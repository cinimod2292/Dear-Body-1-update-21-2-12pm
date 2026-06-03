import { Prisma } from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { resolvePublicUrlForStorageKey, resolveUploadConfig } from "../media/upload.service.js";
import {
  BUILDER_PAGE_KEYS,
  type BuilderPageKey,
  builderHistoryEntrySchema,
  builderPageContentSchema,
  builderPageSchema,
  updateBuilderDraftSchema,
  validatePageKey,
} from "./builder.schemas.js";

const BUILDER_SCOPE = "builder";

type BuilderPageContent = ReturnType<typeof builderPageContentSchema.parse>;

type BuilderHistoryEntry = ReturnType<typeof builderHistoryEntrySchema.parse>;

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

function isBuilderDebugEnabled() {
  return process.env.NODE_ENV !== "production" || process.env.BUILDER_DEBUG === "1";
}

function extractHeroImageUrl(content: BuilderPageContent | undefined | null): string | null {
  if (!content || !Array.isArray(content.sections)) return null;
  const hero = content.sections.find((section) => section.type === "hero_banner");
  return typeof hero?.props?.imageUrl === "string" ? hero.props.imageUrl : null;
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
  if (isBuilderDebugEnabled()) {
    console.info("[builder-debug] writePage before upsert", {
      pageKey: parsed.pageKey,
      draftHeroImageUrl: extractHeroImageUrl(parsed.draftContent),
      publishedHeroImageUrl: extractHeroImageUrl(parsed.publishedContent),
    });
  }
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
  if (isBuilderDebugEnabled()) {
    console.info("[builder-debug] getAdminBuilderPage before normalization", {
      pageKey,
      draftHeroImageUrl: extractHeroImageUrl(page.draftContent),
      publishedHeroImageUrl: extractHeroImageUrl(page.publishedContent),
    });
  }
  const normalized = await normalizeAdminBuilderPage(page);
  if (isBuilderDebugEnabled()) {
    console.info("[builder-debug] getAdminBuilderPage after normalization", {
      pageKey,
      draftHeroImageUrl: extractHeroImageUrl(normalized.draftContent),
      publishedHeroImageUrl: extractHeroImageUrl(normalized.publishedContent),
    });
  }
  return normalized;
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
  if (isBuilderDebugEnabled()) {
    const preValidationHeroImageUrl = (() => {
      if (typeof rawBody !== "object" || rawBody === null) return null;
      const content = (rawBody as { content?: BuilderPageContent }).content;
      return extractHeroImageUrl(content ?? null);
    })();
    console.info("[builder-debug] updateBuilderDraft pre-validation", { pageKey, preValidationHeroImageUrl });
  }
  const body = updateBuilderDraftSchema.parse(rawBody);
  if (isBuilderDebugEnabled()) {
    console.info("[builder-debug] updateBuilderDraft post-validation", {
      pageKey,
      validatedHeroImageUrl: extractHeroImageUrl(body.content),
    });
  }
  const existing = await readPage(pageKey);
  const base = existing ?? defaultPage(pageKey);

  const updated: BuilderPageRecord = {
    ...base,
    draftContent: body.content,
    updatedAt: nowIso(),
    updatedBy: actorUserId ?? null,
  };

  const saved = await writePage(updated);
  return normalizeAdminBuilderPage(saved);
}

export async function publishBuilderDraft(rawPageKey: string, actorUserId?: string | null) {
  const pageKey = parsePageKey(rawPageKey);
  const existing = await readPage(pageKey);
  if (!existing) {
    throw new AppError(404, "Builder page not found", "BUILDER_PAGE_NOT_FOUND");
  }

  const publishedAt = nowIso();
  const newEntry: BuilderHistoryEntry = {
    version: existing.version + 1,
    publishedAt,
    publishedBy: actorUserId ?? null,
    content: existing.draftContent,
  };
  const existingHistory = Array.isArray((existing as any).history) ? (existing as any).history as BuilderHistoryEntry[] : [];
  const history = [newEntry, ...existingHistory].slice(0, 20);
  const updated: BuilderPageRecord = {
    ...existing,
    publishedContent: existing.draftContent,
    version: existing.version + 1,
    publishedAt,
    publishedBy: actorUserId ?? null,
    updatedAt: publishedAt,
    updatedBy: actorUserId ?? null,
    history,
  };

  const saved = await writePage(updated);
  return normalizeAdminBuilderPage(saved);
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

  const saved = await writePage(updated);
  return normalizeAdminBuilderPage(saved);
}

export async function getBuilderPageHistory(rawPageKey: string) {
  const pageKey = parsePageKey(rawPageKey);
  const existing = await readPage(pageKey);
  const history: BuilderHistoryEntry[] = Array.isArray((existing as any)?.history) ? (existing as any).history : [];
  return history.map(({ version, publishedAt, publishedBy }) => ({ version, publishedAt, publishedBy }));
}

export async function restoreBuilderPageVersion(rawPageKey: string, targetVersion: number, actorUserId?: string | null) {
  const pageKey = parsePageKey(rawPageKey);
  const existing = await readPage(pageKey);
  if (!existing) {
    throw new AppError(404, "Builder page not found", "BUILDER_PAGE_NOT_FOUND");
  }
  const history: BuilderHistoryEntry[] = Array.isArray((existing as any).history) ? (existing as any).history : [];
  const entry = history.find((h) => h.version === targetVersion);
  if (!entry) {
    throw new AppError(404, "Version not found in history", "BUILDER_VERSION_NOT_FOUND");
  }
  const updated: BuilderPageRecord = {
    ...existing,
    draftContent: entry.content,
    updatedAt: nowIso(),
    updatedBy: actorUserId ?? null,
  };
  const saved = await writePage(updated);
  return normalizeAdminBuilderPage(saved);
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

export function __testOnly__choosePreferredImageVariantUrl(
  params: {
    variants: Array<{ key: string; storageKey: string }>;
    fallbackStorageKey: string;
    isHero: boolean;
    currentVariantStorageKey?: string | null;
  },
  resolver: (storageKey: string) => string,
): string | null {
  const currentVariantStorageKey = params.currentVariantStorageKey?.trim();
  if (currentVariantStorageKey) {
    const hasCurrentVariant = params.variants.some((entry) => entry.storageKey === currentVariantStorageKey);
    if (hasCurrentVariant) return resolver(currentVariantStorageKey);
  }

  const preferred = params.isHero
    ? ["hero_desktop", "gallery_main", "card", "thumb"]
    : ["gallery_main", "card", "thumb"];
  for (const key of preferred) {
    const variant = params.variants.find((entry) => entry.key === key);
    if (variant) return resolver(variant.storageKey);
  }
  return resolver(params.fallbackStorageKey);
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizePathname(value: string): string {
  if (!value) return "";
  const normalized = value.replace(/\\/g, "/").replace(/\/{2,}/g, "/").trim();
  if (!normalized) return "";
  return normalized.startsWith("/") ? normalized : `/${normalized}`;
}

export function __testOnly__normalizeLookupCandidates(url: string): string[] {
  const value = String(url || "").trim();
  if (!value) return [];
  const candidates = new Set<string>();
  const add = (input: string) => {
    const trimmed = String(input || "").trim();
    if (!trimmed) return;
    candidates.add(trimmed);
    candidates.add(safeDecodeURIComponent(trimmed));
  };

  const rawNoQueryOrHash = value.split("?")[0]?.split("#")[0] ?? value;
  add(rawNoQueryOrHash);

  let parsedPath = "";
  try {
    const parsed = new URL(value);
    parsed.search = "";
    parsed.hash = "";
    add(parsed.toString());
    parsedPath = parsed.pathname;
  } catch {
    parsedPath = rawNoQueryOrHash;
  }

  const normalizedPath = normalizePathname(parsedPath);
  if (normalizedPath) {
    add(normalizedPath);
    add(normalizedPath.replace(/^\//, ""));
    const filename = normalizedPath.split("/").filter(Boolean).at(-1);
    if (filename) add(filename);

    const localUploadIdx = normalizedPath.indexOf("/local-upload/");
    if (localUploadIdx >= 0) {
      const storageKey = normalizedPath.slice(localUploadIdx + "/local-upload/".length).replace(/^\//, "");
      add(storageKey);
    }

    const variantsIdx = normalizedPath.indexOf("/variants/");
    if (variantsIdx >= 0) add(normalizedPath.slice(variantsIdx + 1));
    const uploadsIdx = normalizedPath.indexOf("/uploads/");
    if (uploadsIdx >= 0) add(normalizedPath.slice(uploadsIdx + 1));
  }

  return Array.from(candidates).filter(Boolean);
}

export function __testOnly__matchAssetForImageUrl(
  imageUrl: string,
  assets: Array<{ id: string; filename: string; storageKey: string; publicUrl?: string | null; variants: Array<{ publicUrl?: string | null; storageKey: string }> }>,
): string | null {
  const byCandidate = new Map<string, string>();
  for (const asset of assets) {
    if (asset.publicUrl) {
      for (const candidate of __testOnly__normalizeLookupCandidates(asset.publicUrl)) byCandidate.set(candidate, asset.id);
    }
    byCandidate.set(asset.storageKey, asset.id);
    byCandidate.set(asset.filename, asset.id);
    for (const variant of asset.variants) {
      if (variant.publicUrl) {
        for (const candidate of __testOnly__normalizeLookupCandidates(variant.publicUrl)) byCandidate.set(candidate, asset.id);
      }
      byCandidate.set(variant.storageKey, asset.id);
    }
  }
  return __testOnly__normalizeLookupCandidates(imageUrl)
    .map((candidate) => byCandidate.get(candidate))
    .find(Boolean) ?? null;
}

export function __testOnly__resolveCurrentVariantStorageKey(
  imageUrl: string,
  variants: Array<{ storageKey: string; publicUrl?: string | null }>,
): string | null {
  const imageCandidates = __testOnly__normalizeLookupCandidates(imageUrl);
  return variants
    .find((variant) => {
      const variantCandidates = new Set([
        ...__testOnly__normalizeLookupCandidates(variant.storageKey),
        ...__testOnly__normalizeLookupCandidates(String(variant.publicUrl ?? "")),
      ]);
      return imageCandidates.some((candidate) => variantCandidates.has(candidate));
    })?.storageKey ?? null;
}

async function normalizePublishedContentForStore(content: BuilderPageContent): Promise<BuilderPageContent> {
  const sections = Array.isArray(content.sections) ? content.sections : [];
  const imageUrls = sections.flatMap((section) => (
    Object.entries(section.props ?? {})
      .filter(([key, value]) => key.toLowerCase().includes("image") && typeof value === "string" && value.trim())
      .flatMap(([, value]) => __testOnly__normalizeLookupCandidates(String(value)))
  ));
  const uniqueUrls = Array.from(new Set(imageUrls.filter(Boolean)));
  if (!uniqueUrls.length) return content;

  const cfg = await resolveUploadConfig();
  const assets = await prisma.mediaAsset.findMany({
    where: {
      OR: [
        { publicUrl: { in: uniqueUrls } },
        { storageKey: { in: uniqueUrls } },
        { filename: { in: uniqueUrls } },
        { variants: { some: { publicUrl: { in: uniqueUrls } } } },
        { variants: { some: { storageKey: { in: uniqueUrls } } } },
      ],
    },
    include: { variants: true },
  });

  const byUrl = new Map<string, (typeof assets)[number]>();
  for (const asset of assets) {
    if (asset.publicUrl) {
      for (const candidate of __testOnly__normalizeLookupCandidates(asset.publicUrl)) byUrl.set(candidate, asset);
    }
    byUrl.set(asset.storageKey, asset);
    byUrl.set(asset.filename, asset);
    for (const variant of asset.variants) {
      if (variant.publicUrl) {
        for (const candidate of __testOnly__normalizeLookupCandidates(variant.publicUrl)) byUrl.set(candidate, asset);
      }
      byUrl.set(variant.storageKey, asset);
    }
  }

  return {
    ...(content.seo ? { seo: content.seo } : {}),
    sections: sections.map((section) => ({
      ...section,
      props: Object.fromEntries(Object.entries(section.props ?? {}).map(([key, value]) => {
        if (!(key.toLowerCase().includes("image") && typeof value === "string")) return [key, value];
        const matched = __testOnly__normalizeLookupCandidates(value)
          .map((candidate) => byUrl.get(candidate))
          .find(Boolean);
        if (!matched) return [key, value];
        const currentVariantStorageKey = __testOnly__resolveCurrentVariantStorageKey(value, matched.variants);
        const resolved = __testOnly__choosePreferredImageVariantUrl({
          variants: matched.variants.map((variant) => ({ key: variant.key, storageKey: variant.storageKey })),
          fallbackStorageKey: matched.storageKey,
          isHero: section.type === "hero_banner" || key.toLowerCase().includes("hero"),
          currentVariantStorageKey,
        }, (storageKey) => resolvePublicUrlForStorageKey(storageKey, cfg));
        if (!resolved) return [key, null];
        return [key, resolved];
      })),
    })),
  };
}

async function normalizeAdminBuilderPage(page: BuilderPageRecord): Promise<BuilderPageRecord> {
  const [draftContent, publishedContent] = await Promise.all([
    normalizePublishedContentForStore(page.draftContent),
    normalizePublishedContentForStore(page.publishedContent),
  ]);
  return {
    ...page,
    draftContent,
    publishedContent,
  };
}
