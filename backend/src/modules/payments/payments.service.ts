import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { decryptSecret, encryptSecret } from "../../lib/secrets.js";
import { toPaginatedResponse } from "../../lib/pagination.js";
import { env } from "../../config/env.js";
import {
  paymentEventsQuerySchema,
  paymentInitiationSchema,
  paymentVerifySchema,
  payfastSettingsSchema,
  stitchSettingsSchema,
} from "./payments.schemas.js";
import { GatewayConfig, PaymentGatewayProvider } from "./payment-gateway.js";
import { PayfastGateway } from "./payfast.gateway.js";
import { StitchGateway } from "./stitch.gateway.js";
import {
  assertAtLeastOneGatewayEnabled,
  EnabledGatewayState,
  resolveGatewayForRequest,
  toStorefrontGatewayLabel,
} from "./payment-settings.js";
import { resolveTemplateByKey } from "../email-templates/email-template.service.js";
import { sendEmail } from "../notifications/notification.service.js";
import { autoCreatePudoShipment } from "../pudo/pudo.service.js";
import { initWarehouseOnPayment } from "../fulfillment/fulfillment.service.js";

const SETTING_SCOPE = "payments";
const STITCH_SETTING_KEY = "stitch";
const PAYFAST_SETTING_KEY = "payfast";

const gateways: Record<string, PaymentGatewayProvider> = {
  stitch: new StitchGateway(),
  payfast: new PayfastGateway(),
};

function isReusableStitchCheckoutUrl(url: string | undefined) {
  if (!url) return false;
  return !url.includes("/pay/");
}

interface StitchStoredConfig {
  enabled: boolean;
  mode: "sandbox" | "production";
  merchantId: string;
  encryptedApiKey: string;
  encryptedWebhookSecret?: string;
  redirectUrl?: string;
  callbackUrl?: string;
  apiBaseUrl?: string;
}


interface PayfastStoredConfig {
  enabled: boolean;
  mode: "sandbox" | "live";
  sandboxMerchantId?: string;
  encryptedSandboxMerchantKey?: string;
  encryptedSandboxPassphrase?: string;
  liveMerchantId?: string;
  encryptedLiveMerchantKey?: string;
  encryptedLivePassphrase?: string;
  returnUrl?: string;
  cancelUrl?: string;
  notifyUrl?: string;
}

const PAYFAST_ITN_PATH = "/payments/payfast/webhook";

function isHttpsOrLocalhost(url: URL) {
  if (url.protocol === "https:") return true;
  if (url.protocol !== "http:") return false;
  return ["localhost", "127.0.0.1"].includes(url.hostname);
}

function resolvePayfastNotifyUrl(storedNotifyUrl?: string) {
  const fromSettings = storedNotifyUrl?.trim() ? storedNotifyUrl.trim() : undefined;
  if (fromSettings) {
    const parsed = new URL(fromSettings);
    if (!isHttpsOrLocalhost(parsed)) {
      throw new AppError(400, "PayFast notify URL must be HTTPS (or localhost HTTP in development)", "PAYFAST_NOTIFY_URL_INVALID");
    }
    return fromSettings;
  }

  if (!env.PUBLIC_BASE_URL) return undefined;
  const base = env.PUBLIC_BASE_URL.replace(/\/+$/, "");
  return `${base}${env.API_PREFIX}${PAYFAST_ITN_PATH}`;
}
function resolveStoredWebhookSecret(storedValue?: string) {
  if (!storedValue) return undefined;
  const decrypted = decryptSecret(storedValue);
  if (decrypted) return decrypted;
  if (!storedValue.includes(":")) return storedValue;
  return undefined;
}

function getGateway(name: string) {
  const gateway = gateways[name];
  if (!gateway) throw new AppError(400, `Unsupported gateway: ${name}`, "PAYMENT_GATEWAY_UNSUPPORTED");
  return gateway;
}

async function getRawGatewaySetting(key: string) {
  const setting = await prisma.setting.findUnique({ where: { scope_key: { scope: SETTING_SCOPE, key } } });
  return (setting?.value ?? {}) as Record<string, unknown>;
}

async function getGatewayEnabledState(): Promise<EnabledGatewayState> {
  const [stitchRaw, payfastRaw] = await Promise.all([
    getRawGatewaySetting(STITCH_SETTING_KEY),
    getRawGatewaySetting(PAYFAST_SETTING_KEY),
  ]);

  return {
    stitch: Boolean(stitchRaw.enabled),
    payfast: Boolean(payfastRaw.enabled),
  };
}

async function writePaymentEventLog(data: {
  gateway: string;
  eventType: string;
  status: string;
  orderId?: string;
  transactionId?: string;
  externalEventId?: string;
  idempotencyKey?: string;
  payload?: Record<string, unknown>;
  error?: string;
}) {
  try {
    return await prisma.paymentEventLog.create({
      data: {
        gateway: data.gateway,
        eventType: data.eventType,
        status: data.status,
        orderId: data.orderId,
        transactionId: data.transactionId,
        externalEventId: data.externalEventId,
        idempotencyKey: data.idempotencyKey,
        payload: data.payload as Prisma.InputJsonValue | undefined,
        error: data.error,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown event log error";
    if (message.includes("Unique constraint failed")) {
      return null;
    }
    throw error;
  }
}

export async function getStitchSettings() {
  const setting = await prisma.setting.findUnique({ where: { scope_key: { scope: SETTING_SCOPE, key: STITCH_SETTING_KEY } } });
  if (!setting) {
    return {
      enabled: false,
      mode: "sandbox" as const,
      merchantId: "",
      apiKeyConfigured: false,
      webhookSecretConfigured: false,
      redirectUrl: "",
      callbackUrl: "",
      apiBaseUrl: "",
    };
  }

  const value = setting.value as unknown as StitchStoredConfig;
  return {
    enabled: Boolean(value.enabled),
    mode: value.mode,
    merchantId: value.merchantId,
    apiKeyConfigured: Boolean(value.encryptedApiKey),
    webhookSecretConfigured: Boolean(value.encryptedWebhookSecret),
    redirectUrl: value.redirectUrl ?? "",
    callbackUrl: value.callbackUrl ?? "",
    apiBaseUrl: value.apiBaseUrl ?? "",
  };
}

export async function upsertStitchSettings(rawBody: unknown) {
  const body = stitchSettingsSchema.parse(rawBody);
  console.info("[payments] stitch settings save request", {
    hasWebhookSecretInPayload: Boolean(body.webhookSecret),
  });

  const existing = await prisma.setting.findUnique({ where: { scope_key: { scope: SETTING_SCOPE, key: STITCH_SETTING_KEY } } });
  const existingValue = (existing?.value ?? {}) as unknown as StitchStoredConfig;

  const next: StitchStoredConfig = {
    enabled: body.enabled,
    mode: body.mode,
    merchantId: body.merchantId,
    encryptedApiKey: body.apiKey ? encryptSecret(body.apiKey) : existingValue.encryptedApiKey,
    encryptedWebhookSecret: body.webhookSecret
      ? encryptSecret(body.webhookSecret)
      : existingValue.encryptedWebhookSecret,
    redirectUrl: body.redirectUrl,
    callbackUrl: body.callbackUrl,
    apiBaseUrl: body.apiBaseUrl,
  };

  if (!next.encryptedApiKey) {
    throw new AppError(400, "Stitch API key is required", "STITCH_API_KEY_REQUIRED");
  }
  const currentState = await getGatewayEnabledState();
  assertAtLeastOneGatewayEnabled({ ...currentState, stitch: next.enabled });

  const saved = await prisma.setting.upsert({
    where: { scope_key: { scope: SETTING_SCOPE, key: STITCH_SETTING_KEY } },
    update: { value: next as unknown as Prisma.InputJsonValue },
    create: { scope: SETTING_SCOPE, key: STITCH_SETTING_KEY, value: next as unknown as Prisma.InputJsonValue },
  });
  console.info("[payments] stitch settings saved", {
    webhookSecretWriteAttempted: Boolean(body.webhookSecret),
    encryptedWebhookSecretPresent: Boolean(next.encryptedWebhookSecret),
    settingId: saved.id,
  });

  return {
    id: saved.id,
    enabled: next.enabled,
    mode: next.mode,
    merchantId: next.merchantId,
    apiKeyConfigured: Boolean(next.encryptedApiKey),
    webhookSecretConfigured: Boolean(next.encryptedWebhookSecret),
    redirectUrl: next.redirectUrl ?? "",
    callbackUrl: next.callbackUrl ?? "",
    apiBaseUrl: next.apiBaseUrl ?? "",
  };
}

export async function getPayfastSettings() {
  const setting = await prisma.setting.findUnique({ where: { scope_key: { scope: SETTING_SCOPE, key: PAYFAST_SETTING_KEY } } });
  if (!setting) {
    return {
      enabled: false,
      mode: "sandbox" as const,
      sandboxMerchantId: "",
      sandboxMerchantKeyConfigured: false,
      sandboxPassphraseConfigured: false,
      liveMerchantId: "",
      liveMerchantKeyConfigured: false,
      livePassphraseConfigured: false,
      returnUrl: "",
      cancelUrl: "",
      notifyUrl: "",
    };
  }

  const value = setting.value as unknown as PayfastStoredConfig;
  return {
    enabled: Boolean(value.enabled),
    mode: value.mode,
    sandboxMerchantId: value.sandboxMerchantId ?? "",
    sandboxMerchantKeyConfigured: Boolean(value.encryptedSandboxMerchantKey),
    sandboxPassphraseConfigured: Boolean(value.encryptedSandboxPassphrase),
    liveMerchantId: value.liveMerchantId ?? "",
    liveMerchantKeyConfigured: Boolean(value.encryptedLiveMerchantKey),
    livePassphraseConfigured: Boolean(value.encryptedLivePassphrase),
    returnUrl: value.returnUrl ?? "",
    cancelUrl: value.cancelUrl ?? "",
    notifyUrl: value.notifyUrl ?? "",
  };
}

export async function upsertPayfastSettings(rawBody: unknown) {
  const body = payfastSettingsSchema.parse(rawBody);
  const existing = await prisma.setting.findUnique({ where: { scope_key: { scope: SETTING_SCOPE, key: PAYFAST_SETTING_KEY } } });
  const existingValue = (existing?.value ?? {}) as unknown as PayfastStoredConfig;

  const next: PayfastStoredConfig = {
    enabled: body.enabled,
    mode: body.mode,
    sandboxMerchantId: body.sandboxMerchantId ?? existingValue.sandboxMerchantId,
    encryptedSandboxMerchantKey: body.sandboxMerchantKey ? encryptSecret(body.sandboxMerchantKey) : existingValue.encryptedSandboxMerchantKey,
    encryptedSandboxPassphrase: body.sandboxPassphrase ? encryptSecret(body.sandboxPassphrase) : existingValue.encryptedSandboxPassphrase,
    liveMerchantId: body.liveMerchantId ?? existingValue.liveMerchantId,
    encryptedLiveMerchantKey: body.liveMerchantKey ? encryptSecret(body.liveMerchantKey) : existingValue.encryptedLiveMerchantKey,
    encryptedLivePassphrase: body.livePassphrase ? encryptSecret(body.livePassphrase) : existingValue.encryptedLivePassphrase,
    returnUrl: body.returnUrl ?? existingValue.returnUrl,
    cancelUrl: body.cancelUrl ?? existingValue.cancelUrl,
    notifyUrl: body.notifyUrl ?? existingValue.notifyUrl,
  };

  if (next.mode === "sandbox") {
    if (!next.sandboxMerchantId || !next.encryptedSandboxMerchantKey) {
      throw new AppError(400, "PayFast sandbox merchant ID and key are required", "PAYFAST_SANDBOX_CREDENTIALS_REQUIRED");
    }
  } else if (!next.liveMerchantId || !next.encryptedLiveMerchantKey) {
    throw new AppError(400, "PayFast live merchant ID and key are required", "PAYFAST_LIVE_CREDENTIALS_REQUIRED");
  }

  const currentState = await getGatewayEnabledState();
  assertAtLeastOneGatewayEnabled({ ...currentState, payfast: next.enabled });

  const saved = await prisma.setting.upsert({
    where: { scope_key: { scope: SETTING_SCOPE, key: PAYFAST_SETTING_KEY } },
    update: { value: next as unknown as Prisma.InputJsonValue },
    create: { scope: SETTING_SCOPE, key: PAYFAST_SETTING_KEY, value: next as unknown as Prisma.InputJsonValue },
  });

  return {
    id: saved.id,
    enabled: next.enabled,
    mode: next.mode,
    sandboxMerchantId: next.sandboxMerchantId ?? "",
    sandboxMerchantKeyConfigured: Boolean(next.encryptedSandboxMerchantKey),
    sandboxPassphraseConfigured: Boolean(next.encryptedSandboxPassphrase),
    liveMerchantId: next.liveMerchantId ?? "",
    liveMerchantKeyConfigured: Boolean(next.encryptedLiveMerchantKey),
    livePassphraseConfigured: Boolean(next.encryptedLivePassphrase),
    returnUrl: next.returnUrl ?? "",
    cancelUrl: next.cancelUrl ?? "",
    notifyUrl: next.notifyUrl ?? "",
  };
}

export async function getPaymentGatewayOptions() {
  const [stitch, payfast] = await Promise.all([getStitchSettings(), getPayfastSettings()]);
  const state: EnabledGatewayState = { stitch: stitch.enabled, payfast: payfast.enabled };
  const enabled = (Object.entries(state).filter(([, enabledValue]) => enabledValue).map(([name]) => name));
  const preferred = resolveGatewayForRequest(state);
  return {
    preferredGateway: preferred,
    enabledGateways: enabled.map((gateway) => ({ id: gateway, label: toStorefrontGatewayLabel(gateway as "stitch" | "payfast") })),
  };
}

async function getStitchGatewayConfig(): Promise<GatewayConfig> {
  const setting = await prisma.setting.findUnique({ where: { scope_key: { scope: SETTING_SCOPE, key: STITCH_SETTING_KEY } } });
  if (!setting) throw new AppError(400, "Stitch is not configured", "STITCH_NOT_CONFIGURED");

  const value = setting.value as unknown as StitchStoredConfig;
  if (!value.enabled) throw new AppError(400, "Stitch is disabled", "STITCH_DISABLED");
  if (value.mode === "production" && !value.encryptedWebhookSecret) {
    throw new AppError(400, "Stitch webhook secret is required in production mode", "STITCH_WEBHOOK_SECRET_REQUIRED");
  }
  const webhookSecret = resolveStoredWebhookSecret(value.encryptedWebhookSecret);
  console.info("[payments] stitch runtime config loaded", {
    encryptedWebhookSecretPresent: Boolean(value.encryptedWebhookSecret),
    decryptedWebhookSecretPresent: Boolean(webhookSecret),
  });

  return {
    mode: value.mode,
    merchantId: value.merchantId,
    apiKey: decryptSecret(value.encryptedApiKey),
    webhookSecret,
    redirectUrl: value.redirectUrl,
    callbackUrl: value.callbackUrl,
    apiBaseUrl: value.apiBaseUrl,
  };
}

async function getPayfastGatewayConfig(): Promise<GatewayConfig> {
  const setting = await prisma.setting.findUnique({ where: { scope_key: { scope: SETTING_SCOPE, key: PAYFAST_SETTING_KEY } } });
  if (!setting) throw new AppError(400, "PayFast is not configured", "PAYFAST_NOT_CONFIGURED");

  const value = setting.value as unknown as PayfastStoredConfig;
  if (!value.enabled) throw new AppError(400, "PayFast is disabled", "PAYFAST_DISABLED");
  const notifyUrl = resolvePayfastNotifyUrl(value.notifyUrl);
  if (!notifyUrl) {
    throw new AppError(
      400,
      "PayFast notify URL is required. Configure notifyUrl in admin settings or set PUBLIC_BASE_URL.",
      "PAYFAST_NOTIFY_URL_REQUIRED",
    );
  }

  if (value.mode === "sandbox") {
    if (!value.sandboxMerchantId || !value.encryptedSandboxMerchantKey) {
      throw new AppError(400, "PayFast sandbox credentials are incomplete", "PAYFAST_SANDBOX_CREDENTIALS_REQUIRED");
    }

    return {
      mode: "sandbox",
      merchantId: value.sandboxMerchantId,
      apiKey: decryptSecret(value.encryptedSandboxMerchantKey),
      webhookSecret: value.encryptedSandboxPassphrase ? decryptSecret(value.encryptedSandboxPassphrase) : undefined,
      redirectUrl: value.returnUrl,
      callbackUrl: notifyUrl,
    };
  }

  if (!value.liveMerchantId || !value.encryptedLiveMerchantKey) {
    throw new AppError(400, "PayFast live credentials are incomplete", "PAYFAST_LIVE_CREDENTIALS_REQUIRED");
  }

  return {
    mode: "production",
    merchantId: value.liveMerchantId,
    apiKey: decryptSecret(value.encryptedLiveMerchantKey),
    webhookSecret: value.encryptedLivePassphrase ? decryptSecret(value.encryptedLivePassphrase) : undefined,
    redirectUrl: value.returnUrl,
    callbackUrl: notifyUrl,
  };
}

async function getGatewayRuntimeConfig(gatewayName: string): Promise<GatewayConfig> {
  if (gatewayName === "stitch") return getStitchGatewayConfig();
  if (gatewayName === "payfast") return getPayfastGatewayConfig();
  throw new AppError(400, `Unsupported gateway: ${gatewayName}`, "PAYMENT_GATEWAY_UNSUPPORTED");
}

async function sendPaymentSuccessEmail(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { customer: true } });
  if (!order?.customer?.email) return;

  const template = await resolveTemplateByKey("payment_confirmation", {
    orderNumber: order.orderNumber,
    amount: `${order.currency} ${Number(order.totalAmount).toFixed(2)}`,
  });

  await sendEmail({
    to: order.customer.email,
    subject: template.subject,
    html: template.htmlBody,
    meta: { templateKey: template.key, orderId: order.id },
  });
}

async function applyPaymentStatus(orderId: string, transactionId: string, status: "PENDING" | "AWAITING_PAYMENT" | "PAID" | "FAILED", details: Record<string, unknown>) {
  const [currentOrder, currentTx] = await Promise.all([
    prisma.order.findUnique({ where: { id: orderId }, select: { paymentStatus: true, status: true } }),
    prisma.paymentTransaction.findUnique({ where: { id: transactionId }, select: { status: true } }),
  ]);
  if (!currentOrder || !currentTx) {
    throw new AppError(404, "Payment transaction not found", "PAYMENT_TX_NOT_FOUND");
  }

  if (currentOrder.paymentStatus === "PAID" && status !== "PAID") {
    return {
      applied: false,
      reason: "downgrade_prevented",
      currentStatus: currentOrder.paymentStatus,
    } as const;
  }

  if (currentTx.status === status && currentOrder.paymentStatus === status) {
    return {
      applied: false,
      reason: "already_applied",
      currentStatus: currentOrder.paymentStatus,
    } as const;
  }

  await prisma.paymentTransaction.update({
    where: { id: transactionId },
    data: {
      status,
      metadata: details as Prisma.InputJsonValue,
      processedAt: new Date(),
      errorMessage: status === "FAILED" ? "Payment marked as failed" : null,
    },
  });

  const orderData =
    status === "PAID"
      ? { paymentStatus: "PAID" as const, status: "PROCESSING" as const }
      : status === "FAILED"
        ? { paymentStatus: "FAILED" as const, status: "PAYMENT_FAILED" as const }
        : { paymentStatus: "AWAITING_PAYMENT" as const, status: "AWAITING_PAYMENT" as const };

  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: orderData,
    select: { id: true, status: true, paymentStatus: true },
  });
  console.info("[payments] applyPaymentStatus persisted order", {
    orderId: updatedOrder.id,
    status: updatedOrder.status,
    paymentStatus: updatedOrder.paymentStatus,
  });
  const becamePaid = status === "PAID" && currentOrder.paymentStatus !== "PAID";
  if (becamePaid) {
    await sendPaymentSuccessEmail(orderId).catch((err) => console.warn("[email] send failed", err));
    autoCreatePudoShipment(orderId).catch((err) => {
      console.error("[payments] autoCreatePudoShipment error for order", orderId, err);
    });
    initWarehouseOnPayment(orderId).catch((err) => {
      console.error("[payments] initWarehouseOnPayment error for order", orderId, err);
    });
  }
  await prisma.orderEvent.create({
    data: {
      orderId,
      eventType: "PAYMENT_STATUS_SYNCED",
      nextValue: status,
      details: details as Prisma.InputJsonValue,
    },
  });

  return {
    applied: true,
    reason: "updated",
    currentStatus: status,
  } as const;
}

export async function initiateOrderPayment(orderId: string, rawBody: unknown, actorId?: string) {
  const paymentInitStartedAt = Date.now();
  const body = paymentInitiationSchema.parse(rawBody);

  // Fetch enabled gateway state and the order in parallel
  const [enabledState, order] = await Promise.all([
    getGatewayEnabledState(),
    prisma.order.findUnique({ where: { id: orderId }, include: { customer: true } }),
  ]);
  if (!order) throw new AppError(404, "Order not found", "ORDER_NOT_FOUND");
  console.info("[checkout-timing] auth/user/cart lookup complete", {
    orderId,
    elapsedMs: Date.now() - paymentInitStartedAt,
  });

  const selectedGateway = resolveGatewayForRequest(enabledState, body.gateway);
  const gateway = getGateway(selectedGateway);

  if (order.paymentStatus === "PAID") {
    throw new AppError(400, "Order is already paid", "ORDER_ALREADY_PAID");
  }
  if (!["AWAITING_PAYMENT", "PAYMENT_FAILED", "PENDING"].includes(order.status)) {
    throw new AppError(400, "Order is not eligible for payment retry", "ORDER_PAYMENT_RETRY_NOT_ALLOWED");
  }

  // Fetch gateway config and latest payment attempt in parallel
  const [config, latestAttempt] = await Promise.all([
    getGatewayRuntimeConfig(selectedGateway),
    prisma.paymentTransaction.findFirst({ where: { orderId: order.id, provider: gateway.name }, orderBy: { createdAt: "desc" } }),
  ]);
  const idempotencyKey = `${gateway.name}:init:${order.id}:${latestAttempt ? latestAttempt.id : "first"}:${body.force ? "force" : "normal"}`;
  const latestCheckoutUrl = (latestAttempt?.metadata as { checkoutUrl?: string } | null)?.checkoutUrl;
  const canReuseCheckoutUrl = gateway.name === "stitch" ? isReusableStitchCheckoutUrl(latestCheckoutUrl) : Boolean(latestCheckoutUrl);
  if (latestCheckoutUrl && !canReuseCheckoutUrl) {
    await writePaymentEventLog({
      gateway: gateway.name,
      eventType: "payment.initiation.checkout_url.rejected",
      status: "IGNORED",
      orderId: order.id,
      transactionId: latestAttempt?.id,
      idempotencyKey,
      payload: { checkoutUrl: latestCheckoutUrl },
      error: "Legacy checkout URL shape rejected for reuse",
    });
  }
  if (!body.force && latestAttempt && canReuseCheckoutUrl && ["PENDING", "AWAITING_PAYMENT"].includes(latestAttempt.status)) {
    console.info("[payments] reusing checkout URL", {
      orderId: order.id,
      transactionId: latestAttempt.id,
      checkoutUrl: latestCheckoutUrl,
    });
    console.info("[checkout-timing] response returned to frontend", {
      orderId: order.id,
      reusedCheckoutUrl: true,
      elapsedMs: Date.now() - paymentInitStartedAt,
    });
    return {
      transactionId: latestAttempt.id,
      status: latestAttempt.status,
      provider: gateway.name,
      referenceId: latestAttempt.referenceId,
      checkoutUrl: latestCheckoutUrl,
      idempotencyKey,
      reused: true,
    };
  }

  const payableAmount = Number(order.totalAmount);
  const subtotalAmount = Number(order.subtotalAmount);
  const shippingAmount = Number(order.shippingAmount);
  const taxAmount = Number(order.taxAmount);
  const discountAmount = Number(order.discountAmount);
  console.info("[payments] order amounts at gateway initiation", {
    orderId: order.id,
    subtotalAmount,
    shippingAmount,
    taxAmount,
    discountAmount,
    totalAmount: payableAmount,
    amountPassedToGatewayMajor: payableAmount,
  });
  console.info("[checkout-timing] Stitch API request start", {
    orderId: order.id,
    elapsedMs: Date.now() - paymentInitStartedAt,
  });

  const result = await gateway.initiatePayment(config, {
    orderId: order.id,
    orderNumber: order.orderNumber,
    amount: payableAmount,
    currency: order.currency,
    returnUrl: body.returnUrl,
    cancelUrl: body.cancelUrl,
    customerEmail: order.customer?.email,
  });
  console.info("[checkout-timing] Stitch API response received", {
    orderId: order.id,
    elapsedMs: Date.now() - paymentInitStartedAt,
  });
  console.info("[payments] fresh checkout URL from gateway", {
    orderId: order.id,
    checkoutUrl: result.checkoutUrl,
    referenceId: result.referenceId,
    notifyUrl: gateway.name === "payfast" ? config.callbackUrl : undefined,
  });

  if (!result.checkoutUrl) {
    await writePaymentEventLog({
      gateway: gateway.name,
      eventType: "payment.initiation.failed",
      status: "FAILED",
      orderId: order.id,
      idempotencyKey,
      payload: result.raw,
      error: `${gateway.name} response missing hosted checkout URL`,
    });
    throw new AppError(502, `${toStorefrontGatewayLabel(selectedGateway)} did not return a hosted checkout URL`, "PAYMENT_CHECKOUT_URL_MISSING");
  }

  let transaction;
  try {
    transaction = await prisma.paymentTransaction.create({
      data: {
        orderId: order.id,
        provider: gateway.name,
        referenceId: result.referenceId,
        amount: order.totalAmount,
        status: result.status === "PENDING" ? "AWAITING_PAYMENT" : result.status,
        metadata: {
          checkoutUrl: result.checkoutUrl,
          raw: result.raw,
        } as Prisma.InputJsonValue,
        idempotencyKey,
        processedAt: new Date(),
      },
    });
  } catch (error) {
    const existingByKey = await prisma.paymentTransaction.findUnique({ where: { idempotencyKey } });
    if (!existingByKey) throw error;
    transaction = existingByKey;
  }

  // These three writes are independent — run them in parallel
  await Promise.all([
    prisma.order.update({
      where: { id: order.id },
      data: {
        stitchReference: gateway.name === "stitch" ? result.referenceId : undefined,
        paymentStatus: "AWAITING_PAYMENT",
        status: "AWAITING_PAYMENT",
      },
    }),
    writePaymentEventLog({
      gateway: gateway.name,
      eventType: "payment.initiated",
      status: result.status === "PENDING" ? "AWAITING_PAYMENT" : result.status,
      orderId: order.id,
      transactionId: transaction.id,
      idempotencyKey,
      payload: result.raw,
    }),
    prisma.orderEvent.create({
      data: {
        orderId: order.id,
        actorId,
        eventType: "PAYMENT_INITIATED",
        nextValue: result.status === "PENDING" ? "AWAITING_PAYMENT" : result.status,
        details: { provider: gateway.name, referenceId: result.referenceId } as Prisma.InputJsonValue,
      },
    }),
  ]);
  console.info("[checkout-timing] response returned to frontend", {
    orderId: order.id,
    reusedCheckoutUrl: false,
    elapsedMs: Date.now() - paymentInitStartedAt,
  });

  return {
    transactionId: transaction.id,
    status: transaction.status,
    provider: transaction.provider,
    referenceId: transaction.referenceId,
    checkoutUrl: (transaction.metadata as { checkoutUrl?: string } | null)?.checkoutUrl,
    idempotencyKey,
    reused: false,
  };
}

export async function verifyOrderPayment(orderId: string, rawBody: unknown) {
  const body = paymentVerifySchema.parse(rawBody);
  const enabledState = await getGatewayEnabledState();
  const selectedGateway = resolveGatewayForRequest(enabledState, body.gateway);
  const gateway = getGateway(selectedGateway);
  const config = await getGatewayRuntimeConfig(selectedGateway);
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new AppError(404, "Order not found", "ORDER_NOT_FOUND");

  const verification = await gateway.verifyPayment(config, body.referenceId);
  const tx = await prisma.paymentTransaction.findFirst({ where: { orderId, referenceId: body.referenceId }, orderBy: { createdAt: "desc" } });
  if (!tx) throw new AppError(404, "Payment transaction not found", "PAYMENT_TX_NOT_FOUND");

  await applyPaymentStatus(orderId, tx.id, verification.status, {
    source: "manual_verify",
    raw: verification.raw,
  });

  await writePaymentEventLog({
    gateway: gateway.name,
    eventType: "payment.verified",
    status: verification.status,
    orderId,
    transactionId: tx.id,
    externalEventId: verification.externalEventId,
    payload: verification.raw,
  });

  return {
    orderId,
    transactionId: tx.id,
    status: verification.status,
    referenceId: verification.referenceId,
  };
}

export async function handleStitchWebhook(headers: Record<string, string | undefined>, body: Record<string, unknown>, rawBody: string) {
  const gateway = getGateway("stitch");
  const config = await getStitchGatewayConfig();
  const payloadData = (body.data ?? {}) as Record<string, unknown>;
  const payment = (payloadData.payment ?? {}) as Record<string, unknown>;
  const topLevelPaymentId = typeof body.id === "string" ? body.id : undefined;
  const topLevelStatus = typeof body.status === "string" ? body.status : undefined;
  const topLevelLinkId = typeof body.linkId === "string" ? body.linkId : undefined;
  const nestedPaymentId = typeof payment.id === "string" ? payment.id : undefined;
  const nestedStatus = typeof payment.status === "string" ? payment.status : undefined;
  const nestedMerchantReference = typeof payment.merchantReference === "string" ? payment.merchantReference : undefined;
  const parsingPath = topLevelPaymentId || topLevelStatus || topLevelLinkId ? "top-level" : "nested";
  console.info("[payments] stitch webhook payload shape", {
    topLevelKeys: Object.keys(body).slice(0, 25),
    dataKeys: Object.keys(payloadData).slice(0, 25),
    paymentKeys: Object.keys(payment).slice(0, 25),
    parsingPath,
  });
  const merchantReference = topLevelLinkId ?? nestedMerchantReference;
  const nestedPaymentStatus = topLevelStatus ?? nestedStatus;
  const paymentId = topLevelPaymentId ?? nestedPaymentId;
  const eventType = typeof body.event_type === "string"
    ? body.event_type
    : typeof body.type === "string"
      ? body.type
      : undefined;
  const normalizedEventType = eventType?.toUpperCase();
  const isSupportedEventType = !eventType || /^payments?\./i.test(eventType) || normalizedEventType === "LINK";
  if (!isSupportedEventType) {
    console.info("[payments] stitch webhook ignored event type", {
      eventType,
      nestedPaymentStatus,
      paymentId,
      merchantReference,
    });
    await writePaymentEventLog({
      gateway: gateway.name,
      eventType: "payment.webhook.ignored",
      status: "IGNORED",
      externalEventId: typeof body.event_id === "string" ? body.event_id : undefined,
      payload: body,
      error: `Unsupported event type: ${eventType}`,
    });

    return {
      ignored: true,
      reason: "unsupported_event_type",
      eventType,
    };
  }
  if (normalizedEventType === "LINK" && !nestedPaymentStatus) {
    console.info("[payments] stitch webhook LINK ignored without payment status", {
      eventType,
      paymentId,
      merchantReference,
    });
    await writePaymentEventLog({
      gateway: gateway.name,
      eventType: "payment.webhook.ignored",
      status: "IGNORED",
      externalEventId: typeof body.event_id === "string" ? body.event_id : undefined,
      payload: body,
      error: "LINK event missing nested payment status",
    });
    return {
      ignored: true,
      reason: "link_event_missing_status",
      eventType,
    };
  }

  const verification = await gateway.verifyWebhook(config, { headers, payload: body, rawBody });
  console.info("[payments] stitch webhook verification", {
    eventType,
    nestedPaymentStatus,
    status: verification.status,
    paymentId,
    merchantReference,
    parsingPath,
    referenceId: verification.referenceId,
    isValid: verification.isValid,
  });

  const ref = verification.referenceId;
  if (!verification.isValid || !ref) {
    await writePaymentEventLog({
      gateway: gateway.name,
      eventType: "payment.webhook.rejected",
      status: "FAILED",
      externalEventId: verification.externalEventId,
      payload: body,
      error: verification.reason ?? "Invalid webhook",
    });

    throw new AppError(401, verification.reason ?? "Invalid Stitch webhook", "STITCH_WEBHOOK_INVALID");
  }

  let transaction = await prisma.paymentTransaction.findFirst({ where: { referenceId: ref, provider: gateway.name }, orderBy: { createdAt: "desc" } });
  console.info("[payments] stitch webhook lookup by reference", {
    referenceId: ref,
    found: Boolean(transaction),
  });
  if (!transaction && merchantReference) {
    const orderByNumber = await prisma.order.findFirst({ where: { orderNumber: merchantReference } });
    if (orderByNumber) {
      transaction = await prisma.paymentTransaction.findFirst({
        where: { orderId: orderByNumber.id, provider: gateway.name },
        orderBy: { createdAt: "desc" },
      });
      console.info("[payments] stitch webhook lookup by merchantReference", {
        merchantReference,
        orderId: orderByNumber.id,
        found: Boolean(transaction),
      });
    } else {
      console.info("[payments] stitch webhook lookup by merchantReference", {
        merchantReference,
        found: false,
      });
    }
  }
  if (!transaction) {
    const orderByReference = await prisma.order.findFirst({ where: { stitchReference: ref } });
    if (orderByReference) {
      const backfillIdempotencyKey = `${gateway.name}:webhook-backfill:${orderByReference.id}:${ref}`;
      try {
        transaction = await prisma.paymentTransaction.create({
          data: {
            orderId: orderByReference.id,
            provider: gateway.name,
            referenceId: ref,
            amount: orderByReference.totalAmount,
            status: "AWAITING_PAYMENT",
            metadata: { source: "webhook_backfill" } as Prisma.InputJsonValue,
            idempotencyKey: backfillIdempotencyKey,
          },
        });
      } catch (error) {
        const existingByKey = await prisma.paymentTransaction.findUnique({ where: { idempotencyKey: backfillIdempotencyKey } });
        if (!existingByKey) throw error;
        transaction = existingByKey;
      }
    }
  }
  if (!transaction) {
    await writePaymentEventLog({
      gateway: gateway.name,
      eventType: "payment.webhook.unmatched",
      status: "FAILED",
      externalEventId: verification.externalEventId,
      payload: body,
      error: "No payment transaction matched reference",
    });
    throw new AppError(404, "Payment transaction not found for webhook reference", "PAYMENT_TX_NOT_FOUND");
  }

  const log = await writePaymentEventLog({
    gateway: gateway.name,
    eventType: "payment.webhook.received",
    status: verification.status,
    orderId: transaction.orderId,
    transactionId: transaction.id,
    externalEventId: verification.externalEventId,
    idempotencyKey: `${gateway.name}:${verification.externalEventId ?? `${ref}:${verification.status}`}`,
    payload: verification.raw,
  });

  if (!log) {
    const reconciled = await applyPaymentStatus(
      transaction.orderId,
      transaction.id,
      transaction.status as "PENDING" | "AWAITING_PAYMENT" | "PAID" | "FAILED",
      {
        source: "webhook_duplicate_reconcile",
        eventId: verification.externalEventId,
      },
    );
    const orderSnapshot = await prisma.order.findUnique({
      where: { id: transaction.orderId },
      select: { status: true, paymentStatus: true },
    });
    console.info("[payments] stitch webhook duplicate reconcile", {
      orderId: transaction.orderId,
      transactionId: transaction.id,
      transactionStatus: transaction.status,
      reconcileApplied: reconciled.applied,
      orderStatus: orderSnapshot?.status,
      orderPaymentStatus: orderSnapshot?.paymentStatus,
    });
    return {
      duplicate: true,
      orderId: transaction.orderId,
      transactionId: transaction.id,
      status: transaction.status,
    };
  }

  const applyResult = await applyPaymentStatus(transaction.orderId, transaction.id, verification.status, {
    source: "webhook",
    eventId: verification.externalEventId,
    raw: verification.raw,
  });
  const orderSnapshot = await prisma.order.findUnique({
    where: { id: transaction.orderId },
    select: { status: true, paymentStatus: true },
  });
  console.info("[payments] stitch webhook post-apply snapshot", {
    orderId: transaction.orderId,
    transactionId: transaction.id,
    verificationStatus: verification.status,
    applyResult: applyResult.reason,
    orderStatus: orderSnapshot?.status,
    orderPaymentStatus: orderSnapshot?.paymentStatus,
  });

  if (!applyResult.applied) {
    console.info("[payments] stitch webhook status skipped", {
      orderId: transaction.orderId,
      transactionId: transaction.id,
      reason: applyResult.reason,
      status: applyResult.currentStatus,
    });
    await writePaymentEventLog({
      gateway: gateway.name,
      eventType: "payment.webhook.noop",
      status: "IGNORED",
      orderId: transaction.orderId,
      transactionId: transaction.id,
      externalEventId: verification.externalEventId,
      idempotencyKey: `${gateway.name}:noop:${verification.externalEventId ?? `${ref}:${verification.status}`}:${applyResult.reason}`,
      payload: verification.raw,
      error: applyResult.reason,
    });

    return {
      duplicate: false,
      noOp: true,
      reason: applyResult.reason,
      orderId: transaction.orderId,
      transactionId: transaction.id,
      status: applyResult.currentStatus,
    };
  }
  console.info("[payments] stitch webhook status applied", {
    orderId: transaction.orderId,
    transactionId: transaction.id,
    status: verification.status,
  });

  return {
    duplicate: false,
    orderId: transaction.orderId,
    transactionId: transaction.id,
    status: verification.status,
  };
}

export async function handlePayfastWebhook(headers: Record<string, string | undefined>, body: Record<string, unknown>, rawBody: string) {
  const gateway = getGateway("payfast");
  const config = await getPayfastGatewayConfig();
  console.info("[payments] payfast webhook inbound", {
    headerNames: Object.keys(headers),
    payloadKeys: Object.keys(body).slice(0, 30),
    hasRawBody: Boolean(rawBody),
    notifyUrl: config.callbackUrl,
  });
  const verification = await gateway.verifyWebhook(config, { headers, payload: body, rawBody });
  const ref = verification.referenceId;
  console.info("[payments] payfast webhook verification", {
    isValid: verification.isValid,
    status: verification.status,
    referenceId: verification.referenceId,
    externalEventId: verification.externalEventId,
    reason: verification.reason,
  });

  if (!verification.isValid || !ref) {
    await writePaymentEventLog({
      gateway: gateway.name,
      eventType: "payment.webhook.rejected",
      status: "FAILED",
      externalEventId: verification.externalEventId,
      payload: body,
      error: verification.reason ?? "Invalid webhook",
    });
    throw new AppError(401, verification.reason ?? "Invalid PayFast webhook", "PAYFAST_WEBHOOK_INVALID");
  }

  const transaction = await prisma.paymentTransaction.findFirst({
    where: { referenceId: ref, provider: gateway.name },
    orderBy: { createdAt: "desc" },
  });
  if (!transaction) {
    await writePaymentEventLog({
      gateway: gateway.name,
      eventType: "payment.webhook.unmatched",
      status: "FAILED",
      externalEventId: verification.externalEventId,
      payload: body,
      error: "No payment transaction matched reference",
    });
    throw new AppError(404, "Payment transaction not found for webhook reference", "PAYMENT_TX_NOT_FOUND");
  }

  const log = await writePaymentEventLog({
    gateway: gateway.name,
    eventType: "payment.webhook.received",
    status: verification.status,
    orderId: transaction.orderId,
    transactionId: transaction.id,
    externalEventId: verification.externalEventId,
    idempotencyKey: `${gateway.name}:${verification.externalEventId ?? `${ref}:${verification.status}`}`,
    payload: verification.raw,
  });

  if (!log) {
    return {
      duplicate: true,
      orderId: transaction.orderId,
      transactionId: transaction.id,
      status: transaction.status,
    };
  }

  const applyResult = await applyPaymentStatus(transaction.orderId, transaction.id, verification.status, {
    source: "webhook",
    eventId: verification.externalEventId,
    raw: verification.raw,
  });
  console.info("[payments] payfast webhook status apply", {
    orderId: transaction.orderId,
    transactionId: transaction.id,
    verificationStatus: verification.status,
    applyResult,
  });

  if (!applyResult.applied) {
    await writePaymentEventLog({
      gateway: gateway.name,
      eventType: "payment.webhook.noop",
      status: "IGNORED",
      orderId: transaction.orderId,
      transactionId: transaction.id,
      externalEventId: verification.externalEventId,
      idempotencyKey: `${gateway.name}:noop:${verification.externalEventId ?? `${ref}:${verification.status}`}:${applyResult.reason}`,
      payload: verification.raw,
      error: applyResult.reason,
    });
    return {
      duplicate: false,
      noOp: true,
      reason: applyResult.reason,
      orderId: transaction.orderId,
      transactionId: transaction.id,
      status: applyResult.currentStatus,
    };
  }

  return {
    duplicate: false,
    orderId: transaction.orderId,
    transactionId: transaction.id,
    status: verification.status,
  };
}

export async function listPaymentEvents(rawQuery: unknown) {
  const query = paymentEventsQuerySchema.parse(rawQuery);
  const skip = (query.page - 1) * query.perPage;

  const where = {
    ...(query.gateway ? { gateway: query.gateway } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.q
      ? {
          OR: [
            { eventType: { contains: query.q, mode: "insensitive" as const } },
            { error: { contains: query.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.paymentEventLog.findMany({
      where,
      skip,
      take: query.perPage,
      orderBy: { createdAt: "desc" },
      include: {
        order: { select: { id: true, orderNumber: true } },
        transaction: { select: { id: true, provider: true, referenceId: true, status: true } },
      },
    }),
    prisma.paymentEventLog.count({ where }),
  ]);

  return toPaginatedResponse(items, total, {
    page: query.page,
    perPage: query.perPage,
    sortBy: "createdAt",
    sortDir: "desc",
    q: query.q,
  });
}
