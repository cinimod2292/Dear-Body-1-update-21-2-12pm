-- Keep production schemas current even when Prisma migrate deploy is skipped or fails.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReviewStatus') THEN
    CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "ProductReview" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "customerId" TEXT,
    "reviewerName" TEXT NOT NULL,
    "reviewerEmail" TEXT,
    "rating" INTEGER NOT NULL,
    "title" TEXT,
    "body" TEXT,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "verifiedPurchase" BOOLEAN NOT NULL DEFAULT false,
    "helpfulCount" INTEGER NOT NULL DEFAULT 0,
    "adminReply" TEXT,
    "adminRepliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProductReview_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProductFaq" (
    "id" TEXT NOT NULL,
    "productId" TEXT,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isGlobal" BOOLEAN NOT NULL DEFAULT false,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProductFaq_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProductReview_productId_status_idx" ON "ProductReview"("productId", "status");
CREATE INDEX IF NOT EXISTS "ProductReview_customerId_idx" ON "ProductReview"("customerId");
CREATE INDEX IF NOT EXISTS "ProductReview_rating_idx" ON "ProductReview"("rating");
CREATE INDEX IF NOT EXISTS "ProductReview_createdAt_idx" ON "ProductReview"("createdAt");
CREATE INDEX IF NOT EXISTS "ProductFaq_productId_position_idx" ON "ProductFaq"("productId", "position");
CREATE INDEX IF NOT EXISTS "ProductFaq_isGlobal_isPublished_idx" ON "ProductFaq"("isGlobal", "isPublished");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProductReview_productId_fkey') THEN
    ALTER TABLE "ProductReview" ADD CONSTRAINT "ProductReview_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProductReview_customerId_fkey') THEN
    ALTER TABLE "ProductReview" ADD CONSTRAINT "ProductReview_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProductFaq_productId_fkey') THEN
    ALTER TABLE "ProductFaq" ADD CONSTRAINT "ProductFaq_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;
