import { FormEvent, useEffect, useState } from "react";
import { apiRequest } from "../api/client";
import { useAdminAuth } from "../context/AdminAuthContext";
import { ErrorState, LoadingState } from "../components/AdminState";
import { toast } from "sonner";

interface PaymentEvent {
  id: string;
  gateway: string;
  eventType: string;
  status: string;
  error?: string | null;
  createdAt: string;
  order?: { orderNumber: string } | null;
}

interface StitchSettings {
  enabled: boolean;
  mode: "sandbox" | "production";
  merchantId: string;
  apiKeyConfigured: boolean;
  webhookSecretConfigured: boolean;
  redirectUrl: string;
  callbackUrl: string;
  apiBaseUrl: string;
}

export default function AdminSettings() {
  const { session } = useAdminAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [storeName, setStoreName] = useState("");
  const [storeEmail, setStoreEmail] = useState("");
  const [saving, setSaving] = useState(false);

  const [stitchEnabled, setStitchEnabled] = useState(false);
  const [stitchMode, setStitchMode] = useState<"sandbox" | "production">("sandbox");
  const [merchantId, setMerchantId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [redirectUrl, setRedirectUrl] = useState("");
  const [callbackUrl, setCallbackUrl] = useState("");
  const [apiBaseUrl, setApiBaseUrl] = useState("");
  const [apiKeyConfigured, setApiKeyConfigured] = useState(false);
  const [webhookConfigured, setWebhookConfigured] = useState(false);
  const [paymentEvents, setPaymentEvents] = useState<PaymentEvent[]>([]);

  const load = async () => {
    if (!session?.accessToken) return;
    try {
      setLoading(true);
      setError(null);

      const [settingsRes, stitchRes, eventsRes] = await Promise.all([
        apiRequest<{ data: { items: Array<{ key: string; value: unknown }> } }>("/admin/settings?page=1&perPage=100", {}, session.accessToken),
        apiRequest<{ data: StitchSettings }>("/admin/payments/settings/stitch", {}, session.accessToken),
        apiRequest<{ data: { items: PaymentEvent[] } }>("/admin/payments/events?page=1&perPage=10", {}, session.accessToken),
      ]);

      const map = new Map(settingsRes.data.items.map((s) => [s.key, s.value]));
      setStoreName((map.get("storeName") as string) ?? "Dear Body");
      setStoreEmail((map.get("storeEmail") as string) ?? "hello@dearbody.com");

      setStitchEnabled(stitchRes.data.enabled);
      setStitchMode(stitchRes.data.mode);
      setMerchantId(stitchRes.data.merchantId || "");
      setRedirectUrl(stitchRes.data.redirectUrl || "");
      setCallbackUrl(stitchRes.data.callbackUrl || "");
      setApiBaseUrl(stitchRes.data.apiBaseUrl || "");
      setApiKeyConfigured(stitchRes.data.apiKeyConfigured);
      setWebhookConfigured(stitchRes.data.webhookSecretConfigured);
      setPaymentEvents(eventsRes.data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [session?.accessToken]);

  const saveStore = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.accessToken) return;

    try {
      setSaving(true);
      await Promise.all([
        apiRequest("/admin/settings", { method: "PUT", body: JSON.stringify({ scope: "store", key: "storeName", value: storeName }) }, session.accessToken),
        apiRequest("/admin/settings", { method: "PUT", body: JSON.stringify({ scope: "store", key: "storeEmail", value: storeEmail }) }, session.accessToken),
      ]);
      toast.success("Store settings saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const saveStitch = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.accessToken) return;

    try {
      setSaving(true);
      const payload = {
        enabled: stitchEnabled,
        mode: stitchMode,
        merchantId,
        apiKey: apiKey || undefined,
        webhookSecret: webhookSecret || undefined,
        redirectUrl: redirectUrl || undefined,
        callbackUrl: callbackUrl || undefined,
        apiBaseUrl: apiBaseUrl || undefined,
      };

      const res = await apiRequest<{ data: StitchSettings }>(
        "/admin/payments/settings/stitch",
        { method: "PUT", body: JSON.stringify(payload) },
        session.accessToken,
      );

      setApiKey("");
      setWebhookSecret("");
      setApiKeyConfigured(res.data.apiKeyConfigured);
      setWebhookConfigured(res.data.webhookSecretConfigured);
      toast.success("Stitch settings saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save Stitch settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState label="Loading settings..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-6 max-w-3xl">
      <form onSubmit={saveStore} className="space-y-4">
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
          {saving ? "Saving..." : "Save Store Settings"}
        </button>
      </form>

      <form onSubmit={saveStitch} className="space-y-4">
        <div>
          <h2 className="text-2xl font-black text-gray-900">Stitch Payments</h2>
          <p className="text-sm text-gray-500">Manage Stitch credentials, mode, and callback configuration.</p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
          <div className="flex items-center gap-2">
            <input id="stitch-enabled" type="checkbox" checked={stitchEnabled} onChange={(e) => setStitchEnabled(e.target.checked)} />
            <label htmlFor="stitch-enabled" className="text-sm font-medium text-gray-700">Enable Stitch</label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mode</label>
            <select className="w-full rounded-lg border border-gray-200 px-3 py-2" value={stitchMode} onChange={(e) => setStitchMode(e.target.value as "sandbox" | "production") }>
              <option value="sandbox">Sandbox</option>
              <option value="production">Production</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Merchant ID</label>
            <input className="w-full rounded-lg border border-gray-200 px-3 py-2" value={merchantId} onChange={(e) => setMerchantId(e.target.value)} required />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">API Key {apiKeyConfigured ? "(configured)" : "(required)"}</label>
            <input type="password" className="w-full rounded-lg border border-gray-200 px-3 py-2" placeholder="Enter new key to rotate" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Webhook Secret {webhookConfigured ? "(configured)" : "(optional)"}</label>
            <input type="password" className="w-full rounded-lg border border-gray-200 px-3 py-2" placeholder="Enter new secret to rotate" value={webhookSecret} onChange={(e) => setWebhookSecret(e.target.value)} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Redirect URL</label>
            <input className="w-full rounded-lg border border-gray-200 px-3 py-2" value={redirectUrl} onChange={(e) => setRedirectUrl(e.target.value)} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Webhook Callback URL</label>
            <input className="w-full rounded-lg border border-gray-200 px-3 py-2" value={callbackUrl} onChange={(e) => setCallbackUrl(e.target.value)} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Custom API Base URL (optional)</label>
            <input className="w-full rounded-lg border border-gray-200 px-3 py-2" value={apiBaseUrl} onChange={(e) => setApiBaseUrl(e.target.value)} />
          </div>
        </div>

        <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm disabled:opacity-70">
          {saving ? "Saving..." : "Save Stitch Settings"}
        </button>
      </form>


      <section className="space-y-3">
        <h3 className="text-lg font-bold text-gray-900">Recent Payment Events</h3>
        <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-2">
          {paymentEvents.length === 0 ? <p className="text-sm text-gray-500">No payment events yet.</p> : paymentEvents.map((event) => (
            <div key={event.id} className="text-sm border border-gray-100 rounded-lg p-2">
              <p className="font-medium">{event.gateway.toUpperCase()} · {event.eventType} · {event.status}</p>
              <p className="text-xs text-gray-500">{event.order?.orderNumber ? `Order #${event.order.orderNumber} · ` : ""}{new Date(event.createdAt).toLocaleString()}</p>
              {event.error ? <p className="text-xs text-red-600 mt-1">{event.error}</p> : null}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
