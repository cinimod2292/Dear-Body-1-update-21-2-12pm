import { API_BASE } from "../admin/api/client";

export interface CmsBootstrap {
  siteConfig: {
    navigation: { items: Array<{ label: string; href: string; enabled: boolean }> };
    header: { announcementText?: string; logoUrl?: string };
    footer: { copyrightText?: string; contactEmail?: string; contactPhone?: string; address?: string; socialLinks: Array<{ platform: string; url: string }> };
    branding: { primaryColor?: string; secondaryColor?: string; fontFamily?: string; logoUrl?: string; faviconUrl?: string };
    seoDefaults: { title?: string; description?: string; ogImageUrl?: string };
    contactInfo: { email?: string; phone?: string; address?: string };
  };
  homeSections: Array<{
    id: string;
    type: string;
    title?: string;
    subtitle?: string;
    content: Record<string, unknown>;
    enabled: boolean;
    order: number;
    status: "draft" | "published";
  }>;
  staticPages: Array<{ slug: string; title: string; status: "draft" | "published"; content: string }>;
}

let cache: CmsBootstrap | null = null;

export async function fetchCmsBootstrap(): Promise<CmsBootstrap> {
  if (cache) return cache;
  const response = await fetch(`${API_BASE}/store/cms/bootstrap`);
  const payload = await response.json();
  cache = payload.data as CmsBootstrap;
  return cache;
}

export function clearCmsBootstrapCache() {
  cache = null;
}
