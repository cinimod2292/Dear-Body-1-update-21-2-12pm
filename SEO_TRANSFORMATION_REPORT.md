# Enterprise SEO Transformation Report

## Audit summary

The storefront already had a React SEO hook, product image sizing, lazy-loaded route chunks, builder hero preloading, product detail breadcrumbs, and some default social metadata. The audit found these material organic-search gaps:

1. Homepage metadata targeted broad branded beauty language instead of priority non-brand terms such as "Fragrances South Africa", "Women's Perfume", and "Body Care".
2. Shop/category pages were primarily faceted product grids, with thin unique copy, limited shopping guidance, and no reusable category SEO content system.
3. Category pages lacked FAQ structured data, buying-guide content, and robust internal links to adjacent collections.
4. Product pages relied heavily on backend descriptions and could render thin content if product data was incomplete.
5. Product schema did not include enhanced category/keyword context or fallback richer descriptions.
6. Social metadata had no guaranteed default share image.
7. XML sitemap and robots directives were missing from the Vite public output.
8. The homepage lacked an always-rendered authority section for fragrance/body-care topics when builder content is present.
9. Internal linking existed in navigation/footer but not enough contextual links between body spray, lotion, scrub, body butter, and all-shop pages.
10. The implementation needed reusable SEO content utilities so future products/categories inherit defaults rather than requiring bespoke page code.

## Prioritised implementation plan by SEO impact

| Priority | Area | Impact | Implementation |
| --- | --- | --- | --- |
| P0 | Crawl/index controls | High | Add robots.txt and sitemap.xml with canonical public routes and ecommerce crawl exclusions. |
| P0 | Metadata/canonicals/social | High | Expand SEO hook defaults, OG/Twitter defaults, locale/site metadata, and keyword support. |
| P0 | Category landing pages | High | Add reusable category SEO content, buying guides, FAQs, FAQPage schema, CollectionPage schema, breadcrumbs, and internal links. |
| P0 | Product detail content/schema | High | Add fallback product descriptions, benefits, fragrance notes, usage guidance, keywords, and richer Product schema. |
| P1 | Homepage authority | High | Add non-disruptive homepage authority block targeting fragrance, women's perfume, and body care in South Africa. |
| P1 | Internal linking | Medium-High | Add contextual links between related categories and homepage collection CTAs. |
| P1 | Image/social assets | Medium | Add default OG image asset and retain responsive/lazy/eager image strategy. |
| P2 | Future automation | Medium | Centralise SEO content generation in reusable utilities and a reusable landing-section component. |

## Files modified

- `frontend/src/app/lib/seo.ts` — enhanced reusable SEO hook defaults, locale/site metadata, social image fallback, and keyword meta support.
- `frontend/src/app/lib/seo-content.ts` — new reusable SEO content library for category landing pages, homepage keyword targets, product fallback copy, and benefits.
- `frontend/src/app/components/SeoLandingSections.tsx` — new reusable landing-page component with buying guides, FAQs, and contextual internal links.
- `frontend/src/app/pages/Shop.tsx` — transformed shop/category routes into SEO landing pages with unique copy, structured data, FAQs, and internal links.
- `frontend/src/app/pages/ProductDetail.tsx` — added richer product content blocks and stronger Product schema fallback descriptions/keywords.
- `frontend/src/app/pages/Home.tsx` — retargeted homepage metadata and added authority copy/internal links while preserving current builder/legacy rendering.
- `frontend/public/robots.txt` — added crawl directives and sitemap declaration.
- `frontend/public/sitemap.xml` — added primary static routes and collection URLs.
- `frontend/public/og-dear-body.svg` — added default social preview image.

## Improvements implemented and expected SEO impact

| Improvement | Expected impact |
| --- | --- |
| Homepage title/description now explicitly target fragrances South Africa, women's perfume, and body care. | High: improves relevance for priority non-brand head terms. |
| Added homepage authority section with contextual links to body sprays, body lotions, and all body care. | High: increases topical authority and passes internal link equity to commercial pages. |
| Added reusable category SEO content for Body Spray, Body Lotion, Body Scrub, and Body Butter. | High: reduces thin category pages and improves category-level keyword relevance. |
| Added buying guides and FAQs to shop/category pages. | High: improves long-tail query coverage and shopper intent matching. |
| Added FAQPage, CollectionPage, and BreadcrumbList structured data for shop/category pages. | Medium-High: improves entity clarity and eligibility for richer search understanding. |
| Added richer product descriptions, benefits, fragrance notes, best-for guidance, and usage guidance fallback. | High: reduces thin PDP risk and expands product long-tail visibility. |
| Improved Product schema with enhanced description, category, keyword context, offers, ratings, and breadcrumbs. | Medium-High: improves product eligibility and entity clarity. |
| Added default OG/Twitter image fallback and OG locale/site name defaults. | Medium: improves social sharing quality and consistent metadata. |
| Added robots.txt with admin/account/cart/checkout/search crawl exclusions. | High: focuses crawl budget on indexable commercial/content pages. |
| Added sitemap.xml for primary public and collection routes. | High: improves discovery of key static landing pages. |
| Centralised SEO content utilities and reusable landing sections. | Medium: makes future SEO implementation scalable and less error-prone. |

## Remaining recommendations

1. Generate a dynamic sitemap from backend product/category data so every live product URL is included with last-modified dates.
2. Move category URLs from query parameters (`/shop?category=Body%20Spray`) to clean paths such as `/collections/body-spray` with 301 redirects.
3. Add backend/admin fields for fragrance families, top/middle/base notes, skin type, benefit tags, and routine pairings so PDP SEO content can be fully data-driven.
4. Add server-side rendering or prerendering for product/category pages if organic growth becomes a top acquisition channel, because this is currently a client-rendered Vite app.
5. Add Search Console and analytics event reporting for landing-page impressions, PDP organic entrances, and category conversion rate.
6. Replace the static sitemap with an automated build/deploy step that validates canonical URLs, sitemap freshness, and robots directives.
7. Create editorial guides for "best body sprays in South Africa", "how to layer fragrance", and "body butter vs lotion" once a blog/content route exists.
