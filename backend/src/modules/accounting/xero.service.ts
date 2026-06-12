import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { decryptSecret, encryptSecret } from "../../lib/secrets.js";
import { toPaginatedResponse } from "../../lib/pagination.js";
import { xeroRetrySchema, xeroSettingsSchema, xeroSyncQuerySchema } from "./xero.schemas.js";

const XERO_SCOPE = "integrations";
const XERO_CONFIG_KEY = "xero.config";
const XERO_TOKEN_KEY = "xero.tokens";
const XERO_STATE_TTL_MS = 10 * 60 * 1000;

interface XeroConfigStored {
  enabled: boolean;
  clientId: string;
  encryptedClientSecret: string;
  redirectUri: string;
  tenantId?: string;
  scopes: string[];
}

interface XeroTokenStored {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  obtainedAt: string;
}

function xeroBaseUrl() {
  return "https://api.xero.com";
}

function xeroAuthBaseUrl() {
  return "https://login.xero.com";
}

async function getXeroConfigStored() {
  const setting = await prisma.setting.findUnique({ where: { scope_key: { scope: XERO_SCOPE, key: XERO_CONFIG_KEY } } });
  if (!setting) return null;
  return setting.value as unknown as XeroConfigStored;
}

async function getXeroTokenStored() {
  const setting = await prisma.setting.findUnique({ where: { scope_key: { scope: XERO_SCOPE, key: XERO_TOKEN_KEY } } });
  if (!setting) return null;
  return setting.value as unknown as XeroTokenStored;
}

function createConnectState() {
  const nonce = crypto.randomUUID();
  const exp = Date.now() + XERO_STATE_TTL_MS;
  return `${nonce}.${exp}`;
}

function assertConnectState(state: string) {
  const [nonce, expRaw] = state.split(".");
  const exp = Number(expRaw);
  if (!nonce || !exp || Date.now() > exp) {
    throw new AppError(400, "Expired or invalid Xero auth state", "XERO_STATE_INVALID");
  }
}

function requireConfig(cfg: XeroConfigStored | null): XeroConfigStored {
  if (!cfg) throw new AppError(400, "Xero config is not set", "XERO_CONFIG_MISSING");
  if (!cfg.enabled) throw new AppError(400, "Xero integration is disabled", "XERO_DISABLED");
  return cfg;
}

function isExpired(expiresAtIso: string) {
  return new Date(expiresAtIso).getTime() <= Date.now() + 30_000;
}

async function tokenRequest(form: URLSearchParams) {
  const response = await fetch(`${xeroAuthBaseUrl()}/identity/connect/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof payload?.error_description === "string" ? payload.error_description : "Xero token exchange failed";
    throw new AppError(400, message, "XERO_TOKEN_EXCHANGE_FAILED", payload);
  }

  return payload as Record<string, unknown>;
}

async function refreshTokenIfNeeded() {
  const config = requireConfig(await getXeroConfigStored());
  const token = await getXeroTokenStored();
  if (!token) throw new AppError(400, "Xero is not connected", "XERO_NOT_CONNECTED");
  if (!isExpired(token.expiresAt)) return token;

  const form = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: decryptSecret(token.refreshToken),
    client_id: config.clientId,
    client_secret: decryptSecret(config.encryptedClientSecret),
  });

  const refreshed = await tokenRequest(form);
  const next: XeroTokenStored = {
    accessToken: encryptSecret(String(refreshed.access_token ?? "")),
    refreshToken: encryptSecret(String(refreshed.refresh_token ?? "")),
    expiresAt: new Date(Date.now() + Number(refreshed.expires_in ?? 1800) * 1000).toISOString(),
    obtainedAt: new Date().toISOString(),
  };

  await prisma.setting.upsert({
    where: { scope_key: { scope: XERO_SCOPE, key: XERO_TOKEN_KEY } },
    update: { value: next as unknown as Prisma.InputJsonValue },
    create: { scope: XERO_SCOPE, key: XERO_TOKEN_KEY, value: next as unknown as Prisma.InputJsonValue },
  });

  return next;
}

async function xeroApiRequest(path: string, init: RequestInit = {}) {
  const config = requireConfig(await getXeroConfigStored());
  const token = await refreshTokenIfNeeded();

  const response = await fetch(`${xeroBaseUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${decryptSecret(token.accessToken)}`,
      "xero-tenant-id": config.tenantId ?? "",
      ...(init.headers ?? {}),
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new AppError(400, "Xero API request failed", "XERO_API_ERROR", payload);
  }
  return payload as Record<string, unknown>;
}

async function writeSyncRecord(input: {
  entityType: "CUSTOMER" | "ORDER" | "INVOICE" | "REFUND" | "PAYMENT";
  entityId: string;
  action: string;
  status: "PENDING" | "SUCCESS" | "FAILED";
  externalId?: string;
  payload?: Record<string, unknown>;
  lastError?: string;
  attempts?: number;
}) {
  const latest = await prisma.accountingSyncRecord.findFirst({
    where: { provider: "xero", entityType: input.entityType, entityId: input.entityId, action: input.action },
    orderBy: { createdAt: "desc" },
  });

  return prisma.accountingSyncRecord.create({
    data: {
      provider: "xero",
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      status: input.status,
      externalId: input.externalId,
      payload: input.payload as Prisma.InputJsonValue | undefined,
      lastError: input.lastError,
      attempts: (latest?.attempts ?? 0) + (input.attempts ?? 1),
      lastSyncedAt: input.status === "SUCCESS" ? new Date() : undefined,
      nextRetryAt: input.status === "FAILED" ? new Date(Date.now() + 5 * 60 * 1000) : undefined,
    },
  });
}

// Look up existing Xero ContactID for a customer, or return null
async function findXeroContactId(customerId: string): Promise<string | null> {
  const record = await prisma.accountingSyncRecord.findFirst({
    where: { provider: "xero", entityType: "CUSTOMER", entityId: customerId, action: "sync_contact", status: "SUCCESS" },
    orderBy: { createdAt: "desc" },
  });
  return record?.externalId ?? null;
}

// Look up existing Xero InvoiceID for an order, or return null
async function findXeroInvoiceId(orderId: string): Promise<string | null> {
  const record = await prisma.accountingSyncRecord.findFirst({
    where: { provider: "xero", entityType: "ORDER", entityId: orderId, action: "sync_invoice", status: "SUCCESS" },
    orderBy: { createdAt: "desc" },
  });
  return record?.externalId ?? null;
}

export async function getXeroSettings() {
  const cfg = await getXeroConfigStored();
  const token = await getXeroTokenStored();

  return {
    enabled: cfg?.enabled ?? false,
    clientId: cfg?.clientId ?? "",
    clientSecretConfigured: Boolean(cfg?.encryptedClientSecret),
    redirectUri: cfg?.redirectUri ?? "",
    tenantId: cfg?.tenantId ?? "",
    scopes: cfg?.scopes ?? ["openid", "profile", "email", "offline_access", "accounting.contacts", "accounting.transactions", "accounting.settings.read"],
    connectionStatus: token ? (isExpired(token.expiresAt) ? "expired" : "connected") : "disconnected",
    tokenExpiresAt: token?.expiresAt ?? null,
  };
}

export async function upsertXeroSettings(rawBody: unknown) {
  const body = xeroSettingsSchema.parse(rawBody);
  const existing = await getXeroConfigStored();

  const next: XeroConfigStored = {
    enabled: body.enabled,
    clientId: body.clientId,
    encryptedClientSecret: body.clientSecret ? encryptSecret(body.clientSecret) : (existing?.encryptedClientSecret ?? ""),
    redirectUri: body.redirectUri,
    tenantId: body.tenantId,
    scopes: body.scopes,
  };

  if (!next.encryptedClientSecret) {
    throw new AppError(400, "Xero client secret is required", "XERO_SECRET_REQUIRED");
  }

  await prisma.setting.upsert({
    where: { scope_key: { scope: XERO_SCOPE, key: XERO_CONFIG_KEY } },
    update: { value: next as unknown as Prisma.InputJsonValue },
    create: { scope: XERO_SCOPE, key: XERO_CONFIG_KEY, value: next as unknown as Prisma.InputJsonValue },
  });

  return getXeroSettings();
}

export async function getXeroConnectUrl() {
  const config = requireConfig(await getXeroConfigStored());
  const state = createConnectState();

  const url = new URL(`${xeroAuthBaseUrl()}/identity/connect/authorize`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("scope", config.scopes.join(" "));
  url.searchParams.set("state", state);

  return { url: url.toString(), state };
}

export async function handleXeroCallback(code: string, state: string) {
  assertConnectState(state);
  const config = requireConfig(await getXeroConfigStored());

  const form = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: config.redirectUri,
    client_id: config.clientId,
    client_secret: decryptSecret(config.encryptedClientSecret),
  });

  const exchanged = await tokenRequest(form);
  const tokens: XeroTokenStored = {
    accessToken: encryptSecret(String(exchanged.access_token ?? "")),
    refreshToken: encryptSecret(String(exchanged.refresh_token ?? "")),
    expiresAt: new Date(Date.now() + Number(exchanged.expires_in ?? 1800) * 1000).toISOString(),
    obtainedAt: new Date().toISOString(),
  };

  await prisma.setting.upsert({
    where: { scope_key: { scope: XERO_SCOPE, key: XERO_TOKEN_KEY } },
    update: { value: tokens as unknown as Prisma.InputJsonValue },
    create: { scope: XERO_SCOPE, key: XERO_TOKEN_KEY, value: tokens as unknown as Prisma.InputJsonValue },
  });

  // Auto-discover and save tenantId if not already set
  try {
    const tenants = await discoverXeroTenants();
    if (tenants.length > 0 && !config.tenantId) {
      const updatedConfig: XeroConfigStored = { ...config, tenantId: tenants[0].tenantId };
      await prisma.setting.upsert({
        where: { scope_key: { scope: XERO_SCOPE, key: XERO_CONFIG_KEY } },
        update: { value: updatedConfig as unknown as Prisma.InputJsonValue },
        create: { scope: XERO_SCOPE, key: XERO_CONFIG_KEY, value: updatedConfig as unknown as Prisma.InputJsonValue },
      });
    }
  } catch {
    // Non-fatal — tenant can be set manually
  }

  return { connected: true, expiresAt: tokens.expiresAt };
}

export async function discoverXeroTenants() {
  // Uses the identity API, not the accounting API — no tenant header needed
  const token = await refreshTokenIfNeeded();

  const response = await fetch(`${xeroBaseUrl()}/connections`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${decryptSecret(token.accessToken)}`,
    },
  });

  const payload = await response.json().catch(() => []);
  if (!response.ok) {
    throw new AppError(400, "Failed to discover Xero tenants", "XERO_TENANTS_FAILED", payload);
  }

  return (payload as Array<{ tenantId: string; tenantName: string; tenantType: string }>).map((t) => ({
    tenantId: t.tenantId,
    tenantName: t.tenantName,
    tenantType: t.tenantType,
  }));
}

export async function syncCustomerToXero(customerId: string) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: { addresses: { where: { isDefaultBilling: true }, take: 1 } },
  });
  if (!customer) throw new AppError(404, "Customer not found", "CUSTOMER_NOT_FOUND");

  const billingAddress = customer.addresses[0];
  const fullName = [customer.firstName, customer.lastName].filter(Boolean).join(" ") || customer.email;

  // Check if contact already exists in Xero — use PUT to upsert by AccountNumber
  const existingXeroId = await findXeroContactId(customerId);

  const contactPayload: Record<string, unknown> = {
    Name: fullName,
    FirstName: customer.firstName ?? undefined,
    LastName: customer.lastName ?? undefined,
    EmailAddress: customer.email,
    AccountNumber: customer.id,
    ...(customer.phone ? { Phones: [{ PhoneType: "DEFAULT", PhoneNumber: customer.phone }] } : {}),
    ...(billingAddress
      ? {
          Addresses: [
            {
              AddressType: "POBOX",
              AddressLine1: billingAddress.line1,
              AddressLine2: billingAddress.line2 ?? undefined,
              City: billingAddress.city,
              Region: billingAddress.state ?? undefined,
              PostalCode: billingAddress.postalCode,
              Country: billingAddress.country,
            },
          ],
        }
      : {}),
  };

  if (existingXeroId) {
    contactPayload.ContactID = existingXeroId;
  }

  try {
    const payload = await xeroApiRequest("/api.xro/2.0/Contacts", {
      method: "POST",
      body: JSON.stringify({ Contacts: [contactPayload] }),
    });

    const externalId = String((payload as any)?.Contacts?.[0]?.ContactID ?? existingXeroId ?? "");
    const record = await writeSyncRecord({
      entityType: "CUSTOMER",
      entityId: customer.id,
      action: "sync_contact",
      status: "SUCCESS",
      externalId,
      payload,
    });

    return { synced: true, recordId: record.id, externalId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to sync customer to Xero";
    const record = await writeSyncRecord({
      entityType: "CUSTOMER",
      entityId: customer.id,
      action: "sync_contact",
      status: "FAILED",
      lastError: message,
    });
    throw new AppError(400, message, "XERO_CUSTOMER_SYNC_FAILED", { recordId: record.id });
  }
}

export async function syncOrderInvoiceToXero(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      customer: true,
      items: true,
      shippingAddress: true,
      billingAddress: true,
      payments: { where: { status: "PAID" }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!order) throw new AppError(404, "Order not found", "ORDER_NOT_FOUND");

  // Resolve Xero ContactID — prefer existing sync record, fall back to email lookup
  let xeroContactId: string | undefined;
  if (order.customerId) {
    xeroContactId = (await findXeroContactId(order.customerId)) ?? undefined;
  }

  const contactRef = xeroContactId
    ? { ContactID: xeroContactId }
    : { Name: order.customer?.email ?? `guest-${order.id}`, EmailAddress: order.customer?.email };

  const lineItems: Record<string, unknown>[] = order.items.map((item) => ({
    Description: [item.productName, item.variantTitle].filter(Boolean).join(" — "),
    Quantity: item.quantity,
    UnitAmount: Number(item.unitPrice),
    AccountCode: "200",
    ...(item.sku ? { ItemCode: item.sku } : {}),
    ...(Number(item.salePrice) > 0 && Number(item.salePrice) < Number(item.unitPrice)
      ? { DiscountAmount: Number(item.unitPrice) - Number(item.salePrice) }
      : {}),
  }));

  // Shipping as a separate line item
  if (Number(order.shippingAmount) > 0) {
    lineItems.push({
      Description: "Shipping",
      Quantity: 1,
      UnitAmount: Number(order.shippingAmount),
      AccountCode: "200",
    });
  }

  // Order-level discount as a negative line item
  if (Number(order.discountAmount) > 0) {
    lineItems.push({
      Description: "Discount",
      Quantity: 1,
      UnitAmount: -Number(order.discountAmount),
      AccountCode: "200",
    });
  }

  const existingInvoiceId = await findXeroInvoiceId(orderId);
  const invoicePayload: Record<string, unknown> = {
    Type: "ACCREC",
    Contact: contactRef,
    Date: new Date(order.placedAt).toISOString().slice(0, 10),
    DueDate: new Date(order.placedAt).toISOString().slice(0, 10),
    Reference: order.orderNumber,
    CurrencyCode: order.currency || "ZAR",
    LineItems: lineItems,
    Status: "AUTHORISED",
  };

  if (existingInvoiceId) {
    invoicePayload.InvoiceID = existingInvoiceId;
  }

  try {
    const payload = await xeroApiRequest("/api.xro/2.0/Invoices", {
      method: "POST",
      body: JSON.stringify({ Invoices: [invoicePayload] }),
    });

    const externalId = String((payload as any)?.Invoices?.[0]?.InvoiceID ?? existingInvoiceId ?? "");
    const record = await writeSyncRecord({
      entityType: "ORDER",
      entityId: order.id,
      action: "sync_invoice",
      status: "SUCCESS",
      externalId,
      payload,
    });

    // If the order is paid, record the payment in Xero
    if (order.paymentStatus === "PAID" && externalId) {
      try {
        await recordPaymentInXero(order.id, externalId, {
          amount: Number(order.totalAmount),
          date: order.payments[0]?.processedAt ?? order.placedAt,
          reference: order.orderNumber,
        });
      } catch {
        // Non-fatal — invoice is created; payment recording can be retried
      }
    }

    return { synced: true, recordId: record.id, externalId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to sync order invoice to Xero";
    const record = await writeSyncRecord({
      entityType: "ORDER",
      entityId: order.id,
      action: "sync_invoice",
      status: "FAILED",
      lastError: message,
    });
    throw new AppError(400, message, "XERO_INVOICE_SYNC_FAILED", { recordId: record.id });
  }
}

export async function recordPaymentInXero(
  orderId: string,
  xeroInvoiceId: string,
  opts: { amount: number; date: Date | string; reference?: string }
) {
  try {
    // Xero requires an Account for the payment — use the default Xero bank account (account code 090 or look up by name)
    const payload = await xeroApiRequest("/api.xro/2.0/Payments", {
      method: "POST",
      body: JSON.stringify({
        Payments: [
          {
            Invoice: { InvoiceID: xeroInvoiceId },
            Account: { Code: "090" },
            Date: new Date(opts.date).toISOString().slice(0, 10),
            Amount: opts.amount,
            Reference: opts.reference ?? "",
          },
        ],
      }),
    });

    const externalId = String((payload as any)?.Payments?.[0]?.PaymentID ?? "");
    const record = await writeSyncRecord({
      entityType: "PAYMENT",
      entityId: orderId,
      action: "record_payment",
      status: "SUCCESS",
      externalId,
      payload,
    });

    return { synced: true, recordId: record.id, externalId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to record payment in Xero";
    const record = await writeSyncRecord({
      entityType: "PAYMENT",
      entityId: orderId,
      action: "record_payment",
      status: "FAILED",
      lastError: message,
    });
    throw new AppError(400, message, "XERO_PAYMENT_SYNC_FAILED", { recordId: record.id });
  }
}

export async function syncRefundToXero(refundId: string) {
  const refund = await prisma.refund.findUnique({
    where: { id: refundId },
    include: {
      order: { include: { customer: true } },
    },
  });
  if (!refund) throw new AppError(404, "Refund not found", "REFUND_NOT_FOUND");

  const xeroInvoiceId = await findXeroInvoiceId(refund.orderId);

  let xeroContactId: string | undefined;
  if (refund.order.customerId) {
    xeroContactId = (await findXeroContactId(refund.order.customerId)) ?? undefined;
  }

  const contactRef = xeroContactId
    ? { ContactID: xeroContactId }
    : { Name: refund.order.customer?.email ?? `guest-${refund.orderId}` };

  const creditNotePayload: Record<string, unknown> = {
    Type: "ACCREC",
    Contact: contactRef,
    Date: new Date(refund.processedAt ?? refund.createdAt).toISOString().slice(0, 10),
    Reference: `Refund-${refund.id.slice(0, 8)}`,
    CurrencyCode: refund.order.currency || "ZAR",
    LineItems: [
      {
        Description: refund.reason ?? "Refund",
        Quantity: 1,
        UnitAmount: Number(refund.amount),
        AccountCode: "200",
      },
    ],
    Status: "AUTHORISED",
  };

  try {
    const payload = await xeroApiRequest("/api.xro/2.0/CreditNotes", {
      method: "POST",
      body: JSON.stringify({ CreditNotes: [creditNotePayload] }),
    });

    const creditNoteId = String((payload as any)?.CreditNotes?.[0]?.CreditNoteID ?? "");

    // If we have the original invoice, allocate the credit note against it
    if (xeroInvoiceId && creditNoteId) {
      try {
        await xeroApiRequest(`/api.xro/2.0/CreditNotes/${creditNoteId}/Allocations`, {
          method: "PUT",
          body: JSON.stringify({
            Allocations: [
              {
                Invoice: { InvoiceID: xeroInvoiceId },
                Amount: Number(refund.amount),
                Date: new Date(refund.processedAt ?? refund.createdAt).toISOString().slice(0, 10),
              },
            ],
          }),
        });
      } catch {
        // Non-fatal — credit note created; allocation can be applied manually
      }
    }

    const record = await writeSyncRecord({
      entityType: "REFUND",
      entityId: refund.id,
      action: "sync_credit_note",
      status: "SUCCESS",
      externalId: creditNoteId,
      payload,
    });

    return { synced: true, recordId: record.id, externalId: creditNoteId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to sync refund to Xero";
    const record = await writeSyncRecord({
      entityType: "REFUND",
      entityId: refund.id,
      action: "sync_credit_note",
      status: "FAILED",
      lastError: message,
    });
    throw new AppError(400, message, "XERO_REFUND_SYNC_FAILED", { recordId: record.id });
  }
}

export async function listXeroSyncRecords(rawQuery: unknown) {
  const query = xeroSyncQuerySchema.parse(rawQuery);
  const skip = (query.page - 1) * query.perPage;

  const where = {
    provider: "xero",
    ...(query.status ? { status: query.status } : {}),
    ...(query.entityType ? { entityType: query.entityType } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.accountingSyncRecord.findMany({ where, skip, take: query.perPage, orderBy: { createdAt: "desc" } }),
    prisma.accountingSyncRecord.count({ where }),
  ]);

  return toPaginatedResponse(items, total, {
    page: query.page,
    perPage: query.perPage,
    sortBy: "createdAt",
    sortDir: "desc",
    q: undefined,
  });
}

export async function retryXeroSync(syncRecordId: string, rawBody: unknown) {
  xeroRetrySchema.parse(rawBody);
  const record = await prisma.accountingSyncRecord.findUnique({ where: { id: syncRecordId } });
  if (!record) throw new AppError(404, "Sync record not found", "SYNC_RECORD_NOT_FOUND");

  if (record.entityType === "CUSTOMER") {
    return syncCustomerToXero(record.entityId);
  }

  if (record.entityType === "ORDER" || record.entityType === "INVOICE") {
    return syncOrderInvoiceToXero(record.entityId);
  }

  if (record.entityType === "REFUND") {
    return syncRefundToXero(record.entityId);
  }

  if (record.entityType === "PAYMENT") {
    // Re-sync the parent order's invoice to re-trigger payment recording
    return syncOrderInvoiceToXero(record.entityId);
  }

  throw new AppError(400, "Unsupported sync record entity type", "SYNC_ENTITY_UNSUPPORTED");
}
