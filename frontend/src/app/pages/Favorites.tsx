import { Link } from "react-router";
import { Heart } from "lucide-react";
import { useMemo } from "react";
import { ProductCard } from "../components/ProductCard";
import { useCustomerAuth } from "../context/CustomerAuthContext";
import { useFavorites } from "../context/FavoritesContext";
import { fetchStoreProducts } from "../data/products";
import { useEffect, useState } from "react";
import type { Product } from "../data/products";

export default function Favorites() {
  const { customer } = useCustomerAuth();
  const { favorites, isFavorited } = useFavorites();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!customer) return;
    setLoading(true);
    fetchStoreProducts()
      .then(setProducts)
      .finally(() => setLoading(false));
  }, [customer]);

  const favoriteProducts = useMemo(() => {
    if (!favorites.length) return [];
    return products.filter((product) => isFavorited(product.id));
  }, [favorites, isFavorited, products]);

  if (!customer) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-14 text-center">
        <Heart size={40} className="mx-auto text-pink-500 mb-4" />
        <h1 className="text-3xl font-black text-gray-900">Sign in to view your favorites</h1>
        <p className="mt-3 text-gray-600">Create an account or log in to save and manage your wishlist.</p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link to={`/account/login?next=${encodeURIComponent("/favorites")}`} className="px-6 py-3 rounded-full bg-gradient-to-r from-pink-500 to-orange-500 text-white font-bold">Log in</Link>
          <Link to={`/account/register?next=${encodeURIComponent("/favorites")}`} className="px-6 py-3 rounded-full border border-gray-300 text-gray-700 font-semibold">Register</Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="max-w-7xl mx-auto px-4 py-14"><h1 className="text-3xl font-black text-gray-900">My Favorites</h1><p className="mt-3 text-gray-500">Loading favorites…</p></div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-14">
      <h1 className="text-3xl font-black text-gray-900">My Favorites</h1>
      <p className="mt-2 text-gray-500">{favoriteProducts.length} saved item{favoriteProducts.length === 1 ? "" : "s"}</p>

      {favoriteProducts.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-gray-200 bg-white p-8 text-center">
          <p className="text-gray-700 font-semibold">Your favorites list is empty.</p>
          <p className="text-gray-500 mt-2">Tap the heart on products to add them here.</p>
          <Link to="/shop" className="inline-block mt-5 px-6 py-3 rounded-full bg-gradient-to-r from-pink-500 to-orange-500 text-white font-bold">Browse products</Link>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {favoriteProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
