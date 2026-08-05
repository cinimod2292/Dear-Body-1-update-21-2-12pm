import { API_BASE } from "../lib/api";
import { apiRequest } from "../admin/api/client";

export type BlogBlock = { type: string; text?: string; level?: number; url?: string; alt?: string; caption?: string; items?: string[]; faqs?: { question: string; answer: string }[]; productId?: string; html?: string; href?: string; label?: string };
export type BlogArticle = { id: string; title: string; slug: string; excerpt?: string; status?: string; featured?: boolean; pinned?: boolean; heroImageUrl?: string; heroImageAlt?: string; body: BlogBlock[]; faqs?: { question: string; answer: string }[]; seoTitle?: string; metaDescription?: string; canonicalUrl?: string; metaRobots?: string; seoScore?: number; readingTime: number; wordCount?: number; viewCount?: number; productClicks?: number; publishedAt?: string; updatedAt?: string; category?: { name: string; slug: string }; author?: { name: string; photoUrl?: string; bio?: string; role?: string }; products?: { product: any; role: string }[] };
export type BlogCategory = { id: string; name: string; slug: string; description?: string; imageUrl?: string };

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) } });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()).data;
}

export const fetchBlogIndex = (params = "") => json<{ articles: BlogArticle[]; categories: BlogCategory[] }>(`/store/blog${params}`);
export const fetchBlogArticle = (slug: string) => json<{ article: BlogArticle; related: BlogArticle[]; previous?: BlogArticle; next?: BlogArticle }>(`/store/blog/${slug}`);
export const fetchAdminBlog = () => apiRequest<{ data: { articles: BlogArticle[]; categories: BlogCategory[] } }>("/admin/blog").then((r) => r.data);
export const fetchAdminBlogMeta = () => apiRequest<{ data: any }>("/admin/blog/meta").then((r) => r.data);
export const saveAdminArticle = (article: Partial<BlogArticle> & Record<string, unknown>) => apiRequest<{ data: BlogArticle }>(article.id ? `/admin/blog/articles/${article.id}` : "/admin/blog/articles", { method: article.id ? "PUT" : "POST", body: JSON.stringify(article) }).then((r) => r.data);
export const generateArticleDraft = (input: Record<string, unknown>) => apiRequest<{ data: Partial<BlogArticle> }>("/admin/blog/generate", { method: "POST", body: JSON.stringify(input) }).then((r) => r.data);
export const duplicateArticle = (id: string) => apiRequest<{ data: BlogArticle }>(`/admin/blog/articles/${id}/duplicate`, { method: "POST" }).then((r) => r.data);
export const archiveArticle = (id: string) => apiRequest<{ data: BlogArticle }>(`/admin/blog/articles/${id}/archive`, { method: "POST" }).then((r) => r.data);
