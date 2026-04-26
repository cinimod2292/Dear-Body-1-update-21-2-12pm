import { Prisma } from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { resolvePublicUrlForStorageKey, resolveUploadConfig } from "../media/upload.service.js";
import {
  BUILDER_PAGE_KEYS,
  type BuilderPageKey,
  builderPageContentSchema,
  builderPageSchema,
  updateBuilderDraftSchema,
  validatePageKey,
} from "./builder.schemas.js";

const BUILDER_SCOPE = "builder";

type BuilderPageContent = ReturnType<typeof builderPageContentSchema.parse>;

type BuilderPageRecord = ReturnType<typeof builderPageSchema.parse>;

const DEFAULT_HOME_PAGE_CONTENT: BuilderPageContent = {
  sections: [
    {
      id: "hero-main",
      type: "hero_banner",
      enabled: true,
      props: {
        eyebrow: "New Summer Collection",
        title: "Dare to be Vibrant",
        subtitle: "Discover our bold collection of perfumed body sprays and skincare.",
        primaryButtonText: "Shop Now",
        primaryButtonHref: "/shop",
        secondaryButtonText: "View Body Sprays",
        secondaryButtonHref: "/shop?category=Body+Spray",
        layout: "image_right",
        tone: "bold",
      },
    },
    {
      id: "featured-products-main",
      type: "featured_products",
      enabled: true,
      props: {
        title: "Bestselling Products",
        subtitle: "Customer favorites updated weekly.",
        mode: "latest",
        limit: 8,
        buttonText: "Shop All",
        buttonHref: "/shop",
      },
    },
    {
      id: "story-main",
      type: "image_text",
      enabled: true,
      props: {
        title: "Body care that feels luxurious, every day",
        body: "Made to layer with your signature scent and daily ritual.",
        imageUrl: "",
        imageAlt: "Dear Body collection",
        buttonText: "Learn More",
        buttonHref: "/about",
        layout: "image_right",
        tone: "clean",
      },
    },
    {
      id: "benefits-main",
      type: "benefit_icons",
      enabled: true,
      props: {
        title: "Why customers love Dear Body",
        columns: "4",
        items: [
          { icon: "sparkles", title: "Vibrant scents", text: "Layerable fragrances for every mood." },
          { icon: "heart", title: "Skin-first formulas", text: "Designed for comfort and confidence." },
          { icon: "shield", title: "Quality tested", text: "Consistent quality from batch to batch." },
          { icon: "truck", title: "Fast delivery", text: "Quick dispatch on local orders." },
        ],
      },
    },
    {
      id: "promo-main",
      type: "promo_banner",
      enabled: true,
      props: {
        text: "Summer Bundle — Save 30%",
        buttonText: "Grab the Bundle",
        buttonHref: "/shop",
        tone: "warm",
      },
    },
  ],
};

function settingKey(pageKey: BuilderPageKey) {
  return `page:${pageKey}`;
}

function nowIso() {
  return new Date().toISOString();
}

function defaultPage(pageKey: BuilderPageKey): BuilderPageRecord {
  const content = pageKey === "home" ? DEFAULT_HOME_PAGE_CONTENT : { sections: [] };
  const timestamp = nowIso();
  return {
    pageKey,
    publishedContent: content,
    draftContent: content,
    version: 1,
    publishedAt: null,
    publishedBy: null,
    updatedAt: timestamp,
    updatedBy: null,
  };
}

async function readPage(pageKey: BuilderPageKey): Promise<BuilderPageRecord | null> {
  const setting = await prisma.setting.findUnique({ where: { scope_key: { scope: BUILDER_SCOPE, key: settingKey(pageKey) } } });
  if (!setting) return null;
  return builderPageSchema.parse(setting.value);
}

async function writePage(page: BuilderPageRecord) {
  const parsed = builderPageSchema.parse(page);
  await prisma.setting.upsert({
    where: { scope_key: { scope: BUILDER_SCOPE, key: settingKey(page.pageKey) } },
    update: { value: parsed as Prisma.InputJsonValue },
    create: { scope: BUILDER_SCOPE, key: settingKey(page.pageKey), value: parsed as Prisma.InputJsonValue },
  });
  return parsed;
}

export async function listBuilderPages() {
  const pages = await Promise.all(BUILDER_PAGE_KEYS.map(async (pageKey) => {
    const existing = await readPage(pageKey);
    const page = existing ?? defaultPage(pageKey);
    return {
      pageKey: page.pageKey,
      version: page.version,
      updatedAt: page.updatedAt,
      publishedAt: page.publishedAt,
    };
  }));
  return pages;
}

export async function getAdminBuilderPage(rawPageKey: string) {
  const pageKey = parsePageKey(rawPageKey);
  const existing = await readPage(pageKey);
  const page = existing ?? await writePage(defaultPage(pageKey));
  return page;
}

export async function getStoreBuilderPage(rawPageKey: string) {
  const pageKey = parsePageKey(rawPageKey);
  const existing = await readPage(pageKey);
  if (!existing) return null;
  const normalizedContent = await normalizePublishedContentForStore(existing.publishedContent);
  return {
    pageKey,
    content: normalizedContent,
    version: existing.version,
    publishedAt: existing.publishedAt,
  };
}

export async function updateBuilderDraft(rawPageKey: string, rawBody: unknown, actorUserId?: string | null) {
  const pageKey = parsePageKey(rawPageKey);
  const body = updateBuilderDraftSchema.parse(rawBody);
  const existing = await readPage(pageKey);
  const base = existing ?? defaultPage(pageKey);

  const updated: BuilderPageRecord = {
    ...base,
    draftContent: body.content,
    updatedAt: nowIso(),
    updatedBy: actorUserId ?? null,
  };

  return writePage(updated);
}

export async function publishBuilderDraft(rawPageKey: string, actorUserId?: string | null) {
  const pageKey = parsePageKey(rawPageKey);
  const existing = await readPage(pageKey);
  if (!existing) {
    throw new AppError(404, "Builder page not found", "BUILDER_PAGE_NOT_FOUND");
  }

  const publishedAt = nowIso();
  const updated: BuilderPageRecord = {
    ...existing,
    publishedContent: existing.draftContent,
    version: existing.version + 1,
    publishedAt,
    publishedBy: actorUserId ?? null,
    updatedAt: publishedAt,
    updatedBy: actorUserId ?? null,
  };

  return writePage(updated);
}

export async function discardBuilderDraft(rawPageKey: string, actorUserId?: string | null) {
  const pageKey = parsePageKey(rawPageKey);
  const existing = await readPage(pageKey);
  if (!existing) {
    throw new AppError(404, "Builder page not found", "BUILDER_PAGE_NOT_FOUND");
  }

  const updated: BuilderPageRecord = {
    ...existing,
    draftContent: existing.publishedContent,
    updatedAt: nowIso(),
    updatedBy: actorUserId ?? null,
  };

  return writePage(updated);
}

function parsePageKey(rawPageKey: string): BuilderPageKey {
  try {
    return validatePageKey(rawPageKey);
  } catch {
    throw new AppError(400, "Unknown page key", "BUILDER_UNKNOWN_PAGE_KEY");
  }
}

export function __testOnly__buildPublishedSnapshot(content: unknown) {
  return builderPageContentSchema.parse(content);
}

function normalizeLookupUrl(url: string): string {
  const value = String(url || "").trim();
  if (!value) return "";
  try {
    const parsed = new URL(value);
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return value.split("?")[0]?.split("#")[0] ?? value;
  }
}

async function normalizePublishedContentForStore(content: BuilderPageContent): Promise<BuilderPageContent> {
  const sections = Array.isArray(content.sections) ? content.sections : [];
  const imageUrls = sections.flatMap((section) => (
    Object.entries(section.props ?? {})
      .filter(([key, value]) => key.toLowerCase().includes("image") && typeof value === "string" && value.trim())
      .map(([, value]) => normalizeLookupUrl(String(value)))
  ));
  const uniqueUrls = Array.from(new Set(imageUrls.filter(Boolean)));
  if (!uniqueUrls.length) return content;

  const cfg = await resolveUploadConfig();
  const assets = await prisma.mediaAsset.findMany({
    where: {
      OR: [
        { publicUrl: { in: uniqueUrls } },
        { variants: { some: { publicUrl: { in: uniqueUrls } } } },
      ],
    },
    include: { variants: true },
  });

  const byUrl = new Map<string, (typeof assets)[number]>();
  for (const asset of assets) {
    if (asset.publicUrl) byUrl.set(normalizeLookupUrl(asset.publicUrl), asset);
    for (const variant of asset.variants) {
      if (variant.publicUrl) byUrl.set(normalizeLookupUrl(variant.publicUrl), asset);
    }
  }

  const resolveVariant = (asset: (typeof assets)[number], isHero: boolean) => {
    const preferred = isHero
      ? ["hero_desktop", "gallery_main", "card", "thumb"]
      : ["gallery_main", "card", "thumb"];
    for (const key of preferred) {
      const variant = asset.variants.find((entry) => entry.key === key);
      if (variant) return resolvePublicUrlForStorageKey(variant.storageKey, cfg);
    }
    return resolvePublicUrlForStorageKey(asset.storageKey, cfg);
  };

  return {
    sections: sections.map((section) => ({
      ...section,
      props: Object.fromEntries(Object.entries(section.props ?? {}).map(([key, value]) => {
        if (!(key.toLowerCase().includes("image") && typeof value === "string")) return [key, value];
        const matched = byUrl.get(normalizeLookupUrl(value));
        if (!matched) return [key, value];
        return [key, resolveVariant(matched, section.type === "hero_banner" || key.toLowerCase().includes("hero"))];
      })),
    })),
  };
}
