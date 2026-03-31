import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { SlidersHorizontal, X, ChevronDown } from "lucide-react";
import { ProductCard } from "../components/ProductCard";
import { fetchStoreProducts, getCategories, Product } from "../data/products";

const sortOptions = [
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
];

export default function Shop() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCategory = searchParams.get("category") || "All";
  const initialSearch = searchParams.get("search") || "";

  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [sortBy, setSortBy] = useState("price-asc");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 0]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const previousDynamicPriceMax = useRef(0);

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

  const handleCategoryChange = (cat: string) => {
    setSelectedCategory(cat);
    if (cat === "All") {
      setSearchParams(prev => { prev.delete("category"); return prev; });
    } else {
      setSearchParams(prev => { prev.set("category", cat); return prev; });
    }
  };

  const productsForFilters = useMemo(() => {
    let result = [...products];

    if (selectedCategory !== "All") {
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
      const previousMax = previousDynamicPriceMax.current;
      const nextMin = Math.min(Math.max(currentMin, 0), dynamicPriceMax);
      const shouldFollowMax = currentMax >= previousMax;
      const unclampedMax = shouldFollowMax ? dynamicPriceMax : currentMax;
      const nextMax = Math.min(Math.max(unclampedMax, nextMin), dynamicPriceMax);

      if (nextMin === currentMin && nextMax === currentMax) {
        return [currentMin, currentMax];
      }

      return [nextMin, nextMax];
    });

    previousDynamicPriceMax.current = dynamicPriceMax;
  }, [dynamicPriceMax]);

  const filteredProducts = useMemo(() => {
    let result = [...productsForFilters];

    result = result.filter(p => p.price >= priceRange[0] && p.price <= priceRange[1] + 0.01);

    switch (sortBy) {
      case "price-desc":
        result.sort((a, b) => b.price - a.price);
        break;
      case "price-asc":
      default:
        result.sort((a, b) => a.price - b.price);
        break;
    }

    return result;
  }, [productsForFilters, sortBy, priceRange]);

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
            {initialSearch ? `Results for "${initialSearch}"` : "Shop All Products"}
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
                    onChange={e => setPriceRange([priceRange[0], Math.max(priceRange[0], Number(e.target.value))])}
                    className="flex-1 accent-pink-500"
                  />
                  <span className="text-gray-600 text-sm w-12">R{priceRange[1]}</span>
                </div>
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-gray-900 mb-4">Availability</h4>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" defaultChecked className="accent-pink-500" />
                  <span className="text-gray-600 text-sm">In Stock Only</span>
                </label>
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-gray-900 mb-4">On Sale</h4>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="accent-pink-500" />
                  <span className="text-gray-600 text-sm">Sale Items Only</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Products Grid */}
        {loading ? (
          <div className="text-center py-24">
            <h3 className="text-gray-800 mb-2" style={{ fontSize: "1.5rem", fontWeight: 700 }}>Loading products…</h3>
          </div>
        ) : error ? (
          <div className="text-center py-24">
            <h3 className="text-gray-800 mb-2" style={{ fontSize: "1.5rem", fontWeight: 700 }}>Unable to load products</h3>
            <p className="text-gray-500">{error}</p>
          </div>
        ) : filteredProducts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="text-center py-24">
            <p className="text-6xl mb-6">🌈</p>
            <h3 className="text-gray-800 mb-2" style={{ fontSize: "1.5rem", fontWeight: 700 }}>No products found</h3>
            <p className="text-gray-500 mb-6">Try adjusting your filters or search terms</p>
            <button
              onClick={() => { handleCategoryChange("All"); }}
              className="px-6 py-3 bg-gradient-to-r from-pink-500 to-orange-500 text-white rounded-full font-bold"
            >
              Clear Filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
