import { prisma } from "../../lib/prisma.js";

export function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 96) || "article";
}

function textFromBlocks(blocks: any[]): string {
  return blocks.map((b) => [b.text, b.caption, ...(b.items ?? []), ...(b.faqs ?? []).flatMap((f: any) => [f.question, f.answer])].filter(Boolean).join(" ")).join(" ");
}

export function analyzeArticle(input: { title?: string; metaDescription?: string; body?: any[]; targetKeyword?: string; heroImageAlt?: string }) {
  const body = Array.isArray(input.body) ? input.body : [];
  const text = textFromBlocks(body);
  const words = text.trim().split(/\s+/).filter(Boolean);
  const keyword = (input.targetKeyword || input.title || "").toLowerCase();
  const keywordHits = keyword ? (text.toLowerCase().match(new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length : 0;
  const headings = body.filter((b) => String(b.type).startsWith("heading"));
  const images = body.filter((b) => b.type === "image" || b.type === "gallery");
  let score = 30;
  if ((input.title?.length ?? 0) >= 35 && (input.title?.length ?? 0) <= 65) score += 15;
  if ((input.metaDescription?.length ?? 0) >= 120 && (input.metaDescription?.length ?? 0) <= 160) score += 15;
  if (words.length >= 600) score += 15;
  if (headings.some((h) => h.level === 2 || h.type === "heading2")) score += 10;
  if (!images.length || input.heroImageAlt) score += 10;
  if (keywordHits > 0) score += 5;
  return { seoScore: Math.min(100, score), wordCount: words.length, readingTime: Math.max(1, Math.ceil(words.length / 220)), keywordDensity: words.length ? Number(((keywordHits / words.length) * 100).toFixed(2)) : 0 };
}

const articleInclude = {
  category: true,
  author: true,
  tags: { include: { tag: true } },
  products: { include: { product: { include: { variants: { take: 1, orderBy: { createdAt: "asc" as const } }, galleries: { take: 1, orderBy: { position: "asc" as const }, include: { mediaAsset: true } } } } } },
};

export async function listPublishedArticles(query: any = {}) {
  const where: any = query.includeDrafts ? {} : { status: "PUBLISHED", publishedAt: { lte: new Date() } };
  if (query.category) where.category = { slug: query.category };
  if (query.q) where.OR = [{ title: { contains: query.q, mode: "insensitive" } }, { excerpt: { contains: query.q, mode: "insensitive" } }];
  const orderBy = query.sort === "oldest" ? { publishedAt: "asc" as const } : query.sort === "popular" ? { viewCount: "desc" as const } : { publishedAt: "desc" as const };
  const [articles, categories] = await Promise.all([
    prisma.blogArticle.findMany({ where, include: articleInclude, orderBy, take: Math.min(Number(query.limit ?? 24), 50), skip: Number(query.offset ?? 0) }),
    prisma.blogCategory.findMany({ orderBy: { name: "asc" } }),
  ]);
  return { articles, categories };
}

export async function getPublishedArticle(slug: string) {
  const article = await prisma.blogArticle.findFirst({ where: { slug, status: "PUBLISHED", publishedAt: { lte: new Date() } }, include: articleInclude });
  if (!article) return null;
  await prisma.blogArticle.update({ where: { id: article.id }, data: { viewCount: { increment: 1 } } }).catch(() => null);
  const [related, previous, next] = await Promise.all([
    prisma.blogArticle.findMany({ where: { id: { not: article.id }, status: "PUBLISHED", categoryId: article.categoryId ?? undefined }, take: 3, orderBy: { publishedAt: "desc" }, include: articleInclude }),
    prisma.blogArticle.findFirst({ where: { status: "PUBLISHED", publishedAt: { lt: article.publishedAt ?? new Date() } }, orderBy: { publishedAt: "desc" } }),
    prisma.blogArticle.findFirst({ where: { status: "PUBLISHED", publishedAt: { gt: article.publishedAt ?? new Date() } }, orderBy: { publishedAt: "asc" } }),
  ]);
  return { article, related, previous, next };
}

export async function upsertArticle(input: any, userId?: string) {
  const body = Array.isArray(input.body) ? input.body : [];
  const metrics = analyzeArticle({ title: input.seoTitle || input.title, metaDescription: input.metaDescription, body, targetKeyword: input.targetKeyword, heroImageAlt: input.heroImageAlt });
  const slug = input.slug ? slugify(input.slug) : slugify(input.title);
  const data: any = { ...input, slug, body, ...metrics, updatedById: userId, publishedAt: input.status === "PUBLISHED" && !input.publishedAt ? new Date() : input.publishedAt ? new Date(input.publishedAt) : undefined, scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : undefined };
  delete data.id; delete data.tagIds; delete data.productIds; delete data.targetKeyword;
  const article = input.id ? await prisma.blogArticle.update({ where: { id: input.id }, data }) : await prisma.blogArticle.create({ data: { ...data, createdById: userId } });
  await prisma.blogArticleVersion.create({ data: { articleId: article.id, title: article.title, body, seo: { seoScore: metrics.seoScore }, createdById: userId } });
  if (Array.isArray(input.productIds)) {
    await prisma.blogArticleProduct.deleteMany({ where: { articleId: article.id } });
    await prisma.blogArticleProduct.createMany({ data: input.productIds.map((productId: string, position: number) => ({ articleId: article.id, productId, position, role: "mentioned" })), skipDuplicates: true });
  }
  return prisma.blogArticle.findUnique({ where: { id: article.id }, include: articleInclude });
}

export async function generateDraft(input: any) {
  const slug = slugify(input.topic || input.primaryKeyword || "dear-body-guide");
  const blocks = [
    { type: "heading2", text: `Why ${input.primaryKeyword || input.topic} matters` },
    { type: "paragraph", text: `A practical Dear Body guide for ${input.targetAudience || "beauty shoppers"}, written in a ${input.tone || "helpful"} tone.` },
    { type: "callout", variant: "tip", text: "Layer fragrance over moisturised skin to help scent last longer." },
    { type: "heading2", text: "Recommended routine" },
    { type: "list", items: ["Cleanse and dry skin", "Apply body lotion or cream", "Mist fragrance on pulse points", "Refresh with hand cream during the day"] },
    { type: "faq", faqs: [{ question: `How do I choose ${input.primaryKeyword || "a fragrance"}?`, answer: "Start with the mood, season and intensity you want, then test how it wears on your skin." }] },
  ];
  return { title: `The Dear Body Guide to ${input.topic || input.primaryKeyword || "Body Care"}`, seoTitle: `${input.primaryKeyword || input.topic || "Body care"} guide | Dear Body`, metaDescription: `Learn ${input.primaryKeyword || input.topic || "body care"} tips, routines, product ideas and shopping advice from Dear Body.`, slug, excerpt: `A conversion-focused guide to ${input.topic || input.primaryKeyword || "body care"}.`, body: blocks, faqs: blocks.at(-1)?.faqs ?? [], status: "DRAFT" };
}
