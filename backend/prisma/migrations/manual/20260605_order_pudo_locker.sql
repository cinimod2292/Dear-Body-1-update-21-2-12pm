-- Add PUDO locker fields to Order so customers can choose a locker at checkout
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "pudoLockerCode" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "pudoLockerName" TEXT;
