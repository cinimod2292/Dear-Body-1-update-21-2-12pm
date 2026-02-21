import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { SlidersHorizontal, Grid3X3, LayoutGrid, ChevronRight, X } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Checkbox } from '../../components/ui/checkbox';
import { Separator } from '../../components/ui/separator';
import { ProductCard } from '../../components/store/ProductCard';
import { PRODUCTS, CATEGORIES } from '../../data/mockData';

export default function ProductListPage() {
  const [sortBy, setSortBy] = useState('featured');
  const [gridCols, setGridCols] = useState(4);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [showFilters, setShowFilters] = useState(false);

  const toggleCategory = (catId) => {
    setSelectedCategories(prev =>
      prev.includes(catId) ? prev.filter(c => c !== catId) : [...prev, catId]
    );
  };

  const products = useMemo(() => {
    let filtered = selectedCategories.length > 0
      ? PRODUCTS.filter(p => selectedCategories.includes(p.category))
      : PRODUCTS;
    switch (sortBy) {
      case 'price-low': return [...filtered].sort((a, b) => a.price - b.price);
      case 'price-high': return [...filtered].sort((a, b) => b.price - a.price);
      case 'rating': return [...filtered].sort((a, b) => b.rating - a.rating);
      case 'newest': return [...filtered].sort((a, b) => (b.tags?.includes('new') ? 1 : 0) - (a.tags?.includes('new') ? 1 : 0));
      default: return filtered;
    }
  }, [sortBy, selectedCategories]);

  return (
    <div>
      {/* Breadcrumb */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <nav className="flex items-center gap-2 text-xs font-body text-muted-foreground">
          <Link to="/" className="hover:text-foreground transition-colors duration-200">Home</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-foreground">All Products</span>
        </nav>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="font-heading text-3xl sm:text-4xl lg:text-5xl mb-2">All Products</h1>
          <p className="font-body text-muted-foreground">{products.length} products</p>
        </motion.div>

        {/* Active Filters */}
        {selectedCategories.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-6">
            <span className="text-xs font-body text-muted-foreground">Filters:</span>
            {selectedCategories.map(catId => {
              const cat = CATEGORIES.find(c => c.id === catId);
              return (
                <Badge key={catId} variant="secondary" className="gap-1 cursor-pointer font-body" onClick={() => toggleCategory(catId)}>
                  {cat?.name} <X className="w-3 h-3" />
                </Badge>
              );
            })}
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => setSelectedCategories([])}>Clear all</Button>
          </div>
        )}

        <div className="flex gap-8">
          {/* Sidebar Filters - Desktop */}
          <aside className="hidden lg:block w-56 flex-shrink-0">
            <h3 className="font-body text-sm font-semibold uppercase tracking-wider mb-4">Categories</h3>
            <div className="space-y-3">
              {CATEGORIES.map(cat => (
                <label key={cat.id} className="flex items-center gap-3 cursor-pointer group">
                  <Checkbox
                    checked={selectedCategories.includes(cat.id)}
                    onCheckedChange={() => toggleCategory(cat.id)}
                    className="rounded-sm"
                  />
                  <span className="text-sm font-body text-muted-foreground group-hover:text-foreground transition-colors duration-200">{cat.name}</span>
                  <span className="text-xs text-muted-foreground ml-auto">({cat.count})</span>
                </label>
              ))}
            </div>
            <Separator className="my-6" />
            <h3 className="font-body text-sm font-semibold uppercase tracking-wider mb-4">Price Range</h3>
            <div className="space-y-2">
              {['Under R20', 'R20 - R35', 'R35 - R50', 'Over R50'].map(range => (
                <p key={range} className="text-sm font-body text-muted-foreground hover:text-foreground cursor-pointer transition-colors duration-200">{range}</p>
              ))}
            </div>
          </aside>

          {/* Main content */}
          <div className="flex-1">
            {/* Toolbar */}
            <div className="flex items-center justify-between pb-4 border-b border-border mb-6">
              <Button variant="outline" size="sm" className="lg:hidden text-xs" onClick={() => setShowFilters(!showFilters)}>
                <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5" /> Filters
              </Button>
              <div className="flex items-center gap-3 ml-auto">
                <div className="hidden sm:flex items-center gap-1">
                  <Button variant={gridCols === 3 ? 'secondary' : 'ghost'} size="icon" onClick={() => setGridCols(3)}>
                    <Grid3X3 className="w-4 h-4" />
                  </Button>
                  <Button variant={gridCols === 4 ? 'secondary' : 'ghost'} size="icon" onClick={() => setGridCols(4)}>
                    <LayoutGrid className="w-4 h-4" />
                  </Button>
                </div>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-44 h-9 text-xs font-body">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="featured">Featured</SelectItem>
                    <SelectItem value="newest">Newest</SelectItem>
                    <SelectItem value="price-low">Price: Low to High</SelectItem>
                    <SelectItem value="price-high">Price: High to Low</SelectItem>
                    <SelectItem value="rating">Top Rated</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Mobile Filters */}
            {showFilters && (
              <div className="lg:hidden mb-6 p-4 bg-card rounded-lg border border-border animate-fade-in">
                <h3 className="font-body text-sm font-semibold uppercase tracking-wider mb-3">Categories</h3>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map(cat => (
                    <Badge
                      key={cat.id}
                      variant={selectedCategories.includes(cat.id) ? 'default' : 'outline'}
                      className="cursor-pointer font-body"
                      onClick={() => toggleCategory(cat.id)}
                    >
                      {cat.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Products Grid */}
            <div className={`grid grid-cols-2 ${gridCols === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-4 lg:gap-6`}>
              {products.map((product, i) => (
                <ProductCard key={product.id} product={product} index={i} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
