-- Keep production schemas current even when Prisma migrate deploy is skipped or fails.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "guestEmail" TEXT;
