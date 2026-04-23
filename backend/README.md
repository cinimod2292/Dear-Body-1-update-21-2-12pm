# Dear Body Backend (Phase 1 + Phase 2 Foundations)

This service provides the production backend foundation for admin APIs and commerce modules.

## Implemented
- Fastify + TypeScript backend skeleton
- Prisma schema for staff/admin users, settings, media, tags, SEO metadata, audit logs, notification logs, webhook events
- Admin authentication (JWT access token) and role-based permission checks
- Admin settings, media, and audit endpoints
- Reusable pagination/filter/sort query pattern
- Standardized error handling and env validation
- Notification/email logging foundation
- Webhook ingestion + signature check foundation

## Phase 2 (Catalog + Inventory)
- Product catalog models and APIs:
  - products, variants, brands, categories/subcategories
  - attributes/options + variant attribute values
  - SKU/barcode management
  - featured product entries
  - related products
  - product galleries with media assets
  - pricing (price/sale/cost) and visibility/status controls
  - SEO metadata linkage
  - bulk product actions
- Inventory models and APIs:
  - inventory per variant
  - low stock threshold
  - optional backorder config and out-of-stock behavior
  - stock adjustments and stock movement log

## Run locally
1. Copy `.env.example` to `.env` and configure values.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Generate prisma client and run migrations:
   ```bash
   npm run prisma:generate
   npm run prisma:migrate
   ```
4. Seed initial admin:
   ```bash
   npm run seed:admin
   ```
5. Run dev server:
   ```bash
   npm run dev
   ```

## API prefix
- All routes are prefixed by `API_PREFIX` (default `/api`).

## Media storage note
- `UPLOAD_PROVIDER=local` stores files on the runtime filesystem (`.local-uploads`) and is intended for local development/testing only.
- In production, use persistent object storage (`UPLOAD_PROVIDER=s3` with bucket/endpoint settings), otherwise files can disappear after instance restart/redeploy.

### Required production media env vars (`UPLOAD_PROVIDER=s3`)
- `UPLOAD_PROVIDER=s3`
- `UPLOAD_BUCKET=<bucket-name>`
- `UPLOAD_REGION=<region>`
- `UPLOAD_ACCESS_KEY_ID=<key>`
- `UPLOAD_SECRET_ACCESS_KEY=<secret>`
- `STORAGE_ENCRYPTION_SECRET=<32+ char secret used to encrypt admin-saved storage secrets>`

### Optional media env vars
- `UPLOAD_ENDPOINT` (S3-compatible endpoint, e.g. MinIO/R2/B2)
- `UPLOAD_PUBLIC_BASE_URL` (public-read base URL if different from `UPLOAD_ENDPOINT`)
- `UPLOAD_SIGNED_URL_TTL_SECONDS` (default `900`)
- `UPLOAD_FORCE_PATH_STYLE` (`true` for many S3-compatible providers)

## Media variant transformation pipeline

The media variant pipeline now performs real byte-level transformation for image variants when `sharp` is available.

### Transformer
- Backend: `sharp` (optional dependency; install in runtime/build environment for active transforms).
- If `sharp` is not available, variant generation fails safely per-variant and does not mutate/degrade existing good variants.

### Variant generation behavior
- Source bytes are read from object storage.
- Every configured key (`thumb`, `card`, `card_2x`, `gallery_thumb`, `gallery_main`, `gallery_main_2x`, `lightbox`, `lightbox_2x`) is resized with:
  - `fit=inside`
  - `withoutEnlargement=true` (no upscaling)
- Each variant is stored as a real transformed object and upserted in `MediaVariant`.
- Metadata persisted per variant row is the transformed output metadata:
  - `width`
  - `height`
  - `mimeType`
  - `byteSize`

### Format policy
- `image/jpeg` input => variants encoded as `image/webp`.
- `image/png` input:
  - alpha/transparency detected => encode as `image/png`.
  - no alpha => encode as `image/webp`.
- `image/webp` input:
  - alpha/transparency detected => encode as `image/png`.
  - no alpha => encode as `image/webp`.
- Original upload is preserved and remains source of truth in all cases.

### Quality/compression settings
- WebP quality: `82`
- PNG compression level: `9`

### Backfill/regenerate commands
- All image assets:
  ```bash
  npm run media:variants -- --all
  ```
- One product:
  ```bash
  npm run media:variants -- --product <productId>
  ```
- One asset:
  ```bash
  npm run media:variants -- --asset <mediaAssetId>
  ```
- Force overwrite existing variants:
  ```bash
  npm run media:variants -- --asset <mediaAssetId> --force
  ```

Backfill/regeneration is resumable and idempotent (`upsert` + skip-existing unless `--force`).
