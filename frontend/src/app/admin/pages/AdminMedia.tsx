import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { apiRequest, API_BASE } from "../api/client";
import { useAdminAuth } from "../context/AdminAuthContext";
import { MediaAsset, PaginatedResult } from "../types/admin";
import { AdminPagination } from "../components/AdminPagination";
import { EmptyState, ErrorState, LoadingState } from "../components/AdminState";
import { toast } from "sonner";

interface MediaResponse {
  data: PaginatedResult<MediaAsset>;
}

interface MediaDetailResponse {
  data: MediaAsset & {
    storageKey: string;
    updatedAt: string;
    usage: {
      galleryCount: number;
      products: Array<{ id: string; name: string; sku: string | null }>;
    };
  };
}

interface MediaUpdateResponse {
  data: MediaAsset;
}

interface ImageImportPreviewRow {
  rowNumber: number;
  sku: string;
  image_url: string;
  operation: "attach" | "error";
  errors: string[];
  rowData?: Record<string, string>;
}

interface ImageImportPreviewSummary {
  total: number;
  attachable: number;
  errors: number;
}

interface ImageImportPreviewResponse {
  data: {
    rows: ImageImportPreviewRow[];
    summary: ImageImportPreviewSummary;
  };
}

interface ImageImportCommitResponse {
  data: {
    summary: {
      attached: number;
      failed: number;
    };
    results: Array<{ rowNumber: number; status: "attached" | "failed"; error?: string; rowData?: Record<string, string> }>;
  };
}

type ImportState = "idle" | "previewing" | "preview" | "importing" | "complete";

function BulkImageImportModal({
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
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<ImportState>("idle");
  const [previewRows, setPreviewRows] = useState<ImageImportPreviewRow[]>([]);
  const [previewSummary, setPreviewSummary] = useState<ImageImportPreviewSummary | null>(null);
  const [importSummary, setImportSummary] = useState<{ attached: number; failed: number } | null>(null);
  const [results, setResults] = useState<Array<{ rowNumber: number; status: "attached" | "failed"; error?: string; rowData?: Record<string, string> }>>([]);
  const [error, setError] = useState<string | null>(null);

  const previewErrorRows = previewRows.filter((row) => row.operation === "error");
  const failedRows = results.filter((row) => row.status === "failed");
  const hasFatalErrors = previewErrorRows.length > 0;

  const csvEscape = (value: unknown) => {
    const text = String(value ?? "");
    if (/[\",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
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

  const downloadTemplate = () => {
    const headers = ["sku", "image_url", "position", "alt_text"];
    const sample = ["DB-SERUM-001", "https://images.example.com/dear-body-serum.jpg", "0", "Front product shot"];
    const csv = [headers.join(","), sample.map(csvEscape).join(",")].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = "product-image-import-template.csv";
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
    downloadCsv("bulk-image-preview-errors.csv", rows);
  };

  const downloadImportFailures = () => {
    const rows = failedRows.map((row) => ({
      row_number: row.rowNumber,
      ...(row.rowData ?? {}),
      status: row.status,
      error_messages: row.error ?? "",
    }));
    downloadCsv("bulk-image-import-failures.csv", rows);
  };

  const reset = () => {
    setFile(null);
    setState("idle");
    setPreviewRows([]);
    setPreviewSummary(null);
    setImportSummary(null);
    setResults([]);
    setError(null);
  };

  useEffect(() => {
    if (!open) reset();
  }, [open]);

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null;
    setFile(selected);
    setState("idle");
    setPreviewRows([]);
    setPreviewSummary(null);
    setImportSummary(null);
    setResults([]);
    setError(null);
  };

  const previewImport = async () => {
    if (!accessToken || !file) return;
    try {
      setState("previewing");
      setError(null);

      const form = new FormData();
      form.append("file", file);
      const response = await fetch(`${API_BASE}/admin/products/images/import/preview`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: form,
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error?.message || `Preview failed (${response.status})`);
      }

      const data = (payload as ImageImportPreviewResponse).data;
      setPreviewRows(data.rows);
      setPreviewSummary(data.summary);
      setState("preview");
    } catch (err) {
      setState("idle");
      setError(err instanceof Error ? err.message : "Failed to preview CSV");
    }
  };

  const commitImport = async () => {
    if (!accessToken || !file) return;
    try {
      setState("importing");
      setError(null);

      const form = new FormData();
      form.append("file", file);
      const response = await fetch(`${API_BASE}/admin/products/images/import/commit`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: form,
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error?.message || `Import failed (${response.status})`);
      }

      const data = (payload as ImageImportCommitResponse).data;
      setImportSummary(data.summary);
      setResults(data.results);
      setState("complete");
      await onImported();
    } catch (err) {
      setState("preview");
      setError(err instanceof Error ? err.message : "Failed to import CSV");
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-5xl rounded-xl border border-gray-200 shadow-xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Bulk Image Import</h3>
            <p className="text-xs text-gray-500">Attach remote images to products by SKU via CSV.</p>
          </div>
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm">Close</button>
        </div>

        <div className="p-5 space-y-4 overflow-auto">
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={downloadTemplate} className="px-3 py-2 rounded-lg border border-gray-200 text-sm">Download Template</button>
            <input type="file" accept=".csv,text/csv" onChange={onFileChange} className="text-sm" />
            <button
              onClick={previewImport}
              disabled={!file || state === "previewing" || state === "importing"}
              className="px-3 py-2 rounded-lg bg-gray-900 text-white text-sm disabled:opacity-50"
            >
              {state === "previewing" ? "Validating..." : "Preview CSV"}
            </button>
          </div>

          <p className="text-xs text-gray-500">CSV columns: <code>sku</code> (required), <code>image_url</code> (required), <code>position</code> (optional), <code>alt_text</code> (optional).</p>

          {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

          {previewSummary ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
              <div className="rounded-lg border border-gray-200 p-2">Total: <strong>{previewSummary.total}</strong></div>
              <div className="rounded-lg border border-green-200 bg-green-50 p-2">Attachable: <strong>{previewSummary.attachable}</strong></div>
              <div className="rounded-lg border border-red-200 bg-red-50 p-2">Errors: <strong>{previewSummary.errors}</strong></div>
            </div>
          ) : null}

          {previewErrorRows.length > 0 ? (
            <button onClick={downloadPreviewErrors} className="px-3 py-2 rounded-lg border border-red-200 text-sm text-red-700 bg-red-50">
              Download Preview Errors CSV
            </button>
          ) : null}

          {previewRows.length > 0 ? (
            <div className="rounded-xl border border-gray-200 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left">Row</th>
                    <th className="px-3 py-2 text-left">SKU</th>
                    <th className="px-3 py-2 text-left">Image URL</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-left">Errors</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row) => (
                    <tr key={row.rowNumber} className="border-t border-gray-100 align-top">
                      <td className="px-3 py-2">{row.rowNumber}</td>
                      <td className="px-3 py-2">{row.sku}</td>
                      <td className="px-3 py-2 break-all max-w-sm">{row.image_url}</td>
                      <td className="px-3 py-2">
                        <span className={`text-xs px-2 py-1 rounded-full ${row.operation === "attach" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
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

          {state === "complete" && importSummary ? (
            <div className="space-y-2">
              <div className="rounded-lg border border-gray-200 p-3 text-sm">
                <p><strong>Import complete</strong></p>
                <p>Attached: {importSummary.attached} · Failed: {importSummary.failed}</p>
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
          {state === "complete" ? null : (
            <button
              onClick={commitImport}
              disabled={state !== "preview" || hasFatalErrors || previewRows.length === 0}
              className="px-3 py-2 rounded-lg bg-gray-900 text-white text-sm disabled:opacity-50"
            >
              {state === "importing" ? "Importing..." : "Import Images"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function MediaDetailsModal({
  mediaId,
  accessToken,
  onClose,
  onChanged,
}: {
  mediaId: string | null;
  accessToken?: string;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [asset, setAsset] = useState<MediaDetailResponse["data"] | null>(null);
  const [filename, setFilename] = useState("");
  const [altText, setAltText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [assignSku, setAssignSku] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [unlinkingSku, setUnlinkingSku] = useState<string | null>(null);

  const loadAsset = async () => {
    if (!accessToken || !mediaId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await apiRequest<MediaDetailResponse>(`/admin/media/${mediaId}`, {}, accessToken);
      setAsset(res.data);
      setFilename(res.data.filename);
      setAltText(res.data.altText ?? "");
      setAssignSku(res.data.usage.products[0]?.sku ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load media details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (mediaId) loadAsset();
    if (!mediaId) {
      setAsset(null);
      setFilename("");
      setAltText("");
      setError(null);
      setShowDeleteConfirm(false);
    }
  }, [mediaId, accessToken]);

  const saveChanges = async () => {
    if (!accessToken || !mediaId) return;
    try {
      setSaving(true);
      setError(null);
      const res = await apiRequest<MediaUpdateResponse>(`/admin/media/${mediaId}`, {
        method: "PATCH",
        body: JSON.stringify({
          filename: filename.trim(),
          altText: altText.trim() || null,
        }),
      }, accessToken);
      setAsset((current) => (current ? { ...current, ...res.data } : current));
      toast.success("Media details updated");
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  const copyUrl = async () => {
    if (!asset?.publicUrl) return;
    try {
      await navigator.clipboard.writeText(asset.publicUrl);
      toast.success("Media URL copied");
    } catch {
      toast.error("Unable to copy URL");
    }
  };

  const deleteAsset = async () => {
    if (!accessToken || !mediaId) return;
    try {
      setDeleting(true);
      setError(null);
      await fetch(`${API_BASE}/admin/media/${mediaId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      }).then(async (res) => {
        if (res.status === 204) return;
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error?.message || `Delete failed (${res.status})`);
      });
      toast.success("Media asset deleted");
      await onChanged();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete media asset");
    } finally {
      setDeleting(false);
    }
  };

  const assignToSku = async () => {
    if (!accessToken || !mediaId || !assignSku.trim()) return;
    try {
      setAssigning(true);
      setError(null);
      await apiRequest(`/admin/media/${mediaId}/assign-product`, {
        method: "POST",
        body: JSON.stringify({
          sku: assignSku.trim(),
          replaceExisting: true,
        }),
      }, accessToken);
      toast.success(`Assigned to SKU ${assignSku.trim()}`);
      await loadAsset();
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign SKU");
    } finally {
      setAssigning(false);
    }
  };

  const unlinkSku = async (sku: string) => {
    if (!accessToken || !mediaId || !sku) return;
    try {
      setUnlinkingSku(sku);
      setError(null);
      await apiRequest(`/admin/media/${mediaId}/unlink-product`, {
        method: "POST",
        body: JSON.stringify({ sku }),
      }, accessToken);
      toast.success(`Unlinked SKU ${sku}`);
      await loadAsset();
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to unlink SKU");
    } finally {
      setUnlinkingSku(null);
    }
  };

  if (!mediaId) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-3xl rounded-xl border border-gray-200 shadow-xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Media Details</h3>
            <p className="text-xs text-gray-500">Inspect and manage this media asset.</p>
          </div>
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm">Close</button>
        </div>

        <div className="p-5 space-y-4 overflow-auto">
          {loading ? <LoadingState label="Loading media details..." /> : null}
          {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
          {asset ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 flex items-center justify-center min-h-[220px]">
                  {asset.publicUrl && asset.mimeType.startsWith("image") ? (
                    <img src={asset.publicUrl} alt={asset.altText ?? asset.filename} className="max-h-64 w-auto rounded object-contain" />
                  ) : (
                    <span className="text-xs text-gray-500">{asset.mimeType}</span>
                  )}
                </div>
                <div className="space-y-3">
                  <label className="block text-sm text-gray-700">
                    Display name
                    <input
                      value={filename}
                      onChange={(e) => setFilename(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="block text-sm text-gray-700">
                    Alt text
                    <input
                      value={altText}
                      onChange={(e) => setAltText(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    />
                  </label>
                  <div className="text-xs text-gray-600 space-y-1">
                    <p><strong>Kind:</strong> {asset.kind}</p>
                    <p><strong>MIME:</strong> {asset.mimeType}</p>
                    <p><strong>Size:</strong> {Math.round(asset.byteSize / 1024)} KB</p>
                    <p><strong>Created:</strong> {new Date(asset.createdAt).toLocaleString()}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 p-3 text-sm">
                <p className="font-medium text-gray-900">Public URL</p>
                <p className="text-xs text-gray-600 break-all">{asset.publicUrl ?? "No public URL available"}</p>
                <button
                  onClick={copyUrl}
                  disabled={!asset.publicUrl}
                  className="mt-2 px-3 py-1.5 rounded-lg border border-gray-200 text-xs disabled:opacity-50"
                >
                  Copy URL
                </button>
              </div>

              <div className="rounded-lg border border-gray-200 p-3 text-sm space-y-2">
                <p className="font-medium text-gray-900">Usage</p>
                <p className="text-xs text-gray-600">
                  Attached to {asset.usage.galleryCount} product gallery {asset.usage.galleryCount === 1 ? "entry" : "entries"}.
                </p>
                {asset.usage.products.length > 0 ? (
                  <div className="space-y-2">
                    {asset.usage.products.map((p) => (
                      <div key={`${p.id}-${p.sku ?? "no-sku"}`} className="flex items-center justify-between gap-2 rounded border border-gray-100 px-2 py-1">
                        <p className="text-xs text-gray-600">
                          {p.name}
                          {p.sku ? <span className="text-gray-400"> · SKU {p.sku}</span> : null}
                        </p>
                        {p.sku ? (
                          <button
                            onClick={() => unlinkSku(p.sku as string)}
                            disabled={unlinkingSku === p.sku}
                            className="px-2 py-1 text-[11px] rounded border border-gray-200 disabled:opacity-50"
                          >
                            {unlinkingSku === p.sku ? "Unlinking..." : "Unlink"}
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : <p className="text-xs text-gray-500">Not linked to any product yet.</p>}
                <div className="pt-2 border-t border-gray-100 space-y-2">
                  <label className="block text-xs text-gray-700">
                    Assign to product SKU
                    <input
                      value={assignSku}
                      onChange={(e) => setAssignSku(e.target.value)}
                      placeholder="e.g. DB-SERUM-001"
                      className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs"
                    />
                  </label>
                  <button
                    onClick={assignToSku}
                    disabled={assigning || !assignSku.trim()}
                    className="px-3 py-1.5 rounded-lg bg-gray-900 text-white text-xs disabled:opacity-50"
                  >
                    {assigning ? "Assigning..." : "Assign SKU"}
                  </button>
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 p-3 text-sm space-y-3">
                <p className="font-medium text-gray-900">Danger Zone</p>
                {asset.usage.galleryCount > 0 ? (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2">
                    This image is currently attached to products and cannot be deleted until it is removed from those products.
                  </p>
                ) : (
                  <>
                    {!showDeleteConfirm ? (
                      <button onClick={() => setShowDeleteConfirm(true)} className="px-3 py-1.5 rounded-lg border border-red-200 text-red-700 bg-red-50 text-xs">
                        Delete Asset
                      </button>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs text-red-700">Confirm deletion. This action cannot be undone.</p>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={deleteAsset}
                            disabled={deleting}
                            className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs disabled:opacity-50"
                          >
                            {deleting ? "Deleting..." : "Confirm Delete"}
                          </button>
                          <button onClick={() => setShowDeleteConfirm(false)} className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs">Cancel</button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          ) : null}
        </div>

        <div className="px-5 py-4 border-t border-gray-200 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 rounded-lg border border-gray-200 text-sm">Close</button>
          <button
            onClick={saveChanges}
            disabled={!asset || saving || !filename.trim()}
            className="px-3 py-2 rounded-lg bg-gray-900 text-white text-sm disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminMedia() {
  const { session } = useAdminAuth();
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<"ALL" | "IMAGE" | "VIDEO" | "FILE">("ALL");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<PaginatedResult<MediaAsset> | null>(null);
  const [uploading, setUploading] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [selectedMediaId, setSelectedMediaId] = useState<string | null>(null);

  const params = useMemo(() => {
    const sp = new URLSearchParams({ page: String(page), perPage: "18", sortBy: "createdAt", sortDir });
    if (query) sp.set("q", query);
    if (kindFilter !== "ALL") sp.set("kind", kindFilter);
    return sp.toString();
  }, [page, query, kindFilter, sortDir]);

  const loadMedia = async () => {
    if (!session?.accessToken) return;
    try {
      setLoading(true);
      setError(null);
      const res = await apiRequest<MediaResponse>(`/admin/media?${params}`, {}, session.accessToken);
      setPayload(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load media");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMedia();
  }, [session?.accessToken, params]);

  const onFileSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !session?.accessToken) return;

    try {
      setUploading(true);
      const kind = file.type.startsWith("image") ? "IMAGE" : file.type.startsWith("video") ? "VIDEO" : "FILE";
      const prep = await apiRequest<{ data: { uploadUrl: string; publicUrl: string; storageKey: string; method: "PUT"; headers: Record<string, string> } }>(
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

      await fetch(prep.data.uploadUrl, {
        method: prep.data.method,
        headers: prep.data.headers,
        body: file,
      });

      await apiRequest("/admin/media/uploads/finalize", {
        method: "POST",
        body: JSON.stringify({
          storageKey: prep.data.storageKey,
          publicUrl: prep.data.publicUrl,
          kind,
          metadata: { byteSize: file.size, mimeType: file.type || "application/octet-stream" },
          altText: file.name,
        }),
      }, session.accessToken);

      toast.success("File uploaded");
      await loadMedia();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  if (loading) return <LoadingState label="Loading media..." />;
  if (error) return <ErrorState message={error} onRetry={loadMedia} />;
  if (!payload) return null;

  return (
    <div className="space-y-4">
      <BulkImageImportModal
        open={bulkImportOpen}
        accessToken={session?.accessToken}
        onClose={() => setBulkImportOpen(false)}
        onImported={loadMedia}
      />
      <MediaDetailsModal
        mediaId={selectedMediaId}
        accessToken={session?.accessToken}
        onClose={() => setSelectedMediaId(null)}
        onChanged={loadMedia}
      />

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-gray-900">Media Library</h2>
          <p className="text-sm text-gray-500">Upload and manage product media assets, including bulk image import.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setBulkImportOpen(true)} className="px-4 py-2 rounded-lg border border-gray-200 text-sm">Bulk Image Import</button>
          <label className="inline-flex items-center px-4 py-2 rounded-lg bg-gray-900 text-white text-sm cursor-pointer">
            {uploading ? "Uploading..." : "Upload File"}
            <input type="file" className="hidden" onChange={onFileSelect} disabled={uploading} />
          </label>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-3 grid grid-cols-1 md:grid-cols-4 gap-3">
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
          placeholder="Search filename, alt text, or URL"
          className="md:col-span-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
        />
        <select
          value={kindFilter}
          onChange={(e) => {
            setKindFilter(e.target.value as "ALL" | "IMAGE" | "VIDEO" | "FILE");
            setPage(1);
          }}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
        >
          <option value="ALL">All kinds</option>
          <option value="IMAGE">Images</option>
          <option value="VIDEO">Videos</option>
          <option value="FILE">Files</option>
        </select>
        <button
          onClick={() => setSortDir((current) => (current === "desc" ? "asc" : "desc"))}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
        >
          {sortDir === "desc" ? "Newest first" : "Oldest first"}
        </button>
      </div>

      {payload.items.length === 0 ? (
        <EmptyState label="No media assets found." />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          {payload.items.map((asset) => (
            <button
              key={asset.id}
              onClick={() => setSelectedMediaId(asset.id)}
              className="text-left rounded-xl border border-gray-200 bg-white p-2 hover:border-gray-300"
            >
              <div className="aspect-square rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center">
                {asset.publicUrl && asset.mimeType.startsWith("image") ? (
                  <img src={asset.publicUrl} alt={asset.filename} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs text-gray-500 text-center px-2">{asset.mimeType}</span>
                )}
              </div>
              <p className="mt-2 text-xs font-medium text-gray-700 truncate" title={asset.filename}>{asset.filename}</p>
              <p className="text-[11px] text-gray-500">{asset.kind}</p>
              <p className="text-[11px] text-gray-400">{Math.round(asset.byteSize / 1024)} KB</p>
            </button>
          ))}
        </div>
      )}

      <AdminPagination page={payload.page} totalPages={payload.totalPages} onChange={setPage} />
    </div>
  );
}
