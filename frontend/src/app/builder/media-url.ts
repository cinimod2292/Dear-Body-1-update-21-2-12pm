export function isSafeImageUrl(value: string) {
  const url = value.trim();
  if (!url) return true;
  if (url.startsWith("/")) return true;
  if (/^https:\/\//i.test(url)) return true;
  return false;
}
