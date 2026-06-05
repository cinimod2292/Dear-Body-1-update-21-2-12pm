import React, { useEffect, useState } from "react";
import { apiRequest } from "../api/client";
import { useAdminAuth } from "../context/AdminAuthContext";
import { ErrorState, LoadingState } from "../components/AdminState";
import { toast } from "sonner";

interface NavItem { label: string; href: string; enabled: boolean }
interface SocialLink { platform: string; url: string }

interface SiteConfig {
  navigation: { items: NavItem[] };
  header: { announcementText: string; logoUrl: string; logo2xUrl: string; logoMediaAssetId: string };
  footer: { copyrightText: string; contactEmail: string; contactPhone: string; address: string; socialLinks: SocialLink[] };
  branding: { primaryColor: string; secondaryColor: string; fontFamily: string; logoUrl: string; logo2xUrl: string; logoFooterUrl: string; logoMediaAssetId: string; faviconUrl: string };
  seoDefaults: { title: string; description: string; ogImageUrl: string };
  contactInfo: { email: string; phone: string; address: string };
}

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

const emptySiteConfig: SiteConfig = {
  navigation: { items: [] },
  header: { announcementText: "", logoUrl: "", logo2xUrl: "", logoMediaAssetId: "" },
  footer: { copyrightText: "", contactEmail: "", contactPhone: "", address: "", socialLinks: [] },
  branding: { primaryColor: "#ec4899", secondaryColor: "#f97316", fontFamily: "Inter, sans-serif", logoUrl: "", logo2xUrl: "", logoFooterUrl: "", logoMediaAssetId: "", faviconUrl: "" },
  seoDefaults: { title: "", description: "", ogImageUrl: "" },
  contactInfo: { email: "", phone: "", address: "" },
};

function parseSiteConfig(raw: unknown): SiteConfig {
  if (!raw || typeof raw !== "object") return emptySiteConfig;
  const r = raw as Record<string, unknown>;
  const nav = (r.navigation as Record<string, unknown> | undefined) ?? {};
  const header = (r.header as Record<string, unknown> | undefined) ?? {};
  const footer = (r.footer as Record<string, unknown> | undefined) ?? {};
  const branding = (r.branding as Record<string, unknown> | undefined) ?? {};
  const seoDefaults = (r.seoDefaults as Record<string, unknown> | undefined) ?? {};
  const contactInfo = (r.contactInfo as Record<string, unknown> | undefined) ?? {};

  return {
    navigation: {
      items: Array.isArray(nav.items)
        ? nav.items.map((item: unknown) => {
            const i = item as Record<string, unknown>;
            return { label: String(i.label ?? ""), href: String(i.href ?? "/"), enabled: Boolean(i.enabled ?? true) };
          })
        : [],
    },
    header: {
      announcementText: String(header.announcementText ?? ""),
      logoUrl: String(header.logoUrl ?? ""),
      logo2xUrl: String(header.logo2xUrl ?? ""),
      logoMediaAssetId: String(header.logoMediaAssetId ?? ""),
    },
    footer: {
      copyrightText: String(footer.copyrightText ?? ""),
      contactEmail: String(footer.contactEmail ?? ""),
      contactPhone: String(footer.contactPhone ?? ""),
      address: String(footer.address ?? ""),
      socialLinks: Array.isArray(footer.socialLinks)
        ? (footer.socialLinks as unknown[]).map((s) => {
            const sl = s as Record<string, unknown>;
            return { platform: String(sl.platform ?? ""), url: String(sl.url ?? "") };
          })
        : [],
    },
    branding: {
      primaryColor: String(branding.primaryColor ?? "#ec4899"),
      secondaryColor: String(branding.secondaryColor ?? "#f97316"),
      fontFamily: String(branding.fontFamily ?? "Inter, sans-serif"),
      logoUrl: String(branding.logoUrl ?? ""),
      logo2xUrl: String(branding.logo2xUrl ?? ""),
      logoFooterUrl: String(branding.logoFooterUrl ?? ""),
      logoMediaAssetId: String(branding.logoMediaAssetId ?? ""),
      faviconUrl: String(branding.faviconUrl ?? ""),
    },
    seoDefaults: {
      title: String(seoDefaults.title ?? ""),
      description: String(seoDefaults.description ?? ""),
      ogImageUrl: String(seoDefaults.ogImageUrl ?? ""),
    },
    contactInfo: {
      email: String(contactInfo.email ?? ""),
      phone: String(contactInfo.phone ?? ""),
      address: String(contactInfo.address ?? ""),
    },
  };
}

export default function AdminCmsEditor() {
  const { session } = useAdminAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<SiteConfig>(emptySiteConfig);
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

      setConfig(parseSiteConfig(siteConfigRes.data));
      setSections([...homeSectionsRes.data].sort((a, b) => a.order - b.order));
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

  useEffect(() => { load(); }, [session?.accessToken]);

  const saveSiteConfig = async () => {
    if (!session?.accessToken) return;
    try {
      await apiRequest("/admin/cms/site-config", { method: "PUT", body: JSON.stringify(config) }, session.accessToken);
      toast.success("Site settings saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save site settings");
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
    const next = [...sections];
    const [item] = next.splice(index, 1);
    next.splice(nextIndex, 0, item);
    try {
      await saveSections(next);
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

  const updateNavItem = (idx: number, field: keyof NavItem, value: string | boolean) =>
    setConfig((c) => {
      const items = [...c.navigation.items];
      items[idx] = { ...items[idx], [field]: value };
      return { ...c, navigation: { items } };
    });

  const addNavItem = () =>
    setConfig((c) => ({ ...c, navigation: { items: [...c.navigation.items, { label: "", href: "/", enabled: true }] } }));

  const removeNavItem = (idx: number) =>
    setConfig((c) => ({ ...c, navigation: { items: c.navigation.items.filter((_, i) => i !== idx) } }));

  const updateSocialLink = (idx: number, field: keyof SocialLink, value: string) =>
    setConfig((c) => {
      const socialLinks = [...c.footer.socialLinks];
      socialLinks[idx] = { ...socialLinks[idx], [field]: value };
      return { ...c, footer: { ...c.footer, socialLinks } };
    });

  const addSocialLink = () =>
    setConfig((c) => ({ ...c, footer: { ...c.footer, socialLinks: [...c.footer.socialLinks, { platform: "instagram", url: "" }] } }));

  const removeSocialLink = (idx: number) =>
    setConfig((c) => ({ ...c, footer: { ...c.footer, socialLinks: c.footer.socialLinks.filter((_, i) => i !== idx) } }));

  if (loading) return <LoadingState label="Loading CMS editor..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black text-gray-900">Website Editor / CMS</h2>
        <p className="text-sm text-gray-500">Manage homepage sections, navigation, header/footer settings, and static pages.</p>
      </div>

      <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-5">
        <h3 className="font-bold text-gray-900">Site Settings</h3>

        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Store &amp; SEO</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Store / SEO Title</label>
              <input className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" value={config.seoDefaults.title} onChange={(e) => setConfig((c) => ({ ...c, seoDefaults: { ...c.seoDefaults, title: e.target.value } }))} placeholder="Dear Body" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Header Announcement Bar</label>
              <input className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" value={config.header.announcementText} onChange={(e) => setConfig((c) => ({ ...c, header: { ...c.header, announcementText: e.target.value } }))} placeholder="FREE SHIPPING on orders over R500" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-gray-500 mb-1">SEO Description</label>
              <input className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" value={config.seoDefaults.description} onChange={(e) => setConfig((c) => ({ ...c, seoDefaults: { ...c.seoDefaults, description: e.target.value } }))} placeholder="Vibrant fragrances and skincare." />
            </div>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Contact &amp; Footer</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Contact Email</label>
              <input type="email" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" value={config.footer.contactEmail} onChange={(e) => setConfig((c) => ({ ...c, footer: { ...c.footer, contactEmail: e.target.value }, contactInfo: { ...c.contactInfo, email: e.target.value } }))} placeholder="hello@dearbody.com" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Contact Phone</label>
              <input type="tel" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" value={config.footer.contactPhone} onChange={(e) => setConfig((c) => ({ ...c, footer: { ...c.footer, contactPhone: e.target.value }, contactInfo: { ...c.contactInfo, phone: e.target.value } }))} placeholder="+27 12 345 6789" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Address</label>
              <input className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" value={config.footer.address} onChange={(e) => setConfig((c) => ({ ...c, footer: { ...c.footer, address: e.target.value }, contactInfo: { ...c.contactInfo, address: e.target.value } }))} placeholder="123 Main Street, Cape Town" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Footer Copyright Text</label>
              <input className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" value={config.footer.copyrightText} onChange={(e) => setConfig((c) => ({ ...c, footer: { ...c.footer, copyrightText: e.target.value } }))} placeholder={`© ${new Date().getFullYear()} Dear Body. All rights reserved.`} />
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-700">Navigation Menu</h4>
            <button type="button" onClick={addNavItem} className="text-xs px-3 py-1.5 rounded-lg border border-gray-200">+ Add Link</button>
          </div>
          {pages.length > 0 && (
            <p className="text-xs text-gray-400 mb-2">
              Available page paths: {pages.filter((p) => p.status === "published").map((p) => <code key={p.slug} className="bg-gray-100 px-1 rounded">/pages/{p.slug}</code>).reduce<React.ReactNode[]>((acc, el, i) => i === 0 ? [el] : [...acc, ", ", el], [])}
            </p>
          )}
          {config.navigation.items.length === 0 ? (
            <p className="text-xs text-gray-400">No nav items yet. Click Add Link to create one.</p>
          ) : (
            <div className="space-y-2">
              {config.navigation.items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 items-center">
                  <input className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm" placeholder="Label (e.g. Shop)" value={item.label} onChange={(e) => updateNavItem(idx, "label", e.target.value)} />
                  <input className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm" placeholder="/path" value={item.href} onChange={(e) => updateNavItem(idx, "href", e.target.value)} />
                  <label className="flex items-center gap-1 text-xs whitespace-nowrap cursor-pointer">
                    <input type="checkbox" checked={item.enabled} onChange={(e) => updateNavItem(idx, "enabled", e.target.checked)} />
                    Show
                  </label>
                  <button type="button" onClick={() => removeNavItem(idx)} className="text-red-500 text-xs px-2 py-1 rounded border border-red-100 hover:bg-red-50">Remove</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-700">Social Links</h4>
            <button type="button" onClick={addSocialLink} className="text-xs px-3 py-1.5 rounded-lg border border-gray-200">+ Add Link</button>
          </div>
          {config.footer.socialLinks.length === 0 ? (
            <p className="text-xs text-gray-400">No social links yet. Click Add Link to create one.</p>
          ) : (
            <div className="space-y-2">
              {config.footer.socialLinks.map((link, idx) => (
                <div key={idx} className="grid grid-cols-[auto_1fr_auto] gap-2 items-center">
                  <select className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm" value={link.platform} onChange={(e) => updateSocialLink(idx, "platform", e.target.value)}>
                    <option value="instagram">Instagram</option>
                    <option value="facebook">Facebook</option>
                    <option value="twitter">Twitter / X</option>
                    <option value="tiktok">TikTok</option>
                    <option value="youtube">YouTube</option>
                    <option value="pinterest">Pinterest</option>
                  </select>
                  <input className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm" placeholder="https://..." value={link.url} onChange={(e) => updateSocialLink(idx, "url", e.target.value)} />
                  <button type="button" onClick={() => removeSocialLink(idx)} className="text-red-500 text-xs px-2 py-1 rounded border border-red-100 hover:bg-red-50">Remove</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Brand Colors</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <input type="color" className="w-10 h-10 rounded cursor-pointer border border-gray-200 p-0.5" value={config.branding.primaryColor} onChange={(e) => setConfig((c) => ({ ...c, branding: { ...c.branding, primaryColor: e.target.value } }))} />
              <div>
                <label className="block text-xs text-gray-500 mb-1">Primary Color</label>
                <input className="rounded-lg border border-gray-200 px-2 py-1 text-xs w-28" value={config.branding.primaryColor} onChange={(e) => setConfig((c) => ({ ...c, branding: { ...c.branding, primaryColor: e.target.value } }))} placeholder="#ec4899" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <input type="color" className="w-10 h-10 rounded cursor-pointer border border-gray-200 p-0.5" value={config.branding.secondaryColor} onChange={(e) => setConfig((c) => ({ ...c, branding: { ...c.branding, secondaryColor: e.target.value } }))} />
              <div>
                <label className="block text-xs text-gray-500 mb-1">Secondary Color</label>
                <input className="rounded-lg border border-gray-200 px-2 py-1 text-xs w-28" value={config.branding.secondaryColor} onChange={(e) => setConfig((c) => ({ ...c, branding: { ...c.branding, secondaryColor: e.target.value } }))} placeholder="#f97316" />
              </div>
            </div>
          </div>
        </div>

        <button onClick={saveSiteConfig} className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm">Save Site Settings</button>
      </section>

      <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
        <h3 className="font-bold text-gray-900">Homepage Sections</h3>
        <p className="text-xs text-gray-500">Reorder and enable/disable which sections appear on the homepage.</p>
        <div className="space-y-2">
          {sections.map((section, index) => (
            <div key={section.id} className="border border-gray-100 rounded-lg p-3 flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-sm">{section.title || section.id} <span className="text-xs text-gray-400">({section.type})</span></p>
                <p className="text-xs text-gray-500">{section.status} · {section.enabled ? "Visible" : "Hidden"}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => moveSection(index, -1)} className="px-2 py-1 text-xs border border-gray-200 rounded disabled:opacity-40" disabled={index === 0}>↑</button>
                <button onClick={() => moveSection(index, 1)} className="px-2 py-1 text-xs border border-gray-200 rounded disabled:opacity-40" disabled={index === sections.length - 1}>↓</button>
                <button onClick={() => toggleSectionEnabled(index)} className={`px-2 py-1 text-xs border rounded ${section.enabled ? "border-red-200 text-red-700" : "border-green-200 text-green-700"}`}>{section.enabled ? "Hide" : "Show"}</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
        <h3 className="font-bold text-gray-900">Static Pages</h3>
        <p className="text-xs text-gray-500">Edit the content of your static pages. The page title is the display name shown on the site and in the footer — the URL path (e.g. <code className="bg-gray-100 px-1 rounded">/pages/about</code>) is fixed and cannot be changed.</p>
        <div className="flex flex-wrap gap-2">
          {pages.map((page) => (
            <button key={page.slug} onClick={() => selectPage(page.slug)} className={`px-3 py-1 rounded-full text-xs ${selectedSlug === page.slug ? "bg-pink-100 text-pink-700 font-semibold" : "bg-gray-100 text-gray-700"}`}>
              {page.title || page.slug}
            </button>
          ))}
        </div>
        {selectedSlug && (
          <p className="text-xs text-gray-400">URL: <code className="bg-gray-100 px-1 rounded">/pages/{selectedSlug}</code></p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input className="rounded-lg border border-gray-200 px-3 py-2" value={pageTitle} onChange={(e) => setPageTitle(e.target.value)} placeholder="Page title (display name)" />
          <select className="rounded-lg border border-gray-200 px-3 py-2" value={pageStatus} onChange={(e) => setPageStatus(e.target.value as "draft" | "published")}>
            <option value="published">Published</option>
            <option value="draft">Draft (not visible on site)</option>
          </select>
        </div>
        <textarea className="w-full min-h-[180px] rounded-lg border border-gray-200 px-3 py-2 text-sm" value={pageContent} onChange={(e) => setPageContent(e.target.value)} placeholder="Page body content" />
        <button onClick={savePage} className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm">Save Page</button>
      </section>
    </div>
  );
}
