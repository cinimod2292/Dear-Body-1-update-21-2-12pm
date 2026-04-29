# Dear Body Media Pipeline Redesign (Cloudflare-native)

## Old pipeline (before)
- Upload prepare/finalize wrote a `MediaAsset` row and then attempted Sharp generation of `MediaVariant` rows.
- Homepage hero assignment depended on variant rows existing (`hero_desktop`, `card`, etc.).
- Admin/backfill flows were required to repair missing variants and timed out in serverless production.
- Local `/uploads/*` and runtime filesystem assumptions leaked into production reliability.

## New pipeline (Cloudflare-native)
- Upload stores the original once in object storage (`UPLOAD_PROVIDER=cloudflare-r2`) and persists stable metadata in `MediaAsset`.
- Variant URLs are generated at response-time via Cloudflare delivery (`/cdn-cgi/image/...`) for:
  - `thumbnail`
  - `card`
  - `gallery`
  - `heroDesktop`
  - `heroMobile`
  - `original`
- No local Sharp dependency is required for Cloudflare-native assets.
- Legacy `MediaVariant` rows are still read for old/local assets.

## Unified media response contract

```ts
{
  id,
  kind,
  mimeType,
  storageProvider,
  storageKey,
  originalUrl,
  variants: {
    thumbnail: { url, width, height, format },
    card: { url, width, height, format },
    gallery: { url, width, height, format },
    heroDesktop: { url, width, height, format },
    heroMobile: { url, width, height, format },
    original: { url, format }
  }
}
```

## Legacy compatibility
- Existing assets with `MediaVariant` rows continue to map from legacy keys.
- Legacy/local assets can still use `/api/media/public/variants` paths.
- New Cloudflare uploads do **not** require backfill/regenerate.

## Config requirements
For `UPLOAD_PROVIDER=cloudflare-r2`, all of the below are required at startup:
- `UPLOAD_BUCKET`
- `UPLOAD_ENDPOINT`
- `UPLOAD_ACCESS_KEY_ID`
- `UPLOAD_SECRET_ACCESS_KEY`
- `UPLOAD_PUBLIC_BASE_URL`

Startup validation fails fast if missing.
