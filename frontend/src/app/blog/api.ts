import { API_BASE } from "../lib/api";

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
export const fetchAdminBlog = () => json<{ articles: BlogArticle[]; categories: BlogCategory[] }>("/admin/blog", { credentials: "include" });
export const fetchAdminBlogMeta = () => json<any>("/admin/blog/meta", { credentials: "include" });
export const saveAdminArticle = (article: Partial<BlogArticle> & Record<string, unknown>) => json<BlogArticle>(article.id ? `/admin/blog/articles/${article.id}` : "/admin/blog/articles", { method: article.id ? "PUT" : "POST", credentials: "include", body: JSON.stringify(article) });
export const generateArticleDraft = (input: Record<string, unknown>) => json<Partial<BlogArticle>>("/admin/blog/generate", { method: "POST", credentials: "include", body: JSON.stringify(input) });
export const duplicateArticle = (id: string) => json<BlogArticle>(`/admin/blog/articles/${id}/duplicate`, { method: "POST", credentials: "include" });
export const archiveArticle = (id: string) => json<BlogArticle>(`/admin/blog/articles/${id}/archive`, { method: "POST", credentials: "include" });
