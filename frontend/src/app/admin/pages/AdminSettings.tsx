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

interface AbandonedCartConfig {
  enabled: boolean;
  inactivityThresholdMinutes: number;
  reminderDelayMinutes: number;
  clearDelayMinutes: number;
  reminderEnabled: boolean;
  templateKey: string;
  helpText: string;
}

interface StorageSettings {
  provider: "local" | "s3" | "cloudflare-r2";
  bucket: string;
  accountId: string;
  accessKeyId: string;
  accessKeyIdMasked?: string;
  secretAccessKeyConfigured: boolean;
  endpoint: string;
  publicBaseUrl: string;
  signedUrlTtlSeconds: number;
  forcePathStyle: boolean;
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
  const [abandonedConfig, setAbandonedConfig] = useState<AbandonedCartConfig>({
    enabled: true,
    inactivityThresholdMinutes: 30,
    reminderDelayMinutes: 60,
    clearDelayMinutes: 120,
    reminderEnabled: true,
    templateKey: "abandoned_cart_reminder",
    helpText: "When a cart is auto-cleared, any reserved stock is released.",
  });
  const [storageConfig, setStorageConfig] = useState<StorageSettings>({
    provider: "local",
    bucket: "",
    accountId: "",
    accessKeyId: "",
    accessKeyIdMasked: "",
    secretAccessKeyConfigured: false,
    endpoint: "",
    publicBaseUrl: "",
    signedUrlTtlSeconds: 900,
    forcePathStyle: false,
  });
  const [storageSecret, setStorageSecret] = useState("");

  const load = async () => {
    if (!session?.accessToken) return;
    try {
      setLoading(true);
      setError(null);
      const [settingsRes, stitchRes, paymentEventsRes, xeroSettingsRes, xeroSyncRes, abandonedConfigRes, storageRes] = await Promise.allSettled([
        apiRequest<{ data: { items: Array<{ key: string; value: unknown }> } }>("/admin/settings?page=1&perPage=100", {}, session.accessToken),
        apiRequest<{ data: StitchSettings }>("/admin/payments/settings/stitch", {}, session.accessToken),
        apiRequest<{ data: { items: PaymentEvent[] } }>("/admin/payments/events?page=1&perPage=10", {}, session.accessToken),
        apiRequest<{ data: XeroSettings }>("/admin/integrations/xero/settings", {}, session.accessToken),
        apiRequest<{ data: { items: XeroSyncRecord[] } }>("/admin/integrations/xero/sync-records?page=1&perPage=10", {}, session.accessToken),
        apiRequest<{ data: AbandonedCartConfig }>("/admin/ops/abandoned-carts/config", {}, session.accessToken),
        apiRequest<{ data: StorageSettings }>("/admin/settings/storage", {}, session.accessToken),
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
      if (abandonedConfigRes.status === "fulfilled") setAbandonedConfig(abandonedConfigRes.value.data);
      if (storageRes.status === "fulfilled") setStorageConfig(storageRes.value.data);

      const failed = [settingsRes, stitchRes, paymentEventsRes, xeroSettingsRes, xeroSyncRes, abandonedConfigRes, storageRes].filter((r) => r.status === "rejected");
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

  const saveAbandonedCartConfig = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.accessToken || saving) return;
    try {
      setSaving(true);
      await apiRequest("/admin/ops/abandoned-carts/config", { method: "PUT", body: JSON.stringify(abandonedConfig) }, session.accessToken);
      toast.success("Abandoned cart settings saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save abandoned cart settings");
    } finally {
      setSaving(false);
    }
  };

  const saveStorage = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.accessToken || saving) return;
    try {
      setSaving(true);
      const payload = {
        provider: storageConfig.provider,
        bucket: storageConfig.bucket || undefined,
        accountId: storageConfig.accountId || undefined,
        accessKeyId: storageConfig.accessKeyId || undefined,
        secretAccessKey: storageSecret || undefined,
        endpoint: storageConfig.endpoint || undefined,
        publicBaseUrl: storageConfig.publicBaseUrl || undefined,
        signedUrlTtlSeconds: storageConfig.signedUrlTtlSeconds,
        forcePathStyle: storageConfig.forcePathStyle,
      };
      const res = await apiRequest<{ data: StorageSettings }>("/admin/settings/storage", { method: "PUT", body: JSON.stringify(payload) }, session.accessToken);
      setStorageConfig(res.data);
      setStorageSecret("");
      toast.success("Storage settings saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save storage settings");
    } finally {
      setSaving(false);
    }
  };

  const testStorage = async () => {
    if (!session?.accessToken || saving) return;
    try {
      setSaving(true);
      const res = await apiRequest<{ data: { ok: boolean; message: string } }>("/admin/settings/storage/test", { method: "POST" }, session.accessToken);
      if (res.data.ok) toast.success(res.data.message);
      else toast.error(res.data.message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Storage connection failed");
    } finally {
      setSaving(false);
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

      <form onSubmit={saveStorage} className="space-y-4">
        <h2 className="text-2xl font-black text-gray-900">Storage Settings</h2>
        <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
          <select className="w-full rounded-lg border border-gray-200 px-3 py-2" value={storageConfig.provider} onChange={(e) => {
            const provider = e.target.value as StorageSettings["provider"];
            setStorageConfig((prev) => ({
              ...prev,
              provider,
              endpoint: provider === "cloudflare-r2" && prev.accountId ? `https://${prev.accountId}.r2.cloudflarestorage.com` : prev.endpoint,
            }));
          }}>
            <option value="local">local</option>
            <option value="s3">s3</option>
            <option value="cloudflare-r2">cloudflare-r2</option>
          </select>
          <input className="w-full rounded-lg border border-gray-200 px-3 py-2" placeholder="Bucket Name" value={storageConfig.bucket} onChange={(e) => setStorageConfig((prev) => ({ ...prev, bucket: e.target.value }))} />
          <input className="w-full rounded-lg border border-gray-200 px-3 py-2" placeholder="Account ID (Cloudflare R2)" value={storageConfig.accountId} onChange={(e) => setStorageConfig((prev) => ({ ...prev, accountId: e.target.value, endpoint: prev.provider === "cloudflare-r2" && e.target.value ? `https://${e.target.value}.r2.cloudflarestorage.com` : prev.endpoint }))} />
          <input className="w-full rounded-lg border border-gray-200 px-3 py-2" placeholder={`Access Key ID ${storageConfig.accessKeyIdMasked ? `(current ${storageConfig.accessKeyIdMasked})` : ""}`} value={storageConfig.accessKeyId} onChange={(e) => setStorageConfig((prev) => ({ ...prev, accessKeyId: e.target.value }))} />
          <input type="password" className="w-full rounded-lg border border-gray-200 px-3 py-2" placeholder={`Secret Access Key ${storageConfig.secretAccessKeyConfigured ? "(configured, leave blank to keep)" : ""}`} value={storageSecret} onChange={(e) => setStorageSecret(e.target.value)} />
          <input className="w-full rounded-lg border border-gray-200 px-3 py-2" placeholder="Endpoint URL" value={storageConfig.endpoint} onChange={(e) => setStorageConfig((prev) => ({ ...prev, endpoint: e.target.value }))} />
          <input className="w-full rounded-lg border border-gray-200 px-3 py-2" placeholder="Public Base URL (optional public origin)" value={storageConfig.publicBaseUrl} onChange={(e) => setStorageConfig((prev) => ({ ...prev, publicBaseUrl: e.target.value }))} />
          <input type="number" min={60} max={86400} className="w-full rounded-lg border border-gray-200 px-3 py-2" placeholder="Signed URL TTL (seconds)" value={storageConfig.signedUrlTtlSeconds} onChange={(e) => setStorageConfig((prev) => ({ ...prev, signedUrlTtlSeconds: Number(e.target.value) }))} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={storageConfig.forcePathStyle} onChange={(e) => setStorageConfig((prev) => ({ ...prev, forcePathStyle: e.target.checked }))} />Force path style</label>
          <p className="text-xs text-amber-700">Cloudflare R2 endpoint suggestion: https://&lt;ACCOUNT_ID&gt;.r2.cloudflarestorage.com</p>
          <p className="text-xs text-amber-700">Browser uploads require bucket CORS for PUT from your admin origin.</p>
          <p className="text-xs text-amber-700">Local storage is not durable in production.</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm disabled:opacity-70">{saving ? "Saving..." : "Save Storage Settings"}</button>
          <button type="button" onClick={testStorage} disabled={saving} className="px-4 py-2 rounded-lg border border-gray-300 text-sm disabled:opacity-70">Test Connection</button>
        </div>
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

      <form onSubmit={saveAbandonedCartConfig} className="space-y-4">
        <h2 className="text-2xl font-black text-gray-900">Abandoned Cart Automation</h2>
        <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={abandonedConfig.enabled} onChange={(e) => setAbandonedConfig((prev) => ({ ...prev, enabled: e.target.checked }))} />Enable abandoned cart handling</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={abandonedConfig.reminderEnabled} onChange={(e) => setAbandonedConfig((prev) => ({ ...prev, reminderEnabled: e.target.checked }))} />Enable reminder email</label>
          <input className="w-full rounded-lg border border-gray-200 px-3 py-2" type="number" min={1} value={abandonedConfig.inactivityThresholdMinutes} onChange={(e) => setAbandonedConfig((prev) => ({ ...prev, inactivityThresholdMinutes: Number(e.target.value) }))} placeholder="Inactivity threshold (minutes)" />
          <input className="w-full rounded-lg border border-gray-200 px-3 py-2" type="number" min={1} value={abandonedConfig.reminderDelayMinutes} onChange={(e) => setAbandonedConfig((prev) => ({ ...prev, reminderDelayMinutes: Number(e.target.value) }))} placeholder="Reminder delay (minutes)" />
          <input className="w-full rounded-lg border border-gray-200 px-3 py-2" type="number" min={1} value={abandonedConfig.clearDelayMinutes} onChange={(e) => setAbandonedConfig((prev) => ({ ...prev, clearDelayMinutes: Number(e.target.value) }))} placeholder="Clear/release delay (minutes)" />
          <input className="w-full rounded-lg border border-gray-200 px-3 py-2" value={abandonedConfig.templateKey} onChange={(e) => setAbandonedConfig((prev) => ({ ...prev, templateKey: e.target.value }))} placeholder="Abandoned cart email template key" />
          <textarea className="w-full rounded-lg border border-gray-200 px-3 py-2" value={abandonedConfig.helpText} onChange={(e) => setAbandonedConfig((prev) => ({ ...prev, helpText: e.target.value }))} />
        </div>
        <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm disabled:opacity-70">{saving ? "Saving..." : "Save Abandoned Cart Settings"}</button>
      </form>

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
