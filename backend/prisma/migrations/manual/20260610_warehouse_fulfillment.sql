-- Add WAREHOUSE_OPERATOR to StaffRole enum
ALTER TYPE "StaffRole" ADD VALUE IF NOT EXISTS 'WAREHOUSE_OPERATOR';

-- Add warehouse enums
DO $$ BEGIN
  CREATE TYPE "WarehouseStatus" AS ENUM ('PENDING_PICK','PICKING','PICKED','PACKING','PACKED','AWAITING_COLLECTION','EXCEPTION');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "StockIssueStatus" AS ENUM ('NONE','PARTIAL_STOCK','OUT_OF_STOCK','DAMAGED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "PickItemStatus" AS ENUM ('PENDING','PICKED','ISSUE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Add warehouse fields to Order
ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "warehouseStatus"      "WarehouseStatus",
  ADD COLUMN IF NOT EXISTS "stockIssueStatus"     "StockIssueStatus"  NOT NULL DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS "pickedById"           TEXT,
  ADD COLUMN IF NOT EXISTS "packedById"           TEXT,
  ADD COLUMN IF NOT EXISTS "pickedAt"             TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "packedAt"             TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "pickingStartedAt"     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "collectionDate"       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "collectionWindowStart" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "collectionWindowEnd"  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "slaDeadline"          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "warehouseNotes"       TEXT;

-- Foreign key constraints for pickedBy / packedBy
ALTER TABLE "Order"
  ADD CONSTRAINT IF NOT EXISTS "Order_pickedById_fkey"
    FOREIGN KEY ("pickedById") REFERENCES "StaffUser"("id") ON DELETE SET NULL,
  ADD CONSTRAINT IF NOT EXISTS "Order_packedById_fkey"
    FOREIGN KEY ("packedById") REFERENCES "StaffUser"("id") ON DELETE SET NULL;

-- Index for warehouse dashboard queries
CREATE INDEX IF NOT EXISTS "Order_warehouseStatus_idx" ON "Order"("warehouseStatus");

-- Create PickTaskItem table
CREATE TABLE IF NOT EXISTS "PickTaskItem" (
  "id"          TEXT        NOT NULL,
  "orderId"     TEXT        NOT NULL,
  "orderItemId" TEXT        NOT NULL,
  "status"      "PickItemStatus"   NOT NULL DEFAULT 'PENDING',
  "issueType"   "StockIssueStatus" NOT NULL DEFAULT 'NONE',
  "issueNotes"  TEXT,
  "pickedAt"    TIMESTAMPTZ,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "PickTaskItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PickTaskItem_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE,
  CONSTRAINT "PickTaskItem_orderItemId_fkey"
    FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE,
  CONSTRAINT "PickTaskItem_orderId_orderItemId_key" UNIQUE ("orderId", "orderItemId")
);

CREATE INDEX IF NOT EXISTS "PickTaskItem_orderId_idx" ON "PickTaskItem"("orderId");
