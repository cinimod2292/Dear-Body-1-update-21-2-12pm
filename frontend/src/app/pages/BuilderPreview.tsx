import { useEffect, useRef, useState } from "react";
import { BuilderPageRenderer } from "../builder/BuilderPageRenderer";
import { BuilderPageContent } from "../builder/types";
import { fetchStoreProducts, Product } from "../data/products";

export default function BuilderPreview() {
  const [content, setContent] = useState<BuilderPageContent | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const reportedRef = useRef(false);

  useEffect(() => {
    fetchStoreProducts().then((p) => setProducts(Array.isArray(p) ? p : [])).catch(() => {});
  }, []);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "BUILDER_PREVIEW_CONTENT") {
        setContent(event.data.content as BuilderPageContent);
      }
    };
    window.addEventListener("message", handler);
    window.parent?.postMessage({ type: "BUILDER_PREVIEW_READY" }, "*");
    return () => window.removeEventListener("message", handler);
  }, []);

  // Report document height to parent after render so the iframe container can resize
  useEffect(() => {
    const report = () => {
      const height = document.documentElement.scrollHeight;
      window.parent?.postMessage({ type: "BUILDER_PREVIEW_HEIGHT", height }, "*");
    };
    report();
    reportedRef.current = true;
    const ro = new ResizeObserver(report);
    ro.observe(document.documentElement);
    return () => ro.disconnect();
  }, [content]);

  if (!content) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <p className="text-sm text-gray-400">Waiting for preview content...</p>
      </div>
    );
  }

  return <BuilderPageRenderer content={content} products={products} />;
}
