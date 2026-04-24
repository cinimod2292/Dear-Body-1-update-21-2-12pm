import { Prisma } from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
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
  return {
    pageKey,
    content: existing.publishedContent,
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
