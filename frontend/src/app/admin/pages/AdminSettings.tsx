import { FormEvent, useEffect, useState } from "react";
import { apiRequest } from "../api/client";
import { useAdminAuth } from "../context/AdminAuthContext";
import { ErrorState, LoadingState } from "../components/AdminState";
import { toast } from "sonner";

export default function AdminSettings() {
  const { session } = useAdminAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [storeName, setStoreName] = useState("");
  const [storeEmail, setStoreEmail] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!session?.accessToken) return;
    try {
      setLoading(true);
      setError(null);
      const res = await apiRequest<{ data: { items: Array<{ key: string; value: unknown }> } }>("/admin/settings?page=1&perPage=100", {}, session.accessToken);
      const map = new Map(res.data.items.map((s) => [s.key, s.value]));
      setStoreName((map.get("storeName") as string) ?? "Dear Body");
      setStoreEmail((map.get("storeEmail") as string) ?? "hello@dearbody.com");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [session?.accessToken]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.accessToken) return;

    try {
      setSaving(true);
      await Promise.all([
        apiRequest("/admin/settings", { method: "PUT", body: JSON.stringify({ scope: "store", key: "storeName", value: storeName }) }, session.accessToken),
        apiRequest("/admin/settings", { method: "PUT", body: JSON.stringify({ scope: "store", key: "storeEmail", value: storeEmail }) }, session.accessToken),
      ]);
      toast.success("Settings saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState label="Loading settings..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <form onSubmit={save} className="space-y-4 max-w-2xl">
      <div>
        <h2 className="text-2xl font-black text-gray-900">Store Settings</h2>
        <p className="text-sm text-gray-500">Core settings used across the storefront and admin portal.</p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Store Name</label>
          <input className="w-full rounded-lg border border-gray-200 px-3 py-2" value={storeName} onChange={(e) => setStoreName(e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Support Email</label>
          <input className="w-full rounded-lg border border-gray-200 px-3 py-2" type="email" value={storeEmail} onChange={(e) => setStoreEmail(e.target.value)} required />
        </div>
      </div>

      <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm disabled:opacity-70">
        {saving ? "Saving..." : "Save Settings"}
      </button>
    </form>
  );
}
