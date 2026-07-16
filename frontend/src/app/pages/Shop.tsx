import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { SlidersHorizontal, X, ChevronDown } from "lucide-react";
import { ProductCard } from "../components/ProductCard";
import { fetchStoreProducts, getCategories, Product } from "../data/products";
import { ALL_PRODUCTS_CATEGORY, getShopCategory, setShopCategory } from "./shop-query";
import { useSEO, buildCanonical } from "../lib/seo";
import { SeoLandingSections } from "../components/SeoLandingSections";
import { DEFAULT_SHOP_SEO, getCategorySeo, PRIMARY_KEYWORDS } from "../lib/seo-content";
import { API_BASE } from "../admin/api/client";

const sortOptions = [
  { value: "", label: "Featured" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
];

export default function Shop() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedCategory = getShopCategory(searchParams);
  const initialSearch = searchParams.get("search") || "";

  const [sortBy, setSortBy] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 0]);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [saleOnly, setSaleOnly] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasUserAdjustedMax = useRef(false);
  const userSelectedMax = useRef<number | null>(null);
  const [categoryMeta, setCategoryMeta] = useState<{ name: string; slug: string; description?: string | null } | null>(null);

  const searchQuery = searchParams.get("search") || "";
  const categorySlug = searchParams.get("category") || "";
  const brandSlug = searchParams.get("brand") || "";

  const activeCategoryName = selectedCategory !== ALL_PRODUCTS_CATEGORY ? selectedCategory : categorySlug || "";
  const landingSeo = getCategorySeo(activeCategoryName);

  const seoTitle = searchQuery
    ? `Search results for ${searchQuery}`
    : landingSeo.title;

  const seoDescription = searchQuery
    ? `Browse search results for "${searchQuery}" at Dear Body. Premium South African beauty, fragrance and body care delivered in South Africa.`
    : landingSeo.description;

  const canonicalPath = categorySlug
    ? `/shop?category=${encodeURIComponent(categorySlug)}`
    : brandSlug
    ? `/shop?brand=${encodeURIComponent(brandSlug)}`
    : "/shop";

  useSEO({
    title: seoTitle,
    description: seoDescription,
    canonical: buildCanonical(canonicalPath),
    noIndex: Boolean(searchQuery),
    keywords: [...PRIMARY_KEYWORDS, activeCategoryName, "Dear Body South Africa"].filter(Boolean),
    structuredData: [
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: `${seoTitle} | Dear Body`,
        description: seoDescription,
        url: buildCanonical(canonicalPath),
        isPartOf: { "@type": "WebSite", name: "Dear Body", url: buildCanonical("/") },
      },
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: landingSeo.faqs.map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: { "@type": "Answer", text: faq.answer },
        })),
      },
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: buildCanonical("/") },
          { "@type": "ListItem", position: 2, name: "Shop", item: buildCanonical("/shop") },
          ...(activeCategoryName ? [{ "@type": "ListItem", position: 3, name: activeCategoryName, item: buildCanonical(canonicalPath) }] : []),
        ],
      },
    ],
  });

  useEffect(() => {
    fetchStoreProducts()
      .then((items) => {
        setProducts(items);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load products");
      })
      .finally(() => setLoading(false));
  }, []);

  // Load category description for SEO content when filtering by category slug
  useEffect(() => {
    if (!categorySlug) { setCategoryMeta(null); return; }
    fetch(`${API_BASE}/store/categories`)
      .then((r) => r.json())
      .catch(() => null)
      .then((payload) => {
        if (!Array.isArray(payload?.data)) return;
        const match = payload.data.find((c: any) => c.slug === categorySlug);
        setCategoryMeta(match || null);
      });
  }, [categorySlug]);

  const handleCategoryChange = (cat: string) => {
    setSearchParams((currentSearchParams) => setShopCategory(currentSearchParams, cat));
  };

  const productsForFilters = useMemo(() => {
    let result = [...products];

    if (selectedCategory !== ALL_PRODUCTS_CATEGORY) {
      result = result.filter(p => p.category === selectedCategory);
    }

    if (initialSearch) {
      result = result.filter(p =>
        p.name.toLowerCase().includes(initialSearch.toLowerCase()) ||
        p.tagline.toLowerCase().includes(initialSearch.toLowerCase()) ||
        p.category.toLowerCase().includes(initialSearch.toLowerCase())
      );
    }

    return result;
  }, [products, selectedCategory, initialSearch]);

  const dynamicPriceMax = useMemo(() => {
    const prices = productsForFilters
      .map((product) => Number(product.price))
      .filter((price) => Number.isFinite(price) && price >= 0);

    return prices.length ? Math.max(...prices) : 0;
  }, [productsForFilters]);

  useEffect(() => {
    setPriceRange(([currentMin, currentMax]) => {
      const nextMin = Math.min(Math.max(currentMin, 0), dynamicPriceMax);
      const preferredMax = hasUserAdjustedMax.current
        ? (userSelectedMax.current ?? currentMax)
        : dynamicPriceMax;
      const nextMax = Math.min(Math.max(preferredMax, nextMin), dynamicPriceMax);

      if (nextMin === currentMin && nextMax === currentMax) {
        return [currentMin, currentMax];
      }

      return [nextMin, nextMax];
    });

  }, [dynamicPriceMax]);

  const filteredProducts = useMemo(() => {
    let result = [...productsForFilters];

    result = result.filter(p => p.price >= priceRange[0] && p.price <= priceRange[1] + 0.01);

    if (inStockOnly) {
      result = result.filter(p => p.inStock);
    }

    if (saleOnly) {
      result = result.filter(p => p.originalPrice !== undefined);
    }

    switch (sortBy) {
      case "price-asc":
        result.sort((a, b) => a.price - b.price);
        break;
      case "price-desc":
        result.sort((a, b) => b.price - a.price);
        break;
    }

    return result;
  }, [productsForFilters, sortBy, priceRange, inStockOnly, saleOnly]);

  const categories = useMemo(() => getCategories(products), [products]);


  const categoryColors: Record<string, string> = {
    "All": "from-pink-500 to-orange-500",
    "Body Spray": "from-pink-500 to-red-500",
    "Body Lotion": "from-orange-400 to-yellow-400",
    "Body Scrub": "from-lime-400 to-green-500",
    "Body Butter": "from-sky-400 to-blue-500",
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Shop Header */}
      <div className="bg-gradient-to-r from-pink-500 via-red-500 to-orange-500 py-20 relative overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-4 left-20 w-32 h-32 rounded-full bg-white" />
          <div className="absolute bottom-2 right-32 w-48 h-48 rounded-full bg-white" />
        </div>
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-white">
          <h1 className="mb-3" style={{ fontSize: "clamp(2rem, 6vw, 3.5rem)", fontWeight: 900 }}>
            {initialSearch ? `Results for "${initialSearch}"` : landingSeo.h1}
          </h1>
          <p className="text-white/80 text-lg">
            {filteredProducts.length} product{filteredProducts.length !== 1 ? "s" : ""} found
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Category Pills */}
        <div className="flex flex-wrap gap-3 mb-8 justify-center">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => handleCategoryChange(cat)}
              className={`px-5 py-2.5 rounded-full font-bold text-sm transition-all duration-200 hover:scale-105 ${
                selectedCategory === cat
                  ? `bg-gradient-to-r ${categoryColors[cat] || "from-pink-500 to-orange-500"} text-white shadow-md`
                  : "bg-white text-gray-700 border border-gray-200 hover:border-pink-300"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between mb-8 gap-4 flex-wrap">
          <button
            onClick={() => setFiltersOpen(!filtersOpen)}
            className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 rounded-full text-gray-700 font-medium hover:border-pink-300 transition-colors"
          >
            <SlidersHorizontal size={16} />
            Filters
            {filtersOpen ? <X size={14} /> : <ChevronDown size={14} />}
          </button>

          <div className="flex items-center gap-3">
            <span className="text-gray-500 text-sm">{filteredProducts.length} results</span>
            <div className="relative">
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                className="appearance-none pl-4 pr-10 py-2.5 bg-white border border-gray-200 rounded-full text-gray-700 font-medium focus:outline-none focus:border-pink-400 cursor-pointer"
              >
                {sortOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Filter Panel */}
        {filtersOpen && (
          <div className="bg-white rounded-2xl p-6 mb-8 border border-gray-100 shadow-sm">
            <div className="flex flex-col sm:flex-row gap-8">
              <div className="flex-1">
                <h4 className="font-bold text-gray-900 mb-4">Price Range</h4>
                <div className="flex items-center gap-4">
                  <span className="text-gray-600 text-sm w-12">R{priceRange[0]}</span>
                  <input
                    type="range"
                    min={0}
                    max={dynamicPriceMax}
                    value={priceRange[1]}
                    onChange={e => {
                      const nextMax = Math.max(priceRange[0], Number(e.target.value));
                      const isCustomMax = nextMax < dynamicPriceMax;

                      hasUserAdjustedMax.current = isCustomMax;
                      userSelectedMax.current = isCustomMax ? nextMax : null;
                      setPriceRange([priceRange[0], nextMax]);
                    }}
                    className="flex-1 accent-pink-500"
                  />
                  <span className="text-gray-600 text-sm w-12">R{priceRange[1]}</span>
                </div>
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-gray-900 mb-4">Availability</h4>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={inStockOnly}
                    onChange={e => setInStockOnly(e.target.checked)}
                    className="accent-pink-500"
                  />
                  <span className="text-gray-600 text-sm">In Stock Only</span>
                </label>
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-gray-900 mb-4">On Sale</h4>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={saleOnly}
                    onChange={e => setSaleOnly(e.target.checked)}
                    className="accent-pink-500"
                  />
                  <span className="text-gray-600 text-sm">Sale Items Only</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Products Grid */}
        {loading ? (
          <div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" aria-label="Loading products…">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="bg-white rounded-2xl overflow-hidden border border-gray-100 animate-pulse">
                  <div className="bg-gray-100 aspect-square" />
                  <div className="p-4 space-y-3">
                    <div className="h-3 bg-gray-100 rounded w-1/3" />
                    <div className="h-4 bg-gray-100 rounded w-3/4" />
                    <div className="h-3 bg-gray-100 rounded w-1/2" />
                    <div className="h-5 bg-gray-100 rounded w-1/4 mt-2" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : error ? (
          <div className="py-16">
            <div className="max-w-2xl mx-auto text-center mb-12">
              <h2 className="text-2xl font-bold text-gray-800 mb-3">Browse Our Collection</h2>
              <p className="text-gray-500 mb-6">
                Dear Body offers a luxurious range of South African beauty products — from perfumed body sprays and
                hydrating lotions to exfoliating scrubs and rich body butters.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-3 bg-gradient-to-r from-pink-500 to-orange-500 text-white rounded-full font-bold hover:opacity-90 transition"
              >
                Retry
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl mx-auto">
              {["Body Sprays", "Body Lotions", "Body Scrubs", "Body Butters"].map((cat) => (
                <a
                  key={cat}
                  href={`/shop?category=${encodeURIComponent(cat.slice(0, -1))}`}
                  className="bg-white border border-gray-200 rounded-2xl p-5 text-center hover:border-pink-300 transition group"
                >
                  <p className="font-bold text-gray-800 text-sm group-hover:text-pink-600">{cat}</p>
                </a>
              ))}
            </div>
          </div>
        ) : filteredProducts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map((product, idx) => (
              <ProductCard key={product.id} product={product} prioritizeImage={idx < 2} />
            ))}
          </div>
        ) : (
          <div className="text-center py-24">
            <p className="text-6xl mb-6">🌈</p>
            <h3 className="text-gray-800 mb-2" style={{ fontSize: "1.5rem", fontWeight: 700 }}>No products found</h3>
            <p className="text-gray-500 mb-6">Try adjusting your filters or search terms</p>
            <button
              onClick={() => { handleCategoryChange("All"); setInStockOnly(false); setSaleOnly(false); setSortBy(""); }}
              className="px-6 py-3 bg-gradient-to-r from-pink-500 to-orange-500 text-white rounded-full font-bold"
            >
              Clear Filters
            </button>
          </div>
        )}

        {/* Category SEO content — rendered below products for UX clarity */}
        {categoryMeta?.description && (
          <div className="mt-16 bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 mb-3">{categoryMeta.name}</h2>
            <div className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">
              {categoryMeta.description}
            </div>
          </div>
        )}

        {!searchQuery && (
          <SeoLandingSections content={activeCategoryName ? landingSeo : DEFAULT_SHOP_SEO} productsCount={filteredProducts.length} />
        )}
      </div>
    </div>
  );
}
