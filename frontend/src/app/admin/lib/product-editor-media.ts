export type EditorMediaAsset = {
  id: string;
  filename: string;
  publicUrl?: string;
  thumbnailUrl?: string;
  previewUrl?: string;
  displayUrl?: string;
  url?: string;
  mimeType: string;
  variants?: Array<{ key: string; publicUrl?: string | null; url?: string | null }>
    | Record<string, { publicUrl?: string | null; url?: string | null }>;
};

export type EditorGalleryEntry = {
  mediaAssetId: string;
  mediaAsset?: EditorMediaAsset | null;
};

export function resolveBestMediaPreviewUrl(asset: EditorMediaAsset): string | undefined {
  const normalizedFromVariants = Array.isArray(asset.variants)
    ? asset.variants
    : asset.variants
      ? Object.entries(asset.variants).map(([key, value]) => ({ key, publicUrl: value?.publicUrl, url: value?.url }))
      : [];
  const variantMap = new Map(normalizedFromVariants.map((variant) => [variant.key, variant.publicUrl ?? variant.url]));
  return asset.thumbnailUrl
    ?? asset.previewUrl
    ?? variantMap.get("card")
    ?? variantMap.get("thumb")
    ?? variantMap.get("gallery_thumb")
    ?? asset.displayUrl
    ?? asset.url
    ?? asset.publicUrl;
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
