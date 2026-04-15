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

function payFastBaseCheckoutUrl(mode: GatewayConfig["mode"]) {
  return mode === "production"
    ? "https://www.payfast.co.za/eng/process"
    : "https://sandbox.payfast.co.za/eng/process";
}

function normalizePayfastStatus(status?: string): "PENDING" | "PAID" | "FAILED" {
  const normalized = String(status ?? "").toUpperCase();
  if (normalized === "COMPLETE") return "PAID";
  if (normalized === "FAILED" || normalized === "CANCELLED") return "FAILED";
  return "PENDING";
}

function normalizePayfastValue(value: string | undefined) {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function toPayfastPairs(fields: Record<string, string | undefined>, passphrase?: string, includePassphrase = true) {
  const pairs = Object.entries(fields)
    .filter(([key]) => key !== "signature")
    .map(([key, value]) => [key, normalizePayfastValue(value)] as const)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${encodeURIComponent(value).replace(/%20/g, "+")}`);

  const normalizedPassphrase = normalizePayfastValue(passphrase);
  if (includePassphrase && normalizedPassphrase) {
    pairs.push(`passphrase=${encodeURIComponent(normalizedPassphrase).replace(/%20/g, "+")}`);
  }

  return pairs;
}

export function buildPayfastSignatureSource(fields: Record<string, string | undefined>, passphrase?: string) {
  return toPayfastPairs(fields, passphrase).join("&");
}

export function buildPayfastRedirectSource(fields: Record<string, string | undefined>) {
  return toPayfastPairs(fields, undefined, false).join("&");
}

export function buildPayfastSignature(fields: Record<string, string | undefined>, passphrase?: string) {
  const source = buildPayfastSignatureSource(fields, passphrase);
  return crypto.createHash("md5").update(source).digest("hex");
}

function sanitizeFieldMap(fields: Record<string, string | undefined>) {
  const cleaned: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields)) {
    const normalized = normalizePayfastValue(value);
    if (!normalized) continue;
    cleaned[key] = normalized;
  }
  return cleaned;
}

function redactSignatureSource(source: string) {
  return source.replace(/(merchant_key=)[^&]+/g, "$1[redacted]").replace(/(passphrase=)[^&]+/g, "$1[redacted]");
}


export class PayfastGateway implements PaymentGatewayProvider {
  readonly name = "payfast";

  async initiatePayment(config: GatewayConfig, input: InitiatePaymentInput): Promise<InitiatePaymentResult> {
    const referenceId = `payfast-${input.orderId}-${Date.now()}`;
    const amount = Number(input.amount).toFixed(2);

    const fields: Record<string, string | undefined> = {
      merchant_id: config.merchantId,
      merchant_key: config.apiKey,
      return_url: input.returnUrl ?? config.redirectUrl,
      cancel_url: input.cancelUrl ?? config.redirectUrl,
      notify_url: config.callbackUrl,
      m_payment_id: referenceId,
      amount,
      item_name: `Order ${input.orderNumber}`,
      email_address: input.customerEmail,
      custom_str1: input.orderId,
    };

    const normalizedFields = sanitizeFieldMap(fields);
    const preHashSource = buildPayfastSignatureSource(normalizedFields, config.webhookSecret);
    const redirectSource = buildPayfastRedirectSource(normalizedFields);
    const signature = buildPayfastSignature(normalizedFields, config.webhookSecret);
    const queryString = `${redirectSource}&signature=${signature}`;
    const signedFieldOrder = preHashSource.split("&").map((pair) => pair.split("=")[0]);
    console.info("[payfast] redirect signature source", {
      source: redactSignatureSource(preHashSource),
      signedFieldOrder,
      mode: config.mode,
    });

    return {
      referenceId,
      checkoutUrl: `${payFastBaseCheckoutUrl(config.mode)}?${queryString}`,
      status: "PENDING",
      raw: {
        mode: config.mode,
        amount,
        fields: { ...normalizedFields, signature: "[redacted]" },
        preHashSource: redactSignatureSource(preHashSource),
        signedFieldOrder,
      },
    };
  }

  async verifyPayment(_config: GatewayConfig, referenceId: string): Promise<VerifyPaymentResult> {
    return {
      referenceId,
      status: "PENDING",
      raw: {
        verification: "PayFast manual verification is pending webhook confirmation",
      },
    };
  }

  async verifyWebhook(config: GatewayConfig, input: VerifyWebhookInput): Promise<VerifyWebhookResult> {
    const signature = typeof input.payload.signature === "string" ? input.payload.signature : undefined;
    const paymentId = typeof input.payload.m_payment_id === "string" ? input.payload.m_payment_id : undefined;
    const eventId = typeof input.payload.pf_payment_id === "string" ? input.payload.pf_payment_id : undefined;
    const paymentStatus = typeof input.payload.payment_status === "string" ? input.payload.payment_status : undefined;

    if (!signature || !paymentId) {
      return {
        isValid: false,
        status: "FAILED",
        raw: input.payload,
        reason: "Missing PayFast signature or payment reference",
      };
    }

    const stringPayload: Record<string, string | undefined> = {};
    for (const [key, value] of Object.entries(input.payload)) {
      if (Array.isArray(value)) {
        stringPayload[key] = value[0] ? String(value[0]) : undefined;
      } else if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        stringPayload[key] = String(value);
      }
    }

    const normalizedPayload = sanitizeFieldMap(stringPayload);
    const expected = buildPayfastSignature(normalizedPayload, config.webhookSecret);
    const isValid = expected.toLowerCase() === signature.toLowerCase();

    return {
      isValid,
      referenceId: paymentId,
      externalEventId: eventId,
      status: normalizePayfastStatus(paymentStatus),
      raw: input.payload,
      reason: isValid ? undefined : "Invalid PayFast webhook signature",
    };
  }
}
