export type EditorMediaAsset = {
  id: string;
  filename: string;
  publicUrl?: string;
  mimeType: string;
  variants?: Array<{ key: string; publicUrl?: string | null }>;
};

export type EditorGalleryEntry = {
  mediaAssetId: string;
  mediaAsset?: EditorMediaAsset | null;
};

export function resolveBestMediaPreviewUrl(asset: EditorMediaAsset): string | undefined {
  const variantMap = new Map((asset.variants ?? []).map((variant) => [variant.key, variant.publicUrl]));
  return variantMap.get("card") ?? variantMap.get("thumb") ?? asset.publicUrl;
}

export function resolveSelectedEditorMediaAssets(params: {
  galleries?: EditorGalleryEntry[];
  mediaAssets: EditorMediaAsset[];
  legacyImages?: string[];
}): EditorMediaAsset[] {
  const galleries = params.galleries ?? [];
  const mediaById = new Map(params.mediaAssets.map((asset) => [asset.id, asset]));

  const fromGalleries = galleries
    .map((entry) => {
      const fromLibrary = mediaById.get(entry.mediaAssetId);
      const source = fromLibrary ?? entry.mediaAsset ?? null;
      if (!source) return null;
      const previewUrl = resolveBestMediaPreviewUrl(source);
      return {
        ...source,
        publicUrl: previewUrl,
      };
    })
    .filter((asset) => Boolean(asset)) as EditorMediaAsset[];

  if (fromGalleries.length > 0) return fromGalleries;

  const legacyImages = (params.legacyImages ?? []).filter((url) => Boolean(url));
  if (legacyImages.length === 0) return [];

  return legacyImages.map((url, index) => ({
    id: `legacy:${index}`,
    filename: `Legacy image ${index + 1}`,
    publicUrl: url,
    mimeType: "image/legacy",
  }));
}
