import { requireOptimizedHeroUrl, synthesizeOptimizedHeroVariants } from "../../lib/hero-media";
import { resolveHeroImageSelection } from "./media-picker";
import { MediaAsset } from "../../types/admin";

export function resolveHeroSelectionUrl(asset: MediaAsset, currentValue: string, preferredKeys: string[]) {
  const repairedAsset = synthesizeOptimizedHeroVariants(asset);
  const selection = resolveHeroImageSelection(currentValue, repairedAsset, preferredKeys);
  const requiredUrl = requireOptimizedHeroUrl({ variants: repairedAsset.variants });
  return { repairedAsset, selection, requiredUrl };
}
