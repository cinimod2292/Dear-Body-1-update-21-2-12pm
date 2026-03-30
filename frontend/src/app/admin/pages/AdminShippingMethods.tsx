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

  const load = async () => {
    if (!session?.accessToken) return;
    try {
      setLoading(true);
      setError(null);
      const [methodsRes, settingsRes] = await Promise.all([
        apiRequest<{ data: ShippingMethod[] }>("/admin/shipping-methods", {}, session.accessToken),
        apiRequest<{ data: { freeShippingEnabled: boolean; freeShippingThreshold: number } }>("/admin/shipping-settings", {}, session.accessToken),
      ]);
      setMethods(methodsRes.data);
      setFreeShippingEnabled(settingsRes.data.freeShippingEnabled);
      setFreeShippingThreshold(String(settingsRes.data.freeShippingThreshold));
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

  if (loading) return <LoadingState label="Loading shipping methods..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-5">
      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="font-bold mb-3">Free Shipping Rules</h3>
        <form onSubmit={saveShippingSettings} className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={freeShippingEnabled} onChange={(e) => setFreeShippingEnabled(e.target.checked)} />Enable free shipping threshold</label>
          <input min={0} step="0.01" type="number" className="rounded-lg border border-gray-200 px-3 py-2" value={freeShippingThreshold} onChange={(e) => setFreeShippingThreshold(e.target.value)} />
          <button className="px-3 py-2 rounded-lg bg-gray-900 text-white text-sm">Save Rules</button>
        </form>
      </section>

      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="font-bold mb-3">Create Shipping Method</h3>
        <form onSubmit={createMethod} className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <input required className="rounded-lg border border-gray-200 px-3 py-2" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <input required min={0} step="0.01" type="number" className="rounded-lg border border-gray-200 px-3 py-2" placeholder="Price" value={price} onChange={(e) => setPrice(e.target.value)} />
          <input className="rounded-lg border border-gray-200 px-3 py-2" placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
          <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />Active</label>
          <button className="px-3 py-2 rounded-lg bg-gray-900 text-white text-sm">Create</button>
        </form>
      </section>

      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="font-bold mb-3">Current Methods</h3>
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
                  {method.isActive ? <button onClick={() => deactivate(method.id)} className="px-3 py-1.5 rounded-lg border border-red-200 text-red-700 text-xs">Disable</button> : null}
                </div>
              </div>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
