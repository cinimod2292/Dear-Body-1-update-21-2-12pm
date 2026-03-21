import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { ShoppingBag, Search, Menu, X, Heart } from "lucide-react";
import { useCart } from "../context/CartContext";
import logoImage from "figma:asset/2f83d3b5e95347ddf4ffa7687e1ec032dc27ba54.png";

export function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { cartCount } = useCart();
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/shop?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchOpen(false);
      setSearchQuery("");
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm shadow-sm">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-pink-500 via-red-400 to-orange-400 text-white text-center py-2 text-sm font-medium tracking-wide">
        🌈 FREE SHIPPING on orders over R50 · Use code <span className="font-bold underline">DEARBODY20</span> for 20% off!
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <img
              src={logoImage}
              alt="Dear Body"
              className="h-10 w-auto object-contain"
            />
          </Link>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-8">
            <Link to="/" className="text-gray-700 hover:text-pink-500 font-medium transition-colors duration-200">Home</Link>
            <Link to="/shop" className="text-gray-700 hover:text-pink-500 font-medium transition-colors duration-200">Shop</Link>
            <Link to="/shop?category=Body+Spray" className="text-gray-700 hover:text-pink-500 font-medium transition-colors duration-200">Body Sprays</Link>
            <Link to="/shop?category=Body+Lotion" className="text-gray-700 hover:text-pink-500 font-medium transition-colors duration-200">Skincare</Link>
            <Link to="/about" className="text-gray-700 hover:text-pink-500 font-medium transition-colors duration-200">About</Link>
          </div>

          {/* Icons */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSearchOpen(!searchOpen)}
              className="p-2 text-gray-600 hover:text-pink-500 transition-colors"
              aria-label="Search"
            >
              <Search size={20} />
            </button>
            <button className="p-2 text-gray-600 hover:text-pink-500 transition-colors hidden sm:block" aria-label="Wishlist">
              <Heart size={20} />
            </button>
            <Link to="/cart" className="relative p-2 text-gray-600 hover:text-pink-500 transition-colors">
              <ShoppingBag size={20} />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-br from-pink-500 to-red-500 rounded-full text-white text-xs flex items-center justify-center font-bold">
                  {cartCount > 9 ? "9+" : cartCount}
                </span>
              )}
            </Link>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-2 text-gray-600 hover:text-pink-500 transition-colors md:hidden"
              aria-label="Menu"
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Search Bar */}
        {searchOpen && (
          <div className="pb-4">
            <form onSubmit={handleSearch} className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search for products..."
                autoFocus
                className="flex-1 px-4 py-2 rounded-full border-2 border-pink-300 focus:border-pink-500 outline-none text-gray-800 bg-pink-50"
              />
              <button type="submit" className="px-6 py-2 bg-gradient-to-r from-pink-500 to-red-500 text-white rounded-full font-medium hover:opacity-90 transition-opacity">
                Search
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 px-4 py-4 flex flex-col gap-4">
          <Link to="/" onClick={() => setMenuOpen(false)} className="text-gray-700 font-medium py-2 border-b border-gray-100">Home</Link>
          <Link to="/shop" onClick={() => setMenuOpen(false)} className="text-gray-700 font-medium py-2 border-b border-gray-100">Shop All</Link>
          <Link to="/shop?category=Body+Spray" onClick={() => setMenuOpen(false)} className="text-gray-700 font-medium py-2 border-b border-gray-100">Body Sprays</Link>
          <Link to="/shop?category=Body+Lotion" onClick={() => setMenuOpen(false)} className="text-gray-700 font-medium py-2 border-b border-gray-100">Skincare</Link>
          <Link to="/about" onClick={() => setMenuOpen(false)} className="text-gray-700 font-medium py-2">About</Link>
        </div>
      )}
    </nav>
  );
}