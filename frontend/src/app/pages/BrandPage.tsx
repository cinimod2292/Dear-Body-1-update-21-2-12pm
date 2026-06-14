import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router";
import { ArrowLeft } from "lucide-react";
import { fetchStoreProducts, Product } from "../data/products";
import { ProductCard } from "../components/ProductCard";
import { useSEO, buildCanonical } from "../lib/seo";
import { API_BASE } from "../admin/api/client";

type BrandMeta = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  logoUrl?: string | null;
};

export default function BrandPage() {
  const { slug } = useParams<{ slug: string }>();
  const [brand, setBrand] = useState<BrandMeta | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    Promise.all([
      fetch(`${API_BASE}/store/brands`).then((r) => r.json()).catch(() => null),
      fetchStoreProducts(),
    ]).then(([brandsPayload, allProducts]) => {
      const found = (brandsPayload?.data ?? []).find((b: BrandMeta) => b.slug === slug);
      if (!found) { setNotFound(true); setLoading(false); return; }
      setBrand(found);
      setProducts(allProducts.filter((p) => p.brandSlug === slug || p.brand?.toLowerCase() === found.name.toLowerCase()));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [slug]);

  const canonicalPath = `/brands/${slug}`;

  useSEO(brand ? {
    title: `${brand.name} | Dear Body South Africa`,
    description: brand.description || `Shop the ${brand.name} range at Dear Body. Premium quality South African beauty and fragrance.`,
    canonical: buildCanonical(canonicalPath),
    structuredData: {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: `${brand.name} | Dear Body`,
      description: brand.description || `Shop the ${brand.name} range at Dear Body.`,
      url: buildCanonical(canonicalPath),
    },
  } : { title: "Brand", noIndex: true });

  const sortedProducts = useMemo(() => [...products].sort((a, b) => a.name.localeCompare(b.name)), [products]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400">Loading brand…</p>
      </div>
    );
  }

  if (notFound || !brand) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4 px-4">
        <h1 className="text-2xl font-black text-gray-900">Brand not found</h1>
        <Link to="/shop" className="text-pink-500 hover:underline font-medium">← Back to Shop</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="bg-gradient-to-r from-pink-500 via-red-500 to-orange-500 py-20 relative overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-4 left-20 w-32 h-32 rounded-full bg-white" />
          <div className="absolute bottom-2 right-32 w-48 h-48 rounded-full bg-white" />
        </div>
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-white">
          {brand.logoUrl && (
            <img src={brand.logoUrl} alt={brand.name} className="h-16 w-auto object-contain mx-auto mb-6 brightness-0 invert" />
          )}
          <h1 className="mb-3" style={{ fontSize: "clamp(2rem, 6vw, 3.5rem)", fontWeight: 900 }}>
            {brand.name}
          </h1>
          <p className="text-white/80 text-lg">
            {sortedProducts.length} product{sortedProducts.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Breadcrumb */}
        <nav className="mb-8 flex items-center gap-2 text-sm text-gray-500">
          <Link to="/" className="hover:text-pink-500 transition-colors">Home</Link>
          <span>/</span>
          <Link to="/shop" className="hover:text-pink-500 transition-colors">Shop</Link>
          <span>/</span>
          <span className="text-gray-900 font-medium">{brand.name}</span>
        </nav>

        {/* Products Grid */}
        {sortedProducts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {sortedProducts.map((product, idx) => (
              <ProductCard key={product.id} product={product} prioritizeImage={idx < 2} />
            ))}
          </div>
        ) : (
          <div className="text-center py-24">
            <p className="text-6xl mb-6">🌸</p>
            <h3 className="text-gray-800 mb-2 text-2xl font-black">No products found</h3>
            <p className="text-gray-500 mb-6">Check back soon for {brand.name} products.</p>
            <Link
              to="/shop"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-pink-500 to-orange-500 text-white rounded-full font-bold"
            >
              <ArrowLeft size={16} /> Shop All Products
            </Link>
          </div>
        )}

        {/* Brand Description */}
        {brand.description && (
          <div className="mt-16 bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 mb-3">About {brand.name}</h2>
            <div className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">
              {brand.description}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
