import React, { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, ChevronRight } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { ProductCard } from '../../components/store/ProductCard';
import { PRODUCTS } from '../../data/mockData';

export default function SearchResults() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return PRODUCTS.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q)
    );
  }, [query]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <nav className="flex items-center gap-2 text-xs font-body text-muted-foreground mb-6">
        <Link to="/" className="hover:text-foreground transition-colors duration-200">Home</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-foreground">Search</span>
      </nav>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-heading text-3xl sm:text-4xl mb-2">
          {query ? `Results for "${query}"` : 'Search Products'}
        </h1>
        <p className="font-body text-muted-foreground mb-8">{results.length} products found</p>
      </motion.div>

      {results.length > 0 ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          {results.map((product, i) => (
            <ProductCard key={product.id} product={product} index={i} />
          ))}
        </div>
      ) : (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mx-auto mb-4">
            <Search className="w-7 h-7 text-muted-foreground" />
          </div>
          <h2 className="font-heading text-2xl mb-2">No results found</h2>
          <p className="font-body text-muted-foreground mb-6 max-w-md mx-auto">
            {query ? `We couldn't find any products matching "${query}". Try a different search term.` : 'Start typing to search for products.'}
          </p>
          <Button variant="beauty" asChild><Link to="/products">Browse All Products</Link></Button>
        </div>
      )}
    </div>
  );
}
