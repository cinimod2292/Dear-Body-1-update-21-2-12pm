import React from 'react';
import { Link } from 'react-router-dom';
import { Heart, ShoppingBag, Star } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { useStore } from '../../context/StoreContext';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

export function ProductCard({ product, index = 0 }) {
  const { addToCart, toggleWishlist, isInWishlist, toggleCart } = useStore();
  const wishlisted = isInWishlist(product.id);

  const handleAddToCart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart(product);
    toast.success(`${product.name} added to bag`);
    toggleCart();
  };

  const handleWishlist = (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleWishlist(product);
    toast(wishlisted ? 'Removed from wishlist' : 'Added to wishlist');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
      className="group flex flex-col"
    >
      <Link to={`/product/${product.slug}`} className="flex flex-col flex-1">
        <div className="relative overflow-hidden rounded-lg bg-secondary aspect-[3/4] mb-4">
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            loading="lazy"
          />
          {/* Tags */}
          <div className="absolute top-3 left-3 flex flex-col gap-1.5">
            {product.tags?.includes('new') && (
              <Badge className="bg-foreground text-background text-[10px] uppercase tracking-widest font-body font-semibold px-2.5 py-1 border-0 rounded-sm">New</Badge>
            )}
            {product.tags?.includes('bestseller') && (
              <Badge className="bg-primary text-primary-foreground text-[10px] uppercase tracking-widest font-body font-semibold px-2.5 py-1 border-0 rounded-sm">Best Seller</Badge>
            )}
            {product.originalPrice && (
              <Badge className="bg-accent text-accent-foreground text-[10px] uppercase tracking-widest font-body font-semibold px-2.5 py-1 border-0 rounded-sm">Sale</Badge>
            )}
          </div>

          {/* Wishlist button */}
          <button
            onClick={handleWishlist}
            className="absolute top-3 right-3 w-9 h-9 rounded-full bg-card/80 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 hover:bg-card"
            aria-label="Add to wishlist"
          >
            <Heart
              className={`w-4 h-4 transition-colors duration-200 ${wishlisted ? 'fill-primary text-primary' : 'text-foreground'}`}
            />
          </button>

          {/* Quick add */}
          <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out">
            <Button
              onClick={handleAddToCart}
              className="w-full rounded-sm"
              variant="elegant"
              size="sm"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              Add to Bag
            </Button>
          </div>
        </div>

        <div className="flex flex-col flex-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1 font-body">{product.category?.replace('-', ' ')}</p>
          <h3 className="font-heading text-lg leading-snug mb-2 text-foreground group-hover:text-primary transition-colors duration-200">{product.name}</h3>
          <div className="flex items-center gap-1.5 mb-2">
            <div className="flex items-center gap-0.5">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className={`w-3 h-3 ${i < Math.floor(product.rating) ? 'fill-warning text-warning' : 'text-border'}`} />
              ))}
            </div>
            <span className="text-xs text-muted-foreground font-body">({product.reviews})</span>
          </div>
          <div className="flex items-center gap-2 mt-auto">
            <span className="font-body font-semibold text-foreground">R{product.price.toFixed(2)}</span>
            {product.originalPrice && (
              <span className="font-body text-sm text-muted-foreground line-through">R{product.originalPrice.toFixed(2)}</span>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
