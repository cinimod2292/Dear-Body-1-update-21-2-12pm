export function isSafeImageUrl(value: string) {
  const url = value.trim();
  if (!url) return true;
  if (/^\s*(javascript|data):/i.test(url)) return false;
  if (/^\/api\/media\/public\/variants\/.+\.webp(\?.*)?$/i.test(url)) return true;
  if (/^\/(?:api\/media\/public\/)?uploads\/.+\.(jpg|jpeg)(\?.*)?$/i.test(url)) return false;
  if (url.startsWith("/")) return true;
  if (/^https:\/\//i.test(url)) return true;
  return false;
}

export function isOptimizedVariantUrl(value: string) {
  const url = value.trim().toLowerCase();
  if (!url) return false;
  return url.includes("/variants/") || url.endsWith(".webp");
}

export function isLikelyOriginalUploadUrl(value: string) {
  const url = value.trim().toLowerCase();
  if (!url) return false;
  if (isOptimizedVariantUrl(url)) return false;
  const hasUploadsSegment = url.includes("/uploads/") || url.includes("uploads%2f");
  const looksOriginalExt = /\.(jpe?g|png)(\?|#|$)/.test(url);
  return hasUploadsSegment && looksOriginalExt;
}

export function sanitizeBuilderImageUrl(value: unknown, options: { isHero: boolean }) {
  const url = typeof value === "string" ? value.trim() : "";
  if (!url) return null;
  if (!isSafeImageUrl(url)) return null;
  if (isLikelyOriginalUploadUrl(url)) return null;
  void options;
  return url;
}
