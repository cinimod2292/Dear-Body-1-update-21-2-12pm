import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import {
  reorderHomeSectionsSchema,
  siteConfigSchema,
  staticPageSchema,
  upsertHomeSectionsSchema,
  upsertStaticPageSchema,
} from "./cms.schemas.js";

const CMS_SCOPE = "cms";
const HOME_SECTIONS_KEY = "home_sections";
const SITE_CONFIG_KEY = "site_config";
const STATIC_PAGES_KEY = "static_pages";

const defaultHomeSections = [
  {
    id: "hero-main",
    type: "hero",
    title: "Dare to be Vibrant",
    subtitle: "Discover our bold collection of perfumed body sprays and skincare.",
    enabled: true,
    order: 0,
    status: "published",
    content: {
      badge: "New Summer Collection",
      ctaPrimaryLabel: "Shop Now",
      ctaPrimaryHref: "/shop",
      ctaSecondaryLabel: "View Body Sprays",
      ctaSecondaryHref: "/shop?category=Body+Spray",
      backgroundImageUrl: "",
      backgroundMediaAssetId: "",
    },
  },
  {
    id: "featured-products",
    type: "featured_products",
    title: "Bestselling Products",
    subtitle: "Customer favorites updated weekly.",
    enabled: true,
    order: 1,
    status: "published",
    content: { mode: "manual", productIds: [], limit: 8 },
  },
  {
    id: "promo-banner",
    type: "promo_banner",
    title: "Summer Bundle — Save 30%",
    subtitle: "Limited edition summer packaging included.",
    enabled: true,
    order: 2,
    status: "published",
    content: { ctaLabel: "Grab the Bundle", ctaHref: "/shop" },
  },
];

const defaultSiteConfig = {
  navigation: {
    items: [
      { label: "Home", href: "/", enabled: true },
      { label: "Shop", href: "/shop", enabled: true },
      { label: "About", href: "/pages/about", enabled: true },
      { label: "Contact", href: "/pages/contact", enabled: true },
    ],
  },
  header: {
    announcementText: "FREE SHIPPING on orders over R50",
    logoUrl: "",
    logo2xUrl: "",
    logoMediaAssetId: "",
  },
  footer: {
    copyrightText: `© ${new Date().getFullYear()} My Dear Body. All rights reserved.`,
    contactEmail: "hello@dearbody.com",
    contactPhone: "+1 (800) DEAR-BODY",
    address: "123 Bloom Avenue, Miami, FL 33101, USA",
    socialLinks: [
      { platform: "instagram", url: "https://instagram.com" },
      { platform: "facebook", url: "https://facebook.com" },
    ],
  },
  branding: {
    primaryColor: "#ec4899",
    secondaryColor: "#f97316",
    fontFamily: "Inter, sans-serif",
    logoUrl: "",
    logo2xUrl: "",
    logoFooterUrl: "",
    logoMediaAssetId: "",
    faviconUrl: "",
  },
  seoDefaults: {
    title: "Dear Body",
    description: "Vibrant fragrances and skincare.",
    ogImageUrl: "",
  },
  contactInfo: {
    email: "hello@dearbody.com",
    phone: "+1 (800) DEAR-BODY",
    address: "123 Bloom Avenue, Miami, FL 33101, USA",
  },
};

const defaultStaticPages = [
  { slug: "about", title: "About", status: "published", seo: { title: "About Us", description: "Learn about Dear Body." }, sections: [], content: "About page content" },
  { slug: "contact", title: "Contact", status: "published", seo: { title: "Contact", description: "Get in touch." }, sections: [], content: "Contact page content" },
  { slug: "privacy-policy", title: "Privacy Policy", status: "published", seo: { title: "Privacy Policy", description: "Our privacy policy." }, sections: [], content: "Privacy policy content" },
  { slug: "returns", title: "Returns", status: "published", seo: { title: "Returns", description: "Returns and refunds." }, sections: [], content: "Returns content" },
  { slug: "shipping", title: "Shipping", status: "published", seo: { title: "Shipping", description: "Shipping info." }, sections: [], content: "Shipping content" },
  { slug: "terms", title: "Terms", status: "published", seo: { title: "Terms", description: "Terms and conditions." }, sections: [], content: "Terms content" },
];

async function readSetting<T>(key: string, fallback: T): Promise<T> {
  const setting = await prisma.setting.findUnique({ where: { scope_key: { scope: CMS_SCOPE, key } } });
  return (setting?.value as T | undefined) ?? fallback;
}

async function writeSetting(key: string, value: unknown) {
  return prisma.setting.upsert({
    where: { scope_key: { scope: CMS_SCOPE, key } },
    update: { value: value as Prisma.InputJsonValue },
    create: { scope: CMS_SCOPE, key, value: value as Prisma.InputJsonValue },
  });
}

type MediaWithVariants = {
  publicUrl: string | null;
  variants: Array<{ key: string; publicUrl: string | null }>;
};

function pickVariantUrl(asset: MediaWithVariants, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = asset.variants.find((variant) => variant.key === key)?.publicUrl?.trim();
    if (value) return value;
  }
  return undefined;
}

export async function getCmsBootstrap() {
  const [siteConfig, homeSections, staticPages] = await Promise.all([
    readSetting(SITE_CONFIG_KEY, defaultSiteConfig),
    readSetting(HOME_SECTIONS_KEY, defaultHomeSections),
    readSetting(STATIC_PAGES_KEY, defaultStaticPages),
  ]);

  const parsedSiteConfig = siteConfigSchema.parse(siteConfig);
  const parsedHomeSections = upsertHomeSectionsSchema.parse({ sections: homeSections }).sections;
  const mediaAssetIds = new Set<string>();
  const logoAssetId = parsedSiteConfig.branding.logoMediaAssetId || parsedSiteConfig.header.logoMediaAssetId;
  if (logoAssetId) mediaAssetIds.add(logoAssetId);
  for (const section of parsedHomeSections) {
    const maybeHeroAssetId = section.type === "hero" ? String(section.content.backgroundMediaAssetId ?? "").trim() : "";
    if (maybeHeroAssetId) mediaAssetIds.add(maybeHeroAssetId);
  }

  const mediaAssets = mediaAssetIds.size > 0
    ? await prisma.mediaAsset.findMany({
      where: { id: { in: [...mediaAssetIds] } },
      select: { id: true, publicUrl: true, variants: { select: { key: true, publicUrl: true } } },
    })
    : [];
  const mediaById = new Map(mediaAssets.map((asset) => [asset.id, asset]));

  if (logoAssetId) {
    const logoAsset = mediaById.get(logoAssetId);
    if (logoAsset) {
      parsedSiteConfig.header.logoUrl = pickVariantUrl(logoAsset, ["logo_header", "card", "thumb"]) ?? logoAsset.publicUrl ?? parsedSiteConfig.header.logoUrl;
      parsedSiteConfig.header.logo2xUrl = pickVariantUrl(logoAsset, ["logo_2x", "card_2x", "gallery_main"]) ?? parsedSiteConfig.header.logo2xUrl;
      parsedSiteConfig.branding.logoUrl = pickVariantUrl(logoAsset, ["logo_footer", "logo_header", "card"]) ?? logoAsset.publicUrl ?? parsedSiteConfig.branding.logoUrl;
      parsedSiteConfig.branding.logo2xUrl = pickVariantUrl(logoAsset, ["logo_2x", "card_2x", "gallery_main"]) ?? parsedSiteConfig.branding.logo2xUrl;
      parsedSiteConfig.branding.logoFooterUrl = pickVariantUrl(logoAsset, ["logo_footer", "logo_header", "card"]) ?? parsedSiteConfig.branding.logoFooterUrl;
    }
  }

  const resolvedHomeSections = parsedHomeSections.map((section) => {
    if (section.type !== "hero") return section;
    const heroAssetId = String(section.content.backgroundMediaAssetId ?? "").trim();
    if (!heroAssetId) return section;
    const heroAsset = mediaById.get(heroAssetId);
    if (!heroAsset) return section;
    const desktop = pickVariantUrl(heroAsset, ["hero_desktop", "lightbox", "gallery_main_2x", "gallery_main"]) ?? heroAsset.publicUrl ?? "";
    const desktop2x = pickVariantUrl(heroAsset, ["hero_desktop_2x", "lightbox_2x", "lightbox", "gallery_main_2x"]);
    const mobile = pickVariantUrl(heroAsset, ["hero_mobile", "card_2x", "card", "gallery_main"]) ?? desktop;

    return {
      ...section,
      content: {
        ...section.content,
        backgroundImageUrl: desktop || section.content.backgroundImageUrl,
        backgroundImageMobileUrl: mobile || section.content.backgroundImageMobileUrl,
        backgroundImageSrcSet: desktop2x ? `${desktop} 1x, ${desktop2x} 2x` : section.content.backgroundImageSrcSet,
      },
    };
  });

  return {
    siteConfig: parsedSiteConfig,
    homeSections: resolvedHomeSections,
    staticPages: (staticPages as unknown[]).map((page) => staticPageSchema.parse(page)),
  };
}

export async function getHomeSections() {
  const sections = await readSetting(HOME_SECTIONS_KEY, defaultHomeSections);
  return upsertHomeSectionsSchema.parse({ sections }).sections.sort((a, b) => a.order - b.order);
}

export async function upsertHomeSections(rawBody: unknown) {
  const body = upsertHomeSectionsSchema.parse(rawBody);
  const normalized = body.sections.map((section, index) => ({ ...section, order: index }));
  await writeSetting(HOME_SECTIONS_KEY, normalized);
  return normalized;
}

export async function reorderHomeSections(rawBody: unknown) {
  const body = reorderHomeSectionsSchema.parse(rawBody);
  const sections = await getHomeSections();
  const map = new Map(sections.map((s) => [s.id, s]));
  const reordered = body.sectionIds
    .map((id, index) => {
      const found = map.get(id);
      if (!found) return null;
      return { ...found, order: index };
    })
    .filter((s): s is NonNullable<typeof s> => Boolean(s));

  for (const leftover of sections) {
    if (!reordered.find((s) => s.id === leftover.id)) {
      reordered.push({ ...leftover, order: reordered.length });
    }
  }

  await writeSetting(HOME_SECTIONS_KEY, reordered);
  return reordered;
}

export async function getSiteConfig() {
  const config = await readSetting(SITE_CONFIG_KEY, defaultSiteConfig);
  return siteConfigSchema.parse(config);
}

export async function upsertSiteConfig(rawBody: unknown) {
  const config = siteConfigSchema.parse(rawBody);
  await writeSetting(SITE_CONFIG_KEY, config);
  return config;
}

export async function listStaticPages() {
  const pages = await readSetting(STATIC_PAGES_KEY, defaultStaticPages);
  return (pages as unknown[]).map((p) => staticPageSchema.parse(p));
}

export async function getStaticPageBySlug(slug: string, includeDraft = false) {
  const pages = await listStaticPages();
  const page = pages.find((p) => p.slug === slug);
  if (!page) throw new AppError(404, "Page not found", "CMS_PAGE_NOT_FOUND");
  if (!includeDraft && page.status !== "published") {
    throw new AppError(404, "Page not published", "CMS_PAGE_NOT_PUBLISHED");
  }
  return page;
}

export async function upsertStaticPage(rawBody: unknown) {
  const page = upsertStaticPageSchema.parse(rawBody);
  const pages = await listStaticPages();
  const existingIndex = pages.findIndex((p) => p.slug === page.slug);
  const nextPage = { ...page, updatedAt: new Date().toISOString() };

  if (existingIndex >= 0) {
    pages[existingIndex] = nextPage;
  } else {
    pages.push(nextPage);
  }

  await writeSetting(STATIC_PAGES_KEY, pages);
  return nextPage;
}
