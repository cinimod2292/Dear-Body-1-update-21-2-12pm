import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
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
  const [sortBy, setSortBy] = useState("updatedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<PaginatedResult<AdminProduct> | null>(null);
  const [selected, setSelected] = useState<string[]>([]);

  const params = useMemo(() => {
    const sp = new URLSearchParams({ page: String(page), perPage: "12", sortBy, sortDir });
    if (query) sp.set("q", query);
    if (status !== "ALL") sp.set("status", status);
    if (featuredOnly) sp.set("featured", "true");
    return sp.toString();
  }, [page, query, status, sortBy, sortDir, featuredOnly]);

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

  useEffect(() => { loadProducts(); }, [session?.accessToken, params]);

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
          <h2 className="text-2xl font-black text-gray-900">Product Management</h2>
          <p className="text-sm text-gray-500">Daily operations for catalog, status, visibility, featured and inventory access.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/admin/catalog-setup" className="px-4 py-2 rounded-lg border border-gray-200 text-sm">Manage Brands/Categories</Link>
          <Link to="/admin/products/new" className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm">Create Product</Link>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-3 md:p-4 grid grid-cols-1 md:grid-cols-5 gap-3">
        <input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Search name or slug" className="md:col-span-2 rounded-lg border border-gray-200 px-3 py-2 text-sm" />
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="rounded-lg border border-gray-200 px-3 py-2 text-sm">
          <option value="ALL">All Statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="ACTIVE">Active</option>
          <option value="ARCHIVED">Archived</option>
        </select>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm">
          <option value="updatedAt">Updated</option>
          <option value="name">Name</option>
          <option value="createdAt">Created</option>
          <option value="publishedAt">Published</option>
        </select>
        <button onClick={() => setSortDir((d) => d === "desc" ? "asc" : "desc")} className="rounded-lg border border-gray-200 px-3 py-2 text-sm">Sort {sortDir === "desc" ? "↓" : "↑"}</button>
        <label className="md:col-span-5 inline-flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" checked={featuredOnly} onChange={(e) => { setFeaturedOnly(e.target.checked); setPage(1); }} />
          Show featured products only
        </label>
      </div>

      {selected.length > 0 && (
        <div className="bg-pink-50 border border-pink-200 rounded-xl p-3 flex flex-wrap items-center gap-2">
          <span className="text-sm text-pink-700 font-medium">{selected.length} selected</span>
          <button className="px-3 py-1.5 rounded-lg bg-white border border-pink-200 text-xs" onClick={() => applyBulk("set_status", { status: "ACTIVE" })}>Set Active</button>
          <button className="px-3 py-1.5 rounded-lg bg-white border border-pink-200 text-xs" onClick={() => applyBulk("set_status", { status: "ARCHIVED" })}>Set Archived</button>
          <button className="px-3 py-1.5 rounded-lg bg-white border border-pink-200 text-xs" onClick={() => applyBulk("set_featured", { featured: true })}>Feature</button>
          <button className="px-3 py-1.5 rounded-lg bg-white border border-pink-200 text-xs" onClick={() => applyBulk("set_featured", { featured: false })}>Unfeature</button>
        </div>
      )}

      {payload.items.length === 0 ? (
        <EmptyState label="No products found for current filters." />
      ) : (
        <AdminTable
          rows={payload.items}
          columns={[
            { key: "select", header: "", render: (item) => <input type="checkbox" checked={selected.includes(item.id)} onChange={(e) => setSelected((prev) => e.target.checked ? [...prev, item.id] : prev.filter((id) => id !== item.id))} /> },
            { key: "name", header: "Product", render: (item) => <div><p className="font-semibold">{item.name}</p><p className="text-xs text-gray-500">/{item.slug}</p></div> },
            { key: "status", header: "Status", render: (item) => <span className="text-xs px-2 py-1 rounded-full bg-gray-100">{item.status}</span> },
            { key: "visibility", header: "Visibility", render: (item) => <span className="text-xs">{item.visibility}</span> },
            { key: "featured", header: "Featured", render: (item) => <span className={`text-xs ${item.featured ? "text-pink-600" : "text-gray-400"}`}>{item.featured ? "Yes" : "No"}</span> },
            { key: "brand", header: "Brand", render: (item) => <span className="text-xs">{item.brand?.name || "—"}</span> },
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
              header: "Total Stock",
              render: (item) => {
                const total = (item.variants ?? []).reduce((sum, v) => sum + (v.inventoryLevel?.quantityOnHand ?? 0), 0);
                return <span className={`text-xs font-medium ${total <= 0 ? "text-red-600" : "text-gray-700"}`}>{total}</span>;
              },
            },
            { key: "actions", header: "Actions", render: (item) => <Link to={`/admin/products/${item.id}`} className="text-xs text-blue-600 hover:underline">Edit</Link> },
          ]}
        />
      )}

      <AdminPagination page={payload.page} totalPages={payload.totalPages} onChange={setPage} />
    </div>
  );
}
