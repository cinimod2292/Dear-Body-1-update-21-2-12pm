import { resolveHeroImageSelection } from "./media-picker";
import { MediaAsset } from "../../types/admin";

export function resolveHeroSelectionUrl(asset: MediaAsset, currentValue: string, preferredKeys: string[]) {
  const selection = resolveHeroImageSelection(currentValue, asset, preferredKeys);
  const requiredUrl = String(asset.publicUrl ?? selection.nextValue ?? "").trim();
  return { repairedAsset: asset, selection, requiredUrl };
}
