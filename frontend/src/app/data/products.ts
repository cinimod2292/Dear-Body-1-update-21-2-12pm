import { API_BASE } from "../admin/api/client";

export interface Product {
  id: string;
  slug: string;
  variantId: string | null;
  name: string;
  tagline: string;
  price: number;
  originalPrice?: number;
  category: string;
  color: string;
  bgColor: string;
  textColor: string;
  image: string;
  description: string;
  ingredients: string;
  howToUse: string;
  size: string;
  rating: number;
  reviews: number;
  badge?: string;
  inStock: boolean;
  scent?: string;
}

type StorefrontProductApi = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  shortDescription?: string | null;
  category?: { name: string } | null;
  featured?: boolean;
  galleries?: Array<{ mediaAsset?: { publicUrl?: string | null } | null }>;
  variants?: Array<{
    id: string;
    price: number;
    salePrice?: number | null;
    inventoryLevel?: { quantityOnHand: number } | null;
  }>;
};

const palette = [
  { color: "#FF69B4", bgColor: "#FFF0F8", textColor: "#C71585" },
  { color: "#F97316", bgColor: "#FFF7ED", textColor: "#C2410C" },
  { color: "#29B8E8", bgColor: "#F0FAFF", textColor: "#0369A1" },
  { color: "#CCDD00", bgColor: "#FAFFF0", textColor: "#65A30D" },
] as const;

function parseJsonSafe<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function toProduct(api: StorefrontProductApi, index: number): Product {
  const primaryVariant = api.variants?.find((variant) => (variant.inventoryLevel?.quantityOnHand ?? 0) > 0) ?? api.variants?.[0];
  const colorSet = palette[index % palette.length];
  const image = api.galleries?.find((gallery) => gallery.mediaAsset?.publicUrl)?.mediaAsset?.publicUrl ?? "";
  const tagDetails = parseJsonSafe<{ ingredients?: string; howToUse?: string; size?: string; scent?: string; tagline?: string }>(api.shortDescription ?? "");

  return {
    id: api.id,
    slug: api.slug,
    variantId: primaryVariant?.id ?? null,
    name: api.name,
    tagline: tagDetails?.tagline ?? api.shortDescription ?? "",
    price: primaryVariant?.salePrice ?? primaryVariant?.price ?? 0,
    originalPrice: primaryVariant?.salePrice ? primaryVariant.price : undefined,
    category: api.category?.name ?? "Products",
    color: colorSet.color,
    bgColor: colorSet.bgColor,
    textColor: colorSet.textColor,
    image,
    description: api.description ?? "",
    ingredients: tagDetails?.ingredients ?? "",
    howToUse: tagDetails?.howToUse ?? "",
    size: tagDetails?.size ?? "",
    rating: 5,
    reviews: 0,
    badge: api.featured ? "BESTSELLER" : undefined,
    inStock: (primaryVariant?.inventoryLevel?.quantityOnHand ?? 0) > 0,
    scent: tagDetails?.scent,
  };
}

export async function fetchStoreProducts(): Promise<Product[]> {
  const response = await fetch(`${API_BASE}/store/products?perPage=100&sortBy=createdAt&sortDir=desc`);
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error?.message || "Failed to load products");
  }
  const items = (payload?.data?.items || []) as StorefrontProductApi[];
  return items.map((item, index) => toProduct(item, index));
}

export async function fetchStoreProductById(productId: string): Promise<Product | null> {
  const response = await fetch(`${API_BASE}/store/products/${productId}`);
  const payload = await response.json().catch(() => null);
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(payload?.error?.message || "Failed to load product");
  }
  return toProduct(payload.data as StorefrontProductApi, 0);
}

export function getCategories(products: Product[]) {
  return ["All", ...new Set(products.map((product) => product.category))];
}
