import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { apiRequest } from "../api/client";
import { EmptyState, ErrorState, LoadingState } from "../components/AdminState";
import { useAdminAuth } from "../context/AdminAuthContext";

type TemplateCategory = "ACCOUNT" | "ORDER" | "PAYMENT" | "SHIPPING" | "SECURITY" | "SUPPORT" | "MARKETING" | "SYSTEM";

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

const CATEGORY_OPTIONS: TemplateCategory[] = ["ACCOUNT", "ORDER", "PAYMENT", "SHIPPING", "SECURITY", "SUPPORT", "MARKETING", "SYSTEM"];

export default function AdminEmailTemplates() {
  const { session } = useAdminAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [preview, setPreview] = useState<TemplatePreview | null>(null);
  const [sampleDataJson, setSampleDataJson] = useState("{\n  \"firstName\": \"Jane\",\n  \"companyName\": \"Dear Body\",\n  \"orderNumber\": \"10001234\",\n  \"orderDate\": \"2026-01-01\",\n  \"orderItems\": \"Hydrating Serum x1\",\n  \"orderTotal\": \"$120.00\",\n  \"trackingNumber\": \"1Z12345E0205271688\",\n  \"trackingUrl\": \"https://tracking.example.com/track/1Z12345E0205271688\",\n  \"supportEmail\": \"hello@dearbody.com\",\n  \"siteUrl\": \"https://example.com\",\n  \"verificationUrl\": \"https://example.com/verify?token=test\",\n  \"resetUrl\": \"https://example.com/reset?token=test\"\n}");
  const [testEmail, setTestEmail] = useState("");

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

  const selectedTemplate = useMemo(() => templates.find((item) => item.id === selectedId) ?? null, [templates, selectedId]);

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
      if (nextId) {
        const current = items.find((item) => item.id === nextId);
        if (current) {
          setForm({
            id: current.id,
            key: current.key ?? "",
            name: current.name ?? "",
            category: current.category ?? "ACCOUNT",
            subject: current.subject ?? "",
            htmlBody: current.htmlBody ?? "",
            textBody: current.textBody ?? "",
            placeholderKeys: Array.isArray(current.placeholderKeys) ? current.placeholderKeys.join(", ") : "",
            isEnabled: Boolean(current.isEnabled),
          });
        }
      }
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

  const parseSampleData = () => {
    try {
      const parsed = JSON.parse(sampleDataJson);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Sample data must be a JSON object");
      }
      return parsed as Record<string, unknown>;
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : "Invalid sample JSON");
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
      const res = await apiRequest<{ data: TemplatePreview }>(
        `/admin/email-templates/${form.id}/preview`,
        { method: "POST", body: JSON.stringify({ sampleData }) },
        session.accessToken,
      );
      setPreview(res.data);
      toast.success("Preview rendered");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to preview template");
    }
  };

  const testSend = async () => {
    if (!session?.accessToken || !form.id || !testEmail.trim()) return;
    try {
      const sampleData = parseSampleData();
      await apiRequest(`/admin/email-templates/${form.id}/test-send`, {
        method: "POST",
        body: JSON.stringify({ to: testEmail.trim(), sampleData }),
      }, session.accessToken);
      toast.success("Test email queued");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Test send failed");
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

  const resetToDefault = async () => {
    if (!session?.accessToken || !form.id) return;
    try {
      await apiRequest(`/admin/email-templates/${form.id}/reset-default`, { method: "POST", body: JSON.stringify({}) }, session.accessToken);
      toast.success("Template reset to default");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reset to default failed");
    }
  };

  if (loading) return <LoadingState label="Loading email templates..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm min-w-64"
          placeholder="Search template name, key, or subject"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select className="rounded-lg border border-gray-200 px-3 py-2 text-sm" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="">All categories</option>
          {CATEGORY_OPTIONS.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
        </select>
        <button type="button" onClick={seedDefaults} className="px-3 py-2 rounded-lg border border-gray-300 text-sm">Seed Defaults</button>
      </div>

      {templates.length === 0 ? <EmptyState label="No email templates found." /> : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <section className="lg:col-span-5 rounded-xl border border-gray-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left px-3 py-2">Name</th>
                  <th className="text-left px-3 py-2">Key</th>
                  <th className="text-left px-3 py-2">Active</th>
                  <th className="text-left px-3 py-2">Updated</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((item) => (
                  <tr
                    key={item.id}
                    className={`border-t border-gray-100 cursor-pointer ${item.id === form.id ? "bg-pink-50" : "hover:bg-gray-50"}`}
                    onClick={() => setSelectedId(item.id)}
                  >
                    <td className="px-3 py-2">
                      <p className="font-medium text-gray-900">{item.name || "Untitled"}</p>
                      <p className="text-xs text-gray-500 truncate max-w-[220px]">{item.subject || "No subject"}</p>
                    </td>
                    <td className="px-3 py-2 text-xs font-mono text-gray-600">{item.key || "-"}</td>
                    <td className="px-3 py-2">{item.isEnabled ? "Yes" : "No"}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="lg:col-span-7 space-y-4">
            {!form.id ? <EmptyState label="Select a template to edit." /> : (
              <>
                <form onSubmit={saveTemplate} className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
                  <h2 className="text-lg font-bold text-gray-900">Edit Template</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input className="rounded-lg border border-gray-200 px-3 py-2" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Template name" required />
                    <input className="rounded-lg border border-gray-200 px-3 py-2 font-mono" value={form.key} onChange={(e) => setForm((prev) => ({ ...prev, key: e.target.value }))} placeholder="template_key" required />
                    <select className="rounded-lg border border-gray-200 px-3 py-2" value={form.category} onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value as TemplateCategory }))}>
                      {CATEGORY_OPTIONS.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={form.isEnabled} onChange={(e) => setForm((prev) => ({ ...prev, isEnabled: e.target.checked }))} />
                      Active template
                    </label>
                  </div>
                  <input className="w-full rounded-lg border border-gray-200 px-3 py-2" value={form.subject} onChange={(e) => setForm((prev) => ({ ...prev, subject: e.target.value }))} placeholder="Email subject" required />
                  <textarea className="w-full rounded-lg border border-gray-200 px-3 py-2 min-h-36 font-mono text-sm" value={form.htmlBody} onChange={(e) => setForm((prev) => ({ ...prev, htmlBody: e.target.value }))} placeholder="HTML email body" required />
                  <textarea className="w-full rounded-lg border border-gray-200 px-3 py-2 min-h-24 font-mono text-sm" value={form.textBody} onChange={(e) => setForm((prev) => ({ ...prev, textBody: e.target.value }))} placeholder="Plain text fallback (optional)" />
                  <input className="w-full rounded-lg border border-gray-200 px-3 py-2" value={form.placeholderKeys} onChange={(e) => setForm((prev) => ({ ...prev, placeholderKeys: e.target.value }))} placeholder="Placeholders (comma separated)" />
                  <div className="flex flex-wrap gap-2">
                    <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm disabled:opacity-70">{saving ? "Saving..." : "Save Template"}</button>
                    <button type="button" onClick={previewTemplate} className="px-4 py-2 rounded-lg border border-gray-300 text-sm">Preview</button>
                    <button type="button" onClick={resetToDefault} className="px-4 py-2 rounded-lg border border-amber-300 text-amber-700 text-sm">Reset to Default</button>
                  </div>
                </form>

                <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
                  <h3 className="text-md font-bold text-gray-900">Preview & Test Send</h3>
                  <textarea
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 min-h-48 font-mono text-xs"
                    value={sampleDataJson}
                    onChange={(e) => setSampleDataJson(e.target.value)}
                  />
                  <input className="w-full rounded-lg border border-gray-200 px-3 py-2" placeholder="Test recipient email" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} />
                  <button type="button" onClick={testSend} className="px-4 py-2 rounded-lg border border-gray-300 text-sm">Send Test Email</button>

                  {preview ? (
                    <div className="rounded-lg border border-gray-100 p-3 space-y-2">
                      <p className="text-sm"><strong>Rendered subject:</strong> {preview.subject}</p>
                      <p className="text-xs text-gray-500">Source: {preview.source}</p>
                      <p className="text-xs text-gray-500">Placeholders: {preview.placeholderKeys.join(", ") || "None"}</p>
                      <p className="text-xs text-amber-600">Missing values: {preview.missingPlaceholders.join(", ") || "None"}</p>
                      <div className="border border-gray-200 rounded p-2 text-sm" dangerouslySetInnerHTML={{ __html: preview.htmlBody }} />
                    </div>
                  ) : null}
                </section>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
