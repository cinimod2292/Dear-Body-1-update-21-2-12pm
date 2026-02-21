import React, { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Heart, ShoppingBag, Star, Minus, Plus, ChevronRight, Check, Truck, RotateCcw, Shield } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Separator } from '../../components/ui/separator';
import { ProductCard } from '../../components/store/ProductCard';
import { useStore } from '../../context/StoreContext';
import { PRODUCTS } from '../../data/mockData';
import { toast } from 'sonner';

export default function ProductDetailPage() {
  const { slug } = useParams();
  const { addToCart, toggleWishlist, isInWishlist, toggleCart } = useStore();
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);

  const product = PRODUCTS.find(p => p.slug === slug);
  const wishlisted = product ? isInWishlist(product.id) : false;

  const relatedProducts = useMemo(() => {
    if (!product) return [];
    return PRODUCTS.filter(p => p.category === product.category && p.id !== product.id).slice(0, 4);
  }, [product]);

  if (!product) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <h1 className="font-heading text-3xl mb-4">Product Not Found</h1>
        <Button variant="beauty" asChild><Link to="/products">Browse Products</Link></Button>
      </div>
    );
  }

  const handleAddToCart = () => {
    for (let i = 0; i < quantity; i++) {
      addToCart(product);
    }
    toast.success(`${product.name} added to bag`, { description: `Quantity: ${quantity}` });
    toggleCart();
  };

  const discount = product.originalPrice
    ? Math.round((1 - product.price / product.originalPrice) * 100)
    : 0;

  return (
    <div>
      {/* Breadcrumb */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <nav className="flex items-center gap-2 text-xs font-body text-muted-foreground">
          <Link to="/" className="hover:text-foreground transition-colors duration-200">Home</Link>
          <ChevronRight className="w-3 h-3" />
          <Link to="/products" className="hover:text-foreground transition-colors duration-200">Products</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-foreground truncate">{product.name}</span>
        </nav>
      </div>

      {/* Product */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-16">
          {/* Images */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
            <div className="aspect-square rounded-lg overflow-hidden bg-secondary mb-4">
              <img
                src={product.images[selectedImage] || product.image}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            </div>
            {product.images.length > 1 && (
              <div className="flex gap-3">
                {product.images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedImage(i)}
                    className={`w-20 h-20 rounded-md overflow-hidden border-2 transition-colors duration-200 ${selectedImage === i ? 'border-primary' : 'border-transparent'}`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </motion.div>

          {/* Info */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
            <div className="space-y-6">
              <div>
                <p className="text-xs font-body uppercase tracking-[0.2em] text-primary mb-2">{product.category?.replace('-', ' ')}</p>
                <h1 className="font-heading text-3xl sm:text-4xl lg:text-5xl leading-tight mb-3">{product.name}</h1>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className={`w-4 h-4 ${i < Math.floor(product.rating) ? 'fill-warning text-warning' : 'text-border'}`} />
                    ))}
                  </div>
                  <span className="text-sm font-body text-muted-foreground">{product.rating} ({product.reviews} reviews)</span>
                </div>
              </div>

              <div className="flex items-baseline gap-3">
                <span className="font-heading text-3xl text-foreground">R{product.price.toFixed(2)}</span>
                {product.originalPrice && (
                  <>
                    <span className="font-body text-lg text-muted-foreground line-through">R{product.originalPrice.toFixed(2)}</span>
                    <Badge className="bg-accent text-accent-foreground text-xs border-0 rounded-sm font-body">Save {discount}%</Badge>
                  </>
                )}
              </div>

              <p className="font-body text-muted-foreground leading-relaxed">{product.description}</p>

              {product.volume && (
                <div>
                  <span className="text-xs font-body uppercase tracking-wider text-muted-foreground">Size</span>
                  <div className="mt-2">
                    <Badge variant="outline" className="px-4 py-1.5 font-body text-sm cursor-pointer border-foreground">{product.volume}</Badge>
                  </div>
                </div>
              )}

              <Separator />

              {/* Quantity & Add to Cart */}
              <div className="flex items-center gap-4">
                <div className="flex items-center border border-border rounded-sm">
                  <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-10 h-10 flex items-center justify-center hover:bg-secondary transition-colors duration-200">
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-12 text-center font-body text-sm">{quantity}</span>
                  <button onClick={() => setQuantity(quantity + 1)} className="w-10 h-10 flex items-center justify-center hover:bg-secondary transition-colors duration-200">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <Button onClick={handleAddToCart} variant="elegant" size="lg" className="flex-1 rounded-sm">
                  <ShoppingBag className="w-4 h-4" /> Add to Bag — R{(product.price * quantity).toFixed(2)}
                </Button>
                <Button
                  onClick={() => { toggleWishlist(product); toast(wishlisted ? 'Removed from wishlist' : 'Added to wishlist'); }}
                  variant="outline"
                  size="icon"
                  className="rounded-sm h-10 w-10"
                >
                  <Heart className={`w-4 h-4 ${wishlisted ? 'fill-primary text-primary' : ''}`} />
                </Button>
              </div>

              {/* Perks */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  { icon: Truck, label: 'Free Shipping', desc: 'Over R50' },
                  { icon: RotateCcw, label: 'Easy Returns', desc: '30 days' },
                  { icon: Shield, label: 'Secure', desc: 'Checkout' },
                ].map((perk) => (
                  <div key={perk.label} className="text-center p-3 rounded-md bg-secondary/50">
                    <perk.icon className="w-4 h-4 mx-auto mb-1.5 text-primary" />
                    <p className="text-xs font-body font-medium">{perk.label}</p>
                    <p className="text-[10px] font-body text-muted-foreground">{perk.desc}</p>
                  </div>
                ))}
              </div>

              {product.stock < 20 && (
                <p className="flex items-center gap-2 text-sm font-body text-primary">
                  <Check className="w-4 h-4" /> Only {product.stock} left in stock
                </p>
              )}
            </div>
          </motion.div>
        </div>

        {/* Tabs */}
        <div className="mt-16">
          <Tabs defaultValue="details">
            <TabsList className="bg-transparent border-b border-border rounded-none w-full justify-start gap-8 h-auto p-0">
              <TabsTrigger value="details" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none bg-transparent font-body text-sm px-0 pb-3">Details</TabsTrigger>
              {product.notes && <TabsTrigger value="notes" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none bg-transparent font-body text-sm px-0 pb-3">Fragrance Notes</TabsTrigger>}
              <TabsTrigger value="ingredients" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none bg-transparent font-body text-sm px-0 pb-3">Ingredients</TabsTrigger>
              <TabsTrigger value="reviews" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none bg-transparent font-body text-sm px-0 pb-3">Reviews ({product.reviews})</TabsTrigger>
            </TabsList>
            <TabsContent value="details" className="pt-6">
              <p className="font-body text-muted-foreground leading-relaxed max-w-2xl">{product.description}</p>
            </TabsContent>
            {product.notes && (
              <TabsContent value="notes" className="pt-6">
                <div className="grid sm:grid-cols-3 gap-6 max-w-2xl">
                  {Object.entries(product.notes).map(([key, value]) => (
                    <div key={key} className="p-4 rounded-md bg-secondary/50">
                      <p className="text-xs font-body uppercase tracking-wider text-primary mb-1">{key} Notes</p>
                      <p className="font-body text-sm text-foreground">{value}</p>
                    </div>
                  ))}
                </div>
              </TabsContent>
            )}
            <TabsContent value="ingredients" className="pt-6">
              <p className="font-body text-sm text-muted-foreground max-w-2xl">{product.ingredients}</p>
            </TabsContent>
            <TabsContent value="reviews" className="pt-6">
              <p className="font-body text-muted-foreground">Reviews are simulated in this prototype. {product.reviews} customers have rated this product {product.rating}/5 stars.</p>
            </TabsContent>
          </Tabs>
        </div>

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <div className="mt-20">
            <h2 className="font-heading text-2xl sm:text-3xl mb-8">You May Also Like</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
              {relatedProducts.map((p, i) => (
                <ProductCard key={p.id} product={p} index={i} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
