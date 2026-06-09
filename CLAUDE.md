# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

**Dear Body** is a full-stack South African e-commerce platform. The repo contains two independent packages:

- `backend/` — Fastify 5 + Prisma REST API (Node.js, TypeScript)
- `frontend/` — React 18 + Vite SPA with a customer storefront and an admin portal (TypeScript)

Both packages have their own `package.json` and must be operated from their respective directories.

---

## Commands

### Backend (`cd backend/`)

```bash
npm run dev              # Start dev server with hot reload (tsx watch)
npm run build            # Generate Prisma client + compile TypeScript
npm start                # Run compiled dist/server.js
npm test                 # Run all *.test.ts files with Node's native test runner (tsx --test)

npm run prisma:generate  # Regenerate Prisma client after schema changes
npm run prisma:migrate   # Create and apply a new migration interactively (dev)
npm run prisma:deploy    # Apply pending migrations (production)
npm run prisma:studio    # Open Prisma Studio (web DB UI)

npm run seed:admin       # Seed the initial superadmin user
npm run media:variants   # Backfill/regenerate image variants
npm run debug:payfast-itn  # Replay a PayFast webhook for debugging
```

### Frontend (`cd frontend/`)

```bash
npm run dev              # Start Vite dev server
npm run build            # Type-check + Vite production build (injects git SHA and timestamp)
npm run typecheck        # tsc --noEmit only
npm test                 # Delegates to backend's tsx binary (see frontend/README.md)
```

### Run a single backend test file

```bash
cd backend && npx tsx --test src/modules/catalog/catalog.service.test.ts
```

---

## Architecture

### Backend: Modular Fastify Services

Each domain lives under `backend/src/modules/{domain}/` and contains:
- `{domain}.routes.ts` — thin Fastify route registration; calls service layer
- `{domain}.service.ts` — all business logic; imports from Prisma client
- `{domain}.schemas.ts` — Zod schemas for request/response validation

All environment variables are validated at startup in `backend/src/config/env.ts` using a Zod schema. **Add new env vars there first** or the server will refuse to start.

The Fastify app is assembled in `backend/src/app.ts`. JWT auth is registered as a plugin (`backend/src/plugins/auth.ts`). All admin routes require a valid access token; the JWT payload carries `permissions[]` which routes check for fine-grained access.

Scheduled jobs run inside the process: abandoned cart processor (60 s interval) and PUDO rate sync (daily at 04:00 UTC).

### Frontend: Dual-Portal React SPA

React Router 7 (browser history, no SSR) with two portals sharing the same bundle:
- `src/app/pages/` — customer-facing storefront
- `src/app/admin/` — admin portal

All routes are **lazy-loaded** via `React.lazy()` for code splitting. Route definitions are centralised in `src/app/routes.ts`.

Three global Context providers wrap the app (in `main.tsx`): `CartContext`, `CustomerAuthContext`, and `FavoritesContext`. The admin portal has its own `AdminAuthContext` under `src/app/admin/context/`.

**Admin API client** (`src/app/admin/api/client.ts`): a thin wrapper that automatically refreshes the JWT access token on 401 and retries the request. All admin API calls go through `apiRequest()` here.

**Customer auth** (`src/app/context/CustomerAuthContext.tsx`): JWTs are kept **in memory only** (not localStorage). Refresh tokens rotate on use.

### Database

PostgreSQL accessed via Prisma. The schema (`backend/prisma/schema.prisma`) has 40+ models. Key groupings:
- **Catalogue**: `Product`, `ProductVariant`, `Brand`, `Category`, `ProductAttribute`
- **Commerce**: `Cart`, `CartItem`, `Order`, `OrderItem`, `Payment`, `Refund`
- **Customers**: `Customer`, `CustomerAddress`, `CustomerInteraction`
- **Media**: `MediaAsset`, `MediaVariant` (Sharp-based transform pipeline)
- **CMS / Builder**: `Page`, `Section`, `Block`, `AnnouncementBanner`
- **Integrations**: `XeroAccount`, `PudoRate`, `WebhookLog`, `NotificationLog`, `AuditLog`

After changing `schema.prisma`, always run `npm run prisma:generate` (and `npm run prisma:migrate` in dev) before running the server or tests.

### Media Pipeline

Upload provider is configured via `UPLOAD_PROVIDER` (`local` | `s3` | `cloudflare-r2`). In development, files land in `backend/.local-uploads/`. In production, use S3 or Cloudflare R2.

`sharp` is an **optional** dependency for image variant generation. The backend degrades gracefully if it is absent, but variant transforms won't run.

### Third-Party Integrations

| Integration | Module | Notes |
|---|---|---|
| PayFast | `modules/payments/payfast.gateway.ts` | South African payment processor; ITN webhook |
| Stitch | `modules/payments/stitch.gateway.ts` | Payment aggregator |
| PUDO | `modules/pudo/` | Pickup locker network; daily rate sync, tracking webhooks |
| Xero | `modules/accounting/` | Order sync to accounting |
| Email | `modules/notifications/` | Providers: `console` (default), `smtp`, `resend`, `sendgrid` |

### Deployment

| Target | Config | Notes |
|---|---|---|
| Backend — Cloud Run | `cloudbuild.yaml` | GCP Buildpacks → `africa-south1` region |
| Backend — Render | `render.yaml` | Auto-runs `prisma migrate deploy` on each deploy |
| Frontend — Vercel | `vercel.json` | SPA rewrite: all non-asset paths → `/index.html` |

Health check endpoint: `GET /ping` (returns 200, bypasses maintenance mode).

---

## Environment Variables

Required backend variables (see full schema in `backend/src/config/env.ts`):

| Variable | Notes |
|---|---|
| `DATABASE_URL` | PostgreSQL URL; add `?sslmode=require` in production |
| `JWT_ACCESS_SECRET` | Min 32 chars |
| `JWT_REFRESH_SECRET` | Min 32 chars |
| `EMAIL_FROM` | Sender address (required even when provider is `console`) |
| `WEBHOOK_SIGNING_SECRET` | Min 8 chars; validates inbound webhook payloads |

Frontend variables (prefix `VITE_`):

| Variable | Default |
|---|---|
| `VITE_API_BASE_URL` | `http://localhost:4000` |
| `VITE_API_PREFIX` | `/api` |
| `VITE_ADMIN_AUTH_DEBUG` | — (set to `"true"` to enable auth debug logs) |

---

## Key Conventions

- **No ESLint or Prettier** is currently configured. TypeScript strict mode is **off** in the backend (`tsconfig.json`).
- Backend TypeScript is compiled with `tsc`; do not rely on `tsx` type-checking in CI.
- Audit logging is automatic: an `onResponse` Fastify hook records every admin API call to `AuditLog`.
- `MAINTENANCE_MODE=true` returns 503 on all routes except `/ping`, `/health`, and `/cms/bootstrap`.
- The page builder uses `@craftjs/core`. Builder state is serialised JSON stored in the `Page` model.
