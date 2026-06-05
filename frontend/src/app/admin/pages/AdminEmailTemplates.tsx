import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { apiRequest } from "../api/client";
import { EmptyState, ErrorState, LoadingState } from "../components/AdminState";
import { useAdminAuth } from "../context/AdminAuthContext";

type TemplateCategory = "ACCOUNT" | "ORDER" | "PAYMENT" | "SHIPPING" | "SECURITY" | "SUPPORT" | "MARKETING" | "SYSTEM";
type EditorMode = "simple" | "advanced";

type ThemeLink = { label: string; url: string };

interface EmailTemplate {
  id: string;
  key: string;
  name: string;
  category: TemplateCategory;
  subject: string;
  htmlBody: string;
  textBody?: string | null;
  placeholderKeys?: string[] | null;
  isEnabled: boolean;
  isSystemDefault: boolean;
  updatedAt: string;
}

interface TemplatePreview {
  key: string;
  subject: string;
  htmlBody: string;
  textBody?: string | null;
  placeholderKeys: string[];
  missingPlaceholders: string[];
  source: "database" | "fallback-default";
}

interface ThemeSettings {
  logoUrl: string;
  brandName: string;
  primaryColor: string;
  accentColor: string;
  buttonBg: string;
  buttonTextColor: string;
  headingColor: string;
  bodyTextColor: string;
  contentBg: string;
  outerBg: string;
  footerBg: string;
  footerText: string;
  supportEmail: string;
  siteUrl: string;
  links: ThemeLink[];
}

interface SimpleTemplateFields {
  preheader: string;
  heading: string;
  intro: string;
  ctaText: string;
  ctaUrl: string;
  footerNote: string;
  showCta: boolean;
  showFooter: boolean;
}

const TEMPLATE_META: Record<string, { description: string }> = {
  welcome: { description: "Greets new customers and introduces your brand." },
  welcome_email: { description: "System welcome variant with brand defaults." },
  password_reset: { description: "Secure password reset flow email." },
  email_verification: { description: "Verifies ownership of customer email." },
  order_confirmation: { description: "Confirms order placement and summary." },
  order_shipped: { description: "Shares shipment and tracking details." },
  order_delivered: { description: "Confirms final delivery completion." },
  contact_form_notification: { description: "Alerts team to a new support inquiry." },
  admin_new_order_notification: { description: "Internal alert for new order placement." },
  newsletter_signup_confirmation: { description: "Confirms newsletter subscription." },
};

const CATEGORY_OPTIONS: TemplateCategory[] = ["ACCOUNT", "ORDER", "PAYMENT", "SHIPPING", "SECURITY", "SUPPORT", "MARKETING", "SYSTEM"];

const VARIABLE_GROUPS: Array<{ label: string; vars: Array<{ key: string; description: string; example: string }> }> = [
  {
    label: "Customer",
    vars: [
      { key: "firstName", description: "Customer first name", example: "Jane" },
      { key: "customerName", description: "Customer full name", example: "Jane Smith" },
      { key: "email", description: "Customer email", example: "jane@example.com" },
    ],
  },
  {
    label: "Order",
    vars: [
      { key: "orderNumber", description: "Store order number", example: "10001234" },
      { key: "orderDate", description: "Date order was placed", example: "2026-03-31" },
      { key: "orderItems", description: "Order item summary", example: "Hydrating Serum x1" },
      { key: "orderTotal", description: "Order total", example: "$120.00" },
      { key: "trackingUrl", description: "Shipment tracking link", example: "https://tracking.example.com/123" },
    ],
  },
  {
    label: "Brand & Support",
    vars: [
      { key: "companyName", description: "Brand/company name", example: "Dear Body" },
      { key: "siteUrl", description: "Storefront URL", example: "https://example.com" },
      { key: "supportEmail", description: "Support inbox", example: "hello@dearbody.com" },
      { key: "resetUrl", description: "Password reset URL", example: "https://example.com/reset" },
      { key: "verificationUrl", description: "Email verification URL", example: "https://example.com/verify" },
    ],
  },
];

const DEFAULT_THEME: ThemeSettings = {
  logoUrl: "",
  brandName: "Dear Body",
  primaryColor: "#f472b6",
  accentColor: "#fb923c",
  buttonBg: "#111827",
  buttonTextColor: "#ffffff",
  headingColor: "#111827",
  bodyTextColor: "#374151",
  contentBg: "#ffffff",
  outerBg: "#f8fafc",
  footerBg: "#111827",
  footerText: "#d1d5db",
  supportEmail: "hello@dearbody.com",
  siteUrl: "https://example.com",
  links: [
    { label: "Instagram", url: "" },
    { label: "TikTok", url: "" },
  ],
};

function stripHtml(input: string) {
  return input.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function buildSimpleHtml(theme: ThemeSettings, fields: SimpleTemplateFields) {
  const links = theme.links.filter((item) => item.label.trim() && item.url.trim());
  const logo = theme.logoUrl.trim()
    ? `<img src="${theme.logoUrl}" alt="${theme.brandName}" style="max-height:40px;display:block;margin:0 auto 8px auto;" />`
    : "";
  const cta = fields.showCta && fields.ctaText.trim() && fields.ctaUrl.trim()
    ? `<tr><td style="padding:8px 32px 18px 32px;"><a href="${fields.ctaUrl}" style="display:inline-block;padding:12px 22px;border-radius:999px;background:${theme.buttonBg};color:${theme.buttonTextColor};text-decoration:none;font-weight:700;font-family:Arial,sans-serif;">${fields.ctaText}</a></td></tr>`
    : "";
  const footerLinks = links.length
    ? `<div style="margin-top:8px;">${links.map((item) => `<a href="${item.url}" style="color:${theme.footerText};text-decoration:none;margin-right:10px;">${item.label}</a>`).join("")}</div>`
    : "";
  const footer = fields.showFooter
    ? `<tr><td style="padding:20px 32px;background:${theme.footerBg};color:${theme.footerText};font-size:13px;line-height:1.6;">${fields.footerNote || "Need help? Contact us anytime."}<br/><a href="mailto:{{supportEmail}}" style="color:${theme.footerText};text-decoration:underline;">{{supportEmail}}</a> · <a href="{{siteUrl}}" style="color:${theme.footerText};text-decoration:underline;">{{siteUrl}}</a>${footerLinks}</td></tr>`
    : "";

  return `<!doctype html>
<html>
  <body style="margin:0;background:${theme.outerBg};font-family:Arial,sans-serif;color:${theme.bodyTextColor};">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${fields.preheader}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${theme.outerBg};padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="620" cellpadding="0" cellspacing="0" style="width:620px;max-width:620px;background:${theme.contentBg};border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
            <tr><td style="padding:18px 24px;text-align:center;background:linear-gradient(90deg,${theme.primaryColor},${theme.accentColor});color:#fff;font-size:20px;font-weight:800;">${logo}${theme.brandName}</td></tr>
            <tr><td style="padding:26px 32px 8px 32px;color:${theme.headingColor};font-size:28px;font-weight:800;line-height:1.2;">${fields.heading}</td></tr>
            <tr><td style="padding:8px 32px 10px 32px;color:${theme.bodyTextColor};font-size:16px;line-height:1.65;">${fields.intro}</td></tr>
            ${cta}
            ${footer}
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export default function AdminEmailTemplates() {
  const { session } = useAdminAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [mode, setMode] = useState<EditorMode>("simple");
  const [theme, setTheme] = useState<ThemeSettings>(DEFAULT_THEME);
  const [variableSearch, setVariableSearch] = useState("");
  const [activeField, setActiveField] = useState<keyof SimpleTemplateFields | "subject" | "htmlBody">("intro");
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [preview, setPreview] = useState<TemplatePreview | null>(null);
  const [testEmail, setTestEmail] = useState("");
  const [sampleDataJson, setSampleDataJson] = useState('{\n  "firstName": "Jane",\n  "customerName": "Jane Smith",\n  "companyName": "Dear Body",\n  "orderNumber": "10001234",\n  "orderDate": "2026-03-31",\n  "orderItems": "Hydrating Serum x1",\n  "orderTotal": "$120.00",\n  "supportEmail": "hello@dearbody.com",\n  "siteUrl": "https://example.com",\n  "trackingUrl": "https://tracking.example.com/123"\n}');
  const [showAdvancedTools, setShowAdvancedTools] = useState(false);

  const [form, setForm] = useState({
    id: "",
    key: "",
    name: "",
    category: "ACCOUNT" as TemplateCategory,
    subject: "",
    htmlBody: "",
    textBody: "",
    placeholderKeys: "",
    isEnabled: true,
  });

  const [simpleFields, setSimpleFields] = useState<SimpleTemplateFields>({
    preheader: "",
    heading: "",
    intro: "",
    ctaText: "",
    ctaUrl: "",
    footerNote: "",
    showCta: true,
    showFooter: true,
  });

  const filteredTemplates = useMemo(() => templates.filter((item) => {
    const matchesQuery = !query.trim() || [item.name, item.key, item.subject].join(" ").toLowerCase().includes(query.trim().toLowerCase());
    const matchesCategory = !categoryFilter || item.category === categoryFilter;
    return matchesQuery && matchesCategory;
  }), [templates, query, categoryFilter]);

  const selectedTemplate = useMemo(() => filteredTemplates.find((item) => item.id === selectedId) ?? null, [filteredTemplates, selectedId]);

  const groupedVariables = useMemo(() => VARIABLE_GROUPS.map((group) => ({
    ...group,
    vars: group.vars.filter((item) => {
      const q = variableSearch.trim().toLowerCase();
      if (!q) return true;
      return item.key.toLowerCase().includes(q) || item.description.toLowerCase().includes(q);
    }),
  })).filter((group) => group.vars.length > 0), [variableSearch]);

  const effectiveHtml = useMemo(() => (mode === "simple" ? buildSimpleHtml(theme, simpleFields) : form.htmlBody), [mode, theme, simpleFields, form.htmlBody]);
  const preheaderPreview = useMemo(() => (simpleFields.preheader || stripHtml(effectiveHtml).slice(0, 120) || "Email preview text"), [simpleFields.preheader, effectiveHtml]);

  const parseSampleData = () => {
    const parsed = JSON.parse(sampleDataJson);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Sample data must be a JSON object");
    }
    return parsed as Record<string, unknown>;
  };

  const hydrateSimpleFields = (template: EmailTemplate) => {
    const plain = stripHtml(template.htmlBody);
    setSimpleFields((prev) => ({
      preheader: prev.preheader || plain.slice(0, 90),
      heading: template.name || prev.heading,
      intro: plain.slice(0, 300),
      ctaText: prev.ctaText || "Shop Now",
      ctaUrl: prev.ctaUrl || "{{siteUrl}}",
      footerNote: prev.footerNote || "Thanks for being part of our community.",
      showCta: true,
      showFooter: true,
    }));
  };

  const load = async () => {
    if (!session?.accessToken) return;
    try {
      setLoading(true);
      setError(null);
      const [templateRes, settingsRes] = await Promise.all([
        apiRequest<{ data: { items: EmailTemplate[] } }>("/admin/email-templates?page=1&perPage=200", {}, session.accessToken),
        apiRequest<{ data: { items: Array<{ scope: string; key: string; value: unknown }> } }>("/admin/settings?page=1&perPage=200", {}, session.accessToken),
      ]);
      const items = Array.isArray(templateRes.data.items) ? templateRes.data.items : [];
      setTemplates(items);
      const nextId = selectedId && items.some((item) => item.id === selectedId) ? selectedId : (items[0]?.id ?? "");
      setSelectedId(nextId);

      const settingsMap = new Map(settingsRes.data.items.map((item) => [`${item.scope}:${item.key}`, item.value]));
      const rawTheme = settingsMap.get("email:template.theme.v1");
      if (rawTheme && typeof rawTheme === "object") {
        const value = rawTheme as Partial<ThemeSettings>;
        setTheme((prev) => ({ ...prev, ...value, links: Array.isArray(value.links) ? value.links as ThemeLink[] : prev.links }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load templates");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [session?.accessToken]);

  useEffect(() => {
    if (!selectedTemplate) return;
    setForm({
      id: selectedTemplate.id,
      key: selectedTemplate.key,
      name: selectedTemplate.name,
      category: selectedTemplate.category,
      subject: selectedTemplate.subject,
      htmlBody: selectedTemplate.htmlBody,
      textBody: selectedTemplate.textBody ?? "",
      placeholderKeys: Array.isArray(selectedTemplate.placeholderKeys) ? selectedTemplate.placeholderKeys.join(", ") : "",
      isEnabled: selectedTemplate.isEnabled,
    });
    setPreview(null);
    hydrateSimpleFields(selectedTemplate);
  }, [selectedTemplate?.id]);

  const insertVariable = (variableKey: string) => {
    const token = `{{${variableKey}}}`;
    const append = <T extends string>(value: T) => `${value}${value.endsWith(" ") || !value ? "" : " "}${token}`;

    if (activeField === "subject") {
      setForm((prev) => ({ ...prev, subject: append(prev.subject) }));
      return;
    }
    if (activeField === "htmlBody") {
      setForm((prev) => ({ ...prev, htmlBody: append(prev.htmlBody) }));
      return;
    }

    setSimpleFields((prev) => ({ ...prev, [activeField]: append(String(prev[activeField])) }));
  };

  const saveTheme = async () => {
    if (!session?.accessToken) return;
    try {
      await apiRequest("/admin/settings", {
        method: "PUT",
        body: JSON.stringify({
          scope: "email",
          key: "template.theme.v1",
          value: theme,
        }),
      }, session.accessToken);
      toast.success("Theme saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save theme");
    }
  };

  const saveTemplate = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.accessToken || !form.id || saving) return;
    try {
      setSaving(true);
      const payload = {
        key: form.key.trim(),
        name: form.name.trim(),
        category: form.category,
        subject: form.subject,
        htmlBody: effectiveHtml,
        textBody: form.textBody.trim() ? form.textBody : undefined,
        placeholderKeys: form.placeholderKeys.split(",").map((item) => item.trim()).filter(Boolean),
        isEnabled: form.isEnabled,
      };
      await apiRequest(`/admin/email-templates/${form.id}`, { method: "PATCH", body: JSON.stringify(payload) }, session.accessToken);
      toast.success("Template saved");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save template");
    } finally {
      setSaving(false);
    }
  };

  const previewTemplate = async () => {
    if (!session?.accessToken || !form.id) return;
    try {
      const sampleData = parseSampleData();
      const merged = {
        ...sampleData,
        companyName: theme.brandName,
        supportEmail: theme.supportEmail,
        siteUrl: theme.siteUrl,
      };
      const res = await apiRequest<{ data: TemplatePreview }>(`/admin/email-templates/${form.id}/preview`, {
        method: "POST",
        body: JSON.stringify({
          sampleData: merged,
        }),
      }, session.accessToken);
      setPreview(res.data);
      toast.success("Preview refreshed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Preview failed");
    }
  };

  const testSend = async () => {
    if (!session?.accessToken || !form.id || !testEmail.trim()) return;
    try {
      const sampleData = parseSampleData();
      const merged = { ...sampleData, companyName: theme.brandName, supportEmail: theme.supportEmail, siteUrl: theme.siteUrl };
      await apiRequest(`/admin/email-templates/${form.id}/test-send`, {
        method: "POST",
        body: JSON.stringify({ to: testEmail.trim(), sampleData: merged, htmlBody: effectiveHtml, subject: form.subject }),
      }, session.accessToken);
      toast.success("Test email queued");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Test send failed");
    }
  };

  const resetToDefault = async (id: string) => {
    if (!session?.accessToken) return;
    try {
      await apiRequest(`/admin/email-templates/${id}/reset-default`, { method: "POST", body: JSON.stringify({}) }, session.accessToken);
      toast.success("Template reset to default");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reset failed");
    }
  };

  const seedDefaults = async () => {
    if (!session?.accessToken) return;
    try {
      await apiRequest("/admin/email-templates/seed-defaults", { method: "POST", body: JSON.stringify({}) }, session.accessToken);
      toast.success("Default templates seeded");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to seed defaults");
    }
  };

  const duplicateTemplate = async (template: EmailTemplate) => {
    if (!session?.accessToken) return;
    try {
      await apiRequest("/admin/email-templates", {
        method: "PUT",
        body: JSON.stringify({
          key: `${template.key}_copy_${Date.now().toString().slice(-4)}`,
          name: `${template.name} (Copy)`,
          category: template.category,
          subject: template.subject,
          htmlBody: template.htmlBody,
          textBody: template.textBody ?? undefined,
          placeholderKeys: Array.isArray(template.placeholderKeys) ? template.placeholderKeys : [],
          isEnabled: false,
        }),
      }, session.accessToken);
      toast.success("Template duplicated");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Duplicate failed");
    }
  };

  if (loading) return <LoadingState label="Loading email template studio..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="max-w-[1440px] mx-auto px-4 xl:px-6 space-y-6">
      <header className="rounded-2xl border border-pink-100 bg-gradient-to-r from-pink-50 via-white to-orange-50 p-6">
        <h1 className="text-2xl font-black text-gray-900">Email Template Studio</h1>
        <p className="text-sm text-gray-600 mt-1">Simple content editing for non-technical admins. Advanced HTML is still available when needed.</p>
      </header>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <input className="flex-1 min-w-56 rounded-lg border border-gray-200 px-3 py-2 text-sm" placeholder="Search templates" value={query} onChange={(e) => setQuery(e.target.value)} />
          <select className="rounded-lg border border-gray-200 px-3 py-2 text-sm" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="">All categories</option>
            {CATEGORY_OPTIONS.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
          <button type="button" onClick={seedDefaults} className="px-3 py-2 rounded-lg bg-gray-900 text-white text-xs">Seed Defaults</button>
          <button type="button" onClick={saveTheme} className="px-3 py-2 rounded-lg border border-gray-300 text-xs">Save Theme</button>
        </div>
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">Existing DB templates keep their content until you reset them.</p>
        <div className="flex gap-3 overflow-x-auto pb-1">
          {filteredTemplates.length === 0 ? <EmptyState label="No templates found." /> : filteredTemplates.map((item) => (
            <article key={item.id} className={`min-w-[280px] max-w-[320px] rounded-xl border p-4 shrink-0 ${item.id === selectedId ? "border-pink-300 bg-pink-50" : "border-gray-200 bg-white"}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-pink-600 font-semibold">{item.category}</p>
                  <h3 className="font-semibold text-gray-900 mt-1">{item.name}</h3>
                  <p className="text-xs text-gray-600 mt-2 leading-relaxed">{TEMPLATE_META[item.key]?.description ?? "Custom template"}</p>
                </div>
                <span className={`text-[11px] px-2 py-1 rounded-full ${item.isEnabled ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>{item.isEnabled ? "Active" : "Disabled"}</span>
              </div>
              <p className="text-xs text-gray-500 mt-2">Updated: {new Date(item.updatedAt).toLocaleDateString()}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <button type="button" onClick={() => setSelectedId(item.id)} className="px-2.5 py-1.5 rounded border border-gray-300 text-xs bg-white">Edit</button>
                <button type="button" onClick={() => { setSelectedId(item.id); void previewTemplate(); }} className="px-2.5 py-1.5 rounded border border-gray-300 text-xs">Preview</button>
                <button type="button" onClick={() => duplicateTemplate(item)} className="px-2.5 py-1.5 rounded border border-gray-300 text-xs">Duplicate</button>
                <button type="button" onClick={() => resetToDefault(item.id)} className="px-2.5 py-1.5 rounded border border-amber-300 text-amber-700 text-xs">Reset</button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {!selectedTemplate ? <EmptyState label="Select a template to begin." /> : (
        <section className="grid grid-cols-1 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-6 items-start">
          <aside className="rounded-2xl border border-gray-200 bg-white p-6 space-y-5">
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-xs text-gray-500">Preview</p>
                <div className="flex gap-1">
                  <button type="button" onClick={() => setPreviewMode("desktop")} className={`px-2 py-1 rounded text-xs ${previewMode === "desktop" ? "bg-gray-900 text-white" : "bg-white border"}`}>Desktop</button>
                  <button type="button" onClick={() => setPreviewMode("mobile")} className={`px-2 py-1 rounded text-xs ${previewMode === "mobile" ? "bg-gray-900 text-white" : "bg-white border"}`}>Mobile</button>
                </div>
              </div>
              <p className="text-sm font-semibold text-gray-900">{preview?.subject || form.subject || "(No subject)"}</p>
              <p className="text-xs text-gray-500 mt-1">Preheader: {preheaderPreview}</p>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
              <div className={`mx-auto border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm ${previewMode === "mobile" ? "max-w-[360px]" : "max-w-[540px]"}`}>
                <div className="p-4" dangerouslySetInnerHTML={{ __html: preview?.htmlBody || effectiveHtml }} />
              </div>
            </div>

            <details className="rounded-xl border border-gray-200 p-4">
              <summary className="cursor-pointer text-sm font-semibold">Sample data + test send</summary>
              <div className="mt-4 space-y-3">
                <textarea className="w-full rounded border border-gray-200 px-2 py-2 text-xs min-h-36 font-mono" value={sampleDataJson} onChange={(e) => setSampleDataJson(e.target.value)} />
                <input className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="recipient@example.com" />
                <button type="button" onClick={testSend} className="px-3 py-1.5 rounded border border-gray-300 text-xs">Send test email</button>
                {preview?.missingPlaceholders?.length ? <p className="text-xs text-amber-600">Missing values: {preview.missingPlaceholders.join(", ")}</p> : null}
              </div>
            </details>
          </aside>

          <section className="rounded-2xl border border-gray-200 bg-white p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-bold text-gray-900">{form.name}</h2>
                <p className="text-xs text-gray-500">Key: {form.key}</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setMode("simple")} className={`px-3 py-1.5 rounded text-xs ${mode === "simple" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700"}`}>Simple mode</button>
                <button type="button" onClick={() => setMode("advanced")} className={`px-3 py-1.5 rounded text-xs ${mode === "advanced" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700"}`}>Advanced mode</button>
              </div>
            </div>

              <form onSubmit={saveTemplate} className="space-y-5">
                <div className="grid grid-cols-2 gap-3 rounded-xl border border-gray-200 p-5">
                  <h3 className="col-span-2 text-sm font-semibold text-gray-800">Basic info</h3>
                  <input className="rounded-lg border border-gray-200 px-3 py-2 text-sm" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Template name" required />
                  <input className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono" value={form.key} onChange={(e) => setForm((prev) => ({ ...prev, key: e.target.value }))} placeholder="template_key" required />
                  <input className="col-span-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" value={form.subject} onFocus={() => setActiveField("subject")} onChange={(e) => setForm((prev) => ({ ...prev, subject: e.target.value }))} placeholder="Subject" />
                  <input className="col-span-2 w-full rounded border border-gray-200 px-3 py-2 text-sm" value={simpleFields.preheader} onFocus={() => setActiveField("preheader")} onChange={(e) => setSimpleFields((prev) => ({ ...prev, preheader: e.target.value }))} placeholder="Preheader" />
                </div>

                {mode === "simple" ? (
                  <>
                  <div className="space-y-3 rounded-xl border border-gray-200 p-5">
                    <h3 className="font-semibold text-sm">Content editor</h3>
                    <input className="w-full rounded border border-gray-200 px-3 py-2 text-sm" value={simpleFields.heading} onFocus={() => setActiveField("heading")} onChange={(e) => setSimpleFields((prev) => ({ ...prev, heading: e.target.value }))} placeholder="Heading" />
                    <textarea className="w-full rounded border border-gray-200 px-3 py-2 text-sm min-h-32" value={simpleFields.intro} onFocus={() => setActiveField("intro")} onChange={(e) => setSimpleFields((prev) => ({ ...prev, intro: e.target.value }))} placeholder="Body copy" />
                  </div>
                  <div className="space-y-3 rounded-xl border border-gray-200 p-5">
                    <h3 className="font-semibold text-sm">CTA section</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <input className="rounded border border-gray-200 px-3 py-2 text-sm" value={simpleFields.ctaText} onFocus={() => setActiveField("ctaText")} onChange={(e) => setSimpleFields((prev) => ({ ...prev, ctaText: e.target.value }))} placeholder="CTA text" />
                      <input className="rounded border border-gray-200 px-3 py-2 text-sm" value={simpleFields.ctaUrl} onFocus={() => setActiveField("ctaUrl")} onChange={(e) => setSimpleFields((prev) => ({ ...prev, ctaUrl: e.target.value }))} placeholder="CTA URL" />
                    </div>
                  </div>
                  <div className="space-y-3 rounded-xl border border-gray-200 p-5">
                    <h3 className="font-semibold text-sm">Options</h3>
                    <input className="w-full rounded border border-gray-200 px-3 py-2 text-sm" value={simpleFields.footerNote} onFocus={() => setActiveField("footerNote")} onChange={(e) => setSimpleFields((prev) => ({ ...prev, footerNote: e.target.value }))} placeholder="Footer note" />
                    <div className="flex items-center gap-5 text-xs text-gray-600">
                      <label className="flex items-center gap-1.5"><input type="checkbox" checked={simpleFields.showCta} onChange={(e) => setSimpleFields((prev) => ({ ...prev, showCta: e.target.checked }))} />Show CTA</label>
                      <label className="flex items-center gap-1.5"><input type="checkbox" checked={simpleFields.showFooter} onChange={(e) => setSimpleFields((prev) => ({ ...prev, showFooter: e.target.checked }))} />Show footer</label>
                    </div>
                  </div>
                  </>
                ) : (
                  <div className="space-y-2 rounded-xl border border-gray-200 p-5">
                    <h3 className="font-semibold text-sm">Advanced HTML editor</h3>
                    <textarea className="w-full rounded border border-gray-200 px-2 py-2 text-xs min-h-64 font-mono" value={form.htmlBody} onFocus={() => setActiveField("htmlBody")} onChange={(e) => setForm((prev) => ({ ...prev, htmlBody: e.target.value }))} />
                    <textarea className="w-full rounded border border-gray-200 px-2 py-2 text-xs min-h-24 font-mono" value={form.textBody} onChange={(e) => setForm((prev) => ({ ...prev, textBody: e.target.value }))} placeholder="Plain text fallback" />
                    <input className="w-full rounded border border-gray-200 px-2 py-1 text-xs" value={form.placeholderKeys} onChange={(e) => setForm((prev) => ({ ...prev, placeholderKeys: e.target.value }))} placeholder="Placeholder keys (comma-separated)" />
                  </div>
                )}

                <details className="rounded-xl border border-gray-200 p-5" open={showAdvancedTools} onToggle={(e) => setShowAdvancedTools((e.currentTarget as HTMLDetailsElement).open)}>
                  <summary className="cursor-pointer text-sm font-semibold">Theme editor</summary>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <input className="rounded border border-gray-200 px-2 py-1.5 text-sm col-span-2" value={theme.logoUrl} onChange={(e) => setTheme((prev) => ({ ...prev, logoUrl: e.target.value }))} placeholder="Logo URL (optional)" />
                    <input className="rounded border border-gray-200 px-2 py-1.5 text-sm" value={theme.brandName} onChange={(e) => setTheme((prev) => ({ ...prev, brandName: e.target.value }))} placeholder="Brand name" />
                    <input className="rounded border border-gray-200 px-2 py-1.5 text-sm" value={theme.supportEmail} onChange={(e) => setTheme((prev) => ({ ...prev, supportEmail: e.target.value }))} placeholder="Support email" />
                    <input className="rounded border border-gray-200 px-2 py-1.5 text-sm col-span-2" value={theme.siteUrl} onChange={(e) => setTheme((prev) => ({ ...prev, siteUrl: e.target.value }))} placeholder="Site URL" />
                    <label className="text-xs">Primary<input type="color" className="mt-1 w-full h-9 rounded border" value={theme.primaryColor} onChange={(e) => setTheme((prev) => ({ ...prev, primaryColor: e.target.value }))} /></label>
                    <label className="text-xs">Accent<input type="color" className="mt-1 w-full h-9 rounded border" value={theme.accentColor} onChange={(e) => setTheme((prev) => ({ ...prev, accentColor: e.target.value }))} /></label>
                    <label className="text-xs">Button BG<input type="color" className="mt-1 w-full h-9 rounded border" value={theme.buttonBg} onChange={(e) => setTheme((prev) => ({ ...prev, buttonBg: e.target.value }))} /></label>
                    <label className="text-xs">Button Text<input type="color" className="mt-1 w-full h-9 rounded border" value={theme.buttonTextColor} onChange={(e) => setTheme((prev) => ({ ...prev, buttonTextColor: e.target.value }))} /></label>
                    <label className="text-xs">Heading<input type="color" className="mt-1 w-full h-9 rounded border" value={theme.headingColor} onChange={(e) => setTheme((prev) => ({ ...prev, headingColor: e.target.value }))} /></label>
                    <label className="text-xs">Body<input type="color" className="mt-1 w-full h-9 rounded border" value={theme.bodyTextColor} onChange={(e) => setTheme((prev) => ({ ...prev, bodyTextColor: e.target.value }))} /></label>
                    <label className="text-xs">Content BG<input type="color" className="mt-1 w-full h-9 rounded border" value={theme.contentBg} onChange={(e) => setTheme((prev) => ({ ...prev, contentBg: e.target.value }))} /></label>
                    <label className="text-xs">Outer BG<input type="color" className="mt-1 w-full h-9 rounded border" value={theme.outerBg} onChange={(e) => setTheme((prev) => ({ ...prev, outerBg: e.target.value }))} /></label>
                    <label className="text-xs">Footer BG<input type="color" className="mt-1 w-full h-9 rounded border" value={theme.footerBg} onChange={(e) => setTheme((prev) => ({ ...prev, footerBg: e.target.value }))} /></label>
                    <label className="text-xs">Footer Text<input type="color" className="mt-1 w-full h-9 rounded border" value={theme.footerText} onChange={(e) => setTheme((prev) => ({ ...prev, footerText: e.target.value }))} /></label>
                    {theme.links.map((link, index) => (
                      <div key={`${link.label}-${index}`} className="col-span-2 grid grid-cols-2 gap-2">
                        <input className="rounded border border-gray-200 px-2 py-1.5 text-sm" value={link.label} onChange={(e) => setTheme((prev) => ({ ...prev, links: prev.links.map((item, idx) => idx === index ? { ...item, label: e.target.value } : item) }))} placeholder="Link label" />
                        <input className="rounded border border-gray-200 px-2 py-1.5 text-sm" value={link.url} onChange={(e) => setTheme((prev) => ({ ...prev, links: prev.links.map((item, idx) => idx === index ? { ...item, url: e.target.value } : item) }))} placeholder="Link URL" />
                      </div>
                    ))}
                  </div>
                </details>

                <details className="rounded-xl border border-gray-200 p-5">
                  <summary className="cursor-pointer text-sm font-semibold">Insert variables</summary>
                  <div className="mt-4 space-y-3">
                    <input className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm" value={variableSearch} onChange={(e) => setVariableSearch(e.target.value)} placeholder="Search variables" />
                    {groupedVariables.map((group) => (
                      <div key={group.label} className="space-y-1">
                        <p className="text-xs font-semibold text-gray-700">{group.label}</p>
                        {group.vars.map((item) => (
                          <button type="button" key={item.key} onClick={() => insertVariable(item.key)} className="w-full text-left rounded border border-gray-200 px-2 py-1.5 hover:bg-pink-50">
                            <p className="text-xs font-mono text-pink-600">{`{{${item.key}}}`}</p>
                            <p className="text-[11px] text-gray-500">{item.description} · e.g. {item.example}</p>
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                </details>

                <div className="flex flex-wrap gap-2.5">
                  <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-gray-900 text-white text-xs font-semibold shadow-sm">{saving ? "Saving..." : "Save template"}</button>
                  <button type="button" onClick={previewTemplate} className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-xs">Refresh preview</button>
                  <button type="button" onClick={() => resetToDefault(form.id)} className="px-4 py-2 rounded-lg border border-amber-300 text-amber-700 text-xs">Reset</button>
                </div>
              </form>
          </section>
        </section>
      )}
    </div>
  );
}
