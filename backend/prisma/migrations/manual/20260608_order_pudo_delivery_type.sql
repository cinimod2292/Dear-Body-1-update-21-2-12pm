-- Add pudoDeliveryType to Order to distinguish locker vs door PUDO deliveries
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "pudoDeliveryType" TEXT;
