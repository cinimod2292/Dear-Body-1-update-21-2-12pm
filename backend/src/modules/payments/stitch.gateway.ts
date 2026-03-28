import { hashBodySignature, safeEqualHex } from "../../lib/secrets.js";
import {
  GatewayConfig,
  InitiatePaymentInput,
  InitiatePaymentResult,
  PaymentGatewayProvider,
  VerifyPaymentResult,
  VerifyWebhookInput,
  VerifyWebhookResult,
} from "./payment-gateway.js";

function resolveBaseUrl(config: GatewayConfig) {
  if (config.apiBaseUrl) return config.apiBaseUrl;
  return "https://express.stitch.money";
}

const TOKEN_TTL_SKEW_MS = 15_000;
let tokenCache: { key: string; accessToken: string; expiresAt: number } | null = null;

function resolveScope() {
  return "payment-links";
}

async function stitchRequest(config: GatewayConfig, path: string, init: RequestInit = {}, accessToken?: string) {
  const baseUrl = resolveBaseUrl(config);
  const requestUrl = `${baseUrl}${path}`;
  const method = init.method ?? "GET";
  const defaultHeaders: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (accessToken) {
    defaultHeaders.Authorization = `Bearer ${accessToken}`;
  }
  const headerNames = [...Object.keys(defaultHeaders), ...Object.keys((init.headers as Record<string, string> | undefined) ?? {})];
  console.info("[stitch] outbound request", { url: requestUrl, method, headerNames: Array.from(new Set(headerNames)) });

  const response = await fetch(requestUrl, {
    ...init,
    headers: {
      ...defaultHeaders,
      ...(init.headers ?? {}),
    },
  });

  const rawText = await response.text();
  let payload: Record<string, unknown> = {};
  try {
    payload = rawText ? JSON.parse(rawText) as Record<string, unknown> : {};
  } catch {
    payload = {};
  }
  if (!response.ok) {
    console.warn("[stitch] non-2xx response", {
      url: requestUrl,
      method,
      status: response.status,
      body: rawText.slice(0, 1000),
    });
    const msg = typeof payload?.message === "string" ? payload.message : `Stitch request failed (${response.status})`;
    throw new Error(msg);
  }

  return payload as Record<string, unknown>;
}

async function getExpressAccessToken(config: GatewayConfig) {
  const baseUrl = resolveBaseUrl(config);
  const scope = resolveScope();
  const cacheKey = `${baseUrl}:${config.merchantId}:${scope}`;
  if (tokenCache && tokenCache.key === cacheKey && tokenCache.expiresAt > (Date.now() + TOKEN_TTL_SKEW_MS)) {
    return tokenCache.accessToken;
  }

  const payload = await stitchRequest(config, "/api/v1/token", {
    method: "POST",
    body: JSON.stringify({
      clientId: config.merchantId,
      clientSecret: config.apiKey,
      scope,
    }),
  });

  const data = (payload.data ?? {}) as Record<string, unknown>;
  const accessToken = typeof data.accessToken === "string" ? data.accessToken : "";
  if (!accessToken) {
    throw new Error("Stitch token response missing data.accessToken");
  }
  const expiresInSeconds = typeof data.expiresIn === "number" ? data.expiresIn : 300;
  tokenCache = {
    key: cacheKey,
    accessToken,
    expiresAt: Date.now() + (expiresInSeconds * 1000),
  };
  return accessToken;
}

function normalizeStatus(status: unknown): "PENDING" | "PAID" | "FAILED" {
  const value = typeof status === "string" ? status.toUpperCase() : "PENDING";
  if (["SUCCESS", "COMPLETED", "PAID"].includes(value)) return "PAID";
  if (["FAILED", "ERROR", "DECLINED", "CANCELLED"].includes(value)) return "FAILED";
  return "PENDING";
}

function normalizeWebhookStatus(status: unknown): "PENDING" | "PAID" | "FAILED" | undefined {
  if (typeof status !== "string") return undefined;
  const value = status.toUpperCase();
  if (["SUCCESS", "COMPLETED", "PAID"].includes(value)) return "PAID";
  if (["FAILED", "ERROR", "DECLINED", "CANCELLED"].includes(value)) return "FAILED";
  if (["PENDING", "PROCESSING", "AWAITING_PAYMENT"].includes(value)) return "PENDING";
  return undefined;
}

function resolveCheckoutUrl(payload: Record<string, unknown>): string | undefined {
  const candidate = payload.checkout_url
    ?? payload.checkoutUrl
    ?? payload.payment_url
    ?? payload.paymentUrl
    ?? payload.redirect_url
    ?? payload.redirectUrl
    ?? payload.url;
  return typeof candidate === "string" && candidate.trim() ? candidate : undefined;
}

export class StitchGateway implements PaymentGatewayProvider {
  readonly name = "stitch";

  async initiatePayment(config: GatewayConfig, input: InitiatePaymentInput): Promise<InitiatePaymentResult> {
    const accessToken = await getExpressAccessToken(config);
    const payload = await stitchRequest(config, "/api/v1/payment-links", {
      method: "POST",
      body: JSON.stringify({
        amount: input.amount,
        merchantReference: input.orderNumber,
        payerName: "Customer",
        payerEmailAddress: input.customerEmail,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      }),
    }, accessToken);

    const payment = ((payload.data ?? {}) as Record<string, unknown>).payment as Record<string, unknown> | undefined;
    let checkoutUrl = resolveCheckoutUrl(payload);
    const hostedLink = payment && typeof payment.link === "string" ? payment.link : undefined;
    if (!checkoutUrl && hostedLink) checkoutUrl = hostedLink;
    if (checkoutUrl && (input.returnUrl ?? config.redirectUrl)) {
      const redirectUrl = input.returnUrl ?? config.redirectUrl;
      const parsed = new URL(checkoutUrl);
      if (!parsed.searchParams.has("redirect_url")) parsed.searchParams.set("redirect_url", redirectUrl!);
      checkoutUrl = parsed.toString();
    }
    const reference = payment && typeof payment.id === "string" ? payment.id : undefined;
    const statusRaw = payment?.status ?? payload.status;

    return {
      referenceId: String(reference ?? payload.reference ?? payload.id ?? input.orderNumber),
      checkoutUrl,
      status: normalizeStatus(statusRaw),
      raw: payload,
    };
  }

  async verifyPayment(config: GatewayConfig, referenceId: string): Promise<VerifyPaymentResult> {
    const accessToken = await getExpressAccessToken(config);
    const payload = await stitchRequest(config, `/api/v1/payment-links/${encodeURIComponent(referenceId)}`, { method: "GET" }, accessToken);
    const payment = ((payload.data ?? {}) as Record<string, unknown>).payment as Record<string, unknown> | undefined;
    return {
      referenceId,
      status: normalizeStatus(payment?.status ?? payload.status),
      raw: payload,
      externalEventId: typeof payment?.id === "string" ? payment.id : undefined,
    };
  }

  async verifyWebhook(config: GatewayConfig, input: VerifyWebhookInput): Promise<VerifyWebhookResult> {
    const expected = input.headers["x-stitch-signature"];
    if (!config.webhookSecret) {
      return {
        isValid: false,
        status: "FAILED",
        raw: input.payload,
        reason: "Missing webhook secret in Stitch configuration",
      };
    }

    if (!expected) {
      return {
        isValid: false,
        status: "FAILED",
        raw: input.payload,
        reason: "Missing stitch signature header",
      };
    }

    const calculated = hashBodySignature(config.webhookSecret, input.rawBody);
    if (!safeEqualHex(calculated, expected)) {
      return {
        isValid: false,
        status: "FAILED",
        raw: input.payload,
        reason: "Invalid stitch webhook signature",
      };
    }

    const normalizedStatus = normalizeWebhookStatus(input.payload.status);
    if (!normalizedStatus) {
      return {
        isValid: false,
        status: "FAILED",
        raw: input.payload,
        reason: "Unsupported stitch webhook status",
      };
    }

    return {
      isValid: true,
      referenceId: typeof input.payload.reference === "string" ? input.payload.reference : undefined,
      externalEventId: typeof input.payload.event_id === "string" ? input.payload.event_id : undefined,
      status: normalizedStatus,
      raw: input.payload,
    };
  }
}
