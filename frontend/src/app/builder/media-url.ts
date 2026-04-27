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
