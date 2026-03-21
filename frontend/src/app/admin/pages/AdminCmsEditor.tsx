import { useEffect, useState } from "react";
import { apiRequest } from "../api/client";
import { useAdminAuth } from "../context/AdminAuthContext";
import { ErrorState, LoadingState } from "../components/AdminState";
import { toast } from "sonner";

interface HomeSection {
  id: string;
  type: string;
  title?: string;
  subtitle?: string;
  enabled: boolean;
  order: number;
  status: "draft" | "published";
  content: Record<string, unknown>;
}

interface StaticPage {
  slug: string;
  title: string;
  status: "draft" | "published";
  content: string;
}

export default function AdminCmsEditor() {
  const { session } = useAdminAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [siteConfigJson, setSiteConfigJson] = useState("{}");
  const [sections, setSections] = useState<HomeSection[]>([]);
  const [pages, setPages] = useState<StaticPage[]>([]);
  const [selectedSlug, setSelectedSlug] = useState("about");
  const [pageTitle, setPageTitle] = useState("");
  const [pageStatus, setPageStatus] = useState<"draft" | "published">("published");
  const [pageContent, setPageContent] = useState("");

  const load = async () => {
    if (!session?.accessToken) return;
    try {
      setLoading(true);
      setError(null);
      const [siteConfigRes, homeSectionsRes, pagesRes] = await Promise.all([
        apiRequest<{ data: unknown }>("/admin/cms/site-config", {}, session.accessToken),
        apiRequest<{ data: HomeSection[] }>("/admin/cms/home-sections", {}, session.accessToken),
        apiRequest<{ data: StaticPage[] }>("/admin/cms/pages", {}, session.accessToken),
      ]);

      setSiteConfigJson(JSON.stringify(siteConfigRes.data, null, 2));
      const sortedSections = [...homeSectionsRes.data].sort((a, b) => a.order - b.order);
      setSections(sortedSections);
      setPages(pagesRes.data);

      const initialPage = pagesRes.data.find((p) => p.slug === selectedSlug) ?? pagesRes.data[0];
      if (initialPage) {
        setSelectedSlug(initialPage.slug);
        setPageTitle(initialPage.title);
        setPageStatus(initialPage.status);
        setPageContent(initialPage.content);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load CMS settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [session?.accessToken]);

  const saveSiteConfig = async () => {
    if (!session?.accessToken) return;
    try {
      const parsed = JSON.parse(siteConfigJson);
      await apiRequest("/admin/cms/site-config", { method: "PUT", body: JSON.stringify(parsed) }, session.accessToken);
      toast.success("Site config saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid JSON / save failed");
    }
  };

  const saveSections = async (nextSections: HomeSection[]) => {
    if (!session?.accessToken) return;
    const normalized = nextSections.map((s, idx) => ({ ...s, order: idx }));
    setSections(normalized);
    await apiRequest("/admin/cms/home-sections", { method: "PUT", body: JSON.stringify({ sections: normalized }) }, session.accessToken);
  };

  const moveSection = async (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= sections.length) return;
    const nextSections = [...sections];
    const [item] = nextSections.splice(index, 1);
    nextSections.splice(nextIndex, 0, item);
    try {
      await saveSections(nextSections);
      toast.success("Section order updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reorder sections");
    }
  };

  const toggleSectionEnabled = async (index: number) => {
    const next = [...sections];
    next[index] = { ...next[index], enabled: !next[index].enabled };
    try {
      await saveSections(next);
      toast.success("Section updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update section");
    }
  };

  const selectPage = (slug: string) => {
    const page = pages.find((p) => p.slug === slug);
    if (!page) return;
    setSelectedSlug(page.slug);
    setPageTitle(page.title);
    setPageStatus(page.status);
    setPageContent(page.content);
  };

  const savePage = async () => {
    if (!session?.accessToken || !selectedSlug) return;
    try {
      await apiRequest(`/admin/cms/pages/${selectedSlug}`, {
        method: "PUT",
        body: JSON.stringify({ title: pageTitle, status: pageStatus, content: pageContent, seo: {}, sections: [] }),
      }, session.accessToken);
      toast.success("Page saved");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save page");
    }
  };

  if (loading) return <LoadingState label="Loading CMS editor..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black text-gray-900">Website Editor / CMS</h2>
        <p className="text-sm text-gray-500">Manage homepage sections, navigation/header/footer settings, branding, and static pages.</p>
      </div>

      <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
        <h3 className="font-bold text-gray-900">Site Config (Navigation, Header/Footer, Logo, Favicon, Social, Contact, Branding, SEO)</h3>
        <textarea className="w-full min-h-[280px] rounded-lg border border-gray-200 px-3 py-2 font-mono text-xs" value={siteConfigJson} onChange={(e) => setSiteConfigJson(e.target.value)} />
        <button onClick={saveSiteConfig} className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm">Save Site Config</button>
      </section>

      <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
        <h3 className="font-bold text-gray-900">Homepage Sections (reorder + enable/disable + draft/publish)</h3>
        <div className="space-y-2">
          {sections.map((section, index) => (
            <div key={section.id} className="border border-gray-100 rounded-lg p-3 flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold">{section.title || section.id} <span className="text-xs text-gray-500">({section.type})</span></p>
                <p className="text-xs text-gray-500">Status: {section.status} · Enabled: {section.enabled ? "Yes" : "No"}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => moveSection(index, -1)} className="px-2 py-1 text-xs border border-gray-200 rounded">↑</button>
                <button onClick={() => moveSection(index, 1)} className="px-2 py-1 text-xs border border-gray-200 rounded">↓</button>
                <button onClick={() => toggleSectionEnabled(index)} className="px-2 py-1 text-xs border border-gray-200 rounded">{section.enabled ? "Disable" : "Enable"}</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
        <h3 className="font-bold text-gray-900">Static Pages (About, Contact, Privacy, Returns, Shipping, Terms)</h3>
        <div className="flex flex-wrap gap-2">
          {pages.map((page) => (
            <button key={page.slug} onClick={() => selectPage(page.slug)} className={`px-3 py-1 rounded-full text-xs ${selectedSlug === page.slug ? "bg-pink-100 text-pink-700" : "bg-gray-100 text-gray-700"}`}>
              {page.slug}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input className="rounded-lg border border-gray-200 px-3 py-2" value={pageTitle} onChange={(e) => setPageTitle(e.target.value)} placeholder="Page title" />
          <select className="rounded-lg border border-gray-200 px-3 py-2" value={pageStatus} onChange={(e) => setPageStatus(e.target.value as "draft" | "published")}>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
          </select>
        </div>
        <textarea className="w-full min-h-[180px] rounded-lg border border-gray-200 px-3 py-2" value={pageContent} onChange={(e) => setPageContent(e.target.value)} placeholder="Page body content" />
        <button onClick={savePage} className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm">Save Page</button>
      </section>
    </div>
  );
}
