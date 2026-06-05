-- Composite index to cover the findFirst query used during payment initiation:
--   WHERE orderId = ? AND provider = ? ORDER BY createdAt DESC
-- The existing (orderId, createdAt) index can satisfy the order but must then
-- filter by provider in memory; this index avoids that extra scan step.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "PaymentTransaction_orderId_provider_createdAt_idx"
  ON "PaymentTransaction" ("orderId", "provider", "createdAt" DESC);
