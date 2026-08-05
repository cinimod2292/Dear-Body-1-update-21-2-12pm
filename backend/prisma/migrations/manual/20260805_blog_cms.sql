-- Blog CMS: articles, categories, tags, authors, product placements, versions, analytics.
-- The equivalent Prisma migration (prisma/migrations/20260805_blog_cms) never ran in
-- production because this app's Docker/Render deploy path only runs `prisma generate`
-- at build time and applies schema changes from this "manual" folder at startup —
-- it never calls `prisma migrate deploy`. Mirrored here, idempotently, so it applies.

DO $$ BEGIN
  CREATE TYPE "BlogArticleStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "BlogCategory" ("id" TEXT NOT NULL, "name" TEXT NOT NULL, "slug" TEXT NOT NULL, "description" TEXT, "seoTitle" TEXT, "metaDescription" TEXT, "imageUrl" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "BlogCategory_pkey" PRIMARY KEY ("id"));
CREATE TABLE IF NOT EXISTS "BlogTag" ("id" TEXT NOT NULL, "name" TEXT NOT NULL, "slug" TEXT NOT NULL, "description" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "BlogTag_pkey" PRIMARY KEY ("id"));
CREATE TABLE IF NOT EXISTS "BlogAuthor" ("id" TEXT NOT NULL, "name" TEXT NOT NULL, "slug" TEXT NOT NULL, "photoUrl" TEXT, "bio" TEXT, "role" TEXT, "socialLinks" JSONB, "seoTitle" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "BlogAuthor_pkey" PRIMARY KEY ("id"));
CREATE TABLE IF NOT EXISTS "BlogArticle" ("id" TEXT NOT NULL, "title" TEXT NOT NULL, "slug" TEXT NOT NULL, "excerpt" TEXT, "status" "BlogArticleStatus" NOT NULL DEFAULT 'DRAFT', "featured" BOOLEAN NOT NULL DEFAULT false, "pinned" BOOLEAN NOT NULL DEFAULT false, "heroImageUrl" TEXT, "heroImageAlt" TEXT, "body" JSONB NOT NULL, "faqs" JSONB, "seoTitle" TEXT, "metaDescription" TEXT, "canonicalUrl" TEXT, "ogTitle" TEXT, "ogDescription" TEXT, "ogImageUrl" TEXT, "twitterTitle" TEXT, "twitterDescription" TEXT, "metaRobots" TEXT NOT NULL DEFAULT 'index,follow', "seoScore" INTEGER NOT NULL DEFAULT 0, "readingTime" INTEGER NOT NULL DEFAULT 1, "wordCount" INTEGER NOT NULL DEFAULT 0, "viewCount" INTEGER NOT NULL DEFAULT 0, "productClicks" INTEGER NOT NULL DEFAULT 0, "scheduledAt" TIMESTAMP(3), "publishedAt" TIMESTAMP(3), "archivedAt" TIMESTAMP(3), "categoryId" TEXT, "authorId" TEXT, "createdById" TEXT, "updatedById" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "BlogArticle_pkey" PRIMARY KEY ("id"));
CREATE TABLE IF NOT EXISTS "BlogArticleTag" ("articleId" TEXT NOT NULL, "tagId" TEXT NOT NULL, CONSTRAINT "BlogArticleTag_pkey" PRIMARY KEY ("articleId","tagId"));
CREATE TABLE IF NOT EXISTS "BlogArticleProduct" ("articleId" TEXT NOT NULL, "productId" TEXT NOT NULL, "role" TEXT NOT NULL DEFAULT 'mentioned', "position" INTEGER NOT NULL DEFAULT 0, CONSTRAINT "BlogArticleProduct_pkey" PRIMARY KEY ("articleId","productId","role"));
CREATE TABLE IF NOT EXISTS "BlogArticleVersion" ("id" TEXT NOT NULL, "articleId" TEXT NOT NULL, "title" TEXT NOT NULL, "body" JSONB NOT NULL, "seo" JSONB, "createdById" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "BlogArticleVersion_pkey" PRIMARY KEY ("id"));
CREATE TABLE IF NOT EXISTS "BlogAnalyticsEvent" ("id" TEXT NOT NULL, "articleId" TEXT, "type" TEXT NOT NULL, "value" TEXT, "sessionId" TEXT, "metadata" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "BlogAnalyticsEvent_pkey" PRIMARY KEY ("id"));

CREATE UNIQUE INDEX IF NOT EXISTS "BlogCategory_slug_key" ON "BlogCategory"("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "BlogTag_slug_key" ON "BlogTag"("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "BlogAuthor_slug_key" ON "BlogAuthor"("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "BlogArticle_slug_key" ON "BlogArticle"("slug");
CREATE INDEX IF NOT EXISTS "BlogArticle_status_publishedAt_idx" ON "BlogArticle"("status", "publishedAt");
CREATE INDEX IF NOT EXISTS "BlogArticle_categoryId_status_idx" ON "BlogArticle"("categoryId", "status");
CREATE INDEX IF NOT EXISTS "BlogArticle_featured_pinned_idx" ON "BlogArticle"("featured", "pinned");
CREATE INDEX IF NOT EXISTS "BlogArticleTag_tagId_idx" ON "BlogArticleTag"("tagId");
CREATE INDEX IF NOT EXISTS "BlogArticleProduct_productId_idx" ON "BlogArticleProduct"("productId");
CREATE INDEX IF NOT EXISTS "BlogArticleVersion_articleId_createdAt_idx" ON "BlogArticleVersion"("articleId", "createdAt");
CREATE INDEX IF NOT EXISTS "BlogAnalyticsEvent_articleId_type_createdAt_idx" ON "BlogAnalyticsEvent"("articleId", "type", "createdAt");
CREATE INDEX IF NOT EXISTS "BlogAnalyticsEvent_type_createdAt_idx" ON "BlogAnalyticsEvent"("type", "createdAt");

DO $$ BEGIN
  ALTER TABLE "BlogArticle" ADD CONSTRAINT "BlogArticle_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "BlogCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "BlogArticle" ADD CONSTRAINT "BlogArticle_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "BlogAuthor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "BlogArticle" ADD CONSTRAINT "BlogArticle_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "BlogArticle" ADD CONSTRAINT "BlogArticle_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "BlogArticleTag" ADD CONSTRAINT "BlogArticleTag_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "BlogArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "BlogArticleTag" ADD CONSTRAINT "BlogArticleTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "BlogTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "BlogArticleProduct" ADD CONSTRAINT "BlogArticleProduct_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "BlogArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "BlogArticleProduct" ADD CONSTRAINT "BlogArticleProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "BlogArticleVersion" ADD CONSTRAINT "BlogArticleVersion_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "BlogArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "BlogArticleVersion" ADD CONSTRAINT "BlogArticleVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "BlogAnalyticsEvent" ADD CONSTRAINT "BlogAnalyticsEvent_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "BlogArticle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
