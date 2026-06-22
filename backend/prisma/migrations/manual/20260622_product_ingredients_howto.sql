-- Add first-class Ingredients and How To Use fields to Product.
-- Previously these were squeezed into shortDescription as JSON with no admin UI,
-- so the storefront product tabs were always blank.
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "ingredients" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "howToUse" TEXT;
