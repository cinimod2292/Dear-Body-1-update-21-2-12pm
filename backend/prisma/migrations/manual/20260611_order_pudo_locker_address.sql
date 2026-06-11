-- Store the chosen PUDO locker's full street address on the order so the
-- order confirmation and detail pages can show the locker location even after
-- a payment-gateway redirect clears the checkout's in-memory state.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "pudoLockerAddress" TEXT;
