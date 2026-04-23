import { API_BASE } from "../admin/api/client";
import { mapGallerySurfaceImages, mapProductCardImageFields, normalizeProductImages } from "../lib/product-images";

export interface Product {
  id: string;
  slug: string;
  categoryId?: string;
  variantId: string | null;
  backendVariantId?: string | null;
  name: string;
  tagline: string;
  price: number;
  originalPrice?: number;
  category: string;
  color: string;
  bgColor: string;
  textColor: string;
  image: string;
  imageWidth?: number;
  imageHeight?: number;
  image2x?: string;
  hoverImage?: string;
  hoverImage2x?: string;
  hoverImageWidth?: number;
  hoverImageHeight?: number;
  images: string[];
  galleryImages?: Array<{
    url: string;
    width?: number;
    height?: number;
    thumbUrl?: string;
    mainUrl?: string;
    main2xUrl?: string;
    lightboxUrl?: string;
    lightbox2xUrl?: string;
  }>;
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
  category?: { id: string; name: string } | null;
  featured?: boolean;
  hoverImageId?: string | null;
  galleries?: Array<{
    mediaAssetId: string;
    mediaAsset?: {
      publicUrl?: string | null;
      metadata?: Record<string, unknown> | null;
      variants?: Array<{ key: string; publicUrl?: string | null; width?: number; height?: number }> | null;
    } | null;
  }>;
  variants?: Array<{
    id: string;
    isActive?: boolean;
    price: number;
    salePrice?: number | null;
    inventoryLevel?: { quantityOnHand: number } | null;
  }>;
};

function normalizePrice(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  if (value && typeof value === "object" && "toString" in value && typeof value.toString === "function") {
    const parsed = Number(value.toString());
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}


const STORE_PRODUCTS_CACHE_KEY = "storefront_products_cache_v2";
const STORE_PRODUCTS_CACHE_TTL_MS = 60 * 1000;
let productsCache: { expiresAt: number; items: Product[] } | null = null;
let inFlightProductsRequest: Promise<Product[]> | null = null;

function readProductsCacheFromSession(): Product[] | null {
  try {
    const raw = sessionStorage.getItem(STORE_PRODUCTS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { expiresAt?: number; items?: Product[] };
    if (!parsed?.expiresAt || !Array.isArray(parsed.items)) return null;
    if (Date.now() >= parsed.expiresAt) return null;
    return parsed.items;
  } catch {
    return null;
  }
}

function writeProductsCache(items: Product[]) {
  const entry = { expiresAt: Date.now() + STORE_PRODUCTS_CACHE_TTL_MS, items };
  productsCache = entry;
  try {
    sessionStorage.setItem(STORE_PRODUCTS_CACHE_KEY, JSON.stringify(entry));
  } catch {
    // ignore storage failures
  }
}

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
  const activeVariants = (api.variants ?? []).filter((variant) => variant.isActive !== false);
  const primaryVariant = activeVariants.find((variant) => (variant.inventoryLevel?.quantityOnHand ?? 0) > 0) ?? activeVariants[0];
  const colorSet = palette[index % palette.length];
  const galleryImages = normalizeProductImages(api.galleries);
  const primaryImage = galleryImages[0];
  const cardFields = mapProductCardImageFields({
    primaryImage,
    hoverImageId: api.hoverImageId,
    galleryImages,
  });
  const tagDetails = parseJsonSafe<{ ingredients?: string; howToUse?: string; size?: string; scent?: string; tagline?: string }>(api.shortDescription ?? "");
  const basePrice = normalizePrice(primaryVariant?.price);
  const salePrice = primaryVariant?.salePrice === null || primaryVariant?.salePrice === undefined
    ? undefined
    : normalizePrice(primaryVariant.salePrice, basePrice);

  return {
    id: api.id,
    slug: api.slug,
    categoryId: api.category?.id,
    variantId: primaryVariant?.id ?? null,
    name: api.name,
    tagline: tagDetails?.tagline ?? api.shortDescription ?? "",
    price: salePrice ?? basePrice,
    originalPrice: salePrice !== undefined ? basePrice : undefined,
    category: api.category?.name ?? "Products",
    color: colorSet.color,
    bgColor: colorSet.bgColor,
    textColor: colorSet.textColor,
    image: cardFields.image,
    image2x: cardFields.image2x,
    imageWidth: cardFields.imageWidth,
    imageHeight: cardFields.imageHeight,
    hoverImage: cardFields.hoverImage,
    hoverImage2x: cardFields.hoverImage2x,
    hoverImageWidth: cardFields.hoverImageWidth,
    hoverImageHeight: cardFields.hoverImageHeight,
    images: galleryImages.map((entry) => entry.url),
    galleryImages: galleryImages.map((entry) => mapGallerySurfaceImages(entry)),
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

export async function fetchStoreProductsByQuery(query: {
  q?: string;
  categoryId?: string;
  featured?: boolean;
  perPage?: number;
  sortBy?: "createdAt" | "updatedAt" | "name" | "publishedAt";
  sortDir?: "asc" | "desc";
}): Promise<Product[]> {
  const params = new URLSearchParams({
    perPage: String(query.perPage ?? 24),
    sortBy: query.sortBy ?? "createdAt",
    sortDir: query.sortDir ?? "desc",
  });
  if (query.q) params.set("q", query.q);
  if (query.categoryId) params.set("categoryId", query.categoryId);
  if (query.featured !== undefined) params.set("featured", String(query.featured));

  const response = await fetch(`${API_BASE}/store/products?${params.toString()}`);
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error?.message || "Failed to load products");
  }
  const items = (payload?.data?.items || []) as StorefrontProductApi[];
  return items
    .map((item, index) => toProduct(item, index))
    .filter((product) => Boolean(product.variantId));
}

export async function fetchStoreProducts(forceRefresh = false): Promise<Product[]> {
  if (!forceRefresh) {
    if (productsCache && Date.now() < productsCache.expiresAt) {
      return productsCache.items;
    }

    const sessionCached = readProductsCacheFromSession();
    if (sessionCached) {
      productsCache = { expiresAt: Date.now() + STORE_PRODUCTS_CACHE_TTL_MS, items: sessionCached };
      return sessionCached;
    }

    if (inFlightProductsRequest) {
      return inFlightProductsRequest;
    }
  }

  inFlightProductsRequest = (async () => {
    const response = await fetch(`${API_BASE}/store/products?perPage=100&sortBy=createdAt&sortDir=desc`);
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.error?.message || "Failed to load products");
    }
    const items = (payload?.data?.items || []) as StorefrontProductApi[];
    const mapped = items
      .map((item, index) => toProduct(item, index))
      .filter((product) => Boolean(product.variantId));
    writeProductsCache(mapped);
    return mapped;
  })();

  try {
    return await inFlightProductsRequest;
  } finally {
    inFlightProductsRequest = null;
  }
}

export async function fetchStoreProductById(productId: string): Promise<Product | null> {
  const response = await fetch(`${API_BASE}/store/products/${productId}`);
  const payload = await response.json().catch(() => null);
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(payload?.error?.message || "Failed to load product");
  }
  const mapped = toProduct(payload.data as StorefrontProductApi, 0);
  if (!mapped.variantId) return null;
  return mapped;
}

export function getCategories(products: Product[]) {
  return ["All", ...new Set(products.map((product) => product.category))];
}

