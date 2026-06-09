import { useEffect, useState } from "react";
import { apiRequest } from "../api/client";
import { useAdminAuth } from "../context/AdminAuthContext";
import { LoadingState, ErrorState } from "../components/AdminState";
import { formatRand } from "../../lib/currency";
import { toast } from "sonner";

type PackageSizeConfig = {
  code: string;
  label: string;
  dimensions: string;
  maxWeight: number;
  lockerPrice: number;
  doorPrice: number;
  lockerServiceCode: string;
  doorServiceCode: string;
  lockerApiRate?: number;
  doorApiRate?: number;
};

type PudoSettings = {
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
  itemRules: { minItems: number; maxItems: number | null; packageCode: string }[];
  lastRatesSync?: string;
};

export default function AdminPudoRates() {
  const { session } = useAdminAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<PudoSettings | null>(null);
  const [sizes, setSizes] = useState<PackageSizeConfig[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!session?.accessToken) return;
    try {
      setLoading(true);
      setError(null);
      const res = await apiRequest<{ data: PudoSettings }>("/admin/integrations/pudo/settings", {}, session.accessToken);
      setSettings(res.data);
      setSizes(res.data.packageSizes ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load PUDO settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [session?.accessToken]);

  const handleSync = async () => {
    if (!session?.accessToken) return;
    try {
      setSyncing(true);
      const res = await apiRequest<{ data: PudoSettings }>("/admin/pudo/sync-rates", { method: "POST" }, session.accessToken);
      setSettings(res.data);
      setSizes(res.data.packageSizes ?? []);
      toast.success("Rates synced from PUDO API");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Rate sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const handleSave = async () => {
    if (!session?.accessToken || !settings) return;
    try {
      setSaving(true);
      const payload = { ...settings, packageSizes: sizes };
      await apiRequest("/admin/integrations/pudo/settings", { method: "PUT", body: JSON.stringify(payload) }, session.accessToken);
      toast.success("Prices saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save prices");
    } finally {
      setSaving(false);
    }
  };

  const updatePrice = (idx: number, field: "lockerPrice" | "doorPrice", value: string) => {
    setSizes((prev) => prev.map((s, i) => i === idx ? { ...s, [field]: Number(value) || 0 } : s));
  };

  const updateServiceCode = (idx: number, field: "lockerServiceCode" | "doorServiceCode", value: string) => {
    setSizes((prev) => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (!settings) return null;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900">PUDO Rates</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage what customers are charged for locker and door delivery.
            {settings.lastRatesSync ? (
              <span className="ml-2 text-gray-400">Last synced: {new Date(settings.lastRatesSync).toLocaleString()}</span>
            ) : (
              <span className="ml-2 text-amber-500">No sync yet — click "Sync from PUDO" to fetch current API rates.</span>
            )}
          </p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold disabled:opacity-60"
        >
          {syncing ? "Syncing…" : "Sync from PUDO"}
        </button>
      </div>

      {!settings.enabled && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
          PUDO integration is currently disabled. Enable it in Shipping settings to use these rates.
        </div>
      )}

      {/* Locker (D2L) Rates */}
      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="font-bold text-gray-900 mb-1">Locker Delivery (D2L)</h2>
        <p className="text-xs text-gray-500 mb-4">
          Packages shipped from your address to a PUDO locker. Customer collects from the locker.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Size</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Dimensions</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Max kg</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">PUDO API Rate</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Your Price (R)</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Service Code</th>
              </tr>
            </thead>
            <tbody>
              {sizes.map((pkg, idx) => (
                <tr key={pkg.code} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2 font-bold text-gray-900">{pkg.label}</td>
                  <td className="px-3 py-2 text-gray-600 text-xs">{pkg.dimensions}</td>
                  <td className="px-3 py-2 text-gray-600">{pkg.maxWeight}kg</td>
                  <td className="px-3 py-2">
                    {pkg.lockerApiRate != null ? (
                      <span className={`font-mono text-sm ${pkg.lockerApiRate > pkg.lockerPrice ? "text-red-600 font-bold" : "text-gray-600"}`}>
                        {formatRand(pkg.lockerApiRate)}
                        {pkg.lockerApiRate > pkg.lockerPrice && (
                          <span className="ml-1 text-xs text-red-500" title="API rate exceeds your price">▲</span>
                        )}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">Not synced</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <span className="text-gray-500 text-sm">R</span>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        className="w-20 border border-gray-200 rounded px-2 py-1 text-sm"
                        value={pkg.lockerPrice}
                        onChange={(e) => updatePrice(idx, "lockerPrice", e.target.value)}
                      />
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className="w-36 border border-gray-200 rounded px-2 py-1 text-xs font-mono"
                      value={pkg.lockerServiceCode}
                      onChange={(e) => updateServiceCode(idx, "lockerServiceCode", e.target.value)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Door (D2D) Rates */}
      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="font-bold text-gray-900 mb-1">Door Delivery (D2D)</h2>
        <p className="text-xs text-gray-500 mb-4">
          Packages shipped from your address directly to the customer's door. PUDO API rate shown is for same-zone delivery (base rate).
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Size</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Dimensions</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Max kg</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">PUDO API Rate</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Your Price (R)</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Service Code</th>
              </tr>
            </thead>
            <tbody>
              {sizes.map((pkg, idx) => (
                <tr key={pkg.code} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2 font-bold text-gray-900">{pkg.label}</td>
                  <td className="px-3 py-2 text-gray-600 text-xs">{pkg.dimensions}</td>
                  <td className="px-3 py-2 text-gray-600">{pkg.maxWeight}kg</td>
                  <td className="px-3 py-2">
                    {pkg.doorApiRate != null ? (
                      <span className={`font-mono text-sm ${pkg.doorApiRate > pkg.doorPrice ? "text-red-600 font-bold" : "text-gray-600"}`}>
                        {formatRand(pkg.doorApiRate)}
                        {pkg.doorApiRate > pkg.doorPrice && (
                          <span className="ml-1 text-xs text-red-500" title="API rate exceeds your price">▲</span>
                        )}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">Not synced</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <span className="text-gray-500 text-sm">R</span>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        className="w-20 border border-gray-200 rounded px-2 py-1 text-sm"
                        value={pkg.doorPrice}
                        onChange={(e) => updatePrice(idx, "doorPrice", e.target.value)}
                      />
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className="w-36 border border-gray-200 rounded px-2 py-1 text-xs font-mono"
                      value={pkg.doorServiceCode}
                      onChange={(e) => updateServiceCode(idx, "doorServiceCode", e.target.value)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 rounded-lg bg-gray-900 text-white font-semibold text-sm disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save Prices"}
        </button>
        <p className="text-xs text-gray-400">
          {settings.roundPricing ? "Round pricing is enabled (prices will round up to nearest R×9)." : ""}
        </p>
      </div>

      <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 text-sm text-blue-800">
        <p className="font-semibold mb-1">How rates work</p>
        <ul className="list-disc list-inside space-y-1 text-xs">
          <li>The <strong>PUDO API Rate</strong> is what PUDO charges you — fetched daily at 4am UTC. Red ▲ means you are charging less than PUDO charges you.</li>
          <li><strong>Your Price</strong> is what customers see at checkout. Set it to cover costs plus any margin.</li>
          <li>Syncing does NOT automatically change your prices — you must save after reviewing.</li>
        </ul>
      </div>
    </div>
  );
}
