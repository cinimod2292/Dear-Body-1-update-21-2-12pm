import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, ShoppingBag, Heart, User, Menu, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Sheet, SheetContent, SheetTrigger } from '../ui/sheet';
import { useStore } from '../../context/StoreContext';
import { CATEGORIES } from '../../data/mockData';

export function Navbar() {
  const { cartCount, toggleCart, wishlist, searchQuery, setSearch } = useStore();
  const [searchOpen, setSearchOpen] = useState(false);
  const navigate = useNavigate();

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
      setSearchOpen(false);
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b border-border">
      {/* Promo bar */}
      <div className="bg-foreground text-background text-center py-2 px-4">
        <p className="text-xs font-body tracking-wider">FREE SHIPPING ON ORDERS OVER R50 &bull; USE CODE: <span className="font-semibold">DEARBODY</span></p>
      </div>

      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-20">
          {/* Mobile menu */}
          <Sheet>
            <SheetTrigger asChild className="lg:hidden">
              <Button variant="ghost" size="icon">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80 bg-card">
              <div className="py-6 space-y-6">
                <Link to="/" className="font-heading text-2xl font-semibold tracking-wider block">DEAR BODY</Link>
                <nav className="space-y-1">
                  <Link to="/products" className="block py-3 text-sm font-body uppercase tracking-wider text-foreground hover:text-primary transition-colors duration-200 border-b border-border">Shop All</Link>
                  {CATEGORIES.map(cat => (
                    <Link key={cat.id} to={`/category/${cat.slug}`} className="block py-3 text-sm font-body uppercase tracking-wider text-foreground hover:text-primary transition-colors duration-200 border-b border-border">{cat.name}</Link>
                  ))}
                  <Link to="/wishlist" className="block py-3 text-sm font-body uppercase tracking-wider text-foreground hover:text-primary transition-colors duration-200 border-b border-border">Wishlist</Link>
                  <Link to="/admin" className="block py-3 text-sm font-body uppercase tracking-wider text-muted-foreground hover:text-primary transition-colors duration-200">Admin Panel</Link>
                </nav>
              </div>
            </SheetContent>
          </Sheet>

          {/* Logo */}
          <Link to="/" className="font-heading text-xl sm:text-2xl lg:text-3xl font-semibold tracking-[0.15em] text-foreground">
            DEAR BODY
          </Link>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-8">
            <Link to="/products" className="text-xs font-body uppercase tracking-[0.15em] text-foreground hover:text-primary transition-colors duration-200">Shop All</Link>
            {CATEGORIES.slice(0, 4).map(cat => (
              <Link key={cat.id} to={`/category/${cat.slug}`} className="text-xs font-body uppercase tracking-[0.15em] text-foreground hover:text-primary transition-colors duration-200">{cat.name}</Link>
            ))}
            <Link to="/category/gift-sets" className="text-xs font-body uppercase tracking-[0.15em] text-primary font-semibold">Gifts</Link>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => setSearchOpen(!searchOpen)}>
              <Search className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" asChild className="relative">
              <Link to="/wishlist">
                <Heart className="w-5 h-5" />
                {wishlist.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-body font-bold flex items-center justify-center">{wishlist.length}</span>
                )}
              </Link>
            </Button>
            <Button variant="ghost" size="icon" asChild className="hidden sm:flex">
              <Link to="/admin"><User className="w-5 h-5" /></Link>
            </Button>
            <Button variant="ghost" size="icon" onClick={toggleCart} className="relative">
              <ShoppingBag className="w-5 h-5" />
              {cartCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-body font-bold flex items-center justify-center">{cartCount}</span>
              )}
            </Button>
          </div>
        </div>

        {/* Search bar */}
        {searchOpen && (
          <div className="pb-4 animate-fade-in">
            <form onSubmit={handleSearch} className="relative">
              <Input
                value={searchQuery}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products, categories..."
                className="w-full h-12 pl-12 pr-12 rounded-sm bg-secondary border-0 font-body text-sm focus-visible:ring-primary"
                autoFocus
              />
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <button type="button" onClick={() => setSearchOpen(false)} className="absolute right-4 top-1/2 -translate-y-1/2">
                <X className="w-4 h-4 text-muted-foreground hover:text-foreground transition-colors duration-200" />
              </button>
            </form>
          </div>
        )}
      </nav>
    </header>
  );
}
