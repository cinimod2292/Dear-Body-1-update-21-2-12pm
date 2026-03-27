import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { apiRequest, API_BASE } from "../api/client";
import { useAdminAuth } from "../context/AdminAuthContext";
import { AdminPagination } from "../components/AdminPagination";
import { EmptyState, ErrorState, LoadingState } from "../components/AdminState";
import { AdminTable } from "../components/AdminTable";
import { AdminProduct, PaginatedResult } from "../types/admin";
import { toast } from "sonner";

interface ProductListResponse {
  data: PaginatedResult<AdminProduct>;
}

interface ImportPreviewRow {
  rowNumber: number;
  sku: string;
  product_name: string;
  operation: "create" | "update" | "error";
  errors: string[];
  rowData?: Record<string, string>;
}

interface ImportPreviewSummary {
  total: number;
  creates: number;
  updates: number;
  errors: number;
}

interface ImportPreviewResponse {
  data: {
    rows: ImportPreviewRow[];
    summary: ImportPreviewSummary;
  };
}

interface ImportCommitResponse {
  data: {
    summary: {
      created: number;
      updated: number;
      failed: number;
    };
    results: Array<{ rowNumber: number; status: "created" | "updated" | "failed"; error?: string; rowData?: Record<string, string> }>;
  };
}

type UploadState = "idle" | "uploading" | "preview" | "importing" | "complete";

function BulkUploadModal({
  open,
  accessToken,
  onClose,
  onImported,
}: {
  open: boolean;
  accessToken?: string;
  onClose: () => void;
  onImported: () => Promise<void>;
}) {
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [previewRows, setPreviewRows] = useState<ImportPreviewRow[]>([]);
  const [previewSummary, setPreviewSummary] = useState<ImportPreviewSummary | null>(null);
  const [importSummary, setImportSummary] = useState<{ created: number; updated: number; failed: number } | null>(null);
  const [importResults, setImportResults] = useState<Array<{ rowNumber: number; status: "created" | "updated" | "failed"; error?: string; rowData?: Record<string, string> }>>([]);
  const [error, setError] = useState<string | null>(null);

  const fatalErrors = previewRows.some((row) => row.operation === "error");
  const failedRows = importResults.filter((row) => row.status === "failed");
  const previewErrorRows = previewRows.filter((row) => row.operation === "error");

  const csvEscape = (value: unknown) => {
    const text = String(value ?? "");
    if (/[\",\n]/.test(text)) return `"${text.replace(/"/g, "\"\"")}"`;
    return text;
  };

  const downloadCsv = (filename: string, rows: Array<Record<string, unknown>>) => {
    if (!rows.length) return;
    const headers = Array.from(
      rows.reduce((set, row) => {
        Object.keys(row).forEach((key) => set.add(key));
        return set;
      }, new Set<string>()),
    );
    const csv = [
      headers.map(csvEscape).join(","),
      ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(href);
  };

  const downloadPreviewErrors = () => {
    const rows = previewErrorRows.map((row) => ({
      row_number: row.rowNumber,
      ...(row.rowData ?? {}),
      operation: row.operation,
      error_messages: row.errors.join(" | "),
    }));
    downloadCsv("bulk-upload-preview-errors.csv", rows);
  };

  const downloadImportFailures = () => {
    const rows = failedRows.map((row) => ({
      row_number: row.rowNumber,
      ...(row.rowData ?? {}),
      status: row.status,
      error_messages: row.error ?? "",
    }));
    downloadCsv("bulk-upload-import-failures.csv", rows);
  };

  const reset = () => {
    setUploadState("idle");
    setFile(null);
    setPreviewRows([]);
    setPreviewSummary(null);
    setImportSummary(null);
    setImportResults([]);
    setError(null);
  };

  useEffect(() => {
    if (!open) reset();
  }, [open]);

  const downloadTemplate = async () => {
    if (!accessToken) return;
    try {
      const res = await fetch(`${API_BASE}/admin/products/import/template.csv`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error(`Download failed (${res.status})`);
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = "product-import-template.csv";
      a.click();
      URL.revokeObjectURL(href);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to download template");
    }
  };

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const chosen = event.target.files?.[0] ?? null;
    setFile(chosen);
    setError(null);
    setPreviewRows([]);
    setPreviewSummary(null);
    setImportSummary(null);
    setImportResults([]);
    if (chosen) setUploadState("idle");
  };

  const previewUpload = async () => {
    if (!accessToken || !file) return;

    try {
      setUploadState("uploading");
      setError(null);
      const form = new FormData();
      form.append("file", file);

      const res = await fetch(`${API_BASE}/admin/products/import/preview`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: form,
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(payload?.error?.message || `Preview failed (${res.status})`);
      }

      const data = (payload as ImportPreviewResponse).data;
      setPreviewRows(data.rows);
      setPreviewSummary(data.summary);
      setUploadState("preview");
    } catch (err) {
      setUploadState("idle");
      setError(err instanceof Error ? err.message : "Failed to preview CSV");
    }
  };

  const commitImport = async () => {
    if (!accessToken) return;
    if (!file) {
      setError("Please select a CSV file before importing");
      return;
    }

    try {
      setUploadState("importing");
      setError(null);

      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${API_BASE}/admin/products/import/commit`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: form,
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(payload?.error?.message || `Import failed (${res.status})`);
      }

      const data = (payload as ImportCommitResponse).data;
      setImportSummary(data.summary);
      setImportResults(data.results);
      setUploadState("complete");
      await onImported();
    } catch (err) {
      setUploadState("preview");
      setError(err instanceof Error ? err.message : "Import failed");
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-5xl rounded-xl border border-gray-200 shadow-xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Bulk Product Upload</h3>
            <p className="text-xs text-gray-500">Upload CSV, preview validation, then import.</p>
          </div>
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm">Close</button>
        </div>

        <div className="p-5 space-y-4 overflow-auto">
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={downloadTemplate} className="px-3 py-2 rounded-lg border border-gray-200 text-sm">Download Template</button>
            <input type="file" accept=".csv,text/csv" onChange={onFileChange} className="text-sm" />
            <button
              onClick={previewUpload}
              disabled={!file || uploadState === "uploading" || uploadState === "importing"}
              className="px-3 py-2 rounded-lg bg-gray-900 text-white text-sm disabled:opacity-50"
            >
              {uploadState === "uploading" ? "Validating..." : "Preview CSV"}
            </button>
          </div>

          {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

          {previewSummary ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <div className="rounded-lg border border-gray-200 p-2">Total: <strong>{previewSummary.total}</strong></div>
              <div className="rounded-lg border border-green-200 bg-green-50 p-2">Create: <strong>{previewSummary.creates}</strong></div>
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-2">Update: <strong>{previewSummary.updates}</strong></div>
              <div className="rounded-lg border border-red-200 bg-red-50 p-2">Errors: <strong>{previewSummary.errors}</strong></div>
            </div>
          ) : null}

          {previewErrorRows.length > 0 ? (
            <div>
              <button onClick={downloadPreviewErrors} className="px-3 py-2 rounded-lg border border-red-200 text-sm text-red-700 bg-red-50">
                Download Error CSV
              </button>
            </div>
          ) : null}

          {previewRows.length > 0 ? (
            <div className="rounded-xl border border-gray-200 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left">Row</th>
                    <th className="px-3 py-2 text-left">SKU</th>
                    <th className="px-3 py-2 text-left">Product</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-left">Errors</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row) => (
                    <tr key={row.rowNumber} className="border-t border-gray-100 align-top">
                      <td className="px-3 py-2">{row.rowNumber}</td>
                      <td className="px-3 py-2">{row.sku}</td>
                      <td className="px-3 py-2">{row.product_name}</td>
                      <td className="px-3 py-2">
                        <span className={`text-xs px-2 py-1 rounded-full ${row.operation === "create" ? "bg-green-100 text-green-700" : row.operation === "update" ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700"}`}>
                          {row.operation}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-red-700">{row.errors.join("; ") || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {uploadState === "complete" && importSummary ? (
            <div className="space-y-2">
              <div className="rounded-lg border border-gray-200 p-3 text-sm">
                <p><strong>Import complete</strong></p>
                <p>Created: {importSummary.created} · Updated: {importSummary.updated} · Failed: {importSummary.failed}</p>
              </div>
              {failedRows.length > 0 ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 space-y-2">
                  <p>Failed rows: {failedRows.map((row) => row.rowNumber).join(", ")}</p>
                  <button onClick={downloadImportFailures} className="px-3 py-2 rounded-lg border border-amber-300 bg-white text-sm">
                    Download Failed Rows CSV
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="px-5 py-4 border-t border-gray-200 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 rounded-lg border border-gray-200 text-sm">Cancel</button>
          {uploadState === "complete" ? null : (
            <button
              onClick={commitImport}
              disabled={uploadState !== "preview" || fatalErrors || previewRows.length === 0}
              className="px-3 py-2 rounded-lg bg-gray-900 text-white text-sm disabled:opacity-50"
            >
              {uploadState === "importing" ? "Importing..." : "Import Products"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
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
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);

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
      <BulkUploadModal open={bulkUploadOpen} accessToken={session?.accessToken} onClose={() => setBulkUploadOpen(false)} onImported={loadProducts} />

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-gray-900">Product Management</h2>
          <p className="text-sm text-gray-500">Daily operations for catalog, status, visibility, featured and inventory access.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/admin/catalog-setup" className="px-4 py-2 rounded-lg border border-gray-200 text-sm">Manage Brands/Categories</Link>
          <button onClick={() => setBulkUploadOpen(true)} className="px-4 py-2 rounded-lg border border-gray-200 text-sm">Bulk Upload</button>
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
