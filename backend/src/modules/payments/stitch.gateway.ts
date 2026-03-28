import { hashBodySignature, safeEqualHex } from "../../lib/secrets.js";
import crypto from "node:crypto";
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
  return "client_paymentrequest";
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

function parseSvixV1Signatures(header: string) {
  const parts = header.split(/\s+/).flatMap((segment) => segment.split(";")).map((segment) => segment.trim()).filter(Boolean);
  const values: string[] = [];
  for (const part of parts) {
    if (part.startsWith("v1,")) {
      values.push(part.slice(3));
      continue;
    }
    if (part.startsWith("v1=")) {
      values.push(part.slice(3));
      continue;
    }
    const [key, value] = part.split(",", 2);
    if (key === "v1" && value) values.push(value);
  }
  return values;
}

function verifySvixSignature(secret: string, messageId: string, timestamp: string, signatureHeader: string, rawBody: string) {
  const payload = `${messageId}.${timestamp}.${rawBody}`;
  const secretValue = secret.startsWith("whsec_")
    ? secret.slice("whsec_".length)
    : secret;
  const signingKey = secret.startsWith("whsec_")
    ? Buffer.from(secretValue, "base64")
    : Buffer.from(secretValue, "utf8");
  const expected = crypto.createHmac("sha256", signingKey).update(payload).digest("base64");
  const provided = parseSvixV1Signatures(signatureHeader);
  return provided.some((candidate) => {
    const a = Buffer.from(candidate, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  });
}

function toMinorUnits(amount: number) {
  return Math.round(amount * 100);
}

export class StitchGateway implements PaymentGatewayProvider {
  readonly name = "stitch";

  async initiatePayment(config: GatewayConfig, input: InitiatePaymentInput): Promise<InitiatePaymentResult> {
    const accessToken = await getExpressAccessToken(config);
    const amountInMinorUnits = toMinorUnits(input.amount);
    console.info("[stitch] payment-link amount", {
      merchantReference: input.orderNumber,
      amountMajor: input.amount,
      amountMinor: amountInMinorUnits,
    });
    const payload = await stitchRequest(config, "/api/v1/payment-links", {
      method: "POST",
      body: JSON.stringify({
        amount: amountInMinorUnits,
        merchantReference: input.orderNumber,
        payerName: "Customer",
        payerEmailAddress: input.customerEmail,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      }),
    }, accessToken);

    const payment = ((payload.data ?? {}) as Record<string, unknown>).payment as Record<string, unknown> | undefined;
    const hostedLink = payment && typeof payment.link === "string" ? payment.link : undefined;
    const hostedId = payment && typeof payment.id === "string" ? payment.id : undefined;
    console.info("[stitch] payment-link response", {
      responseKeys: Object.keys(payload),
      paymentId: hostedId,
      paymentLink: hostedLink,
    });
    let checkoutUrl = hostedLink;
    if (checkoutUrl && (input.returnUrl ?? config.redirectUrl)) {
      const redirectUrl = input.returnUrl ?? config.redirectUrl;
      const parsed = new URL(checkoutUrl);
      if (!parsed.searchParams.has("redirect_url")) parsed.searchParams.set("redirect_url", redirectUrl!);
      checkoutUrl = parsed.toString();
    }
    console.info("[stitch] payment-link mapped checkout URL", {
      paymentId: hostedId,
      rawPaymentLink: hostedLink,
      checkoutUrl,
    });
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
    const svixId = input.headers["svix-id"];
    const svixTimestamp = input.headers["svix-timestamp"];
    const svixSignature = input.headers["svix-signature"];
    if (!config.webhookSecret) {
      return {
        isValid: false,
        status: "FAILED",
        raw: input.payload,
        reason: "Missing webhook secret in Stitch configuration",
      };
    }

    if (!expected) {
      if (svixId || svixTimestamp || svixSignature) {
        const hasAllSvixHeaders = Boolean(svixId && svixTimestamp && svixSignature);
        if (!hasAllSvixHeaders) {
          console.info("[stitch] webhook verification", {
            method: "svix",
            svixHeadersPresent: {
              id: Boolean(svixId),
              timestamp: Boolean(svixTimestamp),
              signature: Boolean(svixSignature),
            },
            isValid: false,
          });
          return {
            isValid: false,
            status: "FAILED",
            raw: input.payload,
            reason: "Missing required Svix signature headers",
          };
        }
        const valid = verifySvixSignature(config.webhookSecret, svixId!, svixTimestamp!, svixSignature!, input.rawBody);
        console.info("[stitch] webhook verification", {
          method: "svix",
          svixHeadersPresent: {
            id: Boolean(svixId),
            timestamp: Boolean(svixTimestamp),
            signature: Boolean(svixSignature),
          },
          isValid: valid,
        });
        if (!valid) {
          return {
            isValid: false,
            status: "FAILED",
            raw: input.payload,
            reason: "Invalid Svix webhook signature",
          };
        }
      } else {
        return {
          isValid: false,
          status: "FAILED",
          raw: input.payload,
          reason: "Missing stitch signature header",
        };
      }
    }

    if (expected) {
      const calculated = hashBodySignature(config.webhookSecret, input.rawBody);
      const stitchValid = safeEqualHex(calculated, expected);
      console.info("[stitch] webhook verification", {
        method: "x-stitch-signature",
        svixHeadersPresent: {
          id: Boolean(svixId),
          timestamp: Boolean(svixTimestamp),
          signature: Boolean(svixSignature),
        },
        isValid: stitchValid,
      });
      if (!stitchValid) {
        return {
          isValid: false,
          status: "FAILED",
          raw: input.payload,
          reason: "Invalid stitch webhook signature",
        };
      }
    }

    const payloadData = (input.payload.data ?? {}) as Record<string, unknown>;
    const payment = (payloadData.payment ?? {}) as Record<string, unknown>;
    const topLevelStatus = typeof input.payload.status === "string" ? input.payload.status : undefined;
    const nestedStatus = typeof payment.status === "string" ? payment.status : undefined;
    const statusValue = topLevelStatus ?? nestedStatus;
    const normalizedStatus = normalizeWebhookStatus(statusValue);
    if (!normalizedStatus) {
      return {
        isValid: false,
        status: "FAILED",
        raw: input.payload,
        reason: "Unsupported stitch webhook status",
      };
    }

    const paymentId = typeof input.payload.id === "string"
      ? input.payload.id
      : typeof payment.id === "string"
        ? payment.id
        : undefined;
    const merchantReference = typeof input.payload.linkId === "string"
      ? input.payload.linkId
      : typeof payment.merchantReference === "string"
        ? payment.merchantReference
        : undefined;

    return {
      isValid: true,
      referenceId: paymentId ?? merchantReference,
      externalEventId: typeof input.payload.event_id === "string" ? input.payload.event_id : paymentId,
      status: normalizedStatus,
      raw: input.payload,
    };
  }
}
