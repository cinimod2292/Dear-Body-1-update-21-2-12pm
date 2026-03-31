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
