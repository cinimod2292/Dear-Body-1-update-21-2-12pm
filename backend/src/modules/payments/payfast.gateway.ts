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
    const value = decodeForm(rawValue);
    pairs.push({ key, value });
  }
  return pairs;
}

function parseRawPayfastSegments(rawBody: string) {
  const parts = rawBody.split("&").filter((part) => part.length > 0);
  return parts.map((part) => {
    const idx = part.indexOf("=");
    const keyRaw = idx >= 0 ? part.slice(0, idx) : part;
    const valueRaw = idx >= 0 ? part.slice(idx + 1) : "";
    const decodeForm = (v: string) => decodeURIComponent(v.replace(/\+/g, "%20"));
    return {
      keyRaw,
      valueRaw,
      keyDecoded: decodeForm(keyRaw),
      valueDecoded: decodeForm(valueRaw),
      original: part,
    };
  });
}

function buildPayfastSourceFromPairs(pairs: Array<{ key: string; value: string }>, passphrase?: string) {
  const entries = pairs.map(({ key, value }) => `${key}=${payfastUrlEncode(value)}`);
  const normalizedPassphrase = normalizePayfastValue(passphrase);
  if (normalizedPassphrase) {
    entries.push(`passphrase=${payfastUrlEncode(normalizedPassphrase)}`);
  }
  return entries.join("&");
}

function redactRawBody(rawBody: string) {
  return rawBody
    .replace(/(^|&)merchant_key=[^&]*/g, "$1merchant_key=[redacted]")
    .replace(/(^|&)signature=[^&]*/g, "$1signature=[redacted]");
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

function maskPassphraseInSource(source: string) {
  return source.replace(/(passphrase=)[^&]*/g, "$1[redacted]");
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

type PayfastMismatchReason =
  | "different field order"
  | "missing/extra field"
  | "decoded-vs-raw encoding mismatch"
  | "passphrase mismatch"
  | "something else";

interface PayfastMismatchAnalysis {
  category: PayfastMismatchReason;
  firstDivergence: string;
  details: Record<string, unknown>;
}

export function diagnosePayfastSignatureMismatch(input: {
  rawBody: string;
  providedSignature: string;
  configPassphrase?: string;
  payload: Record<string, unknown>;
  expectedWithPassphrase: string;
  expectedWithoutPassphrase: string;
  sourceWithPassphrase: string;
  sourceWithoutPassphrase: string;
}) {
  const passphraseConfigured = Boolean(normalizePayfastValue(input.configPassphrase));
  const signatureMatchesWithoutPassphrase = input.expectedWithoutPassphrase.toLowerCase() === input.providedSignature.toLowerCase();
  const signatureMatchesWithPassphrase = input.expectedWithPassphrase.toLowerCase() === input.providedSignature.toLowerCase();
  if (passphraseConfigured && signatureMatchesWithoutPassphrase && !signatureMatchesWithPassphrase) {
    return {
      category: "passphrase mismatch" as const,
      firstDivergence: "Signature only matches canonical source without passphrase.",
      details: {
        passphraseConfigured,
      },
    };
  }

  const segments = parseRawPayfastSegments(input.rawBody);
  const filteredSegments = segments.filter((segment) => segment.keyDecoded !== "signature");
  const payloadKeys = Object.keys(input.payload).filter((key) => key !== "signature");
  const rawKeys = filteredSegments.map((segment) => segment.keyDecoded);
  if (rawKeys.join("\u0000") !== payloadKeys.join("\u0000")) {
    const missingInPayload = rawKeys.filter((key) => !payloadKeys.includes(key));
    const extraInPayload = payloadKeys.filter((key) => !rawKeys.includes(key));
    return {
      category: "missing/extra field" as const,
      firstDivergence: `Key list differs between raw body and parsed payload at position ${Math.min(rawKeys.length, payloadKeys.length)}.`,
      details: {
        rawKeys,
        payloadKeys,
        missingInPayload,
        extraInPayload,
      },
    };
  }

  const rawSourceWithoutSignature = filteredSegments.map((segment) => segment.original).join("&");
  const canonicalWithoutPassphrase = filteredSegments.map((segment) => `${segment.keyDecoded}=${payfastUrlEncode(segment.valueDecoded)}`).join("&");
  if (rawSourceWithoutSignature !== canonicalWithoutPassphrase) {
    const firstIndex = [...rawSourceWithoutSignature].findIndex((char, index) => canonicalWithoutPassphrase[index] !== char);
    return {
      category: "decoded-vs-raw encoding mismatch" as const,
      firstDivergence: firstIndex >= 0
        ? `Canonicalized source diverges from raw source at character index ${firstIndex}.`
        : "Canonicalized source and raw source differ in length.",
      details: {
        rawSourceWithoutSignature,
        canonicalWithoutPassphrase,
      },
    };
  }

  const canonicalOrder = input.sourceWithoutPassphrase.split("&").map((pair) => pair.split("=")[0]);
  if (rawKeys.join("\u0000") !== canonicalOrder.join("\u0000")) {
    return {
      category: "different field order" as const,
      firstDivergence: "Field order changed between raw body and canonical source.",
      details: {
        rawKeys,
        canonicalOrder,
      },
    };
  }

  return {
    category: "something else" as const,
    firstDivergence: "No deterministic mismatch category matched.",
    details: {
      rawSourceWithoutSignature,
      sourceWithoutPassphrase: input.sourceWithoutPassphrase,
      sourceWithPassphrase: maskPassphraseInSource(input.sourceWithPassphrase),
      passphraseConfigured,
      signatureMatchesWithoutPassphrase,
      signatureMatchesWithPassphrase,
    },
  };
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
    const sourceFieldsFromPayload = (() => {
      const stringPayload: Record<string, string | undefined> = {};
      for (const [key, value] of Object.entries(input.payload)) {
        if (Array.isArray(value)) {
          stringPayload[key] = value[0] ? String(value[0]) : undefined;
        } else if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
          stringPayload[key] = String(value);
        }
      }
      return sanitizeFieldMap(stringPayload);
    })();
    const sourceWithoutPassphrase = rawPairs.length > 0
      ? buildPayfastSourceFromPairs(rawPairs)
      : buildPayfastRedirectSource(sourceFieldsFromPayload);
    const sourceWithPassphrase = rawPairs.length > 0
      ? buildPayfastSourceFromPairs(rawPairs, config.webhookSecret)
      : buildPayfastSignatureSource(sourceFieldsFromPayload, config.webhookSecret);
    const expectedWithoutPassphrase = crypto.createHash("md5").update(sourceWithoutPassphrase).digest("hex");
    const passphraseApplied = Boolean(normalizePayfastValue(config.webhookSecret));
    const source = passphraseApplied ? sourceWithPassphrase : sourceWithoutPassphrase;
    const expected = passphraseApplied
      ? crypto.createHash("md5").update(source).digest("hex")
      : expectedWithoutPassphrase;
    const noPassphraseMatches = expectedWithoutPassphrase.toLowerCase() === signature.toLowerCase();
    const isValid = expected.toLowerCase() === signature.toLowerCase();
    const mismatchAnalysis: PayfastMismatchAnalysis | undefined = isValid
      ? undefined
      : diagnosePayfastSignatureMismatch({
        rawBody: input.rawBody,
        payload: input.payload,
        configPassphrase: config.webhookSecret,
        providedSignature: signature,
        expectedWithPassphrase: crypto.createHash("md5").update(sourceWithPassphrase).digest("hex"),
        expectedWithoutPassphrase,
        sourceWithPassphrase,
        sourceWithoutPassphrase,
      });

    console.info("[payfast] webhook signature verification", {
      method: input.headers[":method"] ?? input.headers["x-http-method-override"] ?? "POST",
      path: input.headers[":path"] ?? input.headers["x-original-uri"] ?? "/payments/payfast/webhook",
      contentType: input.headers["content-type"],
      passphraseApplied,
      noPassphraseMatches,
      rawBody: redactRawBody(input.rawBody),
      parsedPairs: rawPairs.map(({ key, value }) => ({
        key,
        value: key === "merchant_key" ? "[redacted]" : value,
      })),
      verificationSourceWithPassphrase: redactSignatureSource(sourceWithPassphrase),
      verificationSourceWithoutPassphrase: redactSignatureSource(sourceWithoutPassphrase),
      verificationSourceWithPassphraseMaskedOnly: maskPassphraseInSource(sourceWithPassphrase),
      verificationSourceWithoutPassphraseMaskedOnly: sourceWithoutPassphrase,
      signedFieldOrder: sourceWithoutPassphrase.split("&").map((pair) => pair.split("=")[0]),
      providedSignature: signature,
      expectedSignature: expected,
      expectedSignatureWithPassphrase: crypto.createHash("md5").update(sourceWithPassphrase).digest("hex"),
      expectedSignatureWithoutPassphrase: expectedWithoutPassphrase,
      passphraseConfigured: passphraseApplied,
      isValid,
      mismatchAnalysis,
    });

    return {
      isValid,
      referenceId: paymentId,
      externalEventId: eventId,
      status: normalizePayfastStatus(paymentStatus),
      raw: {
        payload: input.payload,
        verificationDiagnostics: {
          passphraseConfigured: passphraseApplied,
          sourceWithPassphrase: redactSignatureSource(sourceWithPassphrase),
          sourceWithoutPassphrase: redactSignatureSource(sourceWithoutPassphrase),
          expectedWithPassphrase: crypto.createHash("md5").update(sourceWithPassphrase).digest("hex"),
          expectedWithoutPassphrase,
          providedSignature: signature,
          mismatchAnalysis,
        },
      },
      reason: isValid
        ? undefined
        : noPassphraseMatches && passphraseApplied
          ? "Invalid PayFast webhook signature (passphrase mismatch likely)"
          : "Invalid PayFast webhook signature",
    };
  }
}
