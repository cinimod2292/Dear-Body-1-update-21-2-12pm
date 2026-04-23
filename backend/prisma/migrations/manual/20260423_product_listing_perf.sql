CREATE INDEX IF NOT EXISTS "Product_status_visibility_createdAt_idx"
ON "Product"("status", "visibility", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "Product_status_updatedAt_idx"
ON "Product"("status", "updatedAt" DESC);

CREATE INDEX IF NOT EXISTS "Product_visibility_updatedAt_idx"
ON "Product"("visibility", "updatedAt" DESC);

CREATE INDEX IF NOT EXISTS "Product_updatedAt_idx"
ON "Product"("updatedAt" DESC);

CREATE INDEX IF NOT EXISTS "Product_publishedAt_idx"
ON "Product"("publishedAt" DESC);

CREATE INDEX IF NOT EXISTS "Product_name_idx"
ON "Product"("name");

CREATE INDEX IF NOT EXISTS "ProductGalleryImage_productId_position_idx"
ON "ProductGalleryImage"("productId", "position");
