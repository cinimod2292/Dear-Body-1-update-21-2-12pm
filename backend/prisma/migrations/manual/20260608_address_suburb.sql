-- Add suburb (local area) to Address for PUDO door delivery geocoding
ALTER TABLE "Address" ADD COLUMN IF NOT EXISTS "suburb" TEXT;
