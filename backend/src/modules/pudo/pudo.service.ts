import { Agent } from "undici";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { resolveTemplateByKey } from "../email-templates/email-template.service.js";
import { sendEmail } from "../notifications/notification.service.js";

const PUDO_API_PROD = "https://api-pudo.co.za";
const PUDO_API_SANDBOX = "https://api-sandbox.pudo.co.za";

// Sandbox custom domain doesn't have a TLS cert covering the custom domain name.
const pudoSandboxAgent = new Agent({ connect: { rejectUnauthorized: false } });

export interface PackageSizeConfig {
  code: string;
  label: string;
  dimensions: string;
  maxWeight: number;
  lockerPrice: number;
  doorPrice: number;
  lockerServiceCode: string;
  doorServiceCode: string;
}

export interface ItemRule {
  minItems: number;
  maxItems: number | null;
  packageCode: string;
}

export interface PudoSettings {
  enabled: boolean;
  apiKey: string;
  sandboxApiKey?: string;
  sandbox: boolean;
  accountNumber?: string;
  senderName?: string;
  senderPhone?: string;
  senderEmail?: string;
  senderUnitAddress?: string;
  senderStreetAddress?: string;
  senderLocalArea?: string;
  senderCity?: string;
  senderPostalCode?: string;
  senderProvince?: string;
  allowCustomerLockerSelection: boolean;
  doorDeliveryEnabled: boolean;
  roundPricing: boolean;
  packageSizes: PackageSizeConfig[];
  itemRules: ItemRule[];
}

const DEFAULT_PACKAGE_SIZES: PackageSizeConfig[] = [
  { code: "XS", label: "XS", dimensions: "60×17×8cm", maxWeight: 2, lockerPrice: 49, doorPrice: 79, lockerServiceCode: "D2L-EXPRESS", doorServiceCode: "D2D-EXPRESS" },
  { code: "S",  label: "S",  dimensions: "60×41×8cm", maxWeight: 5, lockerPrice: 59, doorPrice: 89, lockerServiceCode: "D2L-EXPRESS", doorServiceCode: "D2D-EXPRESS" },
  { code: "M",  label: "M",  dimensions: "60×41×19cm", maxWeight: 10, lockerPrice: 69, doorPrice: 119, lockerServiceCode: "D2L-EXPRESS", doorServiceCode: "D2D-EXPRESS" },
  { code: "L",  label: "L",  dimensions: "60×41×41cm", maxWeight: 15, lockerPrice: 89, doorPrice: 169, lockerServiceCode: "D2L-EXPRESS", doorServiceCode: "D2D-EXPRESS" },
  { code: "XL", label: "XL", dimensions: "60×41×69cm", maxWeight: 20, lockerPrice: 119, doorPrice: 229, lockerServiceCode: "D2L-EXPRESS", doorServiceCode: "D2D-EXPRESS" },
];

const DEFAULT_ITEM_RULES: ItemRule[] = [
  { minItems: 1, maxItems: 3, packageCode: "XS" },
  { minItems: 4, maxItems: 6, packageCode: "S" },
  { minItems: 7, maxItems: 10, packageCode: "M" },
  { minItems: 11, maxItems: 13, packageCode: "L" },
  { minItems: 14, maxItems: null, packageCode: "XL" },
];

function roundToX9(price: number): number {
  const intPrice = Math.ceil(price);
  const mod = intPrice % 10;
  if (mod === 9) return intPrice;
  return intPrice + ((9 - mod + 10) % 10);
}

/** Normalises a South African phone number to +27XXXXXXXXX (international format). */
function normalizeSAPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("27")) return "+" + digits;
  if (digits.length === 10 && digits.startsWith("0")) return "+27" + digits.slice(1);
  if (phone.startsWith("+27")) return phone;
  return phone;
}

/** Parses a dimension string like "60×17×8cm" into [length, width, height] in cm. */
function parseDimensions(dimensions: string): [number, number, number] {
  const parts = dimensions.replace(/cm/gi, "").split(/[×x*]/);
  const nums = parts.map((p) => parseFloat(p.trim())).filter((n) => !isNaN(n));
  return [nums[0] ?? 10, nums[1] ?? 10, nums[2] ?? 10];
}

/** Maps SA province names to PUDO zone codes. */
const PROVINCE_CODES: Record<string, string> = {
  "gauteng": "GP", "western cape": "WC", "eastern cape": "EC",
  "kwazulu-natal": "KZN", "kwazulu natal": "KZN",
  "limpopo": "LP", "mpumalanga": "MP", "north west": "NW",
  "northern cape": "NC", "free state": "FS",
};
function toProvinceCode(province: string): string {
  return PROVINCE_CODES[province.toLowerCase().trim()] ?? province;
}

function buildEnteredAddress(...parts: (string | null | undefined)[]): string {
  return parts.filter(Boolean).join(", ");
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
  /** Locker terminal_id for locker deliveries — omit for door-to-door */
  lockerCode?: string;
  /** Full delivery address for door-to-door; required when lockerCode is absent */
  doorAddress?: {
    streetAddress: string;
    localArea?: string;
    city: string;
    postalCode?: string;
    province?: string;
  };
  serviceLevelCode: string;
  recipientName: string;
  recipientPhone: string;
  recipientEmail?: string;
  parcel?: {
    lengthCm: number;
    widthCm: number;
    heightCm: number;
    weightKg: number;
  };
}

export async function getPudoSettings(): Promise<PudoSettings> {
  const setting = await prisma.setting.findUnique({
    where: { scope_key: { scope: "integrations", key: "pudo" } },
  });
  if (!setting) return {
    enabled: false, apiKey: "", sandbox: true, allowCustomerLockerSelection: false,
    doorDeliveryEnabled: false, roundPricing: true,
    packageSizes: DEFAULT_PACKAGE_SIZES, itemRules: DEFAULT_ITEM_RULES,
  };
  const v = setting.value as Record<string, unknown>;
  return {
    enabled: Boolean(v.enabled),
    apiKey: String(v.apiKey ?? ""),
    sandboxApiKey: v.sandboxApiKey ? String(v.sandboxApiKey) : undefined,
    sandbox: v.sandbox !== false,
    accountNumber: v.accountNumber ? String(v.accountNumber) : undefined,
    senderName: v.senderName ? String(v.senderName) : undefined,
    senderPhone: v.senderPhone ? String(v.senderPhone) : undefined,
    senderEmail: v.senderEmail ? String(v.senderEmail) : undefined,
    senderUnitAddress: v.senderUnitAddress ? String(v.senderUnitAddress) : undefined,
    senderStreetAddress: v.senderStreetAddress ? String(v.senderStreetAddress) : undefined,
    senderLocalArea: v.senderLocalArea ? String(v.senderLocalArea) : undefined,
    senderCity: v.senderCity ? String(v.senderCity) : undefined,
    senderPostalCode: v.senderPostalCode ? String(v.senderPostalCode) : undefined,
    senderProvince: v.senderProvince ? String(v.senderProvince) : undefined,
    allowCustomerLockerSelection: Boolean(v.allowCustomerLockerSelection),
    doorDeliveryEnabled: Boolean(v.doorDeliveryEnabled),
    roundPricing: v.roundPricing !== false,
    packageSizes: Array.isArray(v.packageSizes) && v.packageSizes.length ? v.packageSizes as PackageSizeConfig[] : DEFAULT_PACKAGE_SIZES,
    itemRules: Array.isArray(v.itemRules) && v.itemRules.length ? v.itemRules as ItemRule[] : DEFAULT_ITEM_RULES,
  };
}

export async function upsertPudoSettings(rawBody: unknown): Promise<PudoSettings> {
  const b = rawBody as Partial<PudoSettings>;
  const value: PudoSettings = {
    enabled: Boolean(b.enabled),
    apiKey: String(b.apiKey ?? ""),
    sandboxApiKey: b.sandboxApiKey ? String(b.sandboxApiKey) : undefined,
    sandbox: b.sandbox !== false,
    accountNumber: b.accountNumber ? String(b.accountNumber) : undefined,
    senderName: b.senderName ? String(b.senderName) : undefined,
    senderPhone: b.senderPhone ? String(b.senderPhone) : undefined,
    senderEmail: b.senderEmail ? String(b.senderEmail) : undefined,
    senderUnitAddress: b.senderUnitAddress ? String(b.senderUnitAddress) : undefined,
    senderStreetAddress: b.senderStreetAddress ? String(b.senderStreetAddress) : undefined,
    senderLocalArea: b.senderLocalArea ? String(b.senderLocalArea) : undefined,
    senderCity: b.senderCity ? String(b.senderCity) : undefined,
    senderPostalCode: b.senderPostalCode ? String(b.senderPostalCode) : undefined,
    senderProvince: b.senderProvince ? String(b.senderProvince) : undefined,
    allowCustomerLockerSelection: Boolean(b.allowCustomerLockerSelection),
    doorDeliveryEnabled: Boolean(b.doorDeliveryEnabled),
    roundPricing: b.roundPricing !== false,
    packageSizes: Array.isArray(b.packageSizes) && b.packageSizes.length ? b.packageSizes : DEFAULT_PACKAGE_SIZES,
    itemRules: Array.isArray(b.itemRules) && b.itemRules.length ? b.itemRules : DEFAULT_ITEM_RULES,
  };
  await prisma.setting.upsert({
    where: { scope_key: { scope: "integrations", key: "pudo" } },
    update: { value: value as any },
    create: { scope: "integrations", key: "pudo", value: value as any },
  });
  return value;
}

export async function getPudoShippingOption(itemCount: number) {
  const settings = await getPudoSettings();
  if (!settings.enabled) return { locker: null, door: null };

  const rule = settings.itemRules.find(
    (r) => itemCount >= r.minItems && (r.maxItems === null || itemCount <= r.maxItems),
  );
  if (!rule) return { locker: null, door: null };

  const pkg = settings.packageSizes.find((p) => p.code === rule.packageCode);
  if (!pkg) return { locker: null, door: null };

  const round = (price: number) => settings.roundPricing ? roundToX9(price) : price;

  return {
    locker: settings.allowCustomerLockerSelection ? {
      price: round(pkg.lockerPrice),
      packageCode: pkg.code,
      packageLabel: pkg.label,
      dimensions: pkg.dimensions,
      serviceCode: pkg.lockerServiceCode,
    } : null,
    door: settings.doorDeliveryEnabled ? {
      price: round(pkg.doorPrice),
      packageCode: pkg.code,
      packageLabel: pkg.label,
      dimensions: pkg.dimensions,
      serviceCode: pkg.doorServiceCode,
    } : null,
  };
}

function getEffectiveApiKey(settings: PudoSettings): string {
  return settings.sandbox && settings.sandboxApiKey ? settings.sandboxApiKey : settings.apiKey;
}

// All PUDO API routes live under /api/v1/ and require Bearer token auth.
async function pudoFetch<T>(method: string, path: string, settings: PudoSettings, body?: object): Promise<T> {
  const base = settings.sandbox ? PUDO_API_SANDBOX : PUDO_API_PROD;
  const url = `${base}/api/v1${path}`;
  const apiKey = getEffectiveApiKey(settings);

  console.log(`[PUDO] → ${method} ${url} | sandbox=${settings.sandbox} | bodyKeys=${body ? Object.keys(body).join(",") : "none"}`);
  if (body) console.log(`[PUDO] request body:`, JSON.stringify(body));

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: body ? JSON.stringify(body) : undefined,
      // @ts-ignore — undici dispatcher option not in standard RequestInit types
      dispatcher: settings.sandbox ? pudoSandboxAgent : undefined,
    });
  } catch (networkErr: unknown) {
    const msg = networkErr instanceof Error ? networkErr.message : String(networkErr);
    console.error(`[PUDO] network error on ${method} ${url}:`, msg);
    throw new AppError(502, `PUDO network error: ${msg}`, "PUDO_NETWORK_ERROR");
  }

  console.log(`[PUDO] ← ${res.status} ${res.statusText}`);

  if (!res.ok) {
    let rawBody = "";
    try { rawBody = await res.text(); } catch {}
    console.error(`[PUDO] error body:`, rawBody);
    let message = `PUDO API error ${res.status}`;
    try {
      const err = JSON.parse(rawBody) as { message?: string; errors?: unknown; detail?: unknown; details?: unknown };
      if (err?.message) message = `PUDO: ${err.message}`;
      if (err?.errors) console.error(`[PUDO] validation errors:`, JSON.stringify(err.errors));
      if (err?.detail) console.error(`[PUDO] detail:`, JSON.stringify(err.detail));
      if (err?.details) console.error(`[PUDO] details:`, JSON.stringify(err.details));
    } catch {}
    throw new AppError(502, message, "PUDO_API_ERROR");
  }

  let parsed: T;
  try {
    parsed = await res.json() as T;
  } catch (parseErr: unknown) {
    const msg = parseErr instanceof Error ? parseErr.message : String(parseErr);
    console.error(`[PUDO] JSON parse error:`, msg);
    throw new AppError(502, `PUDO response parse error: ${msg}`, "PUDO_PARSE_ERROR");
  }

  console.log(`[PUDO] response preview:`, JSON.stringify(parsed).slice(0, 300));
  return parsed;
}

export async function getPudoLockers(search?: string): Promise<PudoLocker[]> {
  const settings = await getPudoSettings();
  const effectiveKey = getEffectiveApiKey(settings);
  console.log(`[PUDO] getPudoLockers | enabled=${settings.enabled} sandbox=${settings.sandbox} apiKeyLen=${effectiveKey.length}`);
  if (!settings.enabled || !effectiveKey) {
    throw new AppError(400, "PUDO integration is not enabled or configured", "PUDO_NOT_CONFIGURED");
  }
  const data = await pudoFetch<unknown[]>("GET", "/lockers-data", settings);
  const raw = Array.isArray(data) ? data : [];
  const mapped: PudoLocker[] = (raw as any[]).map((item) => ({
    lockerCode: String(item.code ?? ""),
    name: String(item.name ?? ""),
    // The API returns an `address` field directly (not nested)
    address: String(item.address ?? item.street_address ?? ""),
    // city may be at top-level or nested under place
    city: String(item.town ?? item.city ?? item.place?.town ?? item.place?.city ?? ""),
    province: item.province ?? item.place?.province ?? undefined,
    postalCode: item.postal_code ?? item.postalCode ?? item.place?.postalCode ?? undefined,
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
  if (!settings.enabled || !getEffectiveApiKey(settings)) {
    throw new AppError(400, "PUDO integration is not enabled or configured", "PUDO_NOT_CONFIGURED");
  }
  if (!input.lockerCode && !input.doorAddress) {
    throw new AppError(400, "Either lockerCode (locker delivery) or doorAddress (door delivery) is required", "PUDO_DELIVERY_ADDRESS_REQUIRED");
  }
  const order = await prisma.order.findUnique({ where: { id: input.orderId } });
  if (!order) throw new AppError(404, "Order not found", "ORDER_NOT_FOUND");

  const now = new Date().toISOString();
  const senderStreet = [settings.senderUnitAddress, settings.senderStreetAddress].filter(Boolean).join(", ");
  const senderZone = toProvinceCode(settings.senderProvince ?? "");

  const deliveryAddress = input.lockerCode
    ? { terminal_id: input.lockerCode }
    : {
        street_address: input.doorAddress!.streetAddress,
        local_area: input.doorAddress!.localArea ?? "",
        suburb: input.doorAddress!.localArea ?? "",
        city: input.doorAddress!.city,
        code: input.doorAddress!.postalCode ?? "",
        zone: toProvinceCode(input.doorAddress!.province ?? ""),
        country: "South Africa",
        type: "door",
        entered_address: buildEnteredAddress(
          input.doorAddress!.streetAddress,
          input.doorAddress!.localArea,
          input.doorAddress!.city,
          input.doorAddress!.postalCode,
          "South Africa",
        ),
      };

  const isDoor = !input.lockerCode;

  const payload: Record<string, unknown> = {
    collection_min_date: now,
    collection_address: {
      street_address: senderStreet,
      local_area: settings.senderLocalArea ?? "",
      suburb: settings.senderLocalArea ?? "",
      city: settings.senderCity ?? "",
      code: settings.senderPostalCode ?? "",
      zone: senderZone,
      country: "South Africa",
      type: "residential",
      company: settings.senderName ?? "",
      entered_address: buildEnteredAddress(
        senderStreet,
        settings.senderLocalArea,
        settings.senderCity,
        settings.senderPostalCode,
        "South Africa",
      ),
    },
    collection_contact: {
      name: settings.senderName ?? "",
      mobile_number: normalizeSAPhone(settings.senderPhone ?? ""),
      email: settings.senderEmail ?? "",
    },
    delivery_min_date: now,
    delivery_address: deliveryAddress,
    delivery_contact: {
      name: input.recipientName,
      mobile_number: normalizeSAPhone(input.recipientPhone),
      email: input.recipientEmail ?? "",
    },
    service_level_code: input.serviceLevelCode,
    opt_in_rates: [],
    opt_in_time_based_rates: [],
  };

  // D2D only — locker deliveries omit parcels and special instructions
  if (isDoor) {
    payload.special_instructions_collection = "";
    payload.parcels = [
      {
        submitted_length_cm: String(input.parcel?.lengthCm ?? 10),
        submitted_width_cm: String(input.parcel?.widthCm ?? 10),
        submitted_height_cm: String(input.parcel?.heightCm ?? 10),
        submitted_weight_kg: String(input.parcel?.weightKg ?? 0.5),
        parcel_description: "Package",
        alternative_tracking_reference: "",
      },
    ];
  }

  const result = await pudoFetch<Record<string, unknown>>("POST", "/shipments", settings, payload);

  const waybill = String(result.custom_tracking_reference ?? "");
  const shipmentId = result.id as number | undefined;
  // Waybill PDF is proxied through our backend since the PUDO API requires Bearer auth
  const labelUrl = shipmentId ? `/api/admin/pudo/waybill/${shipmentId}` : undefined;

  if (waybill) {
    await prisma.order.update({
      where: { id: input.orderId },
      data: { trackingNumber: waybill, courier: "PUDO - The Courier Guy" },
    });
  }

  return { waybillNumber: waybill, labelUrl, shipmentId };
}

export async function downloadPudoWaybill(shipmentId: number): Promise<{ body: Buffer; contentType: string }> {
  const settings = await getPudoSettings();
  if (!settings.enabled || !getEffectiveApiKey(settings)) {
    throw new AppError(400, "PUDO integration is not enabled or configured", "PUDO_NOT_CONFIGURED");
  }
  const base = settings.sandbox ? PUDO_API_SANDBOX : PUDO_API_PROD;
  const url = `${base}/api/v1/generate/waybill/${shipmentId}`;
  console.log(`[PUDO] → GET waybill ${url}`);
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${getEffectiveApiKey(settings)}` },
      // @ts-ignore
      dispatcher: settings.sandbox ? pudoSandboxAgent : undefined,
    });
  } catch (e: unknown) {
    throw new AppError(502, `PUDO network error: ${e instanceof Error ? e.message : String(e)}`, "PUDO_NETWORK_ERROR");
  }
  if (!res.ok) {
    const rawBody = await res.text().catch(() => "");
    throw new AppError(502, `PUDO waybill error ${res.status}: ${rawBody.slice(0, 200)}`, "PUDO_API_ERROR");
  }
  const contentType = res.headers.get("content-type") ?? "application/pdf";
  const arrayBuf = await res.arrayBuffer();
  return { body: Buffer.from(arrayBuf), contentType };
}

export async function trackPudoShipment(waybillNumber: string) {
  const settings = await getPudoSettings();
  if (!settings.enabled || !getEffectiveApiKey(settings)) {
    throw new AppError(400, "PUDO integration is not enabled or configured", "PUDO_NOT_CONFIGURED");
  }
  return pudoFetch<unknown>("GET", `/tracking/shipments/public?waybill=${encodeURIComponent(waybillNumber)}`, settings);
}

export async function getPudoRates(lockerCode: string) {
  const settings = await getPudoSettings();
  if (!settings.enabled || !getEffectiveApiKey(settings)) {
    throw new AppError(400, "PUDO integration is not enabled or configured", "PUDO_NOT_CONFIGURED");
  }
  const senderStreet = [settings.senderUnitAddress, settings.senderStreetAddress].filter(Boolean).join(", ");
  const payload = {
    collection_address: {
      street_address: senderStreet,
      local_area: settings.senderLocalArea ?? "",
      city: settings.senderCity ?? "",
      code: settings.senderPostalCode ?? "",
      zone: toProvinceCode(settings.senderProvince ?? ""),
      country: "South Africa",
      type: "residential",
    },
    delivery_address: { terminal_id: lockerCode },
  };
  return pudoFetch<unknown>("POST", "/rates", settings, payload);
}

export async function getPudoDoorRates(deliveryAddress: { streetAddress: string; localArea?: string; city: string; postalCode?: string; province?: string }) {
  const settings = await getPudoSettings();
  if (!settings.enabled || !getEffectiveApiKey(settings)) {
    throw new AppError(400, "PUDO integration is not enabled or configured", "PUDO_NOT_CONFIGURED");
  }
  const senderStreet = [settings.senderUnitAddress, settings.senderStreetAddress].filter(Boolean).join(", ");
  const payload = {
    collection_address: {
      street_address: senderStreet,
      local_area: settings.senderLocalArea ?? "",
      city: settings.senderCity ?? "",
      code: settings.senderPostalCode ?? "",
      zone: toProvinceCode(settings.senderProvince ?? ""),
      country: "South Africa",
      type: "residential",
    },
    delivery_address: {
      street_address: deliveryAddress.streetAddress,
      local_area: deliveryAddress.localArea ?? "",
      city: deliveryAddress.city,
      code: deliveryAddress.postalCode ?? "",
      zone: toProvinceCode(deliveryAddress.province ?? ""),
      country: "South Africa",
      type: "door",
    },
  };
  return pudoFetch<unknown>("POST", "/rates", settings, payload);
}

export async function listPudoShipments() {
  const settings = await getPudoSettings();
  if (!settings.enabled || !getEffectiveApiKey(settings)) {
    throw new AppError(400, "PUDO integration is not enabled or configured", "PUDO_NOT_CONFIGURED");
  }
  return pudoFetch<unknown>("GET", "/shipments", settings);
}

export async function diagnosePudoApi() {
  const settings = await getPudoSettings();
  const base = settings.sandbox ? PUDO_API_SANDBOX : PUDO_API_PROD;
  const dispatcher = settings.sandbox ? pudoSandboxAgent : undefined;

  const pathsToTry = [
    "/lockers-data", "/lockers", "/terminals", "/locker",
    "/api/lockers-data", "/api/lockers",
    "/v1/lockers-data", "/v1/lockers",
    "/api/v1/lockers-data", "/api/v1/lockers",
  ];
  const effectiveKey = getEffectiveApiKey(settings);
  const authMethods = [
    { name: "query_api_key",    headers: {},                                             qs: `?api_key=${encodeURIComponent(effectiveKey)}` },
    { name: "bearer_header",    headers: { Authorization: `Bearer ${effectiveKey}` },   qs: "" },
    { name: "query_token",      headers: {},                                             qs: `?token=${encodeURIComponent(effectiveKey)}` },
    { name: "no_auth_baseline", headers: {},                                             qs: "" },
  ];

  const results: Record<string, unknown> = {
    settings: { sandbox: settings.sandbox, enabled: settings.enabled, base, apiKeyLen: effectiveKey.length, apiKeyPreview: effectiveKey.slice(0, 8) + "…" },
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

async function sendPudoShippingEmail(orderId: string, waybillNumber: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { customer: true },
  });
  if (!order?.customer?.email) return;

  const trackingUrl = `https://pudo.co.za/track/${encodeURIComponent(waybillNumber)}`;

  const template = await resolveTemplateByKey("shipping_confirmation", {
    orderNumber: order.orderNumber,
    carrier: "PUDO",
    trackingNumber: waybillNumber,
    trackingUrl,
  });

  await sendEmail({
    to: order.customer.email,
    subject: template.subject,
    html: template.htmlBody,
    meta: { templateKey: template.key, orderId: order.id },
  });
}

/** Resolves the service-level code for an order based on item count and delivery type. */
async function resolveServiceCode(settings: PudoSettings, itemCount: number, deliveryType: "locker" | "door"): Promise<string> {
  const rule = settings.itemRules.find(
    (r) => itemCount >= r.minItems && (r.maxItems === null || itemCount <= r.maxItems),
  );
  const pkg = rule ? settings.packageSizes.find((p) => p.code === rule.packageCode) : null;
  if (pkg) return deliveryType === "locker" ? pkg.lockerServiceCode : pkg.doorServiceCode;
  return deliveryType === "locker" ? "D2L-EXPRESS" : "D2D-EXPRESS";
}

/** Auto-creates a PUDO shipment when an order is paid. Called from payments.service.ts. */
export async function autoCreatePudoShipment(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      customer: true,
      shippingAddress: true,
      items: true,
    },
  });

  if (!order) return;
  if (!order.pudoDeliveryType) return;
  if (order.trackingNumber) return; // already has waybill

  const settings = await getPudoSettings();
  if (!settings.enabled || !getEffectiveApiKey(settings)) return;

  const deliveryType = order.pudoDeliveryType as "locker" | "door";
  const itemCount = order.items.reduce((sum, i) => sum + i.quantity, 0);
  const serviceCode = await resolveServiceCode(settings, itemCount, deliveryType);

  // Resolve package size for parcel dimensions
  const rule = settings.itemRules.find(
    (r) => itemCount >= r.minItems && (r.maxItems === null || itemCount <= r.maxItems),
  );
  const pkg = rule ? settings.packageSizes.find((p) => p.code === rule.packageCode) : null;

  const recipientName = (
    order.shippingAddress?.recipientName
    ?? (order.customer ? [order.customer.firstName, order.customer.lastName].filter(Boolean).join(" ") : "")
  ) || "Customer";
  const recipientPhone = order.customer?.phone ?? "";
  const recipientEmail = order.customer?.email ?? undefined;

  // Pre-flight validation — fail fast with a clear message rather than a generic PUDO error
  if (!recipientPhone) {
    throw new AppError(400, `PUDO shipment cannot be created: customer has no phone number on order ${orderId}`, "PUDO_MISSING_PHONE");
  }
  if (!settings.senderStreetAddress || !settings.senderCity) {
    throw new AppError(400, "PUDO shipment cannot be created: sender address (street + city) is not configured in PUDO settings", "PUDO_MISSING_SENDER_ADDRESS");
  }

  const [lengthCm, widthCm, heightCm] = pkg ? parseDimensions(pkg.dimensions) : [10, 10, 10];
  const weightKg = pkg ? pkg.maxWeight : 0.5;

  const input: PudoShipmentInput = {
    orderId,
    serviceLevelCode: serviceCode,
    recipientName,
    recipientPhone,
    recipientEmail,
    parcel: { lengthCm, widthCm, heightCm, weightKg },
  };

  if (deliveryType === "locker") {
    if (!order.pudoLockerCode) {
      console.warn(`[PUDO] autoCreate skipped for order ${orderId}: locker delivery but no pudoLockerCode`);
      return;
    }
    input.lockerCode = order.pudoLockerCode;
  } else {
    const addr = order.shippingAddress;
    if (!addr?.line1 || !addr.city) {
      console.warn(`[PUDO] autoCreate skipped for order ${orderId}: door delivery but no shipping address`);
      return;
    }
    input.doorAddress = {
      streetAddress: [addr.line2, addr.line1].filter(Boolean).join(", "),
      localArea: addr.suburb ?? undefined,
      city: addr.city,
      postalCode: addr.postalCode ?? undefined,
      province: addr.state ?? undefined,
    };
  }

  console.info(`[PUDO] autoCreatePudoShipment start for order ${orderId}`, { deliveryType, serviceCode });
  try {
    const { waybillNumber } = await createPudoShipment(input);
    if (waybillNumber) {
      console.info(`[PUDO] autoCreatePudoShipment success for order ${orderId}: waybill ${waybillNumber}`);
      await sendPudoShippingEmail(orderId, waybillNumber).catch((err) => {
        console.error(`[PUDO] shipping email failed for order ${orderId}:`, err);
      });
    }
  } catch (err) {
    console.error(`[PUDO] autoCreatePudoShipment failed for order ${orderId}:`, err);
  }
}

/** PUDO tracking status → internal order status mapping */
const PUDO_STATUS_MAP: Record<string, { fulfillmentStatus?: string; status?: string }> = {
  "collected":        { status: "SHIPPED" },
  "in_transit":       { status: "SHIPPED" },
  "out_for_delivery": { status: "SHIPPED" },
  "delivered":        { status: "DELIVERED", fulfillmentStatus: "FULFILLED" },
  "failed_delivery":  { status: "SHIPPED" },
  "exception":        {},
  "return_to_sender": { fulfillmentStatus: "RETURNED" },
};

/** Polls PUDO tracking for all open PUDO orders and updates order status. */
export async function syncPudoTrackingStatuses(): Promise<{ synced: number; errors: number }> {
  const settings = await getPudoSettings();
  if (!settings.enabled || !getEffectiveApiKey(settings)) {
    return { synced: 0, errors: 0 };
  }

  const pudoOrders = await prisma.order.findMany({
    where: {
      courier: { contains: "PUDO", mode: "insensitive" },
      trackingNumber: { not: null },
      NOT: { status: { in: ["DELIVERED", "CANCELLED"] } },
    },
    select: { id: true, orderNumber: true, trackingNumber: true, fulfillmentStatus: true, status: true },
  });

  let synced = 0;
  let errors = 0;

  for (const order of pudoOrders) {
    if (!order.trackingNumber) continue;
    try {
      const tracking = await pudoFetch<Record<string, unknown>>(
        "GET",
        `/tracking/shipments/public?waybill=${encodeURIComponent(order.trackingNumber)}`,
        settings,
      );

      const rawStatus = String((tracking as any)?.status ?? (tracking as any)?.tracking_status ?? "").toLowerCase().replace(/\s+/g, "_");
      const mapped = PUDO_STATUS_MAP[rawStatus];
      if (!mapped) continue;

      const updates: Record<string, unknown> = {};
      if (mapped.fulfillmentStatus && order.fulfillmentStatus !== mapped.fulfillmentStatus) {
        updates.fulfillmentStatus = mapped.fulfillmentStatus;
      }
      if (mapped.status && order.status !== mapped.status) {
        updates.status = mapped.status;
        if (mapped.status === "DELIVERED") updates.deliveredAt = new Date();
      }

      if (Object.keys(updates).length > 0) {
        await prisma.order.update({ where: { id: order.id }, data: updates as any });
        await prisma.orderEvent.create({
          data: {
            orderId: order.id,
            eventType: "TRACKING_UPDATED",
            nextValue: rawStatus,
            details: { source: "pudo_sync", pudoStatus: rawStatus, updates } as any,
          },
        });
        console.info(`[PUDO] tracking sync updated order ${order.orderNumber}: ${rawStatus}`, updates);
      }
      synced++;
    } catch (err) {
      console.error(`[PUDO] tracking sync error for order ${order.orderNumber}:`, err);
      errors++;
    }
  }

  return { synced, errors };
}

/** Lists all our own PUDO orders (from the DB, with tracking info). */
export async function listLocalPudoOrders(page = 1, perPage = 50) {
  const skip = (page - 1) * perPage;
  const [items, total] = await Promise.all([
    prisma.order.findMany({
      where: { pudoDeliveryType: { not: null } },
      orderBy: { createdAt: "desc" },
      skip,
      take: perPage,
      select: {
        id: true,
        orderNumber: true,
        createdAt: true,
        status: true,
        paymentStatus: true,
        fulfillmentStatus: true,
        trackingNumber: true,
        courier: true,
        pudoDeliveryType: true,
        pudoLockerCode: true,
        pudoLockerName: true,
        totalAmount: true,
        customer: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    }),
    prisma.order.count({ where: { pudoDeliveryType: { not: null } } }),
  ]);
  return { items, total, page, perPage };
}
