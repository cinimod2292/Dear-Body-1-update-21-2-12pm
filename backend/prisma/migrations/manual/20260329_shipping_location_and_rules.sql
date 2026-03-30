-- ============================================================================
-- Manual PostgreSQL migration: shipping location fields + shipping rules seed
-- Safe, non-destructive ALTER/UPSERT only (no drops/recreates)
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1) Shipping method location fields (nullable)
-- ----------------------------------------------------------------------------
-- Adds optional country/state applicability for fixed-rate shipping methods.
ALTER TABLE "ShippingMethod"
  ADD COLUMN IF NOT EXISTS "countryCode" TEXT,
  ADD COLUMN IF NOT EXISTS "stateCode" TEXT;

-- Optional lookup indexes for destination filtering in storefront queries.
CREATE INDEX IF NOT EXISTS "ShippingMethod_countryCode_idx"
  ON "ShippingMethod" ("countryCode");

CREATE INDEX IF NOT EXISTS "ShippingMethod_countryCode_stateCode_idx"
  ON "ShippingMethod" ("countryCode", "stateCode");

-- ----------------------------------------------------------------------------
-- 2) Shipping settings defaults in existing settings system
-- ----------------------------------------------------------------------------
-- Note: this project stores settings in "Setting" as JSON in "value" keyed by
-- (scope, key). We set/merge defaults for (scope='shipping', key='rules'):
--   - freeShippingEnabled: false
--   - freeShippingThreshold: 0

INSERT INTO "Setting" (
  "id", "scope", "key", "value", "createdAt", "updatedAt"
)
VALUES (
  'shipping_rules_default',
  'shipping',
  'rules',
  '{"freeShippingEnabled": false, "freeShippingThreshold": 0}'::jsonb,
  NOW(),
  NOW()
)
ON CONFLICT ("scope", "key")
DO UPDATE
SET
  "value" = jsonb_set(
              jsonb_set(
                COALESCE("Setting"."value"::jsonb, '{}'::jsonb),
                '{freeShippingEnabled}',
                'false'::jsonb,
                true
              ),
              '{freeShippingThreshold}',
              '0'::jsonb,
              true
            ),
  "updatedAt" = NOW();

COMMIT;
