import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { apiRequest } from "../api/client";
import { EmptyState, ErrorState, LoadingState } from "../components/AdminState";
import { useAdminAuth } from "../context/AdminAuthContext";

type TemplateCategory = "ACCOUNT" | "ORDER" | "PAYMENT" | "SHIPPING" | "SECURITY" | "SUPPORT" | "MARKETING" | "SYSTEM";
type EditorSection = "header" | "content" | "cta" | "footer" | "advanced";

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

interface BrandTheme {
  companyName: string;
  supportEmail: string;
  siteUrl: string;
  headerGradientStart: string;
  headerGradientEnd: string;
  buttonText: string;
}

interface TemplateCardMeta {
  description: string;
  audience: string;
}

const TEMPLATE_META: Record<string, TemplateCardMeta> = {
  welcome: { description: "Greets new customers and introduces your brand.", audience: "New customer" },
  welcome_email: { description: "System welcome variant with brand defaults.", audience: "New customer" },
  password_reset: { description: "Secure password reset flow email.", audience: "Customer account" },
  email_verification: { description: "Verifies ownership of customer email.", audience: "Customer account" },
  order_confirmation: { description: "Confirms order placement and summary.", audience: "Customer order" },
  order_shipped: { description: "Shares shipment and tracking details.", audience: "Customer order" },
  order_delivered: { description: "Confirms final delivery completion.", audience: "Customer order" },
  contact_form_notification: { description: "Alerts team to new support inquiry.", audience: "Support team" },
  admin_new_order_notification: { description: "Internal alert for new orders.", audience: "Admin team" },
  newsletter_signup_confirmation: { description: "Confirms newsletter subscription.", audience: "Marketing" },
};

const CATEGORY_OPTIONS: TemplateCategory[] = ["ACCOUNT", "ORDER", "PAYMENT", "SHIPPING", "SECURITY", "SUPPORT", "MARKETING", "SYSTEM"];

const VARIABLE_GROUPS: Array<{ label: string; vars: Array<{ key: string; example: string; description: string }> }> = [
  {
    label: "Customer",
    vars: [
      { key: "customerName", example: "Jane Smith", description: "Full customer name" },
      { key: "firstName", example: "Jane", description: "Customer first name" },
      { key: "lastName", example: "Smith", description: "Customer last name" },
      { key: "supportEmail", example: "hello@dearbody.com", description: "Support inbox" },
    ],
  },
  {
    label: "Order",
    vars: [
      { key: "orderNumber", example: "10001234", description: "Store order number" },
      { key: "orderDate", example: "2026-03-31", description: "Date order was placed" },
      { key: "orderItems", example: "Body Lotion x2", description: "Order item summary" },
      { key: "orderTotal", example: "$120.00", description: "Total amount" },
      { key: "trackingNumber", example: "1Z12345", description: "Shipment tracking number" },
      { key: "trackingUrl", example: "https://tracking.example.com", description: "Track URL" },
    ],
  },
  {
    label: "Brand & Links",
    vars: [
      { key: "companyName", example: "Dear Body", description: "Brand/company name" },
      { key: "siteUrl", example: "https://example.com", description: "Storefront URL" },
      { key: "verificationUrl", example: "https://example.com/verify", description: "Email verification URL" },
      { key: "resetUrl", example: "https://example.com/reset", description: "Password reset URL" },
    ],
  },
];

export default function AdminEmailTemplates() {
  const { session } = useAdminAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "disabled">("all");
  const [viewMode, setViewMode] = useState<"gallery" | "list">("gallery");
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [section, setSection] = useState<EditorSection>("header");
  const [preview, setPreview] = useState<TemplatePreview | null>(null);
  const [targetField, setTargetField] = useState<"subject" | "html">("html");
  const [sampleDataJson, setSampleDataJson] = useState("{\n  \"customerName\": \"Jane Smith\",\n  \"firstName\": \"Jane\",\n  \"lastName\": \"Smith\",\n  \"companyName\": \"Dear Body\",\n  \"orderNumber\": \"10001234\",\n  \"orderDate\": \"2026-03-31\",\n  \"orderItems\": \"Hydrating Serum x1\",\n  \"orderTotal\": \"$120.00\",\n  \"trackingNumber\": \"1Z12345E0205271688\",\n  \"trackingUrl\": \"https://tracking.example.com/track/1Z12345E0205271688\",\n  \"supportEmail\": \"hello@dearbody.com\",\n  \"siteUrl\": \"https://example.com\",\n  \"verificationUrl\": \"https://example.com/verify?token=test\",\n  \"resetUrl\": \"https://example.com/reset?token=test\"\n}");
  const [testEmail, setTestEmail] = useState("");
  const [theme, setTheme] = useState<BrandTheme>({
    companyName: "Dear Body",
    supportEmail: "hello@dearbody.com",
    siteUrl: "https://example.com",
    headerGradientStart: "#ec4899",
    headerGradientEnd: "#f97316",
    buttonText: "Shop Now",
  });

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

  const filteredTemplates = useMemo(() => templates.filter((item) => {
    if (statusFilter === "active" && !item.isEnabled) return false;
    if (statusFilter === "disabled" && item.isEnabled) return false;
    return true;
  }), [templates, statusFilter]);

  const selectedTemplate = useMemo(() => filteredTemplates.find((item) => item.id === selectedId) ?? null, [filteredTemplates, selectedId]);
  const preheader = useMemo(() => {
    const noTags = form.htmlBody.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    return noTags.slice(0, 120) || "Email preheader preview";
  }, [form.htmlBody]);

  const parseSampleData = () => {
    try {
      const parsed = JSON.parse(sampleDataJson);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Sample data must be a JSON object");
      return parsed as Record<string, unknown>;
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : "Invalid sample JSON");
    }
  };

  const load = async () => {
    if (!session?.accessToken) return;
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ page: "1", perPage: "200" });
      if (query.trim()) params.set("q", query.trim());
      if (categoryFilter) params.set("category", categoryFilter);
      const res = await apiRequest<{ data: { items: EmailTemplate[] } }>(`/admin/email-templates?${params.toString()}`, {}, session.accessToken);
      const items = Array.isArray(res.data.items) ? res.data.items : [];
      setTemplates(items);
      const nextId = selectedId && items.some((item) => item.id === selectedId) ? selectedId : (items[0]?.id ?? "");
      setSelectedId(nextId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load email templates");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [session?.accessToken, query, categoryFilter]);

  useEffect(() => {
    if (!selectedTemplate) return;
    setForm({
      id: selectedTemplate.id,
      key: selectedTemplate.key ?? "",
      name: selectedTemplate.name ?? "",
      category: selectedTemplate.category ?? "ACCOUNT",
      subject: selectedTemplate.subject ?? "",
      htmlBody: selectedTemplate.htmlBody ?? "",
      textBody: selectedTemplate.textBody ?? "",
      placeholderKeys: Array.isArray(selectedTemplate.placeholderKeys) ? selectedTemplate.placeholderKeys.join(", ") : "",
      isEnabled: Boolean(selectedTemplate.isEnabled),
    });
    setPreview(null);
  }, [selectedTemplate?.id]);

  const insertVariable = (variableKey: string) => {
    const token = `{{${variableKey}}}`;
    if (targetField === "subject") {
      setForm((prev) => ({ ...prev, subject: `${prev.subject}${token}` }));
    } else {
      setForm((prev) => ({ ...prev, htmlBody: `${prev.htmlBody}${token}` }));
    }
  };

  const applyThemeToHtml = () => {
    setForm((prev) => {
      let nextHtml = prev.htmlBody;
      nextHtml = nextHtml.replace(/Dear Body/g, "{{companyName}}");
      nextHtml = nextHtml.replace(/hello@dearbody\.com/g, "{{supportEmail}}");
      nextHtml = nextHtml.replace(/https:\/\/example\.com/g, "{{siteUrl}}");
      nextHtml = nextHtml.replace(/Shop Now/g, theme.buttonText);
      nextHtml = nextHtml.replace(/linear-gradient\(90deg,[^)]+\)/g, `linear-gradient(90deg,${theme.headerGradientStart},${theme.headerGradientEnd})`);
      return { ...prev, htmlBody: nextHtml };
    });
    toast.success("Brand styles applied to HTML");
  };

  const addCtaBlock = () => {
    setForm((prev) => ({
      ...prev,
      htmlBody: `${prev.htmlBody}\n<p style="margin:20px 0;"><a href="{{siteUrl}}" style="display:inline-block;padding:12px 24px;border-radius:999px;background:linear-gradient(90deg,#ec4899,#f97316);color:#fff;text-decoration:none;font-weight:700;">${theme.buttonText}</a></p>`,
    }));
    toast.success("CTA block added");
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
        htmlBody: form.htmlBody,
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
      const merged = { ...sampleData, companyName: theme.companyName, supportEmail: theme.supportEmail, siteUrl: theme.siteUrl };
      const res = await apiRequest<{ data: TemplatePreview }>(`/admin/email-templates/${form.id}/preview`, { method: "POST", body: JSON.stringify({ sampleData: merged }) }, session.accessToken);
      setPreview(res.data);
      toast.success("Live preview refreshed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to preview template");
    }
  };

  const testSend = async () => {
    if (!session?.accessToken || !form.id || !testEmail.trim()) return;
    try {
      const sampleData = parseSampleData();
      const merged = { ...sampleData, companyName: theme.companyName, supportEmail: theme.supportEmail, siteUrl: theme.siteUrl };
      await apiRequest(`/admin/email-templates/${form.id}/test-send`, { method: "POST", body: JSON.stringify({ to: testEmail.trim(), sampleData: merged }) }, session.accessToken);
      toast.success("Test email queued");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Test send failed");
    }
  };

  const resetToDefault = async (id: string) => {
    if (!session?.accessToken) return;
    try {
      await apiRequest(`/admin/email-templates/${id}/reset-default`, { method: "POST", body: JSON.stringify({}) }, session.accessToken);
      toast.success("Template reset to system default");
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
    const cloneKey = `${template.key}_copy_${Date.now().toString().slice(-4)}`;
    try {
      await apiRequest("/admin/email-templates", {
        method: "PUT",
        body: JSON.stringify({
          key: cloneKey,
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

  if (loading) return <LoadingState label="Loading template builder..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-5">
      <header className="rounded-2xl border border-pink-100 bg-gradient-to-r from-pink-50 via-white to-orange-50 p-5">
        <h1 className="text-2xl font-black text-gray-900">Email Template Studio</h1>
        <p className="text-sm text-gray-600 mt-1">Create branded, polished lifecycle emails with a guided builder and live preview.</p>
      </header>

      <section className="flex flex-wrap items-center gap-2">
        <input className="rounded-lg border border-gray-200 px-3 py-2 text-sm min-w-64" placeholder="Search templates..." value={query} onChange={(e) => setQuery(e.target.value)} />
        <select className="rounded-lg border border-gray-200 px-3 py-2 text-sm" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="">All categories</option>
          {CATEGORY_OPTIONS.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
        </select>
        <select className="rounded-lg border border-gray-200 px-3 py-2 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "disabled")}>
          <option value="all">All status</option>
          <option value="active">Active</option>
          <option value="disabled">Disabled</option>
        </select>
        <button type="button" onClick={() => setViewMode((prev) => (prev === "gallery" ? "list" : "gallery"))} className="px-3 py-2 rounded-lg border border-gray-300 text-sm">
          {viewMode === "gallery" ? "Switch to List" : "Switch to Gallery"}
        </button>
        <button type="button" onClick={seedDefaults} className="px-3 py-2 rounded-lg bg-gray-900 text-white text-sm">Seed Defaults</button>
      </section>

      <section className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <p className="font-semibold">Using existing templates?</p>
        <p className="mt-1">
          Existing database templates keep their current HTML. Use <span className="font-semibold">Seed Defaults</span> to add missing templates and
          <span className="font-semibold"> Reset</span> on a template to apply the latest branded default content.
        </p>
      </section>

      {filteredTemplates.length === 0 ? <EmptyState label="No templates found for current filters." /> : (
        <>
          {viewMode === "gallery" ? (
            <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredTemplates.map((item) => {
                const meta = TEMPLATE_META[item.key] ?? { description: "Custom or system template.", audience: "General" };
                return (
                  <article key={item.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs text-pink-600 font-semibold uppercase tracking-wide">{item.category}</p>
                        <h3 className="font-bold text-gray-900 mt-1">{item.name}</h3>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full ${item.isEnabled ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>{item.isEnabled ? "Active" : "Disabled"}</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-2">{meta.description}</p>
                    <p className="text-xs text-gray-500 mt-2">Audience: {meta.audience}</p>
                    <p className="text-xs text-gray-500 mt-1">Updated: {item.updatedAt ? new Date(item.updatedAt).toLocaleString() : "-"}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button type="button" onClick={() => { setSelectedId(item.id); setSection("header"); }} className="px-3 py-1.5 rounded-lg bg-pink-500 text-white text-xs">Edit</button>
                      <button type="button" onClick={() => { setSelectedId(item.id); void previewTemplate(); }} className="px-3 py-1.5 rounded-lg border border-gray-300 text-xs">Preview</button>
                      <button type="button" onClick={() => duplicateTemplate(item)} className="px-3 py-1.5 rounded-lg border border-gray-300 text-xs">Duplicate</button>
                      <button type="button" onClick={() => resetToDefault(item.id)} className="px-3 py-1.5 rounded-lg border border-amber-300 text-amber-700 text-xs">Reset</button>
                    </div>
                  </article>
                );
              })}
            </section>
          ) : (
            <section className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600"><tr><th className="text-left px-3 py-2">Template</th><th className="text-left px-3 py-2">Status</th><th className="text-left px-3 py-2">Updated</th><th className="text-left px-3 py-2">Actions</th></tr></thead>
                <tbody>
                  {filteredTemplates.map((item) => (
                    <tr key={item.id} className="border-t border-gray-100">
                      <td className="px-3 py-2"><p className="font-medium">{item.name}</p><p className="text-xs text-gray-500">{item.key}</p></td>
                      <td className="px-3 py-2">{item.isEnabled ? "Active" : "Disabled"}</td>
                      <td className="px-3 py-2">{item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : "-"}</td>
                      <td className="px-3 py-2"><button type="button" className="text-pink-600 text-xs" onClick={() => setSelectedId(item.id)}>Edit</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </>
      )}

      {!selectedTemplate ? null : (
        <section className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
          <div className="grid grid-cols-1 xl:grid-cols-12 min-h-[700px]">
            <aside className="xl:col-span-2 border-r border-gray-100 p-4 bg-gray-50">
              <h4 className="font-semibold text-sm text-gray-700 mb-3">Builder Sections</h4>
              {[
                { id: "header", label: "Header & Brand" },
                { id: "content", label: "Content" },
                { id: "cta", label: "CTA & Variables" },
                { id: "footer", label: "Footer" },
                { id: "advanced", label: "Advanced" },
              ].map((item) => (
                <button key={item.id} type="button" onClick={() => setSection(item.id as EditorSection)} className={`w-full text-left px-3 py-2 rounded-lg text-sm mb-2 ${section === item.id ? "bg-pink-100 text-pink-700 font-semibold" : "hover:bg-gray-100 text-gray-600"}`}>
                  {item.label}
                </button>
              ))}
              <div className="mt-4 text-xs text-gray-500">
                <p className="font-semibold mb-1">Editing mode</p>
                <p>{section === "advanced" ? "Advanced mode (raw HTML/text)" : "Friendly mode (guided controls)"}</p>
              </div>
            </aside>

            <main className="xl:col-span-6 border-r border-gray-100 p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-400">Live Preview</p>
                  <h3 className="font-bold text-gray-900">{form.name}</h3>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setPreviewMode("desktop")} className={`px-2 py-1 rounded text-xs ${previewMode === "desktop" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600"}`}>Desktop</button>
                  <button type="button" onClick={() => setPreviewMode("mobile")} className={`px-2 py-1 rounded text-xs ${previewMode === "mobile" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600"}`}>Mobile</button>
                  <button type="button" onClick={previewTemplate} className="px-2 py-1 rounded text-xs border border-gray-300">Refresh</button>
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                <p className="text-xs text-gray-500 mb-1">Subject preview</p>
                <p className="font-semibold text-sm text-gray-900">{preview?.subject || form.subject || "(No subject)"}</p>
                <p className="text-xs text-gray-500 mt-2">Preheader: {preheader}</p>
              </div>

              <div className="mt-4 flex justify-center">
                <div className={`bg-white border border-gray-200 rounded-xl overflow-hidden ${previewMode === "mobile" ? "w-[360px]" : "w-full max-w-[760px]"}`}>
                  <div className="p-4 text-sm" dangerouslySetInnerHTML={{ __html: preview?.htmlBody || form.htmlBody }} />
                </div>
              </div>
            </main>

            <aside className="xl:col-span-4 p-4 space-y-3">
              <form onSubmit={saveTemplate} className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <input className="rounded-lg border border-gray-200 px-3 py-2 text-sm" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Template Name" required />
                  <input className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono" value={form.key} onChange={(e) => setForm((p) => ({ ...p, key: e.target.value }))} placeholder="template_key" required />
                </div>
                <input className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" value={form.subject} onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))} placeholder="Subject line" />
                <div className="flex items-center gap-2 text-xs">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={form.isEnabled} onChange={(e) => setForm((p) => ({ ...p, isEnabled: e.target.checked }))} />Active</label>
                  <select className="rounded border border-gray-200 px-2 py-1" value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value as TemplateCategory }))}>
                    {CATEGORY_OPTIONS.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>

                {section === "header" && (
                  <div className="rounded-lg border border-gray-200 p-3 space-y-2">
                    <h4 className="font-semibold text-sm">Brand Theme</h4>
                    <input className="w-full rounded border border-gray-200 px-2 py-1 text-sm" value={theme.companyName} onChange={(e) => setTheme((p) => ({ ...p, companyName: e.target.value }))} placeholder="Company Name" />
                    <input className="w-full rounded border border-gray-200 px-2 py-1 text-sm" value={theme.supportEmail} onChange={(e) => setTheme((p) => ({ ...p, supportEmail: e.target.value }))} placeholder="Support Email" />
                    <div className="grid grid-cols-2 gap-2">
                      <input type="color" className="w-full h-9 rounded border border-gray-200" value={theme.headerGradientStart} onChange={(e) => setTheme((p) => ({ ...p, headerGradientStart: e.target.value }))} />
                      <input type="color" className="w-full h-9 rounded border border-gray-200" value={theme.headerGradientEnd} onChange={(e) => setTheme((p) => ({ ...p, headerGradientEnd: e.target.value }))} />
                    </div>
                    <button type="button" onClick={applyThemeToHtml} className="px-3 py-1.5 rounded border border-gray-300 text-xs">Apply Brand Theme</button>
                  </div>
                )}

                {section === "content" && (
                  <div className="rounded-lg border border-gray-200 p-3 space-y-2">
                    <h4 className="font-semibold text-sm">Content</h4>
                    <textarea className="w-full rounded border border-gray-200 px-2 py-2 text-xs min-h-44 font-mono" value={form.htmlBody} onChange={(e) => setForm((p) => ({ ...p, htmlBody: e.target.value }))} />
                    <textarea className="w-full rounded border border-gray-200 px-2 py-2 text-xs min-h-24 font-mono" value={form.textBody} onChange={(e) => setForm((p) => ({ ...p, textBody: e.target.value }))} placeholder="Plain text fallback (optional)" />
                  </div>
                )}

                {section === "cta" && (
                  <div className="rounded-lg border border-gray-200 p-3 space-y-2">
                    <h4 className="font-semibold text-sm">CTA & Variables</h4>
                    <input className="w-full rounded border border-gray-200 px-2 py-1 text-sm" value={theme.buttonText} onChange={(e) => setTheme((p) => ({ ...p, buttonText: e.target.value }))} placeholder="CTA Button Text" />
                    <button type="button" onClick={addCtaBlock} className="px-3 py-1.5 rounded border border-gray-300 text-xs">Add CTA block</button>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-gray-500">Insert into:</label>
                      <select className="rounded border border-gray-200 px-2 py-1 text-xs" value={targetField} onChange={(e) => setTargetField(e.target.value as "subject" | "html")}>
                        <option value="html">HTML body</option>
                        <option value="subject">Subject</option>
                      </select>
                    </div>
                    <div className="max-h-60 overflow-auto space-y-2">
                      {VARIABLE_GROUPS.map((group) => (
                        <div key={group.label}>
                          <p className="text-xs font-semibold text-gray-700">{group.label}</p>
                          <div className="space-y-1 mt-1">
                            {group.vars.map((v) => (
                              <button key={v.key} type="button" onClick={() => insertVariable(v.key)} className="w-full text-left px-2 py-1.5 rounded border border-gray-200 hover:bg-pink-50">
                                <p className="text-xs font-mono text-pink-600">{`{{${v.key}}}`}</p>
                                <p className="text-[11px] text-gray-500">{v.description} · e.g. {v.example}</p>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {section === "footer" && (
                  <div className="rounded-lg border border-gray-200 p-3 space-y-2">
                    <h4 className="font-semibold text-sm">Footer & Contact</h4>
                    <input className="w-full rounded border border-gray-200 px-2 py-1 text-sm" value={theme.siteUrl} onChange={(e) => setTheme((p) => ({ ...p, siteUrl: e.target.value }))} placeholder="Site URL" />
                    <input className="w-full rounded border border-gray-200 px-2 py-1 text-sm" value={form.placeholderKeys} onChange={(e) => setForm((p) => ({ ...p, placeholderKeys: e.target.value }))} placeholder="Allowed placeholders (comma separated)" />
                    <p className="text-xs text-gray-500">These theme fields are inserted via template variables ({`{{companyName}}`}, {`{{supportEmail}}`}, {`{{siteUrl}}`}).</p>
                  </div>
                )}

                {section === "advanced" && (
                  <div className="rounded-lg border border-gray-200 p-3 space-y-2">
                    <h4 className="font-semibold text-sm">Advanced Mode</h4>
                    <p className="text-xs text-gray-500">Full raw HTML/text editing for power users.</p>
                    <textarea className="w-full rounded border border-gray-200 px-2 py-2 text-xs min-h-52 font-mono" value={form.htmlBody} onChange={(e) => setForm((p) => ({ ...p, htmlBody: e.target.value }))} />
                    <textarea className="w-full rounded border border-gray-200 px-2 py-2 text-xs min-h-24 font-mono" value={form.textBody} onChange={(e) => setForm((p) => ({ ...p, textBody: e.target.value }))} />
                  </div>
                )}

                <div className="rounded-lg border border-gray-200 p-3 space-y-2">
                  <h4 className="font-semibold text-sm">Sample Data & Test Send</h4>
                  <textarea className="w-full rounded border border-gray-200 px-2 py-2 text-xs min-h-36 font-mono" value={sampleDataJson} onChange={(e) => setSampleDataJson(e.target.value)} />
                  <input className="w-full rounded border border-gray-200 px-2 py-1 text-sm" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="recipient@example.com" />
                  <div className="flex flex-wrap gap-2">
                    <button type="submit" disabled={saving} className="px-3 py-1.5 rounded bg-gray-900 text-white text-xs">{saving ? "Saving..." : "Save Template"}</button>
                    <button type="button" onClick={previewTemplate} className="px-3 py-1.5 rounded border border-gray-300 text-xs">Refresh Preview</button>
                    <button type="button" onClick={testSend} className="px-3 py-1.5 rounded border border-gray-300 text-xs">Send Test</button>
                    <button type="button" onClick={() => resetToDefault(form.id)} className="px-3 py-1.5 rounded border border-amber-300 text-amber-700 text-xs">Reset</button>
                  </div>
                  {preview?.missingPlaceholders?.length ? <p className="text-xs text-amber-600">Missing values: {preview.missingPlaceholders.join(", ")}</p> : null}
                </div>
              </form>
            </aside>
          </div>
        </section>
      )}
    </div>
  );
}
