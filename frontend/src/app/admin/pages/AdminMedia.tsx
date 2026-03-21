import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { apiRequest } from "../api/client";
import { useAdminAuth } from "../context/AdminAuthContext";
import { MediaAsset, PaginatedResult } from "../types/admin";
import { AdminPagination } from "../components/AdminPagination";
import { EmptyState, ErrorState, LoadingState } from "../components/AdminState";
import { toast } from "sonner";

interface MediaResponse {
  data: PaginatedResult<MediaAsset>;
}

export default function AdminMedia() {
  const { session } = useAdminAuth();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<PaginatedResult<MediaAsset> | null>(null);
  const [uploading, setUploading] = useState(false);

  const params = useMemo(() => {
    const sp = new URLSearchParams({ page: String(page), perPage: "18" });
    if (query) sp.set("q", query);
    return sp.toString();
  }, [page, query]);

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
      const prep = await apiRequest<{ data: { uploadUrl: string; storageKey: string; method: "PUT"; headers: Record<string, string> } }>(
        "/admin/media/uploads/prepare",
        {
          method: "POST",
          body: JSON.stringify({
            filename: file.name,
            mimeType: file.type || "application/octet-stream",
            byteSize: file.size,
            kind: file.type.startsWith("image") ? "IMAGE" : "FILE",
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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-gray-900">Media Library</h2>
          <p className="text-sm text-gray-500">Upload and manage product media assets.</p>
        </div>
        <label className="inline-flex items-center px-4 py-2 rounded-lg bg-gray-900 text-white text-sm cursor-pointer">
          {uploading ? "Uploading..." : "Upload File"}
          <input type="file" className="hidden" onChange={onFileSelect} disabled={uploading} />
        </label>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-3">
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
          placeholder="Search media"
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
        />
      </div>

      {payload.items.length === 0 ? (
        <EmptyState label="No media assets found." />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          {payload.items.map((asset) => (
            <div key={asset.id} className="rounded-xl border border-gray-200 bg-white p-2">
              <div className="aspect-square rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center">
                {asset.publicUrl && asset.mimeType.startsWith("image") ? (
                  <img src={asset.publicUrl} alt={asset.filename} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs text-gray-500 text-center px-2">{asset.mimeType}</span>
                )}
              </div>
              <p className="mt-2 text-xs font-medium text-gray-700 truncate" title={asset.filename}>{asset.filename}</p>
              <p className="text-[11px] text-gray-400">{Math.round(asset.byteSize / 1024)} KB</p>
            </div>
          ))}
        </div>
      )}

      <AdminPagination page={payload.page} totalPages={payload.totalPages} onChange={setPage} />
    </div>
  );
}
