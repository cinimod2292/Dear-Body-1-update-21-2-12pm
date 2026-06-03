import { FormEvent, useEffect, useState } from "react";
import { apiRequest } from "../api/client";
import { useAdminAuth } from "../context/AdminAuthContext";
import { EmptyState, ErrorState, LoadingState } from "../components/AdminState";
import { toast } from "sonner";

interface Brand { id: string; name: string; slug: string; isActive: boolean }
interface Category { id: string; name: string; slug: string; parent?: { id: string; name: string } | null }
interface Tag { id: string; name: string; slug: string }

export default function AdminCatalogSetup() {
  const { session } = useAdminAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [brandForm, setBrandForm] = useState({ name: "", slug: "" });
  const [categoryForm, setCategoryForm] = useState({ name: "", slug: "", parentId: "" });
  const [tagForm, setTagForm] = useState({ name: "", slug: "" });

  const load = async () => {
    if (!session?.accessToken) return;
    try {
      setLoading(true);
      setError(null);
      const [brandsRes, categoriesRes, tagsRes] = await Promise.all([
        apiRequest<{ data: { items: Brand[] } }>("/admin/brands?page=1&perPage=200", {}, session.accessToken),
        apiRequest<{ data: { items: Category[] } }>("/admin/categories?page=1&perPage=200", {}, session.accessToken),
        apiRequest<{ data: { items: Tag[] } }>("/admin/tags?page=1&perPage=200", {}, session.accessToken),
      ]);
      setBrands(brandsRes.data.items);
      setCategories(categoriesRes.data.items);
      setTags(tagsRes.data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load catalog setup");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [session?.accessToken]);

  const createBrand = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.accessToken) return;
    try {
      await apiRequest("/admin/brands", { method: "POST", body: JSON.stringify({ ...brandForm, isActive: true }) }, session.accessToken);
      toast.success("Brand created");
      setBrandForm({ name: "", slug: "" });
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create brand");
    }
  };

  const createCategory = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.accessToken) return;
    try {
      await apiRequest("/admin/categories", {
        method: "POST",
        body: JSON.stringify({ name: categoryForm.name, slug: categoryForm.slug, parentId: categoryForm.parentId || undefined, isActive: true }),
      }, session.accessToken);
      toast.success("Category created");
      setCategoryForm({ name: "", slug: "", parentId: "" });
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create category");
    }
  };

  const createTag = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.accessToken) return;
    try {
      await apiRequest("/admin/tags", { method: "POST", body: JSON.stringify({ name: tagForm.name, slug: tagForm.slug || tagForm.name.toLowerCase().replace(/\s+/g, "-") }) }, session.accessToken);
      toast.success("Tag created");
      setTagForm({ name: "", slug: "" });
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create tag");
    }
  };

  if (loading) return <LoadingState label="Loading brands and categories..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black text-gray-900">Catalog Setup</h2>
        <p className="text-sm text-gray-500">Manage brands and categories used in product forms.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-bold text-gray-900 mb-1">Tags</h3>
          <p className="text-xs text-gray-500 mb-3">Used to label products and customers for filtering and grouping.</p>
          <form onSubmit={createTag} className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <input className="rounded-lg border border-gray-200 px-3 py-2" placeholder="Tag name" value={tagForm.name} onChange={(e) => setTagForm((f) => ({ ...f, name: e.target.value }))} required />
            <input className="rounded-lg border border-gray-200 px-3 py-2" placeholder="tag-slug (auto if blank)" value={tagForm.slug} onChange={(e) => setTagForm((f) => ({ ...f, slug: e.target.value }))} />
            <button className="md:col-span-2 px-3 py-2 rounded-lg bg-gray-900 text-white text-sm">Add Tag</button>
          </form>
          {tags.length === 0 ? <EmptyState label="No tags yet." /> : (
            <div className="flex flex-wrap gap-2">
              {tags.map((t) => (
                <span key={t.id} className="px-3 py-1 rounded-full border border-gray-200 bg-gray-50 text-sm font-medium text-gray-700">{t.name}</span>
              ))}
            </div>
          )}
        </section>

        <section className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-bold text-gray-900 mb-3">Brands</h3>
          <form onSubmit={createBrand} className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <input className="rounded-lg border border-gray-200 px-3 py-2" placeholder="Brand name" value={brandForm.name} onChange={(e) => setBrandForm((f) => ({ ...f, name: e.target.value }))} required />
            <input className="rounded-lg border border-gray-200 px-3 py-2" placeholder="brand-slug" value={brandForm.slug} onChange={(e) => setBrandForm((f) => ({ ...f, slug: e.target.value }))} required />
            <button className="md:col-span-2 px-3 py-2 rounded-lg bg-gray-900 text-white text-sm">Add Brand</button>
          </form>

          {brands.length === 0 ? <EmptyState label="No brands yet." /> : (
            <div className="space-y-2">
              {brands.map((b) => (
                <div key={b.id} className="rounded-lg border border-gray-100 px-3 py-2 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{b.name}</p>
                    <p className="text-xs text-gray-500">/{b.slug}</p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full bg-gray-100">{b.isActive ? "Active" : "Inactive"}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-bold text-gray-900 mb-3">Categories & Subcategories</h3>
          <form onSubmit={createCategory} className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <input className="rounded-lg border border-gray-200 px-3 py-2" placeholder="Category name" value={categoryForm.name} onChange={(e) => setCategoryForm((f) => ({ ...f, name: e.target.value }))} required />
            <input className="rounded-lg border border-gray-200 px-3 py-2" placeholder="category-slug" value={categoryForm.slug} onChange={(e) => setCategoryForm((f) => ({ ...f, slug: e.target.value }))} required />
            <select className="md:col-span-2 rounded-lg border border-gray-200 px-3 py-2" value={categoryForm.parentId} onChange={(e) => setCategoryForm((f) => ({ ...f, parentId: e.target.value }))}>
              <option value="">No parent (top-level category)</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button className="md:col-span-2 px-3 py-2 rounded-lg bg-gray-900 text-white text-sm">Add Category</button>
          </form>

          {categories.length === 0 ? <EmptyState label="No categories yet." /> : (
            <div className="space-y-2">
              {categories.map((c) => (
                <div key={c.id} className="rounded-lg border border-gray-100 px-3 py-2">
                  <p className="font-medium text-sm">{c.name}</p>
                  <p className="text-xs text-gray-500">/{c.slug}{c.parent ? ` · child of ${c.parent.name}` : ""}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
