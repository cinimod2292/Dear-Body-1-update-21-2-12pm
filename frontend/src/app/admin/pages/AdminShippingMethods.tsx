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

type PudoSettings = {
  enabled: boolean;
  apiKey: string;
  sandbox: boolean;
  accountNumber?: string;
  senderName?: string;
  senderPhone?: string;
  senderEmail?: string;
};

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

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editActive, setEditActive] = useState(true);

  // PUDO settings state
  const [pudoSettings, setPudoSettings] = useState<PudoSettings>({
    enabled: false,
    apiKey: "",
    sandbox: true,
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
        apiRequest<{ data: { freeShippingEnabled: boolean; freeShippingThreshold: number } }>("/admin/shipping-settings", {}, session.accessToken),
        apiRequest<{ data: PudoSettings }>("/admin/integrations/pudo/settings", {}, session.accessToken),
      ]);
      setMethods(methodsRes.data);
      setFreeShippingEnabled(settingsRes.data.freeShippingEnabled);
      setFreeShippingThreshold(String(settingsRes.data.freeShippingThreshold));
      setPudoSettings(pudoRes.data);
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
        body: JSON.stringify({ freeShippingEnabled, freeShippingThreshold: Number(freeShippingThreshold) }),
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
    if (!pudoSettings.apiKey) {
      toast.error("Enter an API key first");
      return;
    }
    try {
      setPudoTesting(true);
      // Save first, then test by fetching lockers
      await apiRequest("/admin/integrations/pudo/settings", {
        method: "PUT",
        body: JSON.stringify(pudoSettings),
      }, session.accessToken);
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
      setName("");
      setPrice("");
      setDescription("");
      setActive(true);
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

  if (loading) return <LoadingState label="Loading shipping methods..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-black text-gray-900">Shipping Methods</h2>
        <p className="text-sm text-gray-500">Manage shipping options and free shipping rules for your store.</p>
      </div>

      {/* Courier Integration Toggle */}
      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="font-bold mb-1">Courier Integration</h3>
        <p className="text-sm text-gray-500 mb-4">Choose how you fulfil shipments. Manual setup is always available regardless of your selection.</p>
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
            <span className="block text-xs mt-0.5 opacity-70">Create PUDO locker shipments from order detail</span>
          </button>
        </div>

        {pudoSettings.enabled && (
          <form onSubmit={savePudoSettings} className="space-y-4 border-t border-gray-100 pt-4">
            <p className="text-xs text-indigo-700 bg-indigo-50 rounded-lg px-3 py-2">
              PUDO is enabled. Manual tracking is still available on every order — PUDO adds an additional "Create PUDO Shipment" panel.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">API Key <span className="text-red-500">*</span></label>
                <input
                  type="password"
                  required
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  placeholder="Your PUDO / Courier Guy API key"
                  value={pudoSettings.apiKey}
                  onChange={(e) => setPudoSettings((s) => ({ ...s, apiKey: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Account Number (optional)</label>
                <input
                  type="text"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  placeholder="Courier Guy account number"
                  value={pudoSettings.accountNumber ?? ""}
                  onChange={(e) => setPudoSettings((s) => ({ ...s, accountNumber: e.target.value || undefined }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Default Sender Name</label>
                <input
                  type="text"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  placeholder="Your store name"
                  value={pudoSettings.senderName ?? ""}
                  onChange={(e) => setPudoSettings((s) => ({ ...s, senderName: e.target.value || undefined }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Default Sender Phone</label>
                <input
                  type="tel"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  placeholder="0800 000 000"
                  value={pudoSettings.senderPhone ?? ""}
                  onChange={(e) => setPudoSettings((s) => ({ ...s, senderPhone: e.target.value || undefined }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Default Sender Email</label>
                <input
                  type="email"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  placeholder="store@example.com"
                  value={pudoSettings.senderEmail ?? ""}
                  onChange={(e) => setPudoSettings((s) => ({ ...s, senderEmail: e.target.value || undefined }))}
                />
              </div>
            </div>

            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={pudoSettings.sandbox}
                onChange={(e) => setPudoSettings((s) => ({ ...s, sandbox: e.target.checked }))}
              />
              <span>Sandbox / test mode</span>
              <span className="text-xs text-gray-400">(disable for live production shipments)</span>
            </label>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={pudoSaving}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm disabled:opacity-60"
              >
                {pudoSaving ? "Saving…" : "Save PUDO Settings"}
              </button>
              <button
                type="button"
                onClick={testPudoConnection}
                disabled={pudoTesting}
                className="px-4 py-2 rounded-lg border border-indigo-200 text-indigo-700 text-sm disabled:opacity-60"
              >
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
                  await apiRequest("/admin/integrations/pudo/settings", {
                    method: "PUT",
                    body: JSON.stringify(pudoSettings),
                  }, session.accessToken);
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

      {/* Free Shipping Rules */}
      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="font-bold mb-3">Free Shipping Rules</h3>
        <form onSubmit={saveShippingSettings} className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={freeShippingEnabled} onChange={(e) => setFreeShippingEnabled(e.target.checked)} />Enable free shipping threshold</label>
          <input min={0} step="0.01" type="number" className="rounded-lg border border-gray-200 px-3 py-2" value={freeShippingThreshold} onChange={(e) => setFreeShippingThreshold(e.target.value)} />
          <button className="px-3 py-2 rounded-lg bg-gray-900 text-white text-sm">Save Rules</button>
        </form>
      </section>

      {/* Manual Shipping Methods */}
      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="font-bold mb-1">Manual Shipping Methods</h3>
        <p className="text-sm text-gray-500 mb-3">These flat-rate methods are always available at checkout regardless of courier integration mode.</p>
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
