import React, { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { SlidersHorizontal, Grid3X3, LayoutGrid, ChevronRight } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { ProductCard } from '../../components/store/ProductCard';
import { PRODUCTS, CATEGORIES } from '../../data/mockData';

export default function CategoryPage() {
  const { slug } = useParams();
  const [sortBy, setSortBy] = useState('featured');
  const [gridCols, setGridCols] = useState(3);

  const category = CATEGORIES.find(c => c.slug === slug);
  const products = useMemo(() => {
    let filtered = PRODUCTS.filter(p => p.category === slug);
    switch (sortBy) {
      case 'price-low': return [...filtered].sort((a, b) => a.price - b.price);
      case 'price-high': return [...filtered].sort((a, b) => b.price - a.price);
      case 'rating': return [...filtered].sort((a, b) => b.rating - a.rating);
      default: return filtered;
    }
  }, [slug, sortBy]);

  if (!category) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <h1 className="font-heading text-3xl mb-4">Category Not Found</h1>
        <Button variant="beauty" asChild><Link to="/products">Browse All Products</Link></Button>
      </div>
    );
  }

  return (
    <div>
      {/* Hero */}
      <div className="relative h-56 sm:h-72 overflow-hidden">
        <img src={category.image} alt={category.name} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-foreground/40" />
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="font-heading text-3xl sm:text-4xl lg:text-5xl text-background mb-2">{category.name}</motion.h1>
          <p className="font-body text-sm text-background/70 max-w-md">{category.description}</p>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <nav className="flex items-center gap-2 text-xs font-body text-muted-foreground">
          <Link to="/" className="hover:text-foreground transition-colors duration-200">Home</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-foreground">{category.name}</span>
        </nav>
      </div>

      {/* Toolbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between py-4 border-b border-border">
          <p className="text-sm font-body text-muted-foreground">{products.length} products</p>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1">
              <Button variant={gridCols === 2 ? 'secondary' : 'ghost'} size="icon" onClick={() => setGridCols(2)}>
                <LayoutGrid className="w-4 h-4" />
              </Button>
              <Button variant={gridCols === 3 ? 'secondary' : 'ghost'} size="icon" onClick={() => setGridCols(3)}>
                <Grid3X3 className="w-4 h-4" />
              </Button>
            </div>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-44 h-9 text-xs font-body">
                <SlidersHorizontal className="w-3.5 h-3.5 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="featured">Featured</SelectItem>
                <SelectItem value="price-low">Price: Low to High</SelectItem>
                <SelectItem value="price-high">Price: High to Low</SelectItem>
                <SelectItem value="rating">Top Rated</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Products */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20">
        {products.length > 0 ? (
          <div className={`grid grid-cols-2 ${gridCols === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2'} gap-4 lg:gap-6`}>
            {products.map((product, i) => (
              <ProductCard key={product.id} product={product} index={i} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <p className="text-muted-foreground font-body">No products found in this category.</p>
            <Button variant="beauty" className="mt-4" asChild><Link to="/products">Browse All Products</Link></Button>
          </div>
        )}
      </div>
    </div>
  );
}
