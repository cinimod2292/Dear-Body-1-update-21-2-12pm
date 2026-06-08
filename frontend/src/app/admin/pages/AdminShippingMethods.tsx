import { FormEvent, useEffect, useState } from "react";
import { apiRequest } from "../api/client";
import { useAdminAuth } from "../context/AdminAuthContext";
import { EmptyState, ErrorState, LoadingState } from "../components/AdminState";
import { formatRand } from "../../lib/currency";
import { toast } from "sonner";

type ShippingMethod = {
  id: string;
  name: string;
  price: number;
  description?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type PackageSizeConfig = {
  code: string;
  label: string;
  dimensions: string;
  maxWeight: number;
  lockerPrice: number;
  doorPrice: number;
  lockerServiceCode: string;
  doorServiceCode: string;
};

type ItemRule = {
  minItems: number;
  maxItems: number | null;
  packageCode: string;
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
  itemRules: ItemRule[];
};

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

export default function AdminShippingMethods() {
  const { session } = useAdminAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [methods, setMethods] = useState<ShippingMethod[]>([]);

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [active, setActive] = useState(true);

  const [freeShippingEnabled, setFreeShippingEnabled] = useState(false);
  const [freeShippingThreshold, setFreeShippingThreshold] = useState("0");
  const [manualShippingEnabled, setManualShippingEnabled] = useState(true);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editActive, setEditActive] = useState(true);

  const [pudoSettings, setPudoSettings] = useState<PudoSettings>({
    enabled: false,
    apiKey: "",
    sandboxApiKey: "",
    sandbox: true,
    allowCustomerLockerSelection: false,
    doorDeliveryEnabled: false,
    roundPricing: true,
    packageSizes: DEFAULT_PACKAGE_SIZES,
    itemRules: DEFAULT_ITEM_RULES,
  });
  const [pudoSaving, setPudoSaving] = useState(false);
  const [pudoTesting, setPudoTesting] = useState(false);

  const load = async () => {
    if (!session?.accessToken) return;
    try {
      setLoading(true);
      setError(null);
      const [methodsRes, settingsRes, pudoRes] = await Promise.all([
        apiRequest<{ data: ShippingMethod[] }>("/admin/shipping-methods", {}, session.accessToken),
        apiRequest<{ data: { freeShippingEnabled: boolean; freeShippingThreshold: number; manualShippingEnabled: boolean } }>("/admin/shipping-settings", {}, session.accessToken),
        apiRequest<{ data: PudoSettings }>("/admin/integrations/pudo/settings", {}, session.accessToken),
      ]);
      setMethods(methodsRes.data);
      setFreeShippingEnabled(settingsRes.data.freeShippingEnabled);
      setFreeShippingThreshold(String(settingsRes.data.freeShippingThreshold));
      setManualShippingEnabled(settingsRes.data.manualShippingEnabled !== false);
      const pd = pudoRes.data;
      setPudoSettings({
        ...pd,
        packageSizes: pd.packageSizes?.length ? pd.packageSizes : DEFAULT_PACKAGE_SIZES,
        itemRules: pd.itemRules?.length ? pd.itemRules : DEFAULT_ITEM_RULES,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load shipping methods");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [session?.accessToken]);

  const saveShippingSettings = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.accessToken) return;
    try {
      await apiRequest("/admin/shipping-settings", {
        method: "PUT",
        body: JSON.stringify({ freeShippingEnabled, freeShippingThreshold: Number(freeShippingThreshold), manualShippingEnabled }),
      }, session.accessToken);
      toast.success("Shipping settings saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save shipping settings");
    }
  };

  const savePudoSettings = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.accessToken) return;
    try {
      setPudoSaving(true);
      await apiRequest("/admin/integrations/pudo/settings", {
        method: "PUT",
        body: JSON.stringify(pudoSettings),
      }, session.accessToken);
      toast.success("PUDO settings saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save PUDO settings");
    } finally {
      setPudoSaving(false);
    }
  };

  const testPudoConnection = async () => {
    if (!session?.accessToken) return;
    const effectiveKey = pudoSettings.sandbox ? (pudoSettings.sandboxApiKey || pudoSettings.apiKey) : pudoSettings.apiKey;
    if (!effectiveKey) { toast.error("Enter an API key first"); return; }
    try {
      setPudoTesting(true);
      await apiRequest("/admin/integrations/pudo/settings", { method: "PUT", body: JSON.stringify(pudoSettings) }, session.accessToken);
      await apiRequest("/admin/pudo/lockers", {}, session.accessToken);
      toast.success("PUDO connection successful");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "PUDO connection failed");
    } finally {
      setPudoTesting(false);
    }
  };

  const createMethod = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.accessToken) return;
    try {
      await apiRequest("/admin/shipping-methods", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), price: Number(price), description: description || null, isActive: active }),
      }, session.accessToken);
      setName(""); setPrice(""); setDescription(""); setActive(true);
      toast.success("Shipping method created");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create shipping method");
    }
  };

  const startEdit = (method: ShippingMethod) => {
    setEditingId(method.id);
    setEditName(method.name);
    setEditPrice(String(Number(method.price).toFixed(2)));
    setEditDescription(method.description || "");
    setEditActive(method.isActive);
  };

  const saveEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.accessToken || !editingId) return;
    try {
      await apiRequest(`/admin/shipping-methods/${editingId}`, {
        method: "PUT",
        body: JSON.stringify({ name: editName.trim(), price: Number(editPrice), description: editDescription || null, isActive: editActive }),
      }, session.accessToken);
      setEditingId(null);
      toast.success("Shipping method updated");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update shipping method");
    }
  };

  const deactivate = async (id: string) => {
    if (!session?.accessToken) return;
    try {
      await apiRequest(`/admin/shipping-methods/${id}`, { method: "DELETE" }, session.accessToken);
      toast.success("Shipping method disabled");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to disable shipping method");
    }
  };

  const enable = async (method: ShippingMethod) => {
    if (!session?.accessToken) return;
    try {
      await apiRequest(`/admin/shipping-methods/${method.id}`, {
        method: "PUT",
        body: JSON.stringify({ name: method.name, price: Number(method.price), description: method.description || null, isActive: true }),
      }, session.accessToken);
      toast.success("Shipping method enabled");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to enable shipping method");
    }
  };

  const updatePackageSize = (idx: number, field: keyof PackageSizeConfig, value: string | number) => {
    setPudoSettings((s) => {
      const sizes = [...s.packageSizes];
      sizes[idx] = { ...sizes[idx], [field]: value };
      return { ...s, packageSizes: sizes };
    });
  };

  const updateItemRule = (idx: number, field: keyof ItemRule, value: string) => {
    setPudoSettings((s) => {
      const rules = [...s.itemRules];
      const parsed = field === "packageCode" ? value : (value === "" || value === "null") ? null : Number(value);
      rules[idx] = { ...rules[idx], [field]: parsed };
      return { ...s, itemRules: rules };
    });
  };

  if (loading) return <LoadingState label="Loading shipping methods..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const inputCls = "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm";

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-black text-gray-900">Shipping Methods</h2>
        <p className="text-sm text-gray-500">Manage shipping options and free shipping rules for your store.</p>
      </div>

      {/* Courier Integration */}
      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="font-bold mb-1">Courier Integration</h3>
        <p className="text-sm text-gray-500 mb-4">Choose how you fulfil shipments.</p>
        <div className="flex gap-3 mb-4">
          <button
            type="button"
            onClick={() => setPudoSettings((s) => ({ ...s, enabled: false }))}
            className={`flex-1 py-3 px-4 rounded-xl border-2 text-sm font-medium transition-colors ${!pudoSettings.enabled ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 text-gray-700 hover:border-gray-400"}`}
          >
            <span className="block font-semibold">Manual Setup</span>
            <span className="block text-xs mt-0.5 opacity-70">Enter tracking numbers manually on each order</span>
          </button>
          <button
            type="button"
            onClick={() => setPudoSettings((s) => ({ ...s, enabled: true }))}
            className={`flex-1 py-3 px-4 rounded-xl border-2 text-sm font-medium transition-colors ${pudoSettings.enabled ? "border-indigo-600 bg-indigo-600 text-white" : "border-gray-200 text-gray-700 hover:border-indigo-300"}`}
          >
            <span className="block font-semibold">PUDO — The Courier Guy</span>
            <span className="block text-xs mt-0.5 opacity-70">Locker and door delivery via PUDO</span>
          </button>
        </div>

        {pudoSettings.enabled && (
          <form onSubmit={savePudoSettings} className="space-y-5 border-t border-gray-100 pt-4">
            <p className="text-xs text-indigo-700 bg-indigo-50 rounded-lg px-3 py-2">
              PUDO is enabled. Configure delivery options, package sizes, and pricing below.
            </p>

            {/* API credentials */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">API Credentials</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Production API Key <span className="text-red-500">*</span></label>
                  <input type="password" className={inputCls} placeholder="Live PUDO Bearer token" value={pudoSettings.apiKey} onChange={(e) => setPudoSettings((s) => ({ ...s, apiKey: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Sandbox API Key</label>
                  <input type="password" className={inputCls} placeholder="Sandbox PUDO Bearer token" value={pudoSettings.sandboxApiKey ?? ""} onChange={(e) => setPudoSettings((s) => ({ ...s, sandboxApiKey: e.target.value || undefined }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Account Number (optional)</label>
                  <input type="text" className={inputCls} placeholder="Courier Guy account number" value={pudoSettings.accountNumber ?? ""} onChange={(e) => setPudoSettings((s) => ({ ...s, accountNumber: e.target.value || undefined }))} />
                </div>
              </div>
            </div>

            {/* Sender details */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Sender / Collection Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
                  <input type="text" className={inputCls} placeholder="Store name" value={pudoSettings.senderName ?? ""} onChange={(e) => setPudoSettings((s) => ({ ...s, senderName: e.target.value || undefined }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
                  <input type="tel" className={inputCls} placeholder="0800 000 000" value={pudoSettings.senderPhone ?? ""} onChange={(e) => setPudoSettings((s) => ({ ...s, senderPhone: e.target.value || undefined }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                  <input type="email" className={inputCls} placeholder="store@example.com" value={pudoSettings.senderEmail ?? ""} onChange={(e) => setPudoSettings((s) => ({ ...s, senderEmail: e.target.value || undefined }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Unit / Complex / Building (optional)</label>
                  <input type="text" className={inputCls} placeholder="Unit 4, The Palms" value={pudoSettings.senderUnitAddress ?? ""} onChange={(e) => setPudoSettings((s) => ({ ...s, senderUnitAddress: e.target.value || undefined }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Street Address</label>
                  <input type="text" className={inputCls} placeholder="123 Main St" value={pudoSettings.senderStreetAddress ?? ""} onChange={(e) => setPudoSettings((s) => ({ ...s, senderStreetAddress: e.target.value || undefined }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Local Area / Suburb</label>
                  <input type="text" className={inputCls} placeholder="Sandton" value={pudoSettings.senderLocalArea ?? ""} onChange={(e) => setPudoSettings((s) => ({ ...s, senderLocalArea: e.target.value || undefined }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">City</label>
                  <input type="text" className={inputCls} placeholder="Johannesburg" value={pudoSettings.senderCity ?? ""} onChange={(e) => setPudoSettings((s) => ({ ...s, senderCity: e.target.value || undefined }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Postal Code</label>
                  <input type="text" className={inputCls} placeholder="2196" value={pudoSettings.senderPostalCode ?? ""} onChange={(e) => setPudoSettings((s) => ({ ...s, senderPostalCode: e.target.value || undefined }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Province</label>
                  <input type="text" className={inputCls} placeholder="Gauteng" value={pudoSettings.senderProvince ?? ""} onChange={(e) => setPudoSettings((s) => ({ ...s, senderProvince: e.target.value || undefined }))} />
                </div>
              </div>
            </div>

            {/* Delivery options */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Delivery Options</h4>
              <div className="flex flex-col gap-2">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={pudoSettings.allowCustomerLockerSelection} onChange={(e) => setPudoSettings((s) => ({ ...s, allowCustomerLockerSelection: e.target.checked }))} />
                  <span className="font-medium">Locker delivery</span>
                  <span className="text-xs text-gray-400">Customer picks a PUDO locker at checkout (D2L)</span>
                </label>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={pudoSettings.doorDeliveryEnabled} onChange={(e) => setPudoSettings((s) => ({ ...s, doorDeliveryEnabled: e.target.checked }))} />
                  <span className="font-medium">Door delivery</span>
                  <span className="text-xs text-gray-400">Customer enters their address at checkout (D2D)</span>
                </label>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={pudoSettings.sandbox} onChange={(e) => setPudoSettings((s) => ({ ...s, sandbox: e.target.checked }))} />
                  <span className="font-medium">Sandbox / test mode</span>
                  <span className="text-xs text-gray-400">Disable for live production shipments</span>
                </label>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={pudoSettings.roundPricing} onChange={(e) => setPudoSettings((s) => ({ ...s, roundPricing: e.target.checked }))} />
                  <span className="font-medium">Round prices to nearest X9</span>
                  <span className="text-xs text-gray-400">e.g. R85.16 → R89</span>
                </label>
              </div>
            </div>

            {/* Package sizes */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Package Sizes &amp; Pricing</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-2 py-2 text-left font-semibold text-gray-600">Size</th>
                      <th className="px-2 py-2 text-left font-semibold text-gray-600">Dimensions</th>
                      <th className="px-2 py-2 text-left font-semibold text-gray-600">Max kg</th>
                      <th className="px-2 py-2 text-left font-semibold text-gray-600">Locker price (R)</th>
                      <th className="px-2 py-2 text-left font-semibold text-gray-600">Door price (R)</th>
                      <th className="px-2 py-2 text-left font-semibold text-gray-600">Locker service code</th>
                      <th className="px-2 py-2 text-left font-semibold text-gray-600">Door service code</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pudoSettings.packageSizes.map((pkg, idx) => (
                      <tr key={pkg.code} className="border-t border-gray-100">
                        <td className="px-2 py-1.5">
                          <input className="w-12 border border-gray-200 rounded px-1 py-0.5 text-xs font-bold" value={pkg.label} onChange={(e) => updatePackageSize(idx, "label", e.target.value)} />
                        </td>
                        <td className="px-2 py-1.5">
                          <input className="w-28 border border-gray-200 rounded px-1 py-0.5 text-xs" value={pkg.dimensions} onChange={(e) => updatePackageSize(idx, "dimensions", e.target.value)} />
                        </td>
                        <td className="px-2 py-1.5">
                          <input type="number" step="0.5" min="0" className="w-14 border border-gray-200 rounded px-1 py-0.5 text-xs" value={pkg.maxWeight} onChange={(e) => updatePackageSize(idx, "maxWeight", Number(e.target.value))} />
                        </td>
                        <td className="px-2 py-1.5">
                          <input type="number" step="1" min="0" className="w-16 border border-gray-200 rounded px-1 py-0.5 text-xs" value={pkg.lockerPrice} onChange={(e) => updatePackageSize(idx, "lockerPrice", Number(e.target.value))} />
                        </td>
                        <td className="px-2 py-1.5">
                          <input type="number" step="1" min="0" className="w-16 border border-gray-200 rounded px-1 py-0.5 text-xs" value={pkg.doorPrice} onChange={(e) => updatePackageSize(idx, "doorPrice", Number(e.target.value))} />
                        </td>
                        <td className="px-2 py-1.5">
                          <input className="w-28 border border-gray-200 rounded px-1 py-0.5 text-xs font-mono" value={pkg.lockerServiceCode} onChange={(e) => updatePackageSize(idx, "lockerServiceCode", e.target.value)} />
                        </td>
                        <td className="px-2 py-1.5">
                          <input className="w-28 border border-gray-200 rounded px-1 py-0.5 text-xs font-mono" value={pkg.doorServiceCode} onChange={(e) => updatePackageSize(idx, "doorServiceCode", e.target.value)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Item rules */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Item Count → Package Size Rules</h4>
              <div className="space-y-2">
                {pudoSettings.itemRules.map((rule, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm">
                    <span className="text-gray-500 w-8 text-right">{idx + 1}.</span>
                    <input
                      type="number" min="1" className="w-16 border border-gray-200 rounded px-2 py-1 text-xs"
                      placeholder="Min"
                      value={rule.minItems}
                      onChange={(e) => updateItemRule(idx, "minItems", e.target.value)}
                    />
                    <span className="text-gray-400 text-xs">to</span>
                    <input
                      type="number" min="1" className="w-16 border border-gray-200 rounded px-2 py-1 text-xs"
                      placeholder="Max (blank=∞)"
                      value={rule.maxItems ?? ""}
                      onChange={(e) => updateItemRule(idx, "maxItems", e.target.value || "null")}
                    />
                    <span className="text-gray-400 text-xs">items →</span>
                    <select
                      className="border border-gray-200 rounded px-2 py-1 text-xs"
                      value={rule.packageCode}
                      onChange={(e) => updateItemRule(idx, "packageCode", e.target.value)}
                    >
                      {pudoSettings.packageSizes.map((p) => (
                        <option key={p.code} value={p.code}>{p.label} ({p.dimensions})</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-1">Set Max blank for the last rule to catch all remaining quantities.</p>
            </div>

            <div className="flex gap-2">
              <button type="submit" disabled={pudoSaving} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm disabled:opacity-60">
                {pudoSaving ? "Saving…" : "Save PUDO Settings"}
              </button>
              <button type="button" onClick={testPudoConnection} disabled={pudoTesting} className="px-4 py-2 rounded-lg border border-indigo-200 text-indigo-700 text-sm disabled:opacity-60">
                {pudoTesting ? "Testing…" : "Test Connection"}
              </button>
            </div>
          </form>
        )}

        {!pudoSettings.enabled && (
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={async () => {
                if (!session?.accessToken) return;
                try {
                  await apiRequest("/admin/integrations/pudo/settings", { method: "PUT", body: JSON.stringify(pudoSettings) }, session.accessToken);
                  toast.success("Integration mode saved (Manual)");
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Failed to save");
                }
              }}
              className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm"
            >
              Save Integration Mode
            </button>
          </div>
        )}
      </section>

      {/* Free Shipping + Manual toggle */}
      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="font-bold mb-3">Shipping Rules</h3>
        <form onSubmit={saveShippingSettings} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={freeShippingEnabled} onChange={(e) => setFreeShippingEnabled(e.target.checked)} />
              Enable free shipping threshold
            </label>
            <input min={0} step="0.01" type="number" className="rounded-lg border border-gray-200 px-3 py-2" value={freeShippingThreshold} onChange={(e) => setFreeShippingThreshold(e.target.value)} />
            <span />
          </div>
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={manualShippingEnabled} onChange={(e) => setManualShippingEnabled(e.target.checked)} />
            <span className="font-medium">Show manual shipping methods at checkout</span>
            <span className="text-xs text-gray-400">(disable when using PUDO exclusively)</span>
          </label>
          <button className="px-3 py-2 rounded-lg bg-gray-900 text-white text-sm">Save Rules</button>
        </form>
      </section>

      {/* Manual Shipping Methods */}
      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="font-bold mb-1">Manual Shipping Methods</h3>
        <p className="text-sm text-gray-500 mb-3">Flat-rate methods shown at checkout when manual shipping is enabled above.</p>
        <form onSubmit={createMethod} className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
          <input required className="rounded-lg border border-gray-200 px-3 py-2" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <input required min={0} step="0.01" type="number" className="rounded-lg border border-gray-200 px-3 py-2" placeholder="Price" value={price} onChange={(e) => setPrice(e.target.value)} />
          <input className="rounded-lg border border-gray-200 px-3 py-2" placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
          <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />Active</label>
          <button className="px-3 py-2 rounded-lg bg-gray-900 text-white text-sm">Create</button>
        </form>

        {methods.length === 0 ? <EmptyState label="No shipping methods yet." /> : methods.map((method) => (
          <div key={method.id} className="border border-gray-100 rounded-lg p-3 mb-2">
            {editingId === method.id ? (
              <form onSubmit={saveEdit} className="grid grid-cols-1 md:grid-cols-6 gap-2 items-center">
                <input required className="rounded-lg border border-gray-200 px-3 py-2" value={editName} onChange={(e) => setEditName(e.target.value)} />
                <input required min={0} step="0.01" type="number" className="rounded-lg border border-gray-200 px-3 py-2" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} />
                <input className="rounded-lg border border-gray-200 px-3 py-2" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
                <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={editActive} onChange={(e) => setEditActive(e.target.checked)} />Active</label>
                <button className="px-3 py-2 rounded-lg bg-gray-900 text-white text-sm">Save</button>
                <button type="button" onClick={() => setEditingId(null)} className="px-3 py-2 rounded-lg border border-gray-200 text-sm">Cancel</button>
              </form>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{method.name}</p>
                  <p className="text-xs text-gray-500">{formatRand(Number(method.price))} · {method.description || "No description"} · {method.isActive ? "Active" : "Disabled"}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => startEdit(method)} className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs">Edit</button>
                  {method.isActive
                    ? <button onClick={() => deactivate(method.id)} className="px-3 py-1.5 rounded-lg border border-red-200 text-red-700 text-xs">Disable</button>
                    : <button onClick={() => enable(method)} className="px-3 py-1.5 rounded-lg border border-green-200 text-green-700 text-xs">Enable</button>
                  }
                </div>
              </div>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
