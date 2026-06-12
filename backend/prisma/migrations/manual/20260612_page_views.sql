CREATE TABLE IF NOT EXISTS "PageView" (
  "id"        TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "path"      TEXT NOT NULL,
  "referrer"  TEXT,
  "country"   TEXT,
  "city"      TEXT,
  "userAgent" TEXT,
  "duration"  INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PageView_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PageView_sessionId_idx" ON "PageView"("sessionId");
CREATE INDEX IF NOT EXISTS "PageView_path_idx"      ON "PageView"("path");
CREATE INDEX IF NOT EXISTS "PageView_createdAt_idx" ON "PageView"("createdAt");
CREATE INDEX IF NOT EXISTS "PageView_country_idx"   ON "PageView"("country");
