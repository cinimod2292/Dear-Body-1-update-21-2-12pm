export type ProductDetailImage = {
  url: string;
  width?: number;
  height?: number;
  thumbUrl?: string;
  mainUrl?: string;
  main2xUrl?: string;
  lightboxUrl?: string;
  lightbox2xUrl?: string;
};

export function deriveGalleryImages(params: {
  galleryImages?: ProductDetailImage[];
  images: string[];
  image: string;
} | null): ProductDetailImage[] {
  if (!params) return [];
  if (params.galleryImages?.length) return params.galleryImages;
  if (params.images.length) return params.images.map((url): ProductDetailImage => ({ url })).filter((entry) => Boolean(entry.url));
  return [{ url: params.image }].filter((entry) => Boolean(entry.url));
}
