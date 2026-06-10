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

## Enablement runbook (how to switch it on)

The application code already emits Cloudflare delivery URLs the moment a public
delivery base is configured — see `toMediaAssetContract` /
`resolveCloudflareResizedUrl` in `backend/src/modules/media/media-contract.ts`
(`shouldGenerateDeliveryVariants` is true when the provider is `cloudflare-r2`
**or** any `publicBaseUrl` is set). Turning it on is therefore an
infrastructure + config task, not an application-code change:

1. **Object storage (R2).** Create a Cloudflare R2 bucket for media. Note its
   S3 API endpoint and create an access key/secret scoped to the bucket.
2. **Public delivery domain.** Serve the bucket on a domain proxied through
   Cloudflare (orange-cloud), e.g. `https://cdn.dearbody.co.za`. Image delivery
   only works when the request passes through Cloudflare.
3. **Enable Transformations.** In the Cloudflare dashboard for that zone, enable
   **Speed → Optimization → Image Transformations** (Image Resizing) and allow
   resizing from the delivery host. This is what makes `/cdn-cgi/image/...` URLs
   work and what serves AVIF/WebP automatically via `format=auto`.
4. **Point the app at it** — either set these environment variables and redeploy:
   - `UPLOAD_PROVIDER=cloudflare-r2`
   - `UPLOAD_BUCKET=<bucket>`
   - `UPLOAD_ENDPOINT=<r2 s3 endpoint>`
   - `UPLOAD_ACCESS_KEY_ID=<key>`
   - `UPLOAD_SECRET_ACCESS_KEY=<secret>`
   - `UPLOAD_PUBLIC_BASE_URL=https://cdn.dearbody.co.za`

   …or set the same values at runtime via **Admin → Settings → Media/Storage**
   (persisted in the `media/storage` Setting and read by `resolveUploadConfig`,
   which takes precedence over env vars).

   > Setting only `UPLOAD_PUBLIC_BASE_URL` (even while keeping `UPLOAD_PROVIDER`
   > on `s3`/`local`) is already enough to switch the response contract to
   > `/cdn-cgi/image/...` delivery URLs. Use `cloudflare-r2` for the fully native
   > setup so new originals also land in R2.

5. **Verify.** In a product API response, confirm `variants.gallery.url` /
   `variants.heroDesktop.url` now point at
   `…/cdn-cgi/image/width=…,format=auto,quality=85/…`. Then load the storefront
   and check the Network tab reports `content-type: image/avif` (or `image/webp`)
   for product images on a supporting browser.

### New vs. existing content
- **New uploads and re-saved builder sections** use delivery URLs immediately.
- **Already-published builder pages** store the original image URL inline in the
  page JSON, so they are upgraded by the **fail-open serve-time variant rewrite**
  applied by the storefront builder-page endpoint: each inline image URL is
  matched back to its `MediaAsset` and swapped for the appropriate variant
  (`gallery`, `heroDesktop`, `heroMobile`, …). If an asset cannot be matched, the
  original URL is returned unchanged, so rendering can never break.

### Optional cleanup once stable
- The Sharp-based variant generator and the `media:variants` backfill become
  unnecessary for Cloudflare-native assets and can be retired later.
- `sharp` can then move fully to the optional path it already half-occupies.
