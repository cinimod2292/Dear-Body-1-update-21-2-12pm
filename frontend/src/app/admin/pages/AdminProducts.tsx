import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiRequest } from "../api/client";
import { useAdminAuth } from "../context/AdminAuthContext";
import { AdminPagination } from "../components/AdminPagination";
import { EmptyState, ErrorState, LoadingState } from "../components/AdminState";
import { AdminTable } from "../components/AdminTable";
import { AdminProduct, PaginatedResult } from "../types/admin";
import { toast } from "sonner";

interface ProductListResponse {
  data: PaginatedResult<AdminProduct>;
}

export default function AdminProducts() {
  const { session } = useAdminAuth();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<PaginatedResult<AdminProduct> | null>(null);
  const [selected, setSelected] = useState<string[]>([]);

  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", slug: "", status: "DRAFT", visibility: "PUBLIC" });

  const params = useMemo(() => {
    const sp = new URLSearchParams({ page: String(page), perPage: "12", sortBy: "updatedAt", sortDir: "desc" });
    if (query) sp.set("q", query);
    if (status !== "ALL") sp.set("status", status);
    return sp.toString();
  }, [page, query, status]);

  const loadProducts = async () => {
    if (!session?.accessToken) return;
    try {
      setLoading(true);
      setError(null);
      const res = await apiRequest<ProductListResponse>(`/admin/products?${params}`, {}, session.accessToken);
      setPayload(res.data);
      setSelected([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [session?.accessToken, params]);

  const createProduct = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.accessToken) return;

    try {
      setCreating(true);
      await apiRequest("/admin/products", {
        method: "POST",
        body: JSON.stringify(form),
      }, session.accessToken);
      toast.success("Product created");
      setShowCreate(false);
      setForm({ name: "", slug: "", status: "DRAFT", visibility: "PUBLIC" });
      await loadProducts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create product");
    } finally {
      setCreating(false);
    }
  };

  const applyBulk = async (action: "set_status" | "set_featured", extra: Record<string, unknown>) => {
    if (!session?.accessToken || selected.length === 0) return;
    try {
      await apiRequest("/admin/products/bulk", {
        method: "POST",
        body: JSON.stringify({ productIds: selected, action, ...extra }),
      }, session.accessToken);
      toast.success("Bulk action applied");
      await loadProducts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bulk update failed");
    }
  };

  if (loading) return <LoadingState label="Loading products..." />;
  if (error) return <ErrorState message={error} onRetry={loadProducts} />;
  if (!payload) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-gray-900">Products</h2>
          <p className="text-sm text-gray-500">Manage product catalog, statuses, and visibility.</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm">Add Product</button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-3 md:p-4 flex flex-col md:flex-row gap-3 md:items-center">
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
          placeholder="Search by name or slug"
          className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
        />
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
        >
          <option value="ALL">All Statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="ACTIVE">Active</option>
          <option value="ARCHIVED">Archived</option>
        </select>
      </div>

      {selected.length > 0 && (
        <div className="bg-pink-50 border border-pink-200 rounded-xl p-3 flex flex-wrap items-center gap-2">
          <span className="text-sm text-pink-700 font-medium">{selected.length} selected</span>
          <button className="px-3 py-1.5 rounded-lg bg-white border border-pink-200 text-xs" onClick={() => applyBulk("set_status", { status: "ACTIVE" })}>Set Active</button>
          <button className="px-3 py-1.5 rounded-lg bg-white border border-pink-200 text-xs" onClick={() => applyBulk("set_status", { status: "ARCHIVED" })}>Set Archived</button>
          <button className="px-3 py-1.5 rounded-lg bg-white border border-pink-200 text-xs" onClick={() => applyBulk("set_featured", { featured: true })}>Feature</button>
        </div>
      )}

      {payload.items.length === 0 ? (
        <EmptyState label="No products found for the selected filters." />
      ) : (
        <AdminTable
          rows={payload.items}
          columns={[
            {
              key: "select",
              header: "",
              render: (item) => (
                <input
                  type="checkbox"
                  checked={selected.includes(item.id)}
                  onChange={(e) => setSelected((prev) => (e.target.checked ? [...prev, item.id] : prev.filter((id) => id !== item.id)))}
                />
              ),
            },
            { key: "name", header: "Product", render: (item) => <div><p className="font-semibold">{item.name}</p><p className="text-xs text-gray-500">/{item.slug}</p></div> },
            { key: "status", header: "Status", render: (item) => <span className="text-xs px-2 py-1 rounded-full bg-gray-100">{item.status}</span> },
            { key: "visibility", header: "Visibility", render: (item) => <span className="text-xs">{item.visibility}</span> },
            {
              key: "pricing",
              header: "Pricing",
              render: (item) => {
                const first = item.variants?.[0];
                if (!first) return <span className="text-xs text-gray-400">No variants</span>;
                return <div className="text-xs"><p>${Number(first.price).toFixed(2)}</p>{first.salePrice ? <p className="text-green-600">Sale ${Number(first.salePrice).toFixed(2)}</p> : null}</div>;
              },
            },
            {
              key: "stock",
              header: "Stock",
              render: (item) => {
                const total = (item.variants ?? []).reduce((sum, v) => sum + (v.inventoryLevel?.quantityOnHand ?? 0), 0);
                return <span className={`text-xs font-medium ${total <= 0 ? "text-red-600" : "text-gray-700"}`}>{total}</span>;
              },
            },
          ]}
        />
      )}

      <AdminPagination page={payload.page} totalPages={payload.totalPages} onChange={setPage} />

      {showCreate && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-40">
          <form onSubmit={createProduct} className="w-full max-w-lg bg-white rounded-2xl p-6 shadow-xl border border-gray-100">
            <h3 className="text-lg font-bold text-gray-900">Create Product</h3>
            <p className="text-sm text-gray-500 mb-4">Create a new catalog product. Variants can be added next.</p>
            <div className="space-y-3">
              <input className="w-full rounded-lg border border-gray-200 px-3 py-2" placeholder="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
              <input className="w-full rounded-lg border border-gray-200 px-3 py-2" placeholder="Slug" value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} required />
              <div className="grid grid-cols-2 gap-3">
                <select className="rounded-lg border border-gray-200 px-3 py-2" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                  <option value="DRAFT">Draft</option>
                  <option value="ACTIVE">Active</option>
                  <option value="ARCHIVED">Archived</option>
                </select>
                <select className="rounded-lg border border-gray-200 px-3 py-2" value={form.visibility} onChange={(e) => setForm((f) => ({ ...f, visibility: e.target.value }))}>
                  <option value="PUBLIC">Public</option>
                  <option value="HIDDEN">Hidden</option>
                  <option value="PRIVATE">Private</option>
                </select>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg border border-gray-200">Cancel</button>
              <button type="submit" disabled={creating} className="px-4 py-2 rounded-lg bg-gray-900 text-white disabled:opacity-70">{creating ? "Creating..." : "Create"}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
