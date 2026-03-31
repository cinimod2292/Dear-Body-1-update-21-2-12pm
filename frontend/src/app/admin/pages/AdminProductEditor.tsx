import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { apiRequest } from "../api/client";
import { useAdminAuth } from "../context/AdminAuthContext";
import { EmptyState, ErrorState, LoadingState } from "../components/AdminState";
import { toast } from "sonner";
import { formatRand } from "../../lib/currency";

interface Brand { id: string; name: string }
interface Category { id: string; name: string }
interface Tag { id: string; name: string }
interface MediaAsset { id: string; filename: string; publicUrl?: string; mimeType: string }
interface Attribute { id: string; name: string; options: Array<{ id: string; value: string }> }

interface Variant {
  id: string;
  title?: string;
  sku: string;
  price: number;
  salePrice?: number | null;
  costPrice?: number | null;
  inventoryLevel?: { quantityOnHand: number; lowStockThreshold: number } | null;
  attributeValues?: Array<{ attributeId: string; optionId: string; attribute?: { name: string }; option?: { value: string } }>;
}

interface Product {
  id: string;
  name: string;
  slug: string;
  description?: string;
  shortDescription?: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  visibility: "PUBLIC" | "HIDDEN" | "PRIVATE";
  featured: boolean;
  brandId?: string | null;
  categoryId?: string | null;
  seoMetadata?: { title?: string; description?: string; canonicalUrl?: string; ogTitle?: string; ogDescription?: string; ogImageUrl?: string } | null;
  tags?: Array<{ tagId: string }>;
  galleries?: Array<{ mediaAssetId: string }>;
  variants?: Variant[];
}

export default function AdminProductEditor() {
  const { session } = useAdminAuth();
  const { productId } = useParams();
  const navigate = useNavigate();
  const isNew = productId === "new";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [attributes, setAttributes] = useState<Attribute[]>([]);

  const [product, setProduct] = useState<Product>({
    id: "",
    name: "",
    slug: "",
    description: "",
    shortDescription: "",
    status: "DRAFT",
    visibility: "PUBLIC",
    featured: false,
    brandId: "",
    categoryId: "",
    seoMetadata: {},
    tags: [],
    galleries: [],
    variants: [],
  });

  const [newVariant, setNewVariant] = useState({
    title: "",
    sku: "",
    price: "",
    salePrice: "",
    costPrice: "",
    quantityOnHand: "0",
    lowStockThreshold: "5",
    selectedAttributeValues: {} as Record<string, string>,
  });

  const [adjustQty, setAdjustQty] = useState<Record<string, string>>({});
  const [movements, setMovements] = useState<Record<string, Array<{ id: string; quantityDelta: number; reason?: string; createdAt: string }>>>({});

  const load = async () => {
    if (!session?.accessToken) return;
    try {
      setLoading(true);
      setError(null);

      const [brandsRes, categoriesRes, tagsRes, mediaRes, attrsRes] = await Promise.all([
        apiRequest<{ data: { items: Brand[] } }>("/admin/brands?page=1&perPage=200", {}, session.accessToken),
        apiRequest<{ data: { items: Category[] } }>("/admin/categories?page=1&perPage=200", {}, session.accessToken),
        apiRequest<{ data: { items: Tag[] } }>("/admin/tags?page=1&perPage=200", {}, session.accessToken),
        apiRequest<{ data: { items: MediaAsset[] } }>("/admin/media?page=1&perPage=200", {}, session.accessToken),
        apiRequest<{ data: Attribute[] }>("/admin/attributes", {}, session.accessToken),
      ]);

      setBrands(brandsRes.data.items);
      setCategories(categoriesRes.data.items);
      setTags(tagsRes.data.items);
      setMediaAssets(mediaRes.data.items);
      setAttributes(attrsRes.data);

      if (!isNew && productId) {
        const productRes = await apiRequest<{ data: Product }>(`/admin/products/${productId}`, {}, session.accessToken);
        const found = productRes.data;
        setProduct({ ...found, brandId: found.brandId ?? "", categoryId: found.categoryId ?? "", seoMetadata: found.seoMetadata ?? {}, tags: found.tags ?? [], galleries: found.galleries ?? [], variants: found.variants ?? [] });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load product editor");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [session?.accessToken, productId]);

  const selectedTagIds = useMemo(() => (product.tags ?? []).map((t) => t.tagId), [product.tags]);
  const selectedMediaIds = useMemo(() => (product.galleries ?? []).map((g) => g.mediaAssetId), [product.galleries]);
  const selectedMediaAssets = useMemo(
    () => selectedMediaIds
      .map((mediaId) => mediaAssets.find((asset) => asset.id === mediaId))
      .filter((asset): asset is MediaAsset => Boolean(asset)),
    [selectedMediaIds, mediaAssets],
  );

  const reorderGallery = (mediaAssetId: string, direction: "up" | "down") => {
    setProduct((prev) => {
      const current = [...(prev.galleries ?? [])];
      const idx = current.findIndex((entry) => entry.mediaAssetId === mediaAssetId);
      if (idx < 0) return prev;
      const target = direction === "up" ? idx - 1 : idx + 1;
      if (target < 0 || target >= current.length) return prev;
      [current[idx], current[target]] = [current[target], current[idx]];
      return { ...prev, galleries: current };
    });
  };

  const setPrimaryImage = (mediaAssetId: string) => {
    setProduct((prev) => {
      const current = [...(prev.galleries ?? [])];
      const idx = current.findIndex((entry) => entry.mediaAssetId === mediaAssetId);
      if (idx <= 0) return prev;
      const [selected] = current.splice(idx, 1);
      current.unshift(selected);
      return { ...prev, galleries: current };
    });
  };

  const removeGalleryImage = (mediaAssetId: string) => {
    setProduct((prev) => ({
      ...prev,
      galleries: (prev.galleries ?? []).filter((entry) => entry.mediaAssetId !== mediaAssetId),
    }));
  };

  const uploadMediaFiles = async (files: FileList | null) => {
    if (!files?.length || !session?.accessToken) return;
    try {
      setUploadingMedia(true);
      const uploadedAssets: MediaAsset[] = [];
      for (const file of Array.from(files)) {
        const kind = file.type.startsWith("image") ? "IMAGE" : file.type.startsWith("video") ? "VIDEO" : "FILE";
        const prep = await apiRequest<{ data: { uploadUrl: string; storageKey: string; method: "PUT"; headers: Record<string, string> } }>(
          "/admin/media/uploads/prepare",
          {
            method: "POST",
            body: JSON.stringify({
              filename: file.name,
              mimeType: file.type || "application/octet-stream",
              byteSize: file.size,
              kind,
            }),
          },
          session.accessToken,
        );

        let uploadResponse: Response;
        try {
          uploadResponse = await fetch(prep.data.uploadUrl, {
            method: prep.data.method,
            headers: prep.data.headers,
            body: file,
          });
        } catch (error) {
          throw new Error(
            `Browser upload request failed before reaching storage. Likely bucket CORS issue for admin origin. ${error instanceof Error ? error.message : ""}`.trim(),
          );
        }
        if (!uploadResponse.ok) throw new Error(`Upload failed for ${file.name} (${uploadResponse.status})`);

        const finalize = await apiRequest<{ data: MediaAsset }>(
          "/admin/media/uploads/finalize",
          {
            method: "POST",
            body: JSON.stringify({
              storageKey: prep.data.storageKey,
              kind,
              metadata: { byteSize: file.size, mimeType: file.type || "application/octet-stream" },
              altText: file.name,
            }),
          },
          session.accessToken,
        );
        uploadedAssets.push(finalize.data);
      }

      if (uploadedAssets.length) {
        setMediaAssets((prev) => [...uploadedAssets, ...prev.filter((asset) => !uploadedAssets.some((u) => u.id === asset.id))]);
        setProduct((prev) => {
          const existing = new Set((prev.galleries ?? []).map((entry) => entry.mediaAssetId));
          const additions = uploadedAssets
            .filter((asset) => !existing.has(asset.id))
            .map((asset) => ({ mediaAssetId: asset.id }));
          return { ...prev, galleries: [...(prev.galleries ?? []), ...additions] };
        });
      }
      toast.success(`${uploadedAssets.length} file${uploadedAssets.length === 1 ? "" : "s"} uploaded`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Image upload failed");
    } finally {
      setUploadingMedia(false);
    }
  };

  const normalizeOptionalText = (value: unknown): string | undefined => {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  };

  const saveProduct = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.accessToken) return;

    const seoPayload = (() => {
      const seo = product.seoMetadata;
      if (!seo || typeof seo !== "object") return undefined;

      const normalized = {
        title: typeof seo.title === "string" && seo.title.trim() ? seo.title.trim() : undefined,
        description: typeof seo.description === "string" && seo.description.trim() ? seo.description.trim() : undefined,
        canonicalUrl: typeof seo.canonicalUrl === "string" && seo.canonicalUrl.trim() ? seo.canonicalUrl.trim() : undefined,
        ogTitle: typeof seo.ogTitle === "string" && seo.ogTitle.trim() ? seo.ogTitle.trim() : undefined,
        ogDescription: typeof seo.ogDescription === "string" && seo.ogDescription.trim() ? seo.ogDescription.trim() : undefined,
        ogImageUrl: typeof seo.ogImageUrl === "string" && seo.ogImageUrl.trim() ? seo.ogImageUrl.trim() : undefined,
      };

      return Object.values(normalized).some(Boolean) ? normalized : undefined;
    })();

    const payload = {
      name: product.name,
      slug: product.slug,
      description: normalizeOptionalText(product.description),
      shortDescription: normalizeOptionalText(product.shortDescription),
      status: product.status,
      visibility: product.visibility,
      featured: product.featured,
      brandId: product.brandId || undefined,
      categoryId: product.categoryId || undefined,
      seo: seoPayload,
      tagIds: selectedTagIds,
      gallery: selectedMediaIds.map((id, idx) => ({ mediaAssetId: id, position: idx })),
    };

    try {
      setSaving(true);
      if (isNew) {
        const created = await apiRequest<{ data: { id: string } }>("/admin/products", { method: "POST", body: JSON.stringify(payload) }, session.accessToken);
        toast.success("Product created");
        navigate(`/admin/products/${created.data.id}`, { replace: true });
      } else {
        await apiRequest(`/admin/products/${productId}`, { method: "PATCH", body: JSON.stringify(payload) }, session.accessToken);
        toast.success("Product updated");
        await load();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save product");
    } finally {
      setSaving(false);
    }
  };

  const addVariant = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.accessToken || isNew || !productId) return;

    const attrs = Object.entries(newVariant.selectedAttributeValues)
      .filter(([, optionId]) => optionId)
      .map(([attributeId, optionId]) => ({ attributeId, optionId }));

    try {
      await apiRequest(`/admin/products/${productId}/variants`, {
        method: "POST",
        body: JSON.stringify({
          title: newVariant.title,
          sku: newVariant.sku,
          price: Number(newVariant.price),
          salePrice: newVariant.salePrice ? Number(newVariant.salePrice) : undefined,
          costPrice: newVariant.costPrice ? Number(newVariant.costPrice) : undefined,
          quantityOnHand: Number(newVariant.quantityOnHand),
          lowStockThreshold: Number(newVariant.lowStockThreshold),
          attributes: attrs,
        }),
      }, session.accessToken);

      toast.success("Variant added");
      setNewVariant({ title: "", sku: "", price: "", salePrice: "", costPrice: "", quantityOnHand: "0", lowStockThreshold: "5", selectedAttributeValues: {} });
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add variant");
    }
  };

  const adjustStock = async (variantId: string) => {
    if (!session?.accessToken) return;
    const delta = Number(adjustQty[variantId] ?? 0);
    if (!delta) return;

    try {
      await apiRequest("/admin/inventory/adjust", {
        method: "POST",
        body: JSON.stringify({
          variantId,
          quantityDelta: delta,
          reason: "Manual adjustment from admin product editor",
          referenceType: "ADMIN_UI",
        }),
      }, session.accessToken);
      toast.success("Stock adjusted");
      setAdjustQty((prev) => ({ ...prev, [variantId]: "" }));
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Stock adjustment failed");
    }
  };

  const loadMovements = async (variantId: string) => {
    if (!session?.accessToken) return;
    try {
      const res = await apiRequest<{ data: Array<{ id: string; quantityDelta: number; reason?: string; createdAt: string }> }>(`/admin/inventory/variants/${variantId}/movements`, {}, session.accessToken);
      setMovements((prev) => ({ ...prev, [variantId]: res.data }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load stock movements");
    }
  };

  if (loading) return <LoadingState label="Loading product workspace..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link to="/admin/products" className="text-sm text-gray-500 hover:text-gray-900">← Back to Products</Link>
          <h2 className="text-2xl font-black text-gray-900 mt-1">{isNew ? "Create Product" : `Edit Product: ${product.name}`}</h2>
          <p className="text-sm text-gray-500">Manage core data, media, SEO, variants, pricing, and inventory in one place.</p>
        </div>
      </div>

      <form onSubmit={saveProduct} className="space-y-5">
        <section className="bg-white border border-gray-200 rounded-xl p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input className="w-full rounded-lg border border-gray-200 px-3 py-2" value={product.name} onChange={(e) => setProduct((p) => ({ ...p, name: e.target.value }))} required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Slug</label>
            <input className="w-full rounded-lg border border-gray-200 px-3 py-2" value={product.slug} onChange={(e) => setProduct((p) => ({ ...p, slug: e.target.value }))} required />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Short Description</label>
            <input className="w-full rounded-lg border border-gray-200 px-3 py-2" value={product.shortDescription ?? ""} onChange={(e) => setProduct((p) => ({ ...p, shortDescription: e.target.value }))} />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea className="w-full rounded-lg border border-gray-200 px-3 py-2 min-h-28" value={product.description ?? ""} onChange={(e) => setProduct((p) => ({ ...p, description: e.target.value }))} />
          </div>
        </section>

        <section className="bg-white border border-gray-200 rounded-xl p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Brand</label>
            <select className="w-full rounded-lg border border-gray-200 px-3 py-2" value={product.brandId ?? ""} onChange={(e) => setProduct((p) => ({ ...p, brandId: e.target.value }))}>
              <option value="">Unassigned</option>
              {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Category</label>
            <select className="w-full rounded-lg border border-gray-200 px-3 py-2" value={product.categoryId ?? ""} onChange={(e) => setProduct((p) => ({ ...p, categoryId: e.target.value }))}>
              <option value="">Unassigned</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Status</label>
            <select className="w-full rounded-lg border border-gray-200 px-3 py-2" value={product.status} onChange={(e) => setProduct((p) => ({ ...p, status: e.target.value as Product["status"] }))}>
              <option value="DRAFT">Draft</option>
              <option value="ACTIVE">Active</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Visibility</label>
            <select className="w-full rounded-lg border border-gray-200 px-3 py-2" value={product.visibility} onChange={(e) => setProduct((p) => ({ ...p, visibility: e.target.value as Product["visibility"] }))}>
              <option value="PUBLIC">Public</option>
              <option value="HIDDEN">Hidden</option>
              <option value="PRIVATE">Private</option>
            </select>
          </div>
          <label className="flex items-center gap-2 pt-8">
            <input type="checkbox" checked={product.featured} onChange={(e) => setProduct((p) => ({ ...p, featured: e.target.checked }))} />
            <span className="text-sm">Featured product</span>
          </label>
        </section>

        <section className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-bold mb-3">Tags</h3>
          {tags.length === 0 ? <EmptyState label="No tags yet. Create tags in Catalog Setup." /> : (
            <div className="flex flex-wrap gap-2">
              {tags.map((t) => {
                const selected = selectedTagIds.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setProduct((p) => ({ ...p, tags: selected ? (p.tags ?? []).filter((x) => x.tagId !== t.id) : [...(p.tags ?? []), { tagId: t.id }] }))}
                    className={`px-3 py-1.5 rounded-full text-xs border ${selected ? "bg-pink-50 border-pink-300 text-pink-700" : "border-gray-200"}`}
                  >
                    {t.name}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-bold mb-3">Media Gallery</h3>
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-xs text-gray-500">Manage linked product images, upload new ones, and set display order.</p>
            <label className="inline-flex items-center px-3 py-2 rounded-lg bg-gray-900 text-white text-xs cursor-pointer">
              {uploadingMedia ? "Uploading..." : "Upload Image(s)"}
              <input
                type="file"
                multiple
                className="hidden"
                disabled={uploadingMedia}
                onChange={(event) => {
                  uploadMediaFiles(event.target.files);
                  event.target.value = "";
                }}
              />
            </label>
          </div>
          <div className="mb-5">
            <h4 className="text-sm font-semibold mb-2">Linked Images</h4>
            {selectedMediaAssets.length === 0 ? (
              <p className="text-xs text-gray-500">No images linked yet.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {selectedMediaAssets.map((asset, index) => (
                  <div key={asset.id} className="rounded-lg border border-gray-200 p-2">
                    <div className="aspect-square bg-gray-100 rounded overflow-hidden flex items-center justify-center">
                      {asset.publicUrl && asset.mimeType.startsWith("image")
                        ? <img src={asset.publicUrl} alt={asset.filename} className="w-full h-full object-cover" />
                        : <span className="text-[10px] text-gray-500">{asset.mimeType}</span>}
                    </div>
                    <p className="mt-2 text-[11px] truncate">{asset.filename}</p>
                    <p className="text-[10px] text-gray-400">{index === 0 ? "Primary image" : `Position ${index + 1}`}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <button type="button" onClick={() => reorderGallery(asset.id, "up")} disabled={index === 0} className="px-2 py-1 rounded border border-gray-200 text-[11px] disabled:opacity-50">↑</button>
                      <button type="button" onClick={() => reorderGallery(asset.id, "down")} disabled={index === selectedMediaAssets.length - 1} className="px-2 py-1 rounded border border-gray-200 text-[11px] disabled:opacity-50">↓</button>
                      <button type="button" onClick={() => setPrimaryImage(asset.id)} disabled={index === 0} className="px-2 py-1 rounded border border-gray-200 text-[11px] disabled:opacity-50">Set Primary</button>
                      <button type="button" onClick={() => removeGalleryImage(asset.id)} className="px-2 py-1 rounded border border-red-200 text-red-600 text-[11px]">Unlink</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {mediaAssets.length === 0 ? <EmptyState label="No media found. Upload files from Media page." /> : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {mediaAssets.map((m) => {
                const selected = selectedMediaIds.includes(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setProduct((p) => ({ ...p, galleries: selected ? (p.galleries ?? []).filter((g) => g.mediaAssetId !== m.id) : [...(p.galleries ?? []), { mediaAssetId: m.id }] }))}
                    className={`border rounded-lg p-2 text-left ${selected ? "border-pink-400 bg-pink-50" : "border-gray-200"}`}
                  >
                    <div className="aspect-square bg-gray-100 rounded overflow-hidden flex items-center justify-center">
                      {m.publicUrl && m.mimeType.startsWith("image") ? <img src={m.publicUrl} className="w-full h-full object-cover" /> : <span className="text-[10px] text-gray-500">{m.mimeType}</span>}
                    </div>
                    <p className="mt-1 text-[11px] truncate">{m.filename}</p>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="bg-white border border-gray-200 rounded-xl p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <h3 className="font-bold md:col-span-2">SEO</h3>
          <input className="rounded-lg border border-gray-200 px-3 py-2" placeholder="SEO Title" value={product.seoMetadata?.title ?? ""} onChange={(e) => setProduct((p) => ({ ...p, seoMetadata: { ...(p.seoMetadata ?? {}), title: e.target.value } }))} />
          <input className="rounded-lg border border-gray-200 px-3 py-2" placeholder="Canonical URL" value={product.seoMetadata?.canonicalUrl ?? ""} onChange={(e) => setProduct((p) => ({ ...p, seoMetadata: { ...(p.seoMetadata ?? {}), canonicalUrl: e.target.value } }))} />
          <textarea className="md:col-span-2 rounded-lg border border-gray-200 px-3 py-2" placeholder="SEO Description" value={product.seoMetadata?.description ?? ""} onChange={(e) => setProduct((p) => ({ ...p, seoMetadata: { ...(p.seoMetadata ?? {}), description: e.target.value } }))} />
        </section>

        <div className="flex justify-end">
          <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm disabled:opacity-70">{saving ? "Saving..." : "Save Product"}</button>
        </div>
      </form>

      {!isNew && (
        <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h3 className="font-bold">Variants, Pricing & Inventory</h3>

          {(product.variants ?? []).length === 0 ? <EmptyState label="No variants yet. Add your first variant below." /> : (
            <div className="space-y-3">
              {(product.variants ?? []).map((v) => (
                <div key={v.id} className="rounded-lg border border-gray-100 p-3">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <div>
                      <p className="font-medium text-sm">{v.title || "Variant"} · {v.sku}</p>
                      <p className="text-xs text-gray-500">Price {formatRand(Number(v.price))}{v.salePrice ? ` · Sale ${formatRand(Number(v.salePrice))}` : ""}{v.costPrice ? ` · Cost ${formatRand(Number(v.costPrice))}` : ""}</p>
                      <p className="text-xs text-gray-500">Stock {v.inventoryLevel?.quantityOnHand ?? 0} (Low stock at {v.inventoryLevel?.lowStockThreshold ?? 0})</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input className="w-20 rounded-lg border border-gray-200 px-2 py-1 text-sm" placeholder="±Qty" value={adjustQty[v.id] ?? ""} onChange={(e) => setAdjustQty((p) => ({ ...p, [v.id]: e.target.value }))} />
                      <button className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs" onClick={() => adjustStock(v.id)}>Adjust</button>
                      <button className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs" onClick={() => loadMovements(v.id)}>Movements</button>
                    </div>
                  </div>

                  {movements[v.id]?.length ? (
                    <div className="mt-3 border-t border-gray-100 pt-3 space-y-1">
                      {movements[v.id].slice(0, 6).map((m) => (
                        <div key={m.id} className="text-xs text-gray-600 flex items-center justify-between">
                          <span>{m.reason || "Movement"}</span>
                          <span className={m.quantityDelta >= 0 ? "text-green-600" : "text-red-600"}>{m.quantityDelta >= 0 ? `+${m.quantityDelta}` : m.quantityDelta}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}

          <form onSubmit={addVariant} className="rounded-lg border border-dashed border-gray-300 p-4 space-y-3">
            <h4 className="font-semibold text-sm">Add Variant</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input className="rounded-lg border border-gray-200 px-3 py-2" placeholder="Title" value={newVariant.title} onChange={(e) => setNewVariant((v) => ({ ...v, title: e.target.value }))} />
              <input className="rounded-lg border border-gray-200 px-3 py-2" placeholder="SKU" value={newVariant.sku} onChange={(e) => setNewVariant((v) => ({ ...v, sku: e.target.value }))} required />
              <input className="rounded-lg border border-gray-200 px-3 py-2" placeholder="Price" type="number" min="0" step="0.01" value={newVariant.price} onChange={(e) => setNewVariant((v) => ({ ...v, price: e.target.value }))} required />
              <input className="rounded-lg border border-gray-200 px-3 py-2" placeholder="Sale price" type="number" min="0" step="0.01" value={newVariant.salePrice} onChange={(e) => setNewVariant((v) => ({ ...v, salePrice: e.target.value }))} />
              <input className="rounded-lg border border-gray-200 px-3 py-2" placeholder="Cost price" type="number" min="0" step="0.01" value={newVariant.costPrice} onChange={(e) => setNewVariant((v) => ({ ...v, costPrice: e.target.value }))} />
              <input className="rounded-lg border border-gray-200 px-3 py-2" placeholder="Quantity" type="number" value={newVariant.quantityOnHand} onChange={(e) => setNewVariant((v) => ({ ...v, quantityOnHand: e.target.value }))} />
              <input className="rounded-lg border border-gray-200 px-3 py-2" placeholder="Low stock threshold" type="number" value={newVariant.lowStockThreshold} onChange={(e) => setNewVariant((v) => ({ ...v, lowStockThreshold: e.target.value }))} />
            </div>

            {attributes.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {attributes.map((attr) => (
                  <select
                    key={attr.id}
                    className="rounded-lg border border-gray-200 px-3 py-2"
                    value={newVariant.selectedAttributeValues[attr.id] ?? ""}
                    onChange={(e) => setNewVariant((v) => ({ ...v, selectedAttributeValues: { ...v.selectedAttributeValues, [attr.id]: e.target.value } }))}
                  >
                    <option value="">{attr.name}</option>
                    {attr.options.map((opt) => <option key={opt.id} value={opt.id}>{opt.value}</option>)}
                  </select>
                ))}
              </div>
            )}

            <button className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm">Add Variant</button>
          </form>
        </section>
      )}
    </div>
  );
}
