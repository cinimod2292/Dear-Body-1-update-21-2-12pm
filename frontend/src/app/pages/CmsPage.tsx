import { useEffect, useState } from "react";
import { useLocation, useParams } from "react-router";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { API_BASE } from "../admin/api/client";

interface CmsPagePayload {
  slug: string;
  title: string;
  content: string;
  status: "draft" | "published";
}

export default function CmsPage() {
  const { slug } = useParams();
  const location = useLocation();
  const rawPathSlug = location.pathname.replace(/^\//, "").replace(/^pages\//, "");
  const resolvedSlug = slug ?? (rawPathSlug || "about");
  const [page, setPage] = useState<CmsPagePayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/store/cms/pages/${resolvedSlug}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Page not found");
        return res.json();
      })
      .then((payload) => setPage(payload.data))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load page"));
  }, [resolvedSlug]);

  if (error) {
    return <div className="max-w-4xl mx-auto px-4 py-20"><h1 className="text-3xl font-black text-gray-900 mb-4">Page unavailable</h1><p className="text-gray-600">{error}</p></div>;
  }

  if (!page) {
    return <div className="max-w-4xl mx-auto px-4 py-20 text-gray-500">Loading page...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-16">
      <h1 className="text-4xl font-black text-gray-900 mb-6">{page.title}</h1>
      <div className="prose prose-gray max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{page.content}</ReactMarkdown>
      </div>
    </div>
  );
}
