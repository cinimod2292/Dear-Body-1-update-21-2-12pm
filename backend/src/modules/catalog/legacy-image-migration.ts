export function extractLegacyImageUrls(shortDescription?: string | null): string[] {
  if (!shortDescription) return [];
  try {
    const parsed = JSON.parse(shortDescription) as { images?: unknown; image?: unknown };
    const fromImages = Array.isArray(parsed.images) ? parsed.images.filter((value): value is string => typeof value === "string" && value.trim().length > 0) : [];
    const fromImage = typeof parsed.image === "string" && parsed.image.trim().length > 0 ? [parsed.image] : [];
    return [...fromImages, ...fromImage];
  } catch {
    return [];
  }
}

export function planLegacyImageMigration(params: {
  legacyUrls: string[];
  canonicalMediaUrls: string[];
}) {
  const canonicalSet = new Set(params.canonicalMediaUrls.map((url) => url.trim()));
  const toMigrate: string[] = [];
  const duplicates: string[] = [];

  for (const url of params.legacyUrls) {
    const normalized = url.trim();
    if (!normalized) continue;
    if (canonicalSet.has(normalized)) {
      duplicates.push(normalized);
      continue;
    }
    toMigrate.push(normalized);
    canonicalSet.add(normalized);
  }

  return { toMigrate, duplicates };
}
