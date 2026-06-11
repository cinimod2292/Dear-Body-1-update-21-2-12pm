import { FormEvent, useEffect, useState } from "react";
import { apiRequest } from "../api/client";
import { useAdminAuth } from "../context/AdminAuthContext";
import { ErrorState, LoadingState } from "../components/AdminState";
import { toast } from "sonner";
import { Switch } from "../../components/ui/switch";
import { clearCmsBootstrapCache } from "../../lib/cms";

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
interface PayfastSettings {
  enabled: boolean;
  mode: "sandbox" | "live";
  sandboxMerchantId: string;
  sandboxMerchantKeyConfigured: boolean;
  sandboxPassphraseConfigured: boolean;
  liveMerchantId: string;
  liveMerchantKeyConfigured: boolean;
  livePassphraseConfigured: boolean;
  returnUrl: string;
  cancelUrl: string;
  notifyUrl: string;
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

interface SendgridSettings {
  enabled: boolean;
  fromEmail: string;
  fromName: string;
  replyToEmail: string;
  sandboxMode: boolean;
  apiKeyConfigured: boolean;
}

export default function AdminSettings() {
  const { session } = useAdminAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("status");
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
  const [payfastEnabled, setPayfastEnabled] = useState(false);
  const [payfastMode, setPayfastMode] = useState<"sandbox" | "live">("sandbox");
  const [sandboxMerchantId, setSandboxMerchantId] = useState("");
  const [sandboxMerchantKey, setSandboxMerchantKey] = useState("");
  const [sandboxPassphrase, setSandboxPassphrase] = useState("");
  const [liveMerchantId, setLiveMerchantId] = useState("");
  const [liveMerchantKey, setLiveMerchantKey] = useState("");
  const [livePassphrase, setLivePassphrase] = useState("");
  const [payfastReturnUrl, setPayfastReturnUrl] = useState("");
  const [payfastCancelUrl, setPayfastCancelUrl] = useState("");
  const [payfastNotifyUrl, setPayfastNotifyUrl] = useState("");
  const [sandboxMerchantKeyConfigured, setSandboxMerchantKeyConfigured] = useState(false);
  const [sandboxPassphraseConfigured, setSandboxPassphraseConfigured] = useState(false);
  const [liveMerchantKeyConfigured, setLiveMerchantKeyConfigured] = useState(false);
  const [livePassphraseConfigured, setLivePassphraseConfigured] = useState(false);

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
  const [sendgridConfig, setSendgridConfig] = useState<SendgridSettings>({
    enabled: false,
    fromEmail: "",
    fromName: "",
    replyToEmail: "",
    sandboxMode: false,
    apiKeyConfigured: false,
  });
  const [sendgridApiKey, setSendgridApiKey] = useState("");
  const [sendgridTestTo, setSendgridTestTo] = useState("");
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [comingSoon, setComingSoon] = useState(false);

  const buildStoragePayload = () => ({
    provider: storageConfig.provider,
    bucket: storageConfig.bucket || undefined,
    accountId: storageConfig.accountId || undefined,
    accessKeyId: storageConfig.accessKeyId || undefined,
    secretAccessKey: storageSecret || undefined,
    endpoint: storageConfig.endpoint || undefined,
    publicBaseUrl: storageConfig.publicBaseUrl || undefined,
    signedUrlTtlSeconds: storageConfig.signedUrlTtlSeconds,
    forcePathStyle: storageConfig.forcePathStyle,
  });

  const load = async () => {
    if (!session?.accessToken) return;
    try {
      setLoading(true);
      setError(null);
      const [settingsRes, stitchRes, payfastRes, paymentEventsRes, xeroSettingsRes, xeroSyncRes, abandonedConfigRes, storageRes, sendgridRes, siteConfigRes] = await Promise.allSettled([
        apiRequest<{ data: { items: Array<{ key: string; value: unknown }> } }>("/admin/settings?page=1&perPage=100", {}, session.accessToken),
        apiRequest<{ data: StitchSettings }>("/admin/payments/settings/stitch", {}, session.accessToken),
        apiRequest<{ data: PayfastSettings }>("/admin/payments/settings/payfast", {}, session.accessToken),
        apiRequest<{ data: { items: PaymentEvent[] } }>("/admin/payments/events?page=1&perPage=10", {}, session.accessToken),
        apiRequest<{ data: XeroSettings }>("/admin/integrations/xero/settings", {}, session.accessToken),
        apiRequest<{ data: { items: XeroSyncRecord[] } }>("/admin/integrations/xero/sync-records?page=1&perPage=10", {}, session.accessToken),
        apiRequest<{ data: AbandonedCartConfig }>("/admin/ops/abandoned-carts/config", {}, session.accessToken),
        apiRequest<{ data: StorageSettings }>("/admin/settings/storage", {}, session.accessToken),
        apiRequest<{ data: SendgridSettings }>("/admin/settings/email/sendgrid", {}, session.accessToken),
        apiRequest<{ data: { siteStatus?: { maintenanceMode: boolean; comingSoon: boolean } } }>("/admin/cms/site-config", {}, session.accessToken),
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
      if (payfastRes.status === "fulfilled") {
        setPayfastEnabled(payfastRes.value.data.enabled);
        setPayfastMode(payfastRes.value.data.mode);
        setSandboxMerchantId(payfastRes.value.data.sandboxMerchantId || "");
        setLiveMerchantId(payfastRes.value.data.liveMerchantId || "");
        setPayfastReturnUrl(payfastRes.value.data.returnUrl || "");
        setPayfastCancelUrl(payfastRes.value.data.cancelUrl || "");
        setPayfastNotifyUrl(payfastRes.value.data.notifyUrl || "");
        setSandboxMerchantKeyConfigured(payfastRes.value.data.sandboxMerchantKeyConfigured);
        setSandboxPassphraseConfigured(payfastRes.value.data.sandboxPassphraseConfigured);
        setLiveMerchantKeyConfigured(payfastRes.value.data.liveMerchantKeyConfigured);
        setLivePassphraseConfigured(payfastRes.value.data.livePassphraseConfigured);
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
      if (sendgridRes.status === "fulfilled") setSendgridConfig(sendgridRes.value.data);
      if (siteConfigRes.status === "fulfilled") {
        const status = siteConfigRes.value.data?.siteStatus;
        setMaintenanceMode(status?.maintenanceMode ?? false);
        setComingSoon(status?.comingSoon ?? false);
      }

      const failed = [settingsRes, stitchRes, payfastRes, paymentEventsRes, xeroSettingsRes, xeroSyncRes, abandonedConfigRes, storageRes, sendgridRes].filter((r) => r.status === "rejected");
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

  const saveSiteStatus = async (nextMaintenance: boolean, nextComingSoon: boolean) => {
    if (!session?.accessToken) return;
    try {
      await apiRequest("/admin/cms/site-status", {
        method: "PATCH",
        body: JSON.stringify({ maintenanceMode: nextMaintenance, comingSoon: nextComingSoon }),
      }, session.accessToken);
      setMaintenanceMode(nextMaintenance);
      setComingSoon(nextComingSoon);
      clearCmsBootstrapCache();
      toast.success("Site status updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update site status");
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

  const savePayfast = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.accessToken || saving) return;
    try {
      setSaving(true);
      const payload = {
        enabled: payfastEnabled,
        mode: payfastMode,
        sandboxMerchantId: sandboxMerchantId || undefined,
        sandboxMerchantKey: sandboxMerchantKey || undefined,
        sandboxPassphrase: sandboxPassphrase || undefined,
        liveMerchantId: liveMerchantId || undefined,
        liveMerchantKey: liveMerchantKey || undefined,
        livePassphrase: livePassphrase || undefined,
        returnUrl: payfastReturnUrl || undefined,
        cancelUrl: payfastCancelUrl || undefined,
        notifyUrl: payfastNotifyUrl || undefined,
      };
      const res = await apiRequest<{ data: PayfastSettings }>("/admin/payments/settings/payfast", { method: "PUT", body: JSON.stringify(payload) }, session.accessToken);
      setSandboxMerchantKey("");
      setSandboxPassphrase("");
      setLiveMerchantKey("");
      setLivePassphrase("");
      setSandboxMerchantKeyConfigured(res.data.sandboxMerchantKeyConfigured);
      setSandboxPassphraseConfigured(res.data.sandboxPassphraseConfigured);
      setLiveMerchantKeyConfigured(res.data.liveMerchantKeyConfigured);
      setLivePassphraseConfigured(res.data.livePassphraseConfigured);
      toast.success("PayFast settings saved");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save PayFast settings");
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
      const payload = buildStoragePayload();
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

  const saveSendgrid = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.accessToken || saving) return;
    try {
      setSaving(true);
      const payload = {
        enabled: sendgridConfig.enabled,
        fromEmail: sendgridConfig.fromEmail || undefined,
        fromName: sendgridConfig.fromName || undefined,
        replyToEmail: sendgridConfig.replyToEmail || undefined,
        sandboxMode: sendgridConfig.sandboxMode,
        apiKey: sendgridApiKey || undefined,
      };
      const res = await apiRequest<{ data: SendgridSettings }>("/admin/settings/email/sendgrid", { method: "PUT", body: JSON.stringify(payload) }, session.accessToken);
      setSendgridConfig(res.data);
      setSendgridApiKey("");
      toast.success("SendGrid settings saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save SendGrid settings");
    } finally {
      setSaving(false);
    }
  };

  const testSendgrid = async () => {
    if (!session?.accessToken || saving || !sendgridTestTo.trim()) return;
    try {
      setSaving(true);
      const res = await apiRequest<{ data: { ok: boolean; message: string } }>(
        "/admin/settings/email/sendgrid/test",
        { method: "POST", body: JSON.stringify({ to: sendgridTestTo.trim() }) },
        session.accessToken,
      );
      if (res.data.ok) toast.success(res.data.message);
      else toast.error(res.data.message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "SendGrid test failed");
    } finally {
      setSaving(false);
    }
  };

  const testStorage = async () => {
    if (!session?.accessToken || saving) return;
    try {
      setSaving(true);
      const payload = buildStoragePayload();
      const res = await apiRequest<{ data: { ok: boolean; message: string } }>("/admin/settings/storage/test", { method: "POST", body: JSON.stringify(payload) }, session.accessToken);
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

  const TABS = [
    ["status", "Site Status"],
    ["store", "Store"],
    ["stitch", "Stitch Payments"],
    ["payfast", "PayFast"],
    ["storage", "Storage"],
    ["sendgrid", "SendGrid Email"],
    ["abandoned-cart", "Abandoned Cart"],
    ["xero", "Xero"],
  ] as const;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-2xl font-black text-gray-900">Settings</h2>
        <p className="text-sm text-gray-500 mb-4">Configure your store, payments, email, and integrations.</p>
        <div className="flex flex-wrap border-b border-gray-200">
          {TABS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === id
                  ? "border-gray-900 text-gray-900"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "status" && (
        <div className="space-y-4">
          <h2 className="text-xl font-black text-gray-900">Site Status</h2>

          <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-5">
            {/* Maintenance Mode */}
            <div className="flex items-start justify-between gap-6">
              <div>
                <p className="text-sm font-medium text-gray-900">Maintenance Mode</p>
                <p className="text-xs text-gray-500 mt-0.5 max-w-sm">
                  Show a "We'll be right back" page to all storefront visitors. The admin panel stays accessible.
                </p>
              </div>
              <Switch
                checked={maintenanceMode}
                onCheckedChange={(checked) => saveSiteStatus(checked, comingSoon)}
                className="data-[state=checked]:!bg-orange-500 shrink-0 mt-0.5"
              />
            </div>

            {maintenanceMode && (
              <div className="rounded-lg bg-orange-50 border border-orange-200 px-3 py-2 text-xs text-orange-700">
                Maintenance mode is active — customers are seeing the maintenance page.
              </div>
            )}

            <div className="h-px bg-gray-100" />

            {/* Coming Soon */}
            <div className="flex items-start justify-between gap-6">
              <div>
                <p className="text-sm font-medium text-gray-900">Coming Soon</p>
                <p className="text-xs text-gray-500 mt-0.5 max-w-sm">
                  Show a pre-launch page instead of the storefront. Useful before the site goes live.
                </p>
              </div>
              <Switch
                checked={comingSoon}
                onCheckedChange={(checked) => saveSiteStatus(maintenanceMode, checked)}
                className="data-[state=checked]:!bg-pink-500 shrink-0 mt-0.5"
              />
            </div>

            {comingSoon && (
              <div className="rounded-lg bg-pink-50 border border-pink-200 px-3 py-2 text-xs text-pink-700">
                Coming Soon mode is active — customers are seeing the pre-launch page.
              </div>
            )}
          </div>

          <p className="text-xs text-gray-400">
            Changes take effect within ~60 seconds. If both are enabled, Maintenance Mode takes priority.
          </p>
        </div>
      )}

      {activeTab === "store" && (
        <form onSubmit={saveStore} className="space-y-4">
          <h2 className="text-xl font-black text-gray-900">Store Settings</h2>
          <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
            <label className="block text-sm font-medium text-gray-700">
              Store Name
              <input className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" value={storeName} onChange={(e) => setStoreName(e.target.value)} required />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Support Email
              <input className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" type="email" value={storeEmail} onChange={(e) => setStoreEmail(e.target.value)} required />
            </label>
          </div>
          <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm disabled:opacity-70">{saving ? "Saving..." : "Save Store Settings"}</button>
        </form>
      )}

      {activeTab === "stitch" && (
        <div className="space-y-6">
          <form onSubmit={saveStitch} className="space-y-4">
            <h2 className="text-xl font-black text-gray-900">Stitch Payments</h2>
            <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={stitchEnabled} onChange={(e) => setStitchEnabled(e.target.checked)} />Enable Stitch</label>
              <label className="block text-sm font-medium text-gray-700">
                Mode
                <select className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" value={stitchMode} onChange={(e) => setStitchMode(e.target.value as "sandbox" | "production")}><option value="sandbox">Sandbox</option><option value="production">Production</option></select>
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Merchant ID
                <input className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" value={merchantId} onChange={(e) => setMerchantId(e.target.value)} required />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                API Key {apiKeyConfigured ? <span className="font-normal text-emerald-600">(configured)</span> : <span className="font-normal text-gray-500">(required)</span>}
                <input type="password" className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Webhook Secret {webhookConfigured ? <span className="font-normal text-emerald-600">(configured)</span> : <span className="font-normal text-gray-500">(optional)</span>}
                <input type="password" className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" value={webhookSecret} onChange={(e) => setWebhookSecret(e.target.value)} />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Redirect URL
                <input className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" value={redirectUrl} onChange={(e) => setRedirectUrl(e.target.value)} />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Callback URL
                <input className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" value={callbackUrl} onChange={(e) => setCallbackUrl(e.target.value)} />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Custom API Base URL
                <input className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" value={apiBaseUrl} onChange={(e) => setApiBaseUrl(e.target.value)} />
              </label>
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
        </div>
      )}

      {activeTab === "payfast" && (
        <form onSubmit={savePayfast} className="space-y-4">
          <h2 className="text-xl font-black text-gray-900">PayFast Payments</h2>
          <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={payfastEnabled} onChange={(e) => setPayfastEnabled(e.target.checked)} />Enable PayFast</label>
            <label className="block text-sm font-medium text-gray-700">
              Mode
              <select className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" value={payfastMode} onChange={(e) => setPayfastMode(e.target.value as "sandbox" | "live")}><option value="sandbox">Sandbox</option><option value="live">Live</option></select>
            </label>
            <p className="text-xs text-gray-500">Keep sandbox and live credentials separate to avoid accidental cross-environment usage.</p>
            <label className="block text-sm font-medium text-gray-700">
              Sandbox Merchant ID
              <input className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" value={sandboxMerchantId} onChange={(e) => setSandboxMerchantId(e.target.value)} />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Sandbox Merchant Key {sandboxMerchantKeyConfigured ? <span className="font-normal text-emerald-600">(configured)</span> : null}
              <input type="password" className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" value={sandboxMerchantKey} onChange={(e) => setSandboxMerchantKey(e.target.value)} />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Sandbox Passphrase {sandboxPassphraseConfigured ? <span className="font-normal text-emerald-600">(configured)</span> : <span className="font-normal text-gray-500">(optional)</span>}
              <input type="password" className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" value={sandboxPassphrase} onChange={(e) => setSandboxPassphrase(e.target.value)} />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Live Merchant ID
              <input className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" value={liveMerchantId} onChange={(e) => setLiveMerchantId(e.target.value)} />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Live Merchant Key {liveMerchantKeyConfigured ? <span className="font-normal text-emerald-600">(configured)</span> : null}
              <input type="password" className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" value={liveMerchantKey} onChange={(e) => setLiveMerchantKey(e.target.value)} />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Live Passphrase {livePassphraseConfigured ? <span className="font-normal text-emerald-600">(configured)</span> : <span className="font-normal text-gray-500">(optional)</span>}
              <input type="password" className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" value={livePassphrase} onChange={(e) => setLivePassphrase(e.target.value)} />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Return URL
              <input className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" value={payfastReturnUrl} onChange={(e) => setPayfastReturnUrl(e.target.value)} />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Cancel URL
              <input className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" value={payfastCancelUrl} onChange={(e) => setPayfastCancelUrl(e.target.value)} />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Notify URL (webhook)
              <input className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" value={payfastNotifyUrl} onChange={(e) => setPayfastNotifyUrl(e.target.value)} />
            </label>
          </div>
          <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm disabled:opacity-70">{saving ? "Saving..." : "Save PayFast Settings"}</button>
        </form>
      )}

      {activeTab === "storage" && (
        <form onSubmit={saveStorage} className="space-y-4">
          <h2 className="text-xl font-black text-gray-900">Storage Settings</h2>
          <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              Storage Provider
              <select className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" value={storageConfig.provider} onChange={(e) => {
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
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Bucket Name
              <input className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" value={storageConfig.bucket} onChange={(e) => setStorageConfig((prev) => ({ ...prev, bucket: e.target.value }))} />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Account ID (Cloudflare R2)
              <input className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" value={storageConfig.accountId} onChange={(e) => setStorageConfig((prev) => ({ ...prev, accountId: e.target.value, endpoint: prev.provider === "cloudflare-r2" && e.target.value ? `https://${e.target.value}.r2.cloudflarestorage.com` : prev.endpoint }))} />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Access Key ID {storageConfig.accessKeyIdMasked ? <span className="font-normal text-gray-500">(current {storageConfig.accessKeyIdMasked})</span> : null}
              <input className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" value={storageConfig.accessKeyId} onChange={(e) => setStorageConfig((prev) => ({ ...prev, accessKeyId: e.target.value }))} />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Secret Access Key {storageConfig.secretAccessKeyConfigured ? <span className="font-normal text-emerald-600">(configured, leave blank to keep)</span> : null}
              <input type="password" className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" value={storageSecret} onChange={(e) => setStorageSecret(e.target.value)} />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Endpoint URL
              <input className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" value={storageConfig.endpoint} onChange={(e) => setStorageConfig((prev) => ({ ...prev, endpoint: e.target.value }))} />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Public Base URL <span className="font-normal text-gray-500">(optional public origin)</span>
              <input className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" value={storageConfig.publicBaseUrl} onChange={(e) => setStorageConfig((prev) => ({ ...prev, publicBaseUrl: e.target.value }))} />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Signed URL TTL (seconds)
              <input type="number" min={60} max={86400} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" value={storageConfig.signedUrlTtlSeconds} onChange={(e) => setStorageConfig((prev) => ({ ...prev, signedUrlTtlSeconds: Number(e.target.value) }))} />
            </label>
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
      )}

      {activeTab === "sendgrid" && (
        <form onSubmit={saveSendgrid} className="space-y-4">
          <h2 className="text-xl font-black text-gray-900">SendGrid Email</h2>
          <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={sendgridConfig.enabled} onChange={(e) => setSendgridConfig((prev) => ({ ...prev, enabled: e.target.checked }))} />Enable SendGrid provider settings</label>
            <label className="block text-sm font-medium text-gray-700">
              From Email
              <input className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" type="email" value={sendgridConfig.fromEmail} onChange={(e) => setSendgridConfig((prev) => ({ ...prev, fromEmail: e.target.value }))} />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              From Name
              <input className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" value={sendgridConfig.fromName} onChange={(e) => setSendgridConfig((prev) => ({ ...prev, fromName: e.target.value }))} />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Reply-To Email <span className="font-normal text-gray-500">(optional)</span>
              <input className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" type="email" value={sendgridConfig.replyToEmail} onChange={(e) => setSendgridConfig((prev) => ({ ...prev, replyToEmail: e.target.value }))} />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              API Key {sendgridConfig.apiKeyConfigured ? <span className="font-normal text-emerald-600">(configured, leave blank to keep)</span> : <span className="font-normal text-gray-500">(required to send)</span>}
              <input type="password" className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" value={sendgridApiKey} onChange={(e) => setSendgridApiKey(e.target.value)} />
            </label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={sendgridConfig.sandboxMode} onChange={(e) => setSendgridConfig((prev) => ({ ...prev, sandboxMode: e.target.checked }))} />Use SendGrid sandbox mode</label>
            <label className="block text-sm font-medium text-gray-700">
              Test Recipient Email
              <input className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" type="email" value={sendgridTestTo} onChange={(e) => setSendgridTestTo(e.target.value)} />
            </label>
            <div className="flex items-center gap-2">
              <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm disabled:opacity-70">{saving ? "Saving..." : "Save SendGrid Settings"}</button>
              <button type="button" onClick={testSendgrid} disabled={saving || !sendgridTestTo.trim()} className="px-4 py-2 rounded-lg border border-gray-300 text-sm disabled:opacity-70">Send Test Email</button>
            </div>
            <p className="text-xs text-gray-500">Set backend EMAIL_PROVIDER=sendgrid to use SendGrid for outbound mail.</p>
          </div>
        </form>
      )}

      {activeTab === "abandoned-cart" && (
        <form onSubmit={saveAbandonedCartConfig} className="space-y-4">
          <h2 className="text-xl font-black text-gray-900">Abandoned Cart Automation</h2>
          <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={abandonedConfig.enabled} onChange={(e) => setAbandonedConfig((prev) => ({ ...prev, enabled: e.target.checked }))} />Enable abandoned cart handling</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={abandonedConfig.reminderEnabled} onChange={(e) => setAbandonedConfig((prev) => ({ ...prev, reminderEnabled: e.target.checked }))} />Enable reminder email</label>
            <label className="block text-sm font-medium text-gray-700">
              Inactivity Threshold (minutes)
              <input className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" type="number" min={1} value={abandonedConfig.inactivityThresholdMinutes} onChange={(e) => setAbandonedConfig((prev) => ({ ...prev, inactivityThresholdMinutes: Number(e.target.value) }))} />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Reminder Delay (minutes)
              <input className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" type="number" min={1} value={abandonedConfig.reminderDelayMinutes} onChange={(e) => setAbandonedConfig((prev) => ({ ...prev, reminderDelayMinutes: Number(e.target.value) }))} />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Clear/Release Delay (minutes)
              <input className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" type="number" min={1} value={abandonedConfig.clearDelayMinutes} onChange={(e) => setAbandonedConfig((prev) => ({ ...prev, clearDelayMinutes: Number(e.target.value) }))} />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Abandoned Cart Email Template Key
              <input className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" value={abandonedConfig.templateKey} onChange={(e) => setAbandonedConfig((prev) => ({ ...prev, templateKey: e.target.value }))} />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Customer Help Text
              <textarea className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" value={abandonedConfig.helpText} onChange={(e) => setAbandonedConfig((prev) => ({ ...prev, helpText: e.target.value }))} />
            </label>
          </div>
          <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm disabled:opacity-70">{saving ? "Saving..." : "Save Abandoned Cart Settings"}</button>
        </form>
      )}

      {activeTab === "xero" && (
        <div className="space-y-6">
          <form onSubmit={saveXero} className="space-y-4">
            <h2 className="text-xl font-black text-gray-900">Xero Accounting</h2>
            <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={xeroEnabled} onChange={(e) => setXeroEnabled(e.target.checked)} />Enable Xero</label>
                <span className={`text-xs px-2 py-1 rounded ${xeroConnectionStatus === "connected" ? "bg-emerald-100 text-emerald-700" : xeroConnectionStatus === "expired" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-700"}`}>{xeroConnectionStatus.toUpperCase()}</span>
              </div>
              <label className="block text-sm font-medium text-gray-700">
                Client ID
                <input className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" value={xeroClientId} onChange={(e) => setXeroClientId(e.target.value)} required />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Client Secret {xeroSecretConfigured ? <span className="font-normal text-emerald-600">(configured)</span> : <span className="font-normal text-gray-500">(required)</span>}
                <input type="password" className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" value={xeroClientSecret} onChange={(e) => setXeroClientSecret(e.target.value)} />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Redirect URI
                <input className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" value={xeroRedirectUri} onChange={(e) => setXeroRedirectUri(e.target.value)} required />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Tenant ID
                <input className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" value={xeroTenantId} onChange={(e) => setXeroTenantId(e.target.value)} />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Scopes <span className="font-normal text-gray-500">(space separated)</span>
                <input className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" value={xeroScopes} onChange={(e) => setXeroScopes(e.target.value)} />
              </label>
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
      )}
    </div>
  );
}
