import { useEffect } from "react";

export interface SEOProps {
  title?: string;
  description?: string;
  canonical?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogType?: "website" | "product" | "article";
  twitterTitle?: string;
  twitterDescription?: string;
  twitterImage?: string;
  noIndex?: boolean;
  structuredData?: object | object[];
}

const SITE_NAME = "Dear Body";
const DEFAULT_TITLE = "Dear Body | South African Beauty & Fragrance";
const DEFAULT_DESC = "Discover Dear Body's luxurious range of perfumed body sprays, body lotions, scrubs and skincare. Premium South African beauty, delivered to your door.";

function setMeta(selector: string, attrName: string, attrValue: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attrName, attrValue);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function removeMeta(selector: string) {
  const el = document.head.querySelector(selector);
  if (el) el.remove();
}

function setLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"][data-seo="true"]`);
  if (!el) {
    el = document.createElement("link");
    el.rel = rel;
    el.setAttribute("data-seo", "true");
    document.head.appendChild(el);
  }
  el.href = href;
}

function removeLink(rel: string) {
  document.head.querySelector(`link[rel="${rel}"][data-seo="true"]`)?.remove();
}

function setStructuredData(data: object | object[]) {
  // Remove existing seo structured data scripts
  document.head.querySelectorAll('script[data-seo-schema="true"]').forEach((el) => el.remove());

  const items = Array.isArray(data) ? data : [data];
  for (const item of items) {
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.setAttribute("data-seo-schema", "true");
    script.textContent = JSON.stringify(item);
    document.head.appendChild(script);
  }
}

function removeStructuredData() {
  document.head.querySelectorAll('script[data-seo-schema="true"]').forEach((el) => el.remove());
}

export function useSEO({
  title,
  description,
  canonical,
  ogTitle,
  ogDescription,
  ogImage,
  ogType = "website",
  twitterTitle,
  twitterDescription,
  twitterImage,
  noIndex = false,
  structuredData,
}: SEOProps) {
  useEffect(() => {
    const fullTitle = title ? `${title} | ${SITE_NAME}` : DEFAULT_TITLE;
    const metaDesc = description || DEFAULT_DESC;

    // Title
    document.title = fullTitle;

    // Meta description
    setMeta('meta[name="description"]', "name", "description", metaDesc);

    // Robots
    if (noIndex) {
      setMeta('meta[name="robots"]', "name", "robots", "noindex, nofollow");
    } else {
      setMeta('meta[name="robots"]', "name", "robots", "index, follow");
    }

    // Canonical
    if (canonical) {
      setLink("canonical", canonical);
    } else {
      removeLink("canonical");
    }

    // OG tags
    setMeta('meta[property="og:title"]', "property", "og:title", ogTitle || fullTitle);
    setMeta('meta[property="og:description"]', "property", "og:description", ogDescription || metaDesc);
    setMeta('meta[property="og:type"]', "property", "og:type", ogType);
    if (canonical) setMeta('meta[property="og:url"]', "property", "og:url", canonical);
    if (ogImage) {
      setMeta('meta[property="og:image"]', "property", "og:image", ogImage);
      setMeta('meta[property="og:image:width"]', "property", "og:image:width", "1200");
      setMeta('meta[property="og:image:height"]', "property", "og:image:height", "630");
    } else {
      removeMeta('meta[property="og:image"]');
    }

    // Twitter cards
    setMeta('meta[name="twitter:card"]', "name", "twitter:card", "summary_large_image");
    setMeta('meta[name="twitter:title"]', "name", "twitter:title", twitterTitle || ogTitle || fullTitle);
    setMeta('meta[name="twitter:description"]', "name", "twitter:description", twitterDescription || ogDescription || metaDesc);
    if (twitterImage || ogImage) {
      setMeta('meta[name="twitter:image"]', "name", "twitter:image", twitterImage || ogImage!);
    }

    // Structured data
    if (structuredData) {
      setStructuredData(structuredData);
    } else {
      removeStructuredData();
    }

    return () => {
      // Reset to defaults on unmount
      document.title = DEFAULT_TITLE;
      removeStructuredData();
    };
  }, [title, description, canonical, ogTitle, ogDescription, ogImage, ogType, twitterTitle, twitterDescription, twitterImage, noIndex, structuredData]);
}

// Build a canonical URL from a path
export function buildCanonical(path: string): string {
  const base = (import.meta.env.VITE_STOREFRONT_URL || window.location.origin).replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
