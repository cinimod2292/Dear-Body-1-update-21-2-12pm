import { Agent } from "undici";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";

const PUDO_API_PROD = "https://api-pudo.co.za";
const PUDO_API_SANDBOX = "https://api-sandbox.pudo.co.za";

// PUDO sandbox custom domain doesn't have a TLS cert covering the hostname —
// it resolves to AWS API Gateway whose cert only covers *.execute-api.af-south-1.amazonaws.com.
const pudoSandboxAgent = new Agent({ connect: { rejectUnauthorized: false } });

export interface PudoSettings {
  enabled: boolean;
  apiKey: string;
  sandbox: boolean;
  accountNumber?: string;
  senderName?: string;
  senderPhone?: string;
  senderEmail?: string;
  senderStreetAddress?: string;
  senderLocalArea?: string;
  senderCity?: string;
  senderPostalCode?: string;
  senderProvince?: string;
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
  serviceLevelCode: string;
  recipientName: string;
  recipientPhone: string;
  recipientEmail?: string;
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
    senderStreetAddress: v.senderStreetAddress ? String(v.senderStreetAddress) : undefined,
    senderLocalArea: v.senderLocalArea ? String(v.senderLocalArea) : undefined,
    senderCity: v.senderCity ? String(v.senderCity) : undefined,
    senderPostalCode: v.senderPostalCode ? String(v.senderPostalCode) : undefined,
    senderProvince: v.senderProvince ? String(v.senderProvince) : undefined,
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
    senderStreetAddress: b.senderStreetAddress ? String(b.senderStreetAddress) : undefined,
    senderLocalArea: b.senderLocalArea ? String(b.senderLocalArea) : undefined,
    senderCity: b.senderCity ? String(b.senderCity) : undefined,
    senderPostalCode: b.senderPostalCode ? String(b.senderPostalCode) : undefined,
    senderProvince: b.senderProvince ? String(b.senderProvince) : undefined,
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
  const sep = path.includes("?") ? "&" : "?";
  const keyPreview = settings.apiKey ? `${settings.apiKey.slice(0, 6)}…(len=${settings.apiKey.length})` : "(empty)";
  const url = `${base}${path}${sep}api_key=${encodeURIComponent(settings.apiKey)}`;
  const logUrl = `${base}${path}${sep}api_key=${keyPreview}`;

  console.log(`[PUDO] → ${method} ${logUrl} | sandbox=${settings.sandbox} | bodyKeys=${body ? Object.keys(body).join(",") : "none"}`);
  if (body) console.log(`[PUDO] request body:`, JSON.stringify(body));

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      // @ts-ignore — undici dispatcher option not in standard RequestInit types
      dispatcher: settings.sandbox ? pudoSandboxAgent : undefined,
    });
  } catch (networkErr: unknown) {
    const msg = networkErr instanceof Error ? networkErr.message : String(networkErr);
    console.error(`[PUDO] network error on ${method} ${logUrl}:`, msg);
    throw new AppError(502, `PUDO network error: ${msg}`, "PUDO_NETWORK_ERROR");
  }

  console.log(`[PUDO] ← ${res.status} ${res.statusText} | content-type=${res.headers.get("content-type")}`);

  if (!res.ok) {
    let rawBody = "";
    try { rawBody = await res.text(); } catch {}
    console.error(`[PUDO] error body:`, rawBody);
    let message = `PUDO API error ${res.status}`;
    try {
      const err = JSON.parse(rawBody) as { message?: string };
      if (err?.message) message = `PUDO: ${err.message}`;
    } catch {}
    throw new AppError(502, message, "PUDO_API_ERROR");
  }

  let parsed: T;
  try {
    parsed = await res.json() as T;
  } catch (parseErr: unknown) {
    const msg = parseErr instanceof Error ? parseErr.message : String(parseErr);
    console.error(`[PUDO] JSON parse error on ${method} ${logUrl}:`, msg);
    throw new AppError(502, `PUDO response parse error: ${msg}`, "PUDO_PARSE_ERROR");
  }

  const preview = JSON.stringify(parsed);
  console.log(`[PUDO] response preview (first 300 chars):`, preview.slice(0, 300));
  return parsed;
}

export async function getPudoLockers(search?: string): Promise<PudoLocker[]> {
  const settings = await getPudoSettings();
  console.log(`[PUDO] getPudoLockers | enabled=${settings.enabled} sandbox=${settings.sandbox} apiKeyLen=${settings.apiKey.length}`);
  if (!settings.enabled || !settings.apiKey) {
    throw new AppError(400, "PUDO integration is not enabled or configured", "PUDO_NOT_CONFIGURED");
  }
  const data = await pudoFetch<unknown[]>("GET", "/lockers-data", settings);
  const raw = Array.isArray(data) ? data : [];
  const mapped: PudoLocker[] = (raw as any[]).map((item) => ({
    lockerCode: String(item.code ?? ""),
    name: String(item.name ?? ""),
    address: String(item.address ?? ""),
    city: String(item.place?.town ?? ""),
    postalCode: item.place?.postalCode ? String(item.place.postalCode) : undefined,
    latitude: item.latitude != null ? parseFloat(String(item.latitude)) : undefined,
    longitude: item.longitude != null ? parseFloat(String(item.longitude)) : undefined,
    businessHours: Array.isArray(item.openinghours)
      ? (item.openinghours as any[])
          .map((h) => `${h.day}: ${h.open_time}–${h.close_time}`)
          .join(", ")
      : undefined,
  }));
  if (!search) return mapped;
  const q = search.toLowerCase();
  return mapped.filter(
    (l) =>
      l.lockerCode.toLowerCase().includes(q) ||
      l.name.toLowerCase().includes(q) ||
      l.address.toLowerCase().includes(q) ||
      l.city.toLowerCase().includes(q),
  );
}

export async function createPudoShipment(input: PudoShipmentInput) {
  const settings = await getPudoSettings();
  if (!settings.enabled || !settings.apiKey) {
    throw new AppError(400, "PUDO integration is not enabled or configured", "PUDO_NOT_CONFIGURED");
  }
  const order = await prisma.order.findUnique({ where: { id: input.orderId } });
  if (!order) throw new AppError(404, "Order not found", "ORDER_NOT_FOUND");

  const payload = {
    collection_address: {
      street_address: settings.senderStreetAddress ?? "",
      local_area: settings.senderLocalArea ?? "",
      city: settings.senderCity ?? "",
      code: settings.senderPostalCode ?? "",
      zone: settings.senderProvince ?? "",
      country: "South Africa",
      type: "business",
    },
    collection_contact: {
      name: settings.senderName ?? "",
      mobile_number: settings.senderPhone ?? "",
      email: settings.senderEmail ?? "",
    },
    // D2L: delivery to a locker identified by terminal_id
    delivery_address: { terminal_id: input.lockerCode },
    delivery_contact: {
      name: input.recipientName,
      mobile_number: input.recipientPhone,
      email: input.recipientEmail ?? "",
    },
    service_level_code: input.serviceLevelCode,
    opt_in_rates: [],
    opt_in_time_based_rates: [],
  };

  const result = await pudoFetch<Record<string, unknown>>("POST", "/shipments", settings, payload);

  const waybill = String(result.custom_tracking_reference ?? "");
  const shipmentId = result.id as number | undefined;
  const base = settings.sandbox ? PUDO_API_SANDBOX : PUDO_API_PROD;
  // generate/waybill uses api_key query param per PUDO docs (not Bearer header)
  const labelUrl = shipmentId
    ? `${base}/generate/waybill/${shipmentId}?api_key=${encodeURIComponent(settings.apiKey)}`
    : undefined;

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
  // Public tracking endpoint — no auth required, identified by custom_tracking_reference
  const base = settings.sandbox ? PUDO_API_SANDBOX : PUDO_API_PROD;
  const url = `${base}/tracking/shipments/public?waybill=${encodeURIComponent(waybillNumber)}`;
  const res = await fetch(url, {
    // @ts-ignore — undici dispatcher option not in standard RequestInit types
    dispatcher: settings.sandbox ? pudoSandboxAgent : undefined,
  });
  if (!res.ok) {
    let rawBody = "";
    try { rawBody = await res.text(); } catch {}
    console.error(`PUDO tracking GET ${url} → ${res.status}`, rawBody);
    throw new AppError(502, `PUDO API error ${res.status}`, "PUDO_API_ERROR");
  }
  return res.json();
}

export async function getPudoRates(lockerCode: string) {
  const settings = await getPudoSettings();
  if (!settings.enabled || !settings.apiKey) {
    throw new AppError(400, "PUDO integration is not enabled or configured", "PUDO_NOT_CONFIGURED");
  }
  const payload = {
    collection_address: {
      street_address: settings.senderStreetAddress ?? "",
      local_area: settings.senderLocalArea ?? "",
      city: settings.senderCity ?? "",
      code: settings.senderPostalCode ?? "",
      zone: settings.senderProvince ?? "",
      country: "South Africa",
      type: "business",
    },
    delivery_address: { terminal_id: lockerCode },
  };
  return pudoFetch<unknown>("POST", "/rates", settings, payload);
}

export async function diagnosePudoApi() {
  const settings = await getPudoSettings();
  const base = settings.sandbox ? PUDO_API_SANDBOX : PUDO_API_PROD;
  const dispatcher = settings.sandbox ? pudoSandboxAgent : undefined;

  const pathsToTry = ["/lockers-data", "/lockers", "/terminals", "/locker"];
  const authMethods = [
    { name: "query_api_key", headers: {}, qs: `?api_key=${encodeURIComponent(settings.apiKey)}` },
    { name: "bearer_header", headers: { Authorization: `Bearer ${settings.apiKey}` }, qs: "" },
  ];

  const results: Record<string, unknown> = {
    settings: { sandbox: settings.sandbox, enabled: settings.enabled, base, apiKeyLen: settings.apiKey.length, apiKeyPreview: settings.apiKey.slice(0, 8) + "…" },
    probes: [] as unknown[],
  };

  for (const auth of authMethods) {
    for (const path of pathsToTry) {
      const url = `${base}${path}${auth.qs}`;
      let status: number | null = null;
      let body = "";
      let error = "";
      try {
        const res = await fetch(url, {
          headers: { Accept: "application/json", ...auth.headers },
          // @ts-ignore
          dispatcher,
        });
        status = res.status;
        body = (await res.text()).slice(0, 200);
      } catch (e: unknown) {
        error = e instanceof Error ? e.message : String(e);
      }
      (results.probes as unknown[]).push({ auth: auth.name, path, status, body, error });
    }
  }

  return results;
}

export async function listPudoShipments() {
  const settings = await getPudoSettings();
  if (!settings.enabled || !settings.apiKey) {
    throw new AppError(400, "PUDO integration is not enabled or configured", "PUDO_NOT_CONFIGURED");
  }
  return pudoFetch<unknown>("GET", "/shipments", settings);
}
