function isApprovedCloudflareUrl(url: string) {
  if (!/^https:\/\//i.test(url)) return false;
  return url.includes("/cdn-cgi/image/") || url.includes("imagedelivery.net");
}

export function isSafeImageUrl(value: string, options?: { isHero?: boolean }) {
  const url = value.trim();
  if (!url) return true;
  if (/^\s*(javascript|data):/i.test(url)) return false;
  if (/^\/api\/media\/public\/variants\/.+/i.test(url)) return true;
  if (/^\/(?:api\/media\/public\/)?uploads\/.+\.(jpg|jpeg|png|webp)(\?.*)?$/i.test(url)) return false;
  if (options?.isHero) {
    if (isApprovedCloudflareUrl(url)) return true;
    return /^\/api\/media\/public\/variants\/.+/i.test(url);
  }
  if (url.startsWith("/")) return true;
  if (/^https:\/\//i.test(url)) return true;
  return false;
}

export function isOptimizedVariantUrl(value: string) {
  const url = value.trim().toLowerCase();
  if (!url) return false;
  return url.includes("/variants/") || url.includes("/cdn-cgi/image/") || url.includes("imagedelivery.net") || url.endsWith(".webp");
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
  if (!isSafeImageUrl(url, { isHero: options.isHero })) return null;
  if (isLikelyOriginalUploadUrl(url)) return null;
  return url;
}
