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

const PAYFAST_CHECKOUT_FIELD_ORDER = [
  "merchant_id",
  "merchant_key",
  "return_url",
  "cancel_url",
  "notify_url",
  "name_first",
  "name_last",
  "email_address",
  "cell_number",
  "m_payment_id",
  "amount",
  "item_name",
  "item_description",
  "custom_int1",
  "custom_int2",
  "custom_int3",
  "custom_int4",
  "custom_int5",
  "custom_str1",
  "custom_str2",
  "custom_str3",
  "custom_str4",
  "custom_str5",
  "email_confirmation",
  "confirmation_address",
  "payment_method",
] as const;

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

function payfastUrlEncode(value: string) {
  return encodeURIComponent(value)
    .replace(/[!'()*~]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/%20/g, "+");
}

function normalizeAndOrderFields(fields: Record<string, string | undefined>) {
  const normalized: Record<string, string> = {};

  for (const key of PAYFAST_CHECKOUT_FIELD_ORDER) {
    const value = normalizePayfastValue(fields[key]);
    if (value === undefined) continue;
    normalized[key] = value;
  }

  for (const [key, value] of Object.entries(fields)) {
    if (key in normalized || key === "signature") continue;
    const normalizedValue = normalizePayfastValue(value);
    if (normalizedValue === undefined) continue;
    normalized[key] = normalizedValue;
  }

  return normalized;
}

function toPayfastPairs(fields: Record<string, string | undefined>, passphrase?: string, includePassphrase = true) {
  const ordered = normalizeAndOrderFields(fields);
  const pairs = Object.entries(ordered)
    .map(([key, value]) => `${key}=${payfastUrlEncode(value)}`);

  const normalizedPassphrase = normalizePayfastValue(passphrase);
  if (includePassphrase && normalizedPassphrase) {
    pairs.push(`passphrase=${payfastUrlEncode(normalizedPassphrase)}`);
  }

  return pairs;
}

function parseRawPayfastBody(rawBody: string) {
  const pairs: Array<{ key: string; value: string }> = [];
  for (const part of rawBody.split("&")) {
    if (!part) continue;
    const idx = part.indexOf("=");
    const rawKey = idx >= 0 ? part.slice(0, idx) : part;
    const rawValue = idx >= 0 ? part.slice(idx + 1) : "";
    const decodeForm = (v: string) => decodeURIComponent(v.replace(/\+/g, "%20"));
    const key = decodeForm(rawKey);
    if (key === "signature") continue;
    const value = normalizePayfastValue(decodeForm(rawValue));
    if (value === undefined) continue;
    pairs.push({ key, value });
  }
  return pairs;
}

function buildPayfastSourceFromPairs(pairs: Array<{ key: string; value: string }>, passphrase?: string) {
  const entries = pairs.map(({ key, value }) => `${key}=${payfastUrlEncode(value)}`);
  const normalizedPassphrase = normalizePayfastValue(passphrase);
  if (normalizedPassphrase) {
    entries.push(`passphrase=${payfastUrlEncode(normalizedPassphrase)}`);
  }
  return entries.join("&");
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
  return normalizeAndOrderFields(cleaned);
}

function redactSignatureSource(source: string) {
  return source
    .replace(/(merchant_key=)[^&]+/g, "$1[redacted]")
    .replace(/(passphrase=)[^&]+/g, "$1[redacted]");
}

function redactPayfastUrl(url: string) {
  return url
    .replace(/([?&]merchant_key=)[^&]+/g, "$1[redacted]")
    .replace(/([?&]signature=)[^&]+/g, "$1[redacted]");
}

function redactFieldMap(fields: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => {
      if (key === "merchant_key") return [key, "[redacted]"];
      return [key, value];
    }),
  );
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
    const checkoutUrl = `${payFastBaseCheckoutUrl(config.mode)}?${queryString}`;
    const signedFieldOrder = preHashSource.split("&").map((pair) => pair.split("=")[0]);

    console.info("[payfast] redirect signing diagnostics", {
      mode: config.mode,
      passphraseApplied: Boolean(normalizePayfastValue(config.webhookSecret)),
      signedFieldOrder,
      normalizedOutgoingFields: redactFieldMap(normalizedFields),
      preSignCanonical: redactSignatureSource(preHashSource),
      redirectCanonical: redactSignatureSource(redirectSource),
      redirectUrl: redactPayfastUrl(checkoutUrl),
    });

    return {
      referenceId,
      checkoutUrl,
      status: "PENDING",
      raw: {
        mode: config.mode,
        amount,
        fields: { ...redactFieldMap(normalizedFields), signature: "[redacted]" },
        preHashSource: redactSignatureSource(preHashSource),
        redirectSource: redactSignatureSource(redirectSource),
        signedFieldOrder,
        passphraseApplied: Boolean(normalizePayfastValue(config.webhookSecret)),
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

    const rawPairs = parseRawPayfastBody(input.rawBody);
    const source = rawPairs.length > 0
      ? buildPayfastSourceFromPairs(rawPairs, config.webhookSecret)
      : (() => {
        const stringPayload: Record<string, string | undefined> = {};
        for (const [key, value] of Object.entries(input.payload)) {
          if (Array.isArray(value)) {
            stringPayload[key] = value[0] ? String(value[0]) : undefined;
          } else if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
            stringPayload[key] = String(value);
          }
        }
        return buildPayfastSignatureSource(sanitizeFieldMap(stringPayload), config.webhookSecret);
      })();
    const expected = crypto.createHash("md5").update(source).digest("hex");
    const isValid = expected.toLowerCase() === signature.toLowerCase();

    console.info("[payfast] webhook signature verification", {
      passphraseApplied: Boolean(normalizePayfastValue(config.webhookSecret)),
      verificationSource: redactSignatureSource(source),
      signedFieldOrder: source.split("&").map((pair) => pair.split("=")[0]),
      providedSignature: "[redacted]",
      expectedSignature: "[redacted]",
      isValid,
    });

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
