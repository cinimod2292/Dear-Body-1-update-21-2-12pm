ALTER TABLE "Product"
ADD COLUMN IF NOT EXISTS "hoverImageId" TEXT;

CREATE INDEX IF NOT EXISTS "Product_hoverImageId_idx" ON "Product"("hoverImageId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'Product_hoverImageId_fkey'
      AND table_name = 'Product'
  ) THEN
    ALTER TABLE "Product"
    ADD CONSTRAINT "Product_hoverImageId_fkey"
    FOREIGN KEY ("hoverImageId") REFERENCES "MediaAsset"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
