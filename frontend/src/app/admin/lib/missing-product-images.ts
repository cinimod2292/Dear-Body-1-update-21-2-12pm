export const MAX_IMAGE_UPLOAD_BYTES = 50 * 1024 * 1024;

export interface MissingProductImageRow {
  id: string;
  name: string;
  slug: string;
  sku?: string | null;
  status?: string | null;
  visibility?: string | null;
}

export function validateProductImageFiles(files: File[]): string | null {
  if (!files.length) return "Select at least one image file";

  for (const file of files) {
    if (!file.type.toLowerCase().startsWith("image/")) {
      return `Only image files are allowed (${file.name})`;
    }
    if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
      return `Image exceeds 50MB limit (${file.name})`;
    }
  }

  return null;
}

export function removeUploadedProductFromMissingList(
  products: MissingProductImageRow[],
  productId: string,
): MissingProductImageRow[] {
  return products.filter((product) => product.id !== productId);
}
