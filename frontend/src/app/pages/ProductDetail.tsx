import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router";
import { ShoppingBag, Heart, Star, ArrowLeft, Truck, Shield, RotateCcw, Minus, Plus, Check } from "lucide-react";
import { fetchStoreProductById, fetchStoreProducts, Product } from "../data/products";
import { useCart } from "../context/CartContext";
import { ProductCard } from "../components/ProductCard";

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();

  const [product, setProduct] = useState<Product | null>(null);
  const [related, setRelated] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [quantity, setQuantity] = useState(1);
  const [wished, setWished] = useState(false);
  const [added, setAdded] = useState(false);
  const [activeTab, setActiveTab] = useState<"description" | "ingredients" | "howToUse">("description");

  useEffect(() => {
    if (!id) return;

    setLoading(true);
    Promise.all([fetchStoreProductById(id), fetchStoreProducts()])
      .then(([foundProduct, allProducts]) => {
        setProduct(foundProduct);
        if (foundProduct) {
          setRelated(allProducts.filter((item) => item.id !== foundProduct.id && item.category === foundProduct.category).slice(0, 4));
        } else {
          setRelated([]);
        }
      })
      .catch(() => {
        setProduct(null);
        setRelated([]);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <h2 style={{ fontSize: "1.5rem", fontWeight: 700 }} className="text-gray-800">Loading product…</h2>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-6xl">🌈</p>
        <h2 style={{ fontSize: "1.5rem", fontWeight: 700 }} className="text-gray-800">Product not found</h2>
        <Link to="/shop" className="px-6 py-3 bg-gradient-to-r from-pink-500 to-orange-500 text-white rounded-full font-bold">
          Back to Shop
        </Link>
      </div>
    );
  }

  const handleAddToCart = () => {
    if (!product.variantId || !product.inStock) return;
    addToCart(product, quantity);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const handleBuyNow = () => {
    if (!product.variantId || !product.inStock) return;
    addToCart(product, quantity);
    navigate("/cart");
  };

  const savings = product.originalPrice
    ? ((product.originalPrice - product.price) * quantity).toFixed(2)
    : null;

  const badgeColors: Record<string, string> = {
    SALE: "bg-red-500",
    BESTSELLER: "bg-pink-500",
    NEW: "bg-lime-500",
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Breadcrumb */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-4">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Link to="/" className="hover:text-pink-500 transition-colors">Home</Link>
          <span>/</span>
          <Link to="/shop" className="hover:text-pink-500 transition-colors">Shop</Link>
          <span>/</span>
          <Link to={`/shop?category=${product.category}`} className="hover:text-pink-500 transition-colors">{product.category}</Link>
          <span>/</span>
          <span className="text-gray-700 font-medium">{product.name}</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-14">

          {/* ── Image Panel ── */}
          <div className="relative">
            <button
              onClick={() => navigate(-1)}
              className="absolute top-0 left-0 z-10 flex items-center gap-2 text-gray-600 hover:text-pink-500 transition-colors font-medium text-sm"
            >
              <ArrowLeft size={16} /> Back
            </button>

            <div
              className="rounded-3xl overflow-hidden mt-8 aspect-square relative shadow-xl"
              style={{ backgroundColor: product.bgColor }}
            >
              <img
                src={product.image}
                alt={product.name}
                className="w-full h-full object-cover"
              />

              {/* Badge */}
              {product.badge && (
                <div className={`absolute top-5 left-5 ${badgeColors[product.badge]} text-white px-4 py-1.5 rounded-full text-sm font-bold`}>
                  {product.badge}
                </div>
              )}

              {/* Wishlist */}
              <button
                onClick={() => setWished(!wished)}
                className={`absolute top-5 right-5 w-11 h-11 rounded-full flex items-center justify-center shadow-lg transition-all ${wished ? "bg-pink-500 text-white" : "bg-white text-gray-400 hover:text-pink-500"}`}
              >
                <Heart size={20} fill={wished ? "currentColor" : "none"} />
              </button>
            </div>

            {/* Scent tags */}
            <div className="flex flex-wrap gap-2 mt-5">
              {[product.scent, product.category, "Vegan", "Cruelty-Free"].filter(Boolean).map(tag => (
                <span
                  key={tag}
                  className="px-3 py-1.5 rounded-full text-sm font-medium"
                  style={{ backgroundColor: product.bgColor, color: product.textColor }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* ── Product Info ── */}
          <div className="flex flex-col gap-5 pt-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-widest mb-2" style={{ color: product.color }}>
                my DEAR BODY · {product.category}
              </p>
              <h1 className="text-gray-900 mb-2" style={{ fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 900, lineHeight: 1.1 }}>
                {product.name}
              </h1>
              <p className="text-gray-500 text-lg italic">{product.tagline}</p>
            </div>

            {/* Rating */}
            <div className="flex items-center gap-3">
              <div className="flex gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    size={18}
                    className={i < Math.floor(product.rating) ? "text-yellow-400 fill-yellow-400" : "text-gray-200 fill-gray-200"}
                  />
                ))}
              </div>
              <span className="font-bold text-gray-800">{product.rating}</span>
              <span className="text-gray-400 text-sm">({product.reviews} reviews)</span>
            </div>

            {/* Price */}
            <div className="flex items-baseline gap-3">
              <span className="font-black text-3xl" style={{ color: product.textColor }}>R{product.price.toFixed(2)}</span>
              {product.originalPrice && (
                <>
                  <span className="text-gray-400 line-through text-lg">R{product.originalPrice.toFixed(2)}</span>
                  <span className="text-red-500 font-bold text-sm bg-red-50 px-2 py-1 rounded-full">
                    SAVE {Math.round((1 - product.price / product.originalPrice) * 100)}%
                  </span>
                </>
              )}
            </div>

            <p className="text-gray-500 text-sm">{product.size}</p>

            {/* Quantity */}
            <div>
              <p className="text-gray-700 font-bold mb-3">Quantity</p>
              <div className="flex items-center gap-4">
                <div className="flex items-center border-2 border-gray-200 rounded-full overflow-hidden">
                  <button
                    onClick={() => setQuantity(q => Math.max(1, q - 1))}
                    className="w-11 h-11 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors"
                  >
                    <Minus size={16} />
                  </button>
                  <span className="w-10 text-center font-bold text-gray-900">{quantity}</span>
                  <button
                    onClick={() => setQuantity(q => q + 1)}
                    className="w-11 h-11 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                {savings && (
                  <span className="text-green-600 text-sm font-medium">You save R{savings}!</span>
                )}
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleAddToCart}
                disabled={!product.variantId || !product.inStock}
                className={`flex-1 py-4 rounded-full font-bold flex items-center justify-center gap-2 transition-all duration-300 ${
                  added
                    ? "bg-green-500 text-white"
                    : product.variantId && product.inStock
                      ? "bg-gradient-to-r from-pink-500 to-orange-500 text-white hover:opacity-90 hover:scale-[1.02] shadow-lg shadow-pink-200"
                      : "bg-gray-300 text-gray-600 cursor-not-allowed"
                }`}
              >
                {added ? <><Check size={18} /> Added to Cart!</> : <><ShoppingBag size={18} /> {product.variantId && product.inStock ? "Add to Cart" : "Unavailable"}</>}
              </button>
              <button
                onClick={handleBuyNow}
                disabled={!product.variantId || !product.inStock}
                className="flex-1 py-4 rounded-full font-bold border-2 text-gray-800 hover:border-pink-400 hover:text-pink-500 transition-all duration-200"
                style={{ borderColor: product.color }}
              >
                Buy Now
              </button>
            </div>

            {/* Trust Badges */}
            <div className="grid grid-cols-3 gap-3 py-4 border-t border-b border-gray-100">
              {[
                { icon: Truck, label: "Free Shipping", sub: "Orders R50+" },
                { icon: RotateCcw, label: "30-Day Returns", sub: "Hassle-free" },
                { icon: Shield, label: "Secure Payment", sub: "100% Protected" },
              ].map(b => (
                <div key={b.label} className="flex flex-col items-center text-center gap-1">
                  <b.icon size={20} className="text-pink-500" />
                  <p className="text-xs font-bold text-gray-700">{b.label}</p>
                  <p className="text-xs text-gray-400">{b.sub}</p>
                </div>
              ))}
            </div>

            {/* Tabs */}
            <div>
              <div className="flex gap-0 border-b border-gray-200 mb-5">
                {(["description", "ingredients", "howToUse"] as const).map(tab => {
                  const labels = { description: "Description", ingredients: "Ingredients", howToUse: "How To Use" };
                  return (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-5 py-3 text-sm font-bold transition-colors border-b-2 -mb-px ${
                        activeTab === tab
                          ? "border-pink-500 text-pink-500"
                          : "border-transparent text-gray-400 hover:text-gray-700"
                      }`}
                    >
                      {labels[tab]}
                    </button>
                  );
                })}
              </div>
              <p className="text-gray-600 text-sm leading-relaxed">
                {product[activeTab]}
              </p>
            </div>
          </div>
        </div>

        {/* ── Related Products ── */}
        {related.length > 0 && (
          <div className="mt-20">
            <h2 className="text-gray-900 mb-8 text-center" style={{ fontSize: "2rem", fontWeight: 900 }}>
              You Might Also Love 💕
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {related.map(p => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
