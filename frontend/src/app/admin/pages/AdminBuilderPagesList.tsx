import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useAdminAuth } from "../context/AdminAuthContext";
import { listBuilderPages } from "../../builder/api";
import { BuilderPageKey } from "../../builder/types";
import { LoadingState, ErrorState } from "../components/AdminState";

type PageMeta = {
  pageKey: BuilderPageKey;
  version: number;
  updatedAt?: string;
  publishedAt?: string | null;
};

const PAGE_LABELS: Record<BuilderPageKey, string> = {
  home: "Homepage",
  about: "About Us",
  contact: "Contact",
};

const PAGE_DESCRIPTIONS: Record<BuilderPageKey, string> = {
  home: "Main storefront landing page",
  about: "Brand story and team page",
  contact: "Contact information and form",
};

export default function AdminBuilderPagesList() {
  const { session } = useAdminAuth();
  const navigate = useNavigate();
  const [pages, setPages] = useState<PageMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.accessToken) return;
    setLoading(true);
    listBuilderPages(session.accessToken)
      .then(setPages)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load pages"))
      .finally(() => setLoading(false));
  }, [session?.accessToken]);

  if (loading) return <LoadingState label="Loading pages..." />;
  if (error) return <ErrorState message={error} onRetry={() => window.location.reload()} />;

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Page Builder</h1>
        <p className="text-sm text-gray-500 mt-1">Select a page to edit its layout and content.</p>
      </div>

      <div className="space-y-3">
        {pages.map((page) => (
          <button
            key={page.pageKey}
            type="button"
            onClick={() => void navigate(`/admin/builder/${page.pageKey}`)}
            className="w-full text-left bg-white border border-gray-200 rounded-xl px-5 py-4 hover:border-pink-300 hover:shadow-sm transition group"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold text-gray-900 group-hover:text-pink-600 transition">
                  {PAGE_LABELS[page.pageKey] ?? page.pageKey}
                </p>
                <p className="text-sm text-gray-500 mt-0.5">
                  {PAGE_DESCRIPTIONS[page.pageKey] ?? ""}
                </p>
              </div>
              <div className="text-right shrink-0">
                {page.publishedAt ? (
                  <span className="inline-block text-[11px] bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5 font-medium">
                    Published
                  </span>
                ) : (
                  <span className="inline-block text-[11px] bg-gray-100 text-gray-500 rounded-full px-2 py-0.5">
                    Draft only
                  </span>
                )}
                {page.updatedAt && (
                  <p className="text-[11px] text-gray-400 mt-1">
                    Updated {new Date(page.updatedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
