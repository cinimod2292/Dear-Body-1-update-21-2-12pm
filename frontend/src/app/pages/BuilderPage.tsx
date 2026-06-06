import { useEffect, useState } from "react";
import { useLocation } from "react-router";
import { BuilderPageRenderer } from "../builder/BuilderPageRenderer";
import { fetchStoreBuilderPage } from "../builder/api";
import { BuilderPageContent, BuilderPageKey } from "../builder/types";
import { API_BASE } from "../admin/api/client";

const PATH_TO_PAGE_KEY: Record<string, BuilderPageKey> = {
  "/about": "about",
  "/contact": "contact",
  "/returns": "returns",
  "/sale": "sale",
  "/brand": "brand",
  "/faq": "faq",
  "/delivery": "delivery",
  "/campaign": "campaign",
};

// Pages that have CMS fallback content when no builder content is published
const CMS_FALLBACK_PATHS = new Set(["/about", "/contact", "/returns"]);

const PAGE_TITLES: Record<string, string> = {
  "/about": "About Us | Dear Body",
  "/contact": "Contact Us | Dear Body",
  "/returns": "Returns & Refunds | Dear Body",
  "/sale": "Sale | Dear Body",
  "/brand": "Our Brand | Dear Body",
  "/faq": "FAQ | Dear Body",
  "/delivery": "Delivery | Dear Body",
  "/campaign": "Campaign | Dear Body",
};

interface CmsPagePayload {
  slug: string;
  title: string;
  content: string;
  status: "draft" | "published";
}

function CmsFallback({ slug }: { slug: string }) {
  const [page, setPage] = useState<CmsPagePayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/store/cms/pages/${slug}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Page not found");
        return res.json();
      })
      .then((payload) => setPage(payload.data))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load page"));
  }, [slug]);

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20">
        <h1 className="text-3xl font-black text-gray-900 mb-4">Page unavailable</h1>
        <p className="text-gray-600">{error}</p>
      </div>
    );
  }

  if (!page) {
    return <div className="max-w-4xl mx-auto px-4 py-20 text-gray-500">Loading page...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-16">
      <h1 className="text-4xl font-black text-gray-900 mb-6">{page.title}</h1>
      <div className="prose max-w-none text-gray-700 whitespace-pre-line">{page.content}</div>
    </div>
  );
}

function ComingSoon({ path }: { path: string }) {
  const label = PAGE_TITLES[path]?.split(" | ")[0] ?? "This page";
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 py-20 text-center">
      <p className="text-sm uppercase tracking-widest text-pink-500 font-semibold mb-3">Coming Soon</p>
      <h1 className="text-4xl font-black text-gray-900 mb-4">{label}</h1>
      <p className="text-gray-500 max-w-sm">We're working on something great. Check back soon.</p>
    </div>
  );
}

export default function BuilderPage() {
  const location = useLocation();
  const pageKey = PATH_TO_PAGE_KEY[location.pathname];
  const [builderContent, setBuilderContent] = useState<BuilderPageContent | null>(null);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    const defaultTitle = PAGE_TITLES[location.pathname] ?? "Dear Body";
    document.title = defaultTitle;
  }, [location.pathname]);

  useEffect(() => {
    if (!builderContent?.seo) return;
    const { title, description, ogImage } = builderContent.seo;
    if (title) document.title = title;
    const setMeta = (name: string, content: string) => {
      let el = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"], meta[property="${name}"]`);
      if (!el) {
        el = document.createElement("meta");
        if (name.startsWith("og:")) el.setAttribute("property", name);
        else el.setAttribute("name", name);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };
    if (description) setMeta("description", description);
    if (ogImage) setMeta("og:image", ogImage);
    if (title) setMeta("og:title", title);
  }, [builderContent?.seo]);

  useEffect(() => {
    if (!pageKey) {
      setBuilderContent(null);
      setResolved(true);
      return;
    }

    let cancelled = false;
    fetchStoreBuilderPage(pageKey)
      .then((page) => {
        if (cancelled) return;
        if (!page?.content?.sections?.length) {
          setBuilderContent(null);
        } else {
          setBuilderContent(page.content);
        }
        setResolved(true);
      })
      .catch(() => {
        if (cancelled) return;
        setBuilderContent(null);
        setResolved(true);
      });
    return () => { cancelled = true; };
  }, [pageKey]);

  if (!resolved) {
    return <div className="max-w-4xl mx-auto px-4 py-20 text-gray-500">Loading...</div>;
  }

  if (builderContent) {
    return (
      <div className="min-h-screen">
        <BuilderPageRenderer content={builderContent} products={[]} />
      </div>
    );
  }

  if (CMS_FALLBACK_PATHS.has(location.pathname)) {
    const slug = location.pathname.replace(/^\//, "");
    return <CmsFallback slug={slug} />;
  }

  return <ComingSoon path={location.pathname} />;
}
