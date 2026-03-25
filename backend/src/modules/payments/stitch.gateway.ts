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
  return config.mode === "production" ? "https://api.stitch.money" : "https://sandbox.stitch.money";
}

async function stitchRequest(config: GatewayConfig, path: string, init: RequestInit = {}) {
  const baseUrl = resolveBaseUrl(config);
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
      "X-Merchant-Id": config.merchantId,
      ...(init.headers ?? {}),
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const msg = typeof payload?.message === "string" ? payload.message : `Stitch request failed (${response.status})`;
    throw new Error(msg);
  }

  return payload as Record<string, unknown>;
}

function normalizeStatus(status: unknown): "PENDING" | "PAID" | "FAILED" {
  const value = typeof status === "string" ? status.toUpperCase() : "PENDING";
  if (["SUCCESS", "COMPLETED", "PAID"].includes(value)) return "PAID";
  if (["FAILED", "ERROR", "DECLINED", "CANCELLED"].includes(value)) return "FAILED";
  return "PENDING";
}

export class StitchGateway implements PaymentGatewayProvider {
  readonly name = "stitch";

  async initiatePayment(config: GatewayConfig, input: InitiatePaymentInput): Promise<InitiatePaymentResult> {
    const payload = await stitchRequest(config, "/v1/payments", {
      method: "POST",
      body: JSON.stringify({
        amount: input.amount,
        currency: input.currency,
        reference: input.orderNumber,
        metadata: {
          orderId: input.orderId,
          customerEmail: input.customerEmail,
        },
        redirect_url: input.returnUrl ?? config.redirectUrl,
        callback_url: config.callbackUrl,
      }),
    });

    return {
      referenceId: String(payload.reference ?? payload.id ?? input.orderNumber),
      checkoutUrl: typeof payload.checkout_url === "string" ? payload.checkout_url : undefined,
      status: normalizeStatus(payload.status),
      raw: payload,
    };
  }

  async verifyPayment(config: GatewayConfig, referenceId: string): Promise<VerifyPaymentResult> {
    const payload = await stitchRequest(config, `/v1/payments/${encodeURIComponent(referenceId)}`, { method: "GET" });
    return {
      referenceId,
      status: normalizeStatus(payload.status),
      raw: payload,
      externalEventId: typeof payload.event_id === "string" ? payload.event_id : undefined,
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

    return {
      isValid: true,
      referenceId: typeof input.payload.reference === "string" ? input.payload.reference : undefined,
      externalEventId: typeof input.payload.event_id === "string" ? input.payload.event_id : undefined,
      status: normalizeStatus(input.payload.status),
      raw: input.payload,
    };
  }
}
