-- Add guestEmail to Order for guest checkout support
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "guestEmail" TEXT;
