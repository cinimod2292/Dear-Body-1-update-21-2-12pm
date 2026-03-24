export interface AdminSession {
  accessToken: string;
  refreshToken?: string;
  accessTokenExpiresAt?: string;
  refreshTokenExpiresAt?: string;
  permissions: string[];
  email: string;
  role: string;
  id: string;
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
  sortBy: string;
  sortDir: "asc" | "desc";
}

export interface AdminProduct {
  id: string;
  name: string;
  slug: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  visibility: "PUBLIC" | "HIDDEN" | "PRIVATE";
  featured: boolean;
  brandId?: string | null;
  categoryId?: string | null;
  brand?: { id: string; name: string } | null;
  category?: { id: string; name: string } | null;
  variants?: Array<{ id: string; sku: string; price: number; salePrice?: number | null; inventoryLevel?: { quantityOnHand: number; lowStockThreshold: number } | null }>;
  updatedAt: string;
}

export interface MediaAsset {
  id: string;
  filename: string;
  publicUrl?: string;
  mimeType: string;
  byteSize: number;
  createdAt: string;
}
