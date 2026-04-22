CREATE TABLE IF NOT EXISTS "MediaVariant" (
  "id" TEXT PRIMARY KEY,
  "mediaAssetId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL UNIQUE,
  "publicUrl" TEXT,
  "width" INTEGER NOT NULL,
  "height" INTEGER NOT NULL,
  "mimeType" TEXT NOT NULL,
  "byteSize" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "MediaVariant_mediaAssetId_key_key" ON "MediaVariant"("mediaAssetId", "key");
CREATE INDEX IF NOT EXISTS "MediaVariant_mediaAssetId_idx" ON "MediaVariant"("mediaAssetId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'MediaVariant_mediaAssetId_fkey'
      AND table_name = 'MediaVariant'
  ) THEN
    ALTER TABLE "MediaVariant"
    ADD CONSTRAINT "MediaVariant_mediaAssetId_fkey"
    FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
