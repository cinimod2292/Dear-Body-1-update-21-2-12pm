import { API_BASE } from "../admin/api/client";

export interface CmsBootstrap {
  siteConfig: {
    navigation: { items: Array<{ label: string; href: string; enabled: boolean }> };
    header: { announcementText?: string; logoUrl?: string; logo2xUrl?: string; logoMediaAssetId?: string };
    footer: { copyrightText?: string; contactEmail?: string; contactPhone?: string; address?: string; socialLinks: Array<{ platform: string; url: string }> };
    branding: { primaryColor?: string; secondaryColor?: string; fontFamily?: string; logoUrl?: string; logo2xUrl?: string; logoFooterUrl?: string; logoMediaAssetId?: string; faviconUrl?: string };
    seoDefaults: { title?: string; description?: string; ogImageUrl?: string };
    contactInfo: { email?: string; phone?: string; address?: string };
    siteStatus: { maintenanceMode: boolean; comingSoon: boolean };
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
const fallbackBootstrap: CmsBootstrap = {
  siteConfig: {
    navigation: { items: [] },
    header: {},
    footer: { socialLinks: [] },
    branding: {},
    seoDefaults: {},
    contactInfo: {},
    siteStatus: { maintenanceMode: false, comingSoon: false },
  },
  homeSections: [],
  staticPages: [],
};

export async function fetchCmsBootstrap(): Promise<CmsBootstrap> {
  if (cache) return cache;
  const response = await fetch(`${API_BASE}/store/cms/bootstrap`);
  if (!response.ok) {
    throw new Error(`Failed to load CMS bootstrap (${response.status})`);
  }

  const payload = await response.json().catch(() => null);
  cache = (payload?.data as CmsBootstrap | undefined) ?? fallbackBootstrap;
  return cache;
}

export function clearCmsBootstrapCache() {
  cache = null;
}
