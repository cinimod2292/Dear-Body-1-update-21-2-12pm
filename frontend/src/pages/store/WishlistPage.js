import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Heart, ChevronRight, ShoppingBag } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { ProductCard } from '../../components/store/ProductCard';
import { useStore } from '../../context/StoreContext';

export default function WishlistPage() {
  const { wishlist } = useStore();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <nav className="flex items-center gap-2 text-xs font-body text-muted-foreground mb-6">
        <Link to="/" className="hover:text-foreground transition-colors duration-200">Home</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-foreground">Wishlist</span>
      </nav>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-heading text-3xl sm:text-4xl lg:text-5xl mb-2">My Wishlist</h1>
        <p className="font-body text-muted-foreground mb-8">{wishlist.length} items saved</p>
      </motion.div>

      {wishlist.length > 0 ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          {wishlist.map((product, i) => (
            <ProductCard key={product.id} product={product} index={i} />
          ))}
        </div>
      ) : (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mx-auto mb-4">
            <Heart className="w-7 h-7 text-muted-foreground" />
          </div>
          <h2 className="font-heading text-2xl mb-2">Your wishlist is empty</h2>
          <p className="font-body text-muted-foreground mb-6">Save items you love to your wishlist.</p>
          <Button variant="beauty" asChild><Link to="/products">Start Shopping</Link></Button>
        </div>
      )}
    </div>
  );
}
