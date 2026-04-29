export type MediaVariantLike = {
  key?: string | null;
  publicUrl?: string | null;
  url?: string | null;
  [key: string]: unknown;
};

export function normalizeVariants(variants: unknown): MediaVariantLike[] {
  if (!variants) return [];
  if (Array.isArray(variants)) return variants as MediaVariantLike[];
  if (typeof variants === "object") {
    return Object.entries(variants as Record<string, unknown>).map(([key, value]) => {
      if (!value || typeof value !== "object") return { key, url: typeof value === "string" ? value : undefined };
      const record = value as Record<string, unknown>;
      return { key, ...record };
    });
  }
  return [];
}

export function variantKeys(variants: unknown): string[] {
  return normalizeVariants(variants)
    .map((variant) => String(variant.key ?? "").trim())
    .filter(Boolean);
}

export function findVariantByKey(variants: unknown, keys: string[]) {
  const list = normalizeVariants(variants);
  for (const key of keys) {
    const found = list.find((variant) => String(variant.key ?? "") === key);
    if (found) return found;
  }
  return null;
}
