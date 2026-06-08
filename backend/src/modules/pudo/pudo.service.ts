import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";

const PUDO_API_PROD = "https://api-pudo.co.za";
const PUDO_API_SANDBOX = "https://sandbox-api.pudo.co.za";

export interface PudoSettings {
  enabled: boolean;
  apiKey: string;
  sandbox: boolean;
  accountNumber?: string;
  senderName?: string;
  senderPhone?: string;
  senderEmail?: string;
  allowCustomerLockerSelection: boolean;
}

export interface PudoLocker {
  lockerCode: string;
  name: string;
  address: string;
  city: string;
  province?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  businessHours?: string;
}

export interface PudoShipmentInput {
  orderId: string;
  lockerCode: string;
  recipientName: string;
  recipientPhone: string;
  recipientEmail?: string;
  senderName: string;
  senderPhone: string;
  senderEmail?: string;
  weight?: number;
  pieces?: number;
}

export async function getPudoSettings(): Promise<PudoSettings> {
  const setting = await prisma.setting.findUnique({
    where: { scope_key: { scope: "integrations", key: "pudo" } },
  });
  if (!setting) return { enabled: false, apiKey: "", sandbox: true, allowCustomerLockerSelection: false };
  const v = setting.value as Record<string, unknown>;
  return {
    enabled: Boolean(v.enabled),
    apiKey: String(v.apiKey ?? ""),
    sandbox: v.sandbox !== false,
    accountNumber: v.accountNumber ? String(v.accountNumber) : undefined,
    senderName: v.senderName ? String(v.senderName) : undefined,
    senderPhone: v.senderPhone ? String(v.senderPhone) : undefined,
    senderEmail: v.senderEmail ? String(v.senderEmail) : undefined,
    allowCustomerLockerSelection: Boolean(v.allowCustomerLockerSelection),
  };
}

export async function upsertPudoSettings(rawBody: unknown): Promise<PudoSettings> {
  const b = rawBody as Partial<PudoSettings>;
  const value: PudoSettings = {
    enabled: Boolean(b.enabled),
    apiKey: String(b.apiKey ?? ""),
    sandbox: b.sandbox !== false,
    accountNumber: b.accountNumber ? String(b.accountNumber) : undefined,
    senderName: b.senderName ? String(b.senderName) : undefined,
    senderPhone: b.senderPhone ? String(b.senderPhone) : undefined,
    senderEmail: b.senderEmail ? String(b.senderEmail) : undefined,
    allowCustomerLockerSelection: Boolean(b.allowCustomerLockerSelection),
  };
  await prisma.setting.upsert({
    where: { scope_key: { scope: "integrations", key: "pudo" } },
    update: { value: value as any },
    create: { scope: "integrations", key: "pudo", value: value as any },
  });
  return value;
}

async function pudoFetch<T>(method: string, path: string, settings: PudoSettings, body?: object): Promise<T> {
  const base = settings.sandbox ? PUDO_API_SANDBOX : PUDO_API_PROD;
  // PUDO API authenticates via api_key query parameter
  const sep = path.includes("?") ? "&" : "?";
  const url = `${base}${path}${sep}api_key=${encodeURIComponent(settings.apiKey)}`;
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let message = `PUDO API error ${res.status}`;
    try {
      const err = (await res.json()) as { message?: string };
      if (err?.message) message = `PUDO: ${err.message}`;
    } catch {}
    throw new AppError(502, message, "PUDO_API_ERROR");
  }
  return res.json() as Promise<T>;
}

export async function getPudoLockers(search?: string): Promise<PudoLocker[]> {
  const settings = await getPudoSettings();
  if (!settings.enabled || !settings.apiKey) {
    throw new AppError(400, "PUDO integration is not enabled or configured", "PUDO_NOT_CONFIGURED");
  }
  const q = search ? `?search=${encodeURIComponent(search)}` : "";
  const data = await pudoFetch<unknown>("GET", `/lockers${q}`, settings);
  if (Array.isArray(data)) return data as PudoLocker[];
  const d = data as Record<string, unknown>;
  return (Array.isArray(d.lockers) ? d.lockers : Array.isArray(d.data) ? d.data : []) as PudoLocker[];
}

export async function createPudoShipment(input: PudoShipmentInput) {
  const settings = await getPudoSettings();
  if (!settings.enabled || !settings.apiKey) {
    throw new AppError(400, "PUDO integration is not enabled or configured", "PUDO_NOT_CONFIGURED");
  }
  const order = await prisma.order.findUnique({ where: { id: input.orderId } });
  if (!order) throw new AppError(404, "Order not found", "ORDER_NOT_FOUND");

  const payload = {
    locker_code: input.lockerCode,
    sender: {
      name: input.senderName,
      cell: input.senderPhone,
      email: input.senderEmail ?? "",
    },
    recipient: {
      name: input.recipientName,
      cell: input.recipientPhone,
      email: input.recipientEmail ?? "",
    },
    parcel: {
      description: `Order ${order.orderNumber}`,
      pieces: input.pieces ?? 1,
      weight: input.weight ?? 0.5,
    },
    reference: order.orderNumber,
    ...(settings.accountNumber ? { account_number: settings.accountNumber } : {}),
  };

  const result = await pudoFetch<Record<string, unknown>>("POST", "/shipments", settings, payload);

  const waybill = String(result.waybillNumber ?? result.waybill_number ?? "");
  const labelUrl = result.labelUrl ?? result.label_url;

  if (waybill) {
    await prisma.order.update({
      where: { id: input.orderId },
      data: { trackingNumber: waybill, courier: "PUDO - The Courier Guy" },
    });
  }

  return { waybillNumber: waybill, labelUrl };
}

export async function trackPudoShipment(waybillNumber: string) {
  const settings = await getPudoSettings();
  if (!settings.enabled || !settings.apiKey) {
    throw new AppError(400, "PUDO integration is not enabled or configured", "PUDO_NOT_CONFIGURED");
  }
  return pudoFetch<unknown>("GET", `/tracking/shipments?parcel_id=${encodeURIComponent(waybillNumber)}`, settings);
}
