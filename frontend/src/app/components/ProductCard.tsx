import { useState } from "react";
import { Link } from "react-router";
import { ShoppingBag, Heart, Star } from "lucide-react";
import { Product } from "../data/products";
import { useCart } from "../context/CartContext";

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const { addToCart } = useCart();
  const [wished, setWished] = useState(false);
  const [added, setAdded] = useState(false);
  const purchasable = Boolean(product.variantId) && product.inStock;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!purchasable) return;
    addToCart(product);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  const badgeColors: Record<string, string> = {
    SALE: "bg-red-500",
    BESTSELLER: "bg-pink-500",
    NEW: "bg-lime-500",
  };

  return (
    <Link to={`/product/${product.id}`} className="group block">
      <div className="relative rounded-2xl overflow-hidden bg-white shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
        {/* Image Container */}
        <div
          className="relative overflow-hidden aspect-square"
          style={{ backgroundColor: product.bgColor }}
        >
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />

          {/* Badge */}
          {product.badge && (
            <span className={`absolute top-3 left-3 ${badgeColors[product.badge] || "bg-gray-500"} text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide`}>
              {product.badge}
            </span>
          )}

          {/* Wishlist */}
          <button
            onClick={e => { e.preventDefault(); setWished(!wished); }}
            className={`absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center shadow-md transition-all duration-200 ${wished ? "bg-pink-500 text-white" : "bg-white/90 text-gray-400 hover:text-pink-500"}`}
          >
            <Heart size={16} fill={wished ? "currentColor" : "none"} />
          </button>

          {/* Add to cart overlay */}
          <button
            onClick={handleAddToCart}
            disabled={!purchasable}
            className={`absolute bottom-3 left-3 right-3 py-2.5 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all duration-300 ${
              added
                ? "bg-green-500 text-white scale-95"
                : purchasable
                  ? "bg-white/95 text-gray-800 hover:bg-gradient-to-r hover:from-pink-500 hover:to-orange-400 hover:text-white opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0"
                  : "bg-gray-200 text-gray-500 cursor-not-allowed"
            }`}
          >
            <ShoppingBag size={15} />
            {added ? "Added!" : purchasable ? "Add to Cart" : "Unavailable"}
          </button>
        </div>

        {/* Info */}
        <div className="p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{product.category}</p>
          <h3 className="font-bold text-gray-900 mb-1 truncate">{product.name}</h3>
          <p className="text-sm text-gray-500 mb-3 truncate">{product.tagline}</p>

          {/* Rating */}
          <div className="flex items-center gap-1.5 mb-3">
            <div className="flex items-center gap-0.5">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  size={12}
                  className={i < Math.floor(product.rating) ? "text-yellow-400 fill-yellow-400" : "text-gray-200 fill-gray-200"}
                />
              ))}
            </div>
            <span className="text-xs text-gray-400">({product.reviews})</span>
          </div>

          {/* Price */}
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-900" style={{ color: product.textColor }}>
              R{product.price.toFixed(2)}
            </span>
            {product.originalPrice && (
              <span className="text-sm text-gray-400 line-through">R{product.originalPrice.toFixed(2)}</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
