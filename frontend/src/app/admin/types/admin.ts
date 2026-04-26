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
  price?: number | null;
  salePrice?: number | null;
  stockTotal?: number;
  thumbnailUrl?: string | null;
  thumbnail2xUrl?: string | null;
  updatedAt: string;
}

export interface MediaAsset {
  id: string;
  filename: string;
  kind: "IMAGE" | "VIDEO" | "FILE";
  publicUrl?: string;
  variants?: Array<{ key: string; publicUrl?: string | null; width?: number | null; height?: number | null }>;
  mimeType: string;
  byteSize: number;
  altText?: string | null;
  createdAt: string;
}
