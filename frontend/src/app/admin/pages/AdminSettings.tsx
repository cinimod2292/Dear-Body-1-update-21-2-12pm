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

interface XeroSettings {
  enabled: boolean;
  clientId: string;
  clientSecretConfigured: boolean;
  redirectUri: string;
  tenantId: string;
  scopes: string[];
  connectionStatus: "connected" | "disconnected" | "expired";
  tokenExpiresAt: string | null;
}

interface XeroSyncRecord {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  status: string;
  attempts: number;
  externalId?: string | null;
  lastError?: string | null;
  updatedAt: string;
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

  const [xeroEnabled, setXeroEnabled] = useState(false);
  const [xeroClientId, setXeroClientId] = useState("");
  const [xeroClientSecret, setXeroClientSecret] = useState("");
  const [xeroRedirectUri, setXeroRedirectUri] = useState("");
  const [xeroTenantId, setXeroTenantId] = useState("");
  const [xeroScopes, setXeroScopes] = useState("openid profile email accounting.contacts accounting.transactions");
  const [xeroConnectionStatus, setXeroConnectionStatus] = useState<"connected" | "disconnected" | "expired">("disconnected");
  const [xeroTokenExpiresAt, setXeroTokenExpiresAt] = useState<string | null>(null);
  const [xeroSecretConfigured, setXeroSecretConfigured] = useState(false);
  const [xeroSyncRecords, setXeroSyncRecords] = useState<XeroSyncRecord[]>([]);

  const load = async () => {
    if (!session?.accessToken) return;
    try {
      setLoading(true);
      setError(null);
      const [settingsRes, stitchRes, paymentEventsRes, xeroSettingsRes, xeroSyncRes] = await Promise.allSettled([
        apiRequest<{ data: { items: Array<{ key: string; value: unknown }> } }>("/admin/settings?page=1&perPage=100", {}, session.accessToken),
        apiRequest<{ data: StitchSettings }>("/admin/payments/settings/stitch", {}, session.accessToken),
        apiRequest<{ data: { items: PaymentEvent[] } }>("/admin/payments/events?page=1&perPage=10", {}, session.accessToken),
        apiRequest<{ data: XeroSettings }>("/admin/integrations/xero/settings", {}, session.accessToken),
        apiRequest<{ data: { items: XeroSyncRecord[] } }>("/admin/integrations/xero/sync-records?page=1&perPage=10", {}, session.accessToken),
      ]);

      if (settingsRes.status === "fulfilled") {
        const map = new Map(settingsRes.value.data.items.map((s) => [s.key, s.value]));
        setStoreName((map.get("storeName") as string) ?? "Dear Body");
        setStoreEmail((map.get("storeEmail") as string) ?? "hello@dearbody.com");
      }
      if (stitchRes.status === "fulfilled") {
        setStitchEnabled(stitchRes.value.data.enabled);
        setStitchMode(stitchRes.value.data.mode);
        setMerchantId(stitchRes.value.data.merchantId || "");
        setRedirectUrl(stitchRes.value.data.redirectUrl || "");
        setCallbackUrl(stitchRes.value.data.callbackUrl || "");
        setApiBaseUrl(stitchRes.value.data.apiBaseUrl || "");
        setApiKeyConfigured(stitchRes.value.data.apiKeyConfigured);
        setWebhookConfigured(stitchRes.value.data.webhookSecretConfigured);
      }
      if (paymentEventsRes.status === "fulfilled") setPaymentEvents(paymentEventsRes.value.data.items);
      if (xeroSettingsRes.status === "fulfilled") {
        setXeroEnabled(xeroSettingsRes.value.data.enabled);
        setXeroClientId(xeroSettingsRes.value.data.clientId || "");
        setXeroRedirectUri(xeroSettingsRes.value.data.redirectUri || "");
        setXeroTenantId(xeroSettingsRes.value.data.tenantId || "");
        setXeroScopes((xeroSettingsRes.value.data.scopes || []).join(" "));
        setXeroConnectionStatus(xeroSettingsRes.value.data.connectionStatus);
        setXeroTokenExpiresAt(xeroSettingsRes.value.data.tokenExpiresAt);
        setXeroSecretConfigured(xeroSettingsRes.value.data.clientSecretConfigured);
      }
      if (xeroSyncRes.status === "fulfilled") setXeroSyncRecords(xeroSyncRes.value.data.items);

      const failed = [settingsRes, stitchRes, paymentEventsRes, xeroSettingsRes, xeroSyncRes].filter((r) => r.status === "rejected");
      if (failed.length > 0) {
        toast.error(`Loaded with partial failures (${failed.length})`);
      }
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
    if (!session?.accessToken || saving) return;
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
    if (!session?.accessToken || saving) return;
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
      const res = await apiRequest<{ data: StitchSettings }>("/admin/payments/settings/stitch", { method: "PUT", body: JSON.stringify(payload) }, session.accessToken);
      setApiKey("");
      setWebhookSecret("");
      setApiKeyConfigured(res.data.apiKeyConfigured);
      setWebhookConfigured(res.data.webhookSecretConfigured);
      toast.success("Stitch settings saved");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save Stitch settings");
    } finally {
      setSaving(false);
    }
  };

  const saveXero = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.accessToken || saving) return;
    try {
      setSaving(true);
      const payload = {
        enabled: xeroEnabled,
        clientId: xeroClientId,
        clientSecret: xeroClientSecret || undefined,
        redirectUri: xeroRedirectUri,
        tenantId: xeroTenantId || undefined,
        scopes: xeroScopes.split(/\s+/).filter(Boolean),
      };
      const res = await apiRequest<{ data: XeroSettings }>("/admin/integrations/xero/settings", { method: "PUT", body: JSON.stringify(payload) }, session.accessToken);
      setXeroClientSecret("");
      setXeroSecretConfigured(res.data.clientSecretConfigured);
      setXeroConnectionStatus(res.data.connectionStatus);
      setXeroTokenExpiresAt(res.data.tokenExpiresAt);
      toast.success("Xero settings saved");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save Xero settings");
    } finally {
      setSaving(false);
    }
  };

  const connectXero = async () => {
    if (!session?.accessToken) return;
    try {
      const res = await apiRequest<{ data: { url: string } }>("/admin/integrations/xero/connect-url", {}, session.accessToken);
      window.open(res.data.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start Xero connect flow");
    }
  };

  const retryXeroSync = async (id: string) => {
    if (!session?.accessToken) return;
    try {
      await apiRequest(`/admin/integrations/xero/sync-records/${id}/retry`, { method: "POST", body: JSON.stringify({ force: true }) }, session.accessToken);
      toast.success("Retry started");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Retry failed");
    }
  };

  if (loading) return <LoadingState label="Loading settings..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-6 max-w-4xl">
      <form onSubmit={saveStore} className="space-y-4">
        <h2 className="text-2xl font-black text-gray-900">Store Settings</h2>
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
        <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm disabled:opacity-70">{saving ? "Saving..." : "Save Store Settings"}</button>
      </form>

      <form onSubmit={saveStitch} className="space-y-4">
        <h2 className="text-2xl font-black text-gray-900">Stitch Payments</h2>
        <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={stitchEnabled} onChange={(e) => setStitchEnabled(e.target.checked)} />Enable Stitch</label>
          <select className="w-full rounded-lg border border-gray-200 px-3 py-2" value={stitchMode} onChange={(e) => setStitchMode(e.target.value as "sandbox" | "production") }><option value="sandbox">Sandbox</option><option value="production">Production</option></select>
          <input className="w-full rounded-lg border border-gray-200 px-3 py-2" placeholder="Merchant ID" value={merchantId} onChange={(e) => setMerchantId(e.target.value)} required />
          <input type="password" className="w-full rounded-lg border border-gray-200 px-3 py-2" placeholder={`API Key ${apiKeyConfigured ? "(configured)" : "(required)"}`} value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
          <input type="password" className="w-full rounded-lg border border-gray-200 px-3 py-2" placeholder={`Webhook Secret ${webhookConfigured ? "(configured)" : "(optional)"}`} value={webhookSecret} onChange={(e) => setWebhookSecret(e.target.value)} />
          <input className="w-full rounded-lg border border-gray-200 px-3 py-2" placeholder="Redirect URL" value={redirectUrl} onChange={(e) => setRedirectUrl(e.target.value)} />
          <input className="w-full rounded-lg border border-gray-200 px-3 py-2" placeholder="Callback URL" value={callbackUrl} onChange={(e) => setCallbackUrl(e.target.value)} />
          <input className="w-full rounded-lg border border-gray-200 px-3 py-2" placeholder="Custom API Base URL" value={apiBaseUrl} onChange={(e) => setApiBaseUrl(e.target.value)} />
        </div>
        <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm disabled:opacity-70">{saving ? "Saving..." : "Save Stitch Settings"}</button>
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

      <form onSubmit={saveXero} className="space-y-4">
        <h2 className="text-2xl font-black text-gray-900">Xero Accounting</h2>
        <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={xeroEnabled} onChange={(e) => setXeroEnabled(e.target.checked)} />Enable Xero</label>
            <span className={`text-xs px-2 py-1 rounded ${xeroConnectionStatus === "connected" ? "bg-emerald-100 text-emerald-700" : xeroConnectionStatus === "expired" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-700"}`}>{xeroConnectionStatus.toUpperCase()}</span>
          </div>
          <input className="w-full rounded-lg border border-gray-200 px-3 py-2" placeholder="Client ID" value={xeroClientId} onChange={(e) => setXeroClientId(e.target.value)} required />
          <input type="password" className="w-full rounded-lg border border-gray-200 px-3 py-2" placeholder={`Client Secret ${xeroSecretConfigured ? "(configured)" : "(required)"}`} value={xeroClientSecret} onChange={(e) => setXeroClientSecret(e.target.value)} />
          <input className="w-full rounded-lg border border-gray-200 px-3 py-2" placeholder="Redirect URI" value={xeroRedirectUri} onChange={(e) => setXeroRedirectUri(e.target.value)} required />
          <input className="w-full rounded-lg border border-gray-200 px-3 py-2" placeholder="Tenant ID" value={xeroTenantId} onChange={(e) => setXeroTenantId(e.target.value)} />
          <input className="w-full rounded-lg border border-gray-200 px-3 py-2" placeholder="Scopes (space separated)" value={xeroScopes} onChange={(e) => setXeroScopes(e.target.value)} />
          <p className="text-xs text-gray-500">Token expiry: {xeroTokenExpiresAt ? new Date(xeroTokenExpiresAt).toLocaleString() : "Not connected"}</p>
          <button type="button" onClick={connectXero} className="px-3 py-2 rounded-lg border border-indigo-300 text-indigo-700 text-sm">Connect / Reconnect Xero</button>
        </div>
        <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm disabled:opacity-70">{saving ? "Saving..." : "Save Xero Settings"}</button>
      </form>

      <section className="space-y-3">
        <h3 className="text-lg font-bold text-gray-900">Xero Sync History</h3>
        <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-2">
          {xeroSyncRecords.length === 0 ? <p className="text-sm text-gray-500">No sync records yet.</p> : xeroSyncRecords.map((record) => (
            <div key={record.id} className="text-sm border border-gray-100 rounded-lg p-2 flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{record.entityType} · {record.action} · {record.status}</p>
                <p className="text-xs text-gray-500">Entity: {record.entityId} · Attempts: {record.attempts} · {new Date(record.updatedAt).toLocaleString()}</p>
                {record.lastError ? <p className="text-xs text-red-600 mt-1">{record.lastError}</p> : null}
              </div>
              <button type="button" onClick={() => retryXeroSync(record.id)} className="px-2 py-1 rounded border border-gray-300 text-xs">Retry</button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
