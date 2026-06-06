import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { ShoppingBag, Search, Menu, X, Heart, User } from "lucide-react";
import { useCart } from "../context/CartContext";
import logoImage from "../../assets/2f83d3b5e95347ddf4ffa7687e1ec032dc27ba54.png";
import { fetchCmsBootstrap } from "../lib/cms";
import { useCustomerAuth } from "../context/CustomerAuthContext";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "./ui/dropdown-menu";

export function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [logo2xUrl, setLogo2xUrl] = useState("");
  const [navItems, setNavItems] = useState<Array<{ label: string; href: string }>>([
    { label: "Home", href: "/" },
    { label: "Shop", href: "/shop" },
    { label: "About", href: "/about" },
  ]);
  const { cartCount } = useCart();
  const { customer, logout } = useCustomerAuth();
  const navigate = useNavigate();
  const favoritesHref = customer ? "/favorites" : `/account/login?next=${encodeURIComponent("/favorites")}`;

  useEffect(() => {
    fetchCmsBootstrap()
      .then((bootstrap) => {
        setAnnouncement(bootstrap.siteConfig.header.announcementText ?? "");
        setLogoUrl(bootstrap.siteConfig.branding.logoUrl || bootstrap.siteConfig.header.logoUrl || "");
        setLogo2xUrl(bootstrap.siteConfig.branding.logo2xUrl || bootstrap.siteConfig.header.logo2xUrl || "");
        const items = bootstrap.siteConfig.navigation.items.filter((i) => i.enabled).map((i) => ({ label: i.label, href: i.href }));
        if (items.length > 0) setNavItems(items);
      })
      .catch(() => undefined);
  }, []);



  const handleLogout = () => {
    logout();
    navigate("/account/login");
  };

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
      <div className="bg-gradient-to-r from-pink-500 via-red-400 to-orange-400 text-white text-center py-2 text-sm font-medium tracking-wide">{announcement}</div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2">
            <img
              src={logoUrl || logoImage}
              srcSet={logo2xUrl ? `${logoUrl || logoImage} 1x, ${logo2xUrl} 2x` : undefined}
              alt="Dear Body"
              className="h-10 w-auto object-contain"
            />
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {navItems.map((item) => (
              <Link key={item.href + item.label} to={item.href} className="text-gray-700 hover:text-pink-500 font-medium transition-colors duration-200">
                {item.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button onClick={() => setSearchOpen(!searchOpen)} className="p-2 text-gray-600 hover:text-pink-500 transition-colors" aria-label="Search"><Search size={20} /></button>
            <Link
              to={favoritesHref}
              className="p-2 text-gray-600 hover:text-pink-500 focus-visible:text-pink-500 focus-visible:outline-none transition-colors hidden sm:block"
              aria-label={customer ? "Wishlist" : "Login to view wishlist"}
            >
              <Heart size={20} />
            </Link>
            {customer ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="p-2 text-gray-600 hover:text-pink-500 focus-visible:text-pink-500 focus-visible:outline-none transition-colors"
                    aria-label="My account"
                  >
                    <User size={20} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem asChild>
                    <Link to="/account">My Account</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/account/orders">Orders</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}>Logout</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link
                to="/account/login"
                className="p-2 text-gray-600 hover:text-pink-500 focus-visible:text-pink-500 focus-visible:outline-none transition-colors"
                aria-label="Customer login"
              >
                <User size={20} />
              </Link>
            )}
            <Link to="/cart" className="relative p-2 text-gray-600 hover:text-pink-500 focus-visible:text-pink-500 focus-visible:outline-none transition-colors" aria-label="Cart">
              <ShoppingBag size={20} />
              {cartCount > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-br from-pink-500 to-red-500 rounded-full text-white text-xs flex items-center justify-center font-bold">{cartCount > 9 ? "9+" : cartCount}</span>}
            </Link>
            <button onClick={() => setMenuOpen(!menuOpen)} className="p-2 text-gray-600 hover:text-pink-500 transition-colors md:hidden" aria-label="Menu">{menuOpen ? <X size={20} /> : <Menu size={20} />}</button>
          </div>
        </div>

        {searchOpen && (
          <div className="pb-4">
            <form onSubmit={handleSearch} className="flex gap-2">
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search for products..." autoFocus className="flex-1 px-4 py-2 rounded-full border-2 border-pink-300 focus:border-pink-500 outline-none text-gray-800 bg-pink-50" />
              <button type="submit" className="px-6 py-2 bg-gradient-to-r from-pink-500 to-red-500 text-white rounded-full font-medium hover:opacity-90 transition-opacity">Search</button>
            </form>
          </div>
        )}
      </div>

      {menuOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 px-4 py-4 flex flex-col gap-4">
          {navItems.map((item) => (
            <Link key={item.href + item.label} to={item.href} onClick={() => setMenuOpen(false)} className="text-gray-700 font-medium py-2 border-b border-gray-100">{item.label}</Link>
          ))}
        </div>
      )}
    </nav>
  );
}
