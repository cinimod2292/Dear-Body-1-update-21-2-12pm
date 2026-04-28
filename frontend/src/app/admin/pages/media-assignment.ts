import { MediaAsset } from "../types/admin";

const HERO_VARIANT_PREFERENCE = ["heroDesktop", "hero_desktop", "card", "thumbnail", "thumb"] as const;

export function resolveNextSelectedMediaId(current: string | null, clickedId: string): string {
  if (!clickedId.trim()) return current ?? "";
  return clickedId;
}

export function selectedAssetLabel(asset: MediaAsset | null): string {
  if (!asset) return "none";
  return `${asset.filename} (${asset.id})`;
}

export function canAssignSelectedAsset(selectedAsset: MediaAsset | null, saving: boolean): boolean {
  return Boolean(selectedAsset && !saving);
}

export function pickOptimizedHeroVariant(asset: MediaAsset | null): { key: string; url: string } | null {
  const variants = asset?.variants;
  if (!variants) return null;

  if (!Array.isArray(variants)) {
    for (const key of HERO_VARIANT_PREFERENCE) {
      const candidate = variants[key as keyof typeof variants] as any;
      const url = String(candidate?.url ?? candidate?.publicUrl ?? "").trim();
      if (url) return { key, url };
    }
  }

  if (Array.isArray(variants)) {
    for (const key of HERO_VARIANT_PREFERENCE) {
      const variantUrl = variants.find((variant) => variant.key === key)?.publicUrl?.trim();
      if (variantUrl) return { key, url: variantUrl };
    }
  }
  return null;
}

export function validateHeroAssignmentAsset(asset: MediaAsset | null): { ok: true } | { ok: false; reason: string } {
  if (!asset) return { ok: false, reason: "Please select an image asset first." };
  if (asset.kind !== "IMAGE") return { ok: false, reason: "Only image assets can be used for homepage hero." };
  if (!pickOptimizedHeroVariant(asset)) {
    return { ok: false, reason: "Selected image has no Cloudflare delivery variants yet." };
  }
  return { ok: true };
}
