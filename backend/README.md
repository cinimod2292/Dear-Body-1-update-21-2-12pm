# Dear Body Backend (Phase 1 Foundations)

This service provides the production backend foundation for admin APIs and future commerce modules.

## Implemented in Phase 1
- Fastify + TypeScript backend skeleton
- Prisma schema for staff/admin users, settings, media, tags, SEO metadata, audit logs, notification logs, webhook events
- Admin authentication (JWT access token) and role-based permission checks
- Admin settings and media foundation endpoints
- Audit logging foundation
- Reusable pagination/filter/sort query pattern
- Standardized error handling and env validation
- Notification/email logging foundation
- Webhook ingestion + signature check foundation

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
