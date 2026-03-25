import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { decryptSecret, encryptSecret } from "../../lib/secrets.js";
import { toPaginatedResponse } from "../../lib/pagination.js";
import {
  paymentEventsQuerySchema,
  paymentInitiationSchema,
  paymentVerifySchema,
  stitchSettingsSchema,
} from "./payments.schemas.js";
import { GatewayConfig, PaymentGatewayProvider } from "./payment-gateway.js";
import { StitchGateway } from "./stitch.gateway.js";
import { resolveTemplateByKey } from "../email-templates/email-template.service.js";
import { sendEmail } from "../notifications/notification.service.js";

const STITCH_SETTING_SCOPE = "payments";
const STITCH_SETTING_KEY = "stitch";

const gateways: Record<string, PaymentGatewayProvider> = {
  stitch: new StitchGateway(),
};

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

function getGateway(name: string) {
  const gateway = gateways[name];
  if (!gateway) throw new AppError(400, `Unsupported gateway: ${name}`, "PAYMENT_GATEWAY_UNSUPPORTED");
  return gateway;
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
  const setting = await prisma.setting.findUnique({ where: { scope_key: { scope: STITCH_SETTING_SCOPE, key: STITCH_SETTING_KEY } } });
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

  const existing = await prisma.setting.findUnique({ where: { scope_key: { scope: STITCH_SETTING_SCOPE, key: STITCH_SETTING_KEY } } });
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

  const saved = await prisma.setting.upsert({
    where: { scope_key: { scope: STITCH_SETTING_SCOPE, key: STITCH_SETTING_KEY } },
    update: { value: next as unknown as Prisma.InputJsonValue },
    create: { scope: STITCH_SETTING_SCOPE, key: STITCH_SETTING_KEY, value: next as unknown as Prisma.InputJsonValue },
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

async function getStitchGatewayConfig(): Promise<GatewayConfig> {
  const setting = await prisma.setting.findUnique({ where: { scope_key: { scope: STITCH_SETTING_SCOPE, key: STITCH_SETTING_KEY } } });
  if (!setting) throw new AppError(400, "Stitch is not configured", "STITCH_NOT_CONFIGURED");

  const value = setting.value as unknown as StitchStoredConfig;
  if (!value.enabled) throw new AppError(400, "Stitch is disabled", "STITCH_DISABLED");

  return {
    mode: value.mode,
    merchantId: value.merchantId,
    apiKey: decryptSecret(value.encryptedApiKey),
    webhookSecret: value.encryptedWebhookSecret ? decryptSecret(value.encryptedWebhookSecret) : undefined,
    redirectUrl: value.redirectUrl,
    callbackUrl: value.callbackUrl,
    apiBaseUrl: value.apiBaseUrl,
  };
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
      ? { paymentStatus: "PAID" as const, status: "PAID" as const }
      : status === "FAILED"
        ? { paymentStatus: "FAILED" as const, status: "PAYMENT_FAILED" as const }
        : { paymentStatus: "AWAITING_PAYMENT" as const, status: "AWAITING_PAYMENT" as const };

  await prisma.order.update({ where: { id: orderId }, data: orderData });
  if (status === "PAID") {
    await sendPaymentSuccessEmail(orderId);
  }
  await prisma.orderEvent.create({
    data: {
      orderId,
      eventType: "PAYMENT_STATUS_SYNCED",
      nextValue: status,
      details: details as Prisma.InputJsonValue,
    },
  });
}

export async function initiateOrderPayment(orderId: string, rawBody: unknown, actorId?: string) {
  const body = paymentInitiationSchema.parse(rawBody);
  const gateway = getGateway(body.gateway);
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { customer: true } });
  if (!order) throw new AppError(404, "Order not found", "ORDER_NOT_FOUND");

  const config = await getStitchGatewayConfig();
  if (order.paymentStatus === "PAID") {
    throw new AppError(400, "Order is already paid", "ORDER_ALREADY_PAID");
  }
  if (!["AWAITING_PAYMENT", "PAYMENT_FAILED", "PENDING"].includes(order.status)) {
    throw new AppError(400, "Order is not eligible for payment retry", "ORDER_PAYMENT_RETRY_NOT_ALLOWED");
  }

  const latestAttempt = await prisma.paymentTransaction.findFirst({ where: { orderId: order.id, provider: gateway.name }, orderBy: { createdAt: "desc" } });
  const idempotencyKey = `${gateway.name}:init:${order.id}:${latestAttempt ? latestAttempt.id : "first"}:${body.force ? "force" : "normal"}`;
  if (!body.force && latestAttempt && ["PENDING", "AWAITING_PAYMENT"].includes(latestAttempt.status)) {
    return {
      transactionId: latestAttempt.id,
      status: latestAttempt.status,
      referenceId: latestAttempt.referenceId,
      checkoutUrl: (latestAttempt.metadata as { checkoutUrl?: string } | null)?.checkoutUrl,
      idempotencyKey,
      reused: true,
    };
  }

  const result = await gateway.initiatePayment(config, {
    orderId: order.id,
    orderNumber: order.orderNumber,
    amount: Number(order.totalAmount),
    currency: order.currency,
    returnUrl: body.returnUrl,
    cancelUrl: body.cancelUrl,
    customerEmail: order.customer?.email,
  });

  const transaction = await prisma.paymentTransaction.create({
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

  await prisma.order.update({ where: { id: order.id }, data: { stitchReference: result.referenceId, paymentStatus: "AWAITING_PAYMENT", status: "AWAITING_PAYMENT" } });

  await writePaymentEventLog({
    gateway: gateway.name,
    eventType: "payment.initiated",
    status: result.status === "PENDING" ? "AWAITING_PAYMENT" : result.status,
    orderId: order.id,
    transactionId: transaction.id,
    idempotencyKey,
    payload: result.raw,
  });

  await prisma.orderEvent.create({
    data: {
      orderId: order.id,
      actorId,
      eventType: "PAYMENT_INITIATED",
      nextValue: result.status === "PENDING" ? "AWAITING_PAYMENT" : result.status,
      details: { provider: gateway.name, referenceId: result.referenceId } as Prisma.InputJsonValue,
    },
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
  const gateway = getGateway(body.gateway);
  const config = await getStitchGatewayConfig();
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
  const verification = await gateway.verifyWebhook(config, { headers, payload: body, rawBody });

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
  if (!transaction) {
    const orderByReference = await prisma.order.findFirst({ where: { stitchReference: ref } });
    if (orderByReference) {
      transaction = await prisma.paymentTransaction.create({
        data: {
          orderId: orderByReference.id,
          provider: gateway.name,
          referenceId: ref,
          amount: orderByReference.totalAmount,
          status: "AWAITING_PAYMENT",
          metadata: { source: "webhook_backfill" } as Prisma.InputJsonValue,
          idempotencyKey: `${gateway.name}:webhook-backfill:${orderByReference.id}:${ref}`,
        },
      });
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
    return {
      duplicate: true,
      orderId: transaction.orderId,
      transactionId: transaction.id,
      status: transaction.status,
    };
  }

  await applyPaymentStatus(transaction.orderId, transaction.id, verification.status, {
    source: "webhook",
    eventId: verification.externalEventId,
    raw: verification.raw,
  });

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
