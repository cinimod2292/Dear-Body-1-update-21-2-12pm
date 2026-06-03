-- Customer password reset tokens
CREATE TABLE "CustomerPasswordReset" (
  "id"         TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "tokenHash"  TEXT NOT NULL,
  "expiresAt"  TIMESTAMP(3) NOT NULL,
  "usedAt"     TIMESTAMP(3),
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CustomerPasswordReset_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CustomerPasswordReset_customerId_idx" ON "CustomerPasswordReset"("customerId");

ALTER TABLE "CustomerPasswordReset"
  ADD CONSTRAINT "CustomerPasswordReset_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
