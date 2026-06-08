import { FormEvent, useEffect, useState } from "react";
import { apiRequest } from "../api/client";
import { useAdminAuth } from "../context/AdminAuthContext";
import { toast } from "sonner";

type Tab = "settings" | "lockers" | "rates" | "shipment" | "track" | "shipments";

interface PudoSettings {
  enabled: boolean;
  sandbox: boolean;
  apiKey: string;
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

function JsonBlock({ data }: { data: unknown }) {
  return (
    <pre className="mt-4 p-4 bg-gray-900 text-green-300 rounded-lg text-xs overflow-auto max-h-96 whitespace-pre-wrap">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

function ResultSection({ result, error }: { result: unknown; error: string | null }) {
  if (error) return <p className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>;
  if (result !== null && result !== undefined) return <JsonBlock data={result} />;
  return null;
}

export default function AdminPudoTest() {
  const { session } = useAdminAuth();
  const token = session?.accessToken;

  const [activeTab, setActiveTab] = useState<Tab>("settings");

  // Settings tab
  const [settings, setSettings] = useState<PudoSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);

  // Lockers tab
  const [lockerSearch, setLockerSearch] = useState("");
  const [lockersResult, setLockersResult] = useState<unknown>(null);
  const [lockersError, setLockersError] = useState<string | null>(null);
  const [lockersLoading, setLockersLoading] = useState(false);

  // Rates tab
  const [ratesLockerCode, setRatesLockerCode] = useState("");
  const [ratesResult, setRatesResult] = useState<unknown>(null);
  const [ratesError, setRatesError] = useState<string | null>(null);
  const [ratesLoading, setRatesLoading] = useState(false);

  // Create shipment tab
  const [shipmentOrderId, setShipmentOrderId] = useState("");
  const [shipmentLockerCode, setShipmentLockerCode] = useState("");
  const [shipmentServiceLevel, setShipmentServiceLevel] = useState("D2L-EXPRESS");
  const [shipmentRecipientName, setShipmentRecipientName] = useState("");
  const [shipmentRecipientPhone, setShipmentRecipientPhone] = useState("");
  const [shipmentRecipientEmail, setShipmentRecipientEmail] = useState("");
  const [shipmentResult, setShipmentResult] = useState<unknown>(null);
  const [shipmentError, setShipmentError] = useState<string | null>(null);
  const [shipmentLoading, setShipmentLoading] = useState(false);

  // Track tab
  const [trackWaybill, setTrackWaybill] = useState("");
  const [trackResult, setTrackResult] = useState<unknown>(null);
  const [trackError, setTrackError] = useState<string | null>(null);
  const [trackLoading, setTrackLoading] = useState(false);

  // Shipments list tab
  const [shipmentsResult, setShipmentsResult] = useState<unknown>(null);
  const [shipmentsError, setShipmentsError] = useState<string | null>(null);
  const [shipmentsLoading, setShipmentsLoading] = useState(false);

  useEffect(() => {
    if (activeTab === "settings" && !settings) {
      setSettingsLoading(true);
      apiRequest<{ data: PudoSettings }>("/admin/integrations/pudo/settings", {}, token)
        .then((r) => setSettings(r.data))
        .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Failed to load settings"))
        .finally(() => setSettingsLoading(false));
    }
  }, [activeTab, settings, token]);

  async function fetchLockers(e: FormEvent) {
    e.preventDefault();
    setLockersLoading(true);
    setLockersError(null);
    setLockersResult(null);
    try {
      const qs = lockerSearch ? `?search=${encodeURIComponent(lockerSearch)}` : "";
      const r = await apiRequest<{ data: unknown }>(`/admin/pudo/lockers${qs}`, {}, token);
      setLockersResult(r.data);
    } catch (e: unknown) {
      setLockersError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLockersLoading(false);
    }
  }

  async function fetchRates(e: FormEvent) {
    e.preventDefault();
    setRatesLoading(true);
    setRatesError(null);
    setRatesResult(null);
    try {
      const r = await apiRequest<{ data: unknown }>("/admin/pudo/rates", {
        method: "POST",
        body: JSON.stringify({ lockerCode: ratesLockerCode }),
      }, token);
      setRatesResult(r.data);
    } catch (e: unknown) {
      setRatesError(e instanceof Error ? e.message : "Failed");
    } finally {
      setRatesLoading(false);
    }
  }

  async function createShipment(e: FormEvent) {
    e.preventDefault();
    setShipmentLoading(true);
    setShipmentError(null);
    setShipmentResult(null);
    try {
      const r = await apiRequest<{ data: unknown }>("/admin/pudo/shipment", {
        method: "POST",
        body: JSON.stringify({
          orderId: shipmentOrderId,
          lockerCode: shipmentLockerCode,
          serviceLevelCode: shipmentServiceLevel,
          recipientName: shipmentRecipientName,
          recipientPhone: shipmentRecipientPhone,
          recipientEmail: shipmentRecipientEmail || undefined,
        }),
      }, token);
      setShipmentResult(r.data);
      toast.success("Shipment created");
    } catch (e: unknown) {
      setShipmentError(e instanceof Error ? e.message : "Failed");
    } finally {
      setShipmentLoading(false);
    }
  }

  async function trackShipment(e: FormEvent) {
    e.preventDefault();
    setTrackLoading(true);
    setTrackError(null);
    setTrackResult(null);
    try {
      const r = await apiRequest<{ data: unknown }>(`/admin/pudo/track/${encodeURIComponent(trackWaybill)}`, {}, token);
      setTrackResult(r.data);
    } catch (e: unknown) {
      setTrackError(e instanceof Error ? e.message : "Failed");
    } finally {
      setTrackLoading(false);
    }
  }

  async function fetchShipments() {
    setShipmentsLoading(true);
    setShipmentsError(null);
    setShipmentsResult(null);
    try {
      const r = await apiRequest<{ data: unknown }>("/admin/pudo/shipments", {}, token);
      setShipmentsResult(r.data);
    } catch (e: unknown) {
      setShipmentsError(e instanceof Error ? e.message : "Failed");
    } finally {
      setShipmentsLoading(false);
    }
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "settings", label: "Settings" },
    { key: "lockers", label: "Lockers" },
    { key: "rates", label: "Rates" },
    { key: "shipment", label: "Create Shipment" },
    { key: "track", label: "Track" },
    { key: "shipments", label: "Shipments List" },
  ];

  const inputCls = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300";
  const btnCls = "px-4 py-2 rounded-lg bg-pink-600 text-white text-sm font-medium hover:bg-pink-700 disabled:opacity-50";

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">PUDO API Test</h1>
        <p className="text-sm text-gray-500 mt-1">Test each PUDO API endpoint against the configured environment (sandbox / production).</p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-gray-200 mb-6">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 -mb-px transition-colors ${
              activeTab === t.key
                ? "border-pink-500 text-pink-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Settings */}
      {activeTab === "settings" && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Current PUDO Settings</h2>
          {settingsLoading && <p className="text-sm text-gray-500">Loading…</p>}
          {settings && (
            <div className="space-y-2">
              <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${settings.enabled ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                {settings.enabled ? "Enabled" : "Disabled"}
              </div>
              <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ml-2 ${settings.sandbox ? "bg-yellow-100 text-yellow-700" : "bg-blue-100 text-blue-700"}`}>
                {settings.sandbox ? "Sandbox mode" : "Production mode"}
              </div>
              <JsonBlock data={settings} />
              <p className="text-xs text-gray-400 mt-2">Change settings at <strong>Settings → Integrations → PUDO</strong>.</p>
            </div>
          )}
        </div>
      )}

      {/* Lockers */}
      {activeTab === "lockers" && (
        <div>
          <h2 className="text-lg font-semibold mb-1">GET /lockers-data</h2>
          <p className="text-xs text-gray-500 mb-4">Fetches all available PUDO lockers. Optional search filters by name, address or city.</p>
          <form onSubmit={fetchLockers} className="flex gap-2">
            <input
              className={`${inputCls} flex-1`}
              placeholder="Search (name, address, city) — leave blank for all"
              value={lockerSearch}
              onChange={(e) => setLockerSearch(e.target.value)}
            />
            <button type="submit" className={btnCls} disabled={lockersLoading}>
              {lockersLoading ? "Loading…" : "Fetch"}
            </button>
          </form>
          <ResultSection result={lockersResult} error={lockersError} />
        </div>
      )}

      {/* Rates */}
      {activeTab === "rates" && (
        <div>
          <h2 className="text-lg font-semibold mb-1">POST /rates</h2>
          <p className="text-xs text-gray-500 mb-4">Returns available D2L service levels and prices for a locker destination. Uses sender address from settings.</p>
          <form onSubmit={fetchRates} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Locker Code (terminal_id)</label>
              <input
                className={inputCls}
                placeholder="e.g. JHB001"
                value={ratesLockerCode}
                onChange={(e) => setRatesLockerCode(e.target.value)}
                required
              />
            </div>
            <button type="submit" className={btnCls} disabled={ratesLoading}>
              {ratesLoading ? "Loading…" : "Get Rates"}
            </button>
          </form>
          <ResultSection result={ratesResult} error={ratesError} />
        </div>
      )}

      {/* Create Shipment */}
      {activeTab === "shipment" && (
        <div>
          <h2 className="text-lg font-semibold mb-1">POST /shipments (D2L)</h2>
          <p className="text-xs text-gray-500 mb-4">Creates a door-to-locker shipment. This will update the order's tracking number if successful.</p>
          <form onSubmit={createShipment} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Order ID</label>
                <input className={inputCls} placeholder="CUID order ID" value={shipmentOrderId} onChange={(e) => setShipmentOrderId(e.target.value)} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Locker Code</label>
                <input className={inputCls} placeholder="e.g. JHB001" value={shipmentLockerCode} onChange={(e) => setShipmentLockerCode(e.target.value)} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Service Level Code</label>
                <input className={inputCls} placeholder="e.g. D2L-EXPRESS" value={shipmentServiceLevel} onChange={(e) => setShipmentServiceLevel(e.target.value)} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Recipient Name</label>
                <input className={inputCls} placeholder="Full name" value={shipmentRecipientName} onChange={(e) => setShipmentRecipientName(e.target.value)} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Recipient Phone</label>
                <input className={inputCls} placeholder="e.g. 0821234567" value={shipmentRecipientPhone} onChange={(e) => setShipmentRecipientPhone(e.target.value)} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Recipient Email (optional)</label>
                <input className={inputCls} type="email" placeholder="email@example.com" value={shipmentRecipientEmail} onChange={(e) => setShipmentRecipientEmail(e.target.value)} />
              </div>
            </div>
            <p className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded p-2">
              ⚠ This creates a real shipment. Only use a test Order ID in sandbox mode.
            </p>
            <button type="submit" className={btnCls} disabled={shipmentLoading}>
              {shipmentLoading ? "Creating…" : "Create Shipment"}
            </button>
          </form>
          <ResultSection result={shipmentResult} error={shipmentError} />
        </div>
      )}

      {/* Track */}
      {activeTab === "track" && (
        <div>
          <h2 className="text-lg font-semibold mb-1">GET /tracking/shipments/public</h2>
          <p className="text-xs text-gray-500 mb-4">Public tracking by waybill/custom_tracking_reference. No authentication required.</p>
          <form onSubmit={trackShipment} className="flex gap-2">
            <input
              className={`${inputCls} flex-1`}
              placeholder="Waybill / custom_tracking_reference"
              value={trackWaybill}
              onChange={(e) => setTrackWaybill(e.target.value)}
              required
            />
            <button type="submit" className={btnCls} disabled={trackLoading}>
              {trackLoading ? "Loading…" : "Track"}
            </button>
          </form>
          <ResultSection result={trackResult} error={trackError} />
        </div>
      )}

      {/* Shipments list */}
      {activeTab === "shipments" && (
        <div>
          <h2 className="text-lg font-semibold mb-1">GET /shipments</h2>
          <p className="text-xs text-gray-500 mb-4">Lists all shipments on the PUDO account.</p>
          <button type="button" className={btnCls} disabled={shipmentsLoading} onClick={fetchShipments}>
            {shipmentsLoading ? "Loading…" : "Fetch Shipments"}
          </button>
          <ResultSection result={shipmentsResult} error={shipmentsError} />
        </div>
      )}
    </div>
  );
}
