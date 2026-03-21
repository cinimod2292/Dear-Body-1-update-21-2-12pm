# Phase 0 — Repository Audit & Production Delivery Plan

## 1) Current Repository Audit

### 1.1 Frontend stack
- Framework/runtime: React 18 + TypeScript, built with Vite 6.
- Routing: `react-router` with browser router.
- Styling/UI: Tailwind CSS + large Radix/shadcn-style UI component set, plus some MUI/emotion dependencies available.
- State management: local React state + context (`CartContext`) only.
- Data source: fully static mock product catalog from local file (`products.ts`) with no backend integration.

### 1.2 Backend stack
- No backend application exists in this repository currently.
- No server runtime, API service, DB connection, ORM, or migrations currently present.

### 1.3 Auth flow
- No authentication system exists.
- No customer auth, no admin auth, no sessions, no token issuance, no route guards.

### 1.4 Database / ORM / schema
- None currently.
- Product catalog, order behavior, and checkout are in-memory/UI-only.

### 1.5 Current API structure
- None. No API client module, no REST/GraphQL endpoints, no fetch/axios integration in app domain logic.

### 1.6 Existing admin-related code
- None. No `/admin` routes, admin layout, role checks, or admin data interfaces.

### 1.7 Media/file upload handling
- None. Static assets and remote image URLs only.
- No upload endpoint, no media library, no storage provider integration.

### 1.8 Deployment configuration
- Frontend-only Vite app; no backend deployment assets (Dockerfile, process manager, IaC, CI deploy manifests) identified.

### 1.9 Environment variable usage
- No active env usage in the app business logic (`import.meta.env` / `process.env` absent in domain code).

### 1.10 Payment / accounting / email logic
- Checkout UI is a simulation: no payment gateway integration, no order persistence, no invoicing/accounting sync, no transactional email.

---

## 2) Recommended Target Architecture (reusing current stack where possible)

## 2.1 Guiding principles
- Preserve existing storefront UX and routes; switch data progressively from static to API.
- Add backend as a separate service first; keep strict API contracts.
- Build admin portal in same frontend codebase under `/admin` route segment to maximize reuse of existing tooling.
- Keep modules bounded (catalog, inventory, orders, customers, content, settings, media).

### 2.2 Proposed platform components
1. **Frontend app (existing Vite React)**
   - Keep storefront routes.
   - Add API client layer + query cache abstraction.
   - Add `/admin` protected route tree and admin shell.
2. **Backend API service (new)**
   - Recommended: Node.js + TypeScript + Fastify (or Express if preferred) with modular route structure.
3. **Database**
   - Recommended: PostgreSQL + Prisma ORM.
4. **Storage**
   - Recommended: S3-compatible object storage (S3/Cloudflare R2) via signed uploads.
5. **Background processing**
   - Queue worker for email/webhook retries and long-running jobs.

---

## 3) Recommended Data Models (initial)

## Core commerce
- `User` (id, email, passwordHash, status, createdAt)
- `Role` (id, key) + `UserRole` join
- `AdminProfile` (userId, name, lastLoginAt)
- `Customer` (id, email, phone, name, marketingOptIn)
- `Address` (customerId, type, fields)
- `Product` (id, slug, name, description, status, brand)
- `ProductVariant` (id, productId, sku, price, compareAtPrice, cost, weight, barcode, status)
- `InventoryItem` (variantId, quantityOnHand, reorderPoint, trackInventory)
- `Collection` and `CollectionProduct`
- `Category` (optional taxonomy)
- `ProductMedia` (productId/variantId, mediaId, sort)

## Orders/payments/fulfillment
- `Cart` + `CartItem`
- `Order` (number, customerId, status, financialStatus, fulfillmentStatus, currency, totals)
- `OrderItem` (orderId, variant snapshot fields)
- `Payment` (orderId, provider, intentId, status, amount)
- `Refund` (paymentId/orderId)
- `Shipment` (orderId, carrier, trackingNumber, status)

## Content/CMS/settings
- `SiteSetting` (key, jsonValue)
- `Page` (slug, title, blocksJson, seo fields, publish status)
- `Announcement` / `Banner`
- `NavigationMenu` + `MenuItem`

## Media and communication
- `MediaAsset` (storageKey, url, mimeType, size, metadata)
- `EmailTemplate` (key, subject, body)
- `EmailLog` (recipient, templateKey, status, providerMessageId)
- `WebhookEvent` (type, payload, status, retryCount)
- `AuditLog` (actorUserId, action, resource, before/after snapshots)

---

## 4) Required Backend Modules

1. **Auth & IAM**
   - Admin login/logout, JWT + refresh token/session strategy.
   - RBAC middleware and route guards.
2. **Catalog**
   - Product/variant CRUD, collections, categories, media attachments.
3. **Inventory**
   - Stock adjustments, movement history, low-stock reporting.
4. **Orders**
   - Checkout order creation, order list/detail, status transitions.
5. **Payments**
   - Provider abstraction (start with Stripe), webhook verification, captures/refunds.
6. **Customers**
   - Customer CRUD/search, addresses, order history.
7. **Promotions**
   - Discount codes, validity windows, usage limits.
8. **Content/CMS**
   - Home/shop content blocks, nav/footer settings, SEO fields.
9. **Media**
   - Signed upload URL issuing, asset validation, attachment APIs.
10. **Notifications**
   - Transactional email service + event-based triggers.
11. **Settings**
   - Store profile, tax/shipping rules, payment keys (server-managed).
12. **System/ops**
   - Health checks, metrics, structured logging, audit log query endpoints.

---

## 5) Required Admin Portal Pages

## Access & shell
- Login page
- Forgot/reset password
- Admin layout (nav, breadcrumbs, global search)
- Profile/security page

## Commerce operations
- Dashboard (sales KPIs, low stock, recent orders)
- Products list/create/edit (variants, media, status)
- Collections/Categories manager
- Inventory management (bulk adjustments)
- Orders list/detail (timeline, payments, fulfillment)
- Customers list/detail
- Discounts/promotions

## Content & configuration
- CMS Pages/Sections editor (home blocks + static pages)
- Navigation/footer editor
- Media library
- Store settings (branding, shipping, tax, currency)
- Email templates & notification settings
- Team/users/roles permissions
- Audit logs

---

## 6) Integration Points With Existing Storefront

1. Replace static `products.ts` consumption with API-backed catalog reads while preserving existing UI components and route structure.
2. Replace local `CartContext` with persistent cart API + local optimistic cache.
3. Replace simulated checkout with backend order + payment intent flow.
4. Add customer-facing order confirmation based on persisted order state.
5. Introduce shared typed DTOs/contracts between frontend and backend to reduce break risk.

---

## 7) CMS / Site Editor Approach

Recommended approach:
- Start with **schema-driven block JSON** for homepage and core content areas.
- Admin gets block editor forms (hero, promo grid, featured products, testimonials, FAQ, etc.).
- Storefront renders known block types with safe defaults.
- Add draft/publish versioning for content entities.

This keeps implementation realistic while still enabling non-developer client management.

---

## 8) Permission Model (RBAC)

Baseline roles:
- `super_admin`: full system and team management
- `store_manager`: products/orders/customers/settings (non-security)
- `content_editor`: CMS/media only
- `support_agent`: orders/customers read+limited updates
- `analyst`: read-only reporting

Enforce route-level and action-level permissions in backend; mirror in admin UI for affordances.

---

## 9) Missing Foundations (must be implemented early)

1. **Admin auth + roles** (highest priority)
2. **Persistent settings storage** (site + commerce config)
3. **Media upload/storage strategy** (signed uploads + metadata table)
4. **Notification/email service** (transactional provider integration)
5. **Background jobs/webhooks**
   - payment webhooks
   - email retries
   - async media processing hooks (optional)

---

## 10) Safe Rollout Order (phased)

### Phase 1 — Platform foundation
- Create backend service scaffold, DB, ORM, migration tooling.
- Add health checks, logging, error format, env schema validation.
- Add API client skeleton in frontend.

### Phase 2 — Auth & Admin shell
- Implement admin auth (JWT/refresh), seed first super admin, RBAC.
- Build admin login + protected routing + base dashboard shell.

### Phase 3 — Catalog + Media
- Product/variant CRUD APIs.
- Media upload flow and media library.
- Admin product management UI.
- Storefront reads products from API (feature flag fallback to static data during cutover).

### Phase 4 — Orders + Checkout + Payments
- Persistent carts, order creation, payment provider integration.
- Replace simulated checkout with real flow.
- Admin order management pages.

### Phase 5 — Customers + Notifications
- Customer APIs + admin views.
- Email events for order placed/shipped/refunded.

### Phase 6 — CMS + Store settings editor
- Site settings/pages/menu APIs.
- Admin CMS editor pages.
- Storefront dynamic rendering from CMS data.

### Phase 7 — Hardening & production readiness
- Audit logs, rate limits, monitoring, backups, security headers/CORS.
- E2E/regression test suite, seed data, deployment docs/runbooks.

---

## 11) Phase 0 Risk Notes
- Current codebase is a design-first storefront prototype; production scope requires introducing all backend foundations.
- Biggest risk is uncontrolled coupling between new API contracts and existing UI assumptions.
- Mitigation: contract-first DTOs, feature flags, incremental route-by-route integration, and regression checks per phase.

