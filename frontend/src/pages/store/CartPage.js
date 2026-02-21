import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Minus, Plus, X, ChevronRight, ShoppingBag, ArrowRight, Truck } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Separator } from '../../components/ui/separator';
import { useStore } from '../../context/StoreContext';

export default function CartPage() {
  const { cart, cartTotal, updateQuantity, removeFromCart } = useStore();
  const shipping = cartTotal >= 50 ? 0 : 4.99;
  const total = cartTotal + shipping;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <nav className="flex items-center gap-2 text-xs font-body text-muted-foreground mb-6">
        <Link to="/" className="hover:text-foreground transition-colors duration-200">Home</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-foreground">Shopping Bag</span>
      </nav>

      <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="font-heading text-3xl sm:text-4xl lg:text-5xl mb-8">
        Shopping Bag
      </motion.h1>

      {cart.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mx-auto mb-4">
            <ShoppingBag className="w-7 h-7 text-muted-foreground" />
          </div>
          <h2 className="font-heading text-2xl mb-2">Your bag is empty</h2>
          <p className="font-body text-muted-foreground mb-6">Looks like you haven't added anything yet.</p>
          <Button variant="elegant" className="rounded-sm" asChild>
            <Link to="/products">Continue Shopping</Link>
          </Button>
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-8 lg:gap-12">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-0">
            {/* Header */}
            <div className="hidden sm:grid grid-cols-12 gap-4 pb-4 border-b border-border">
              <span className="col-span-6 text-xs font-body uppercase tracking-wider text-muted-foreground">Product</span>
              <span className="col-span-2 text-xs font-body uppercase tracking-wider text-muted-foreground text-center">Quantity</span>
              <span className="col-span-2 text-xs font-body uppercase tracking-wider text-muted-foreground text-right">Price</span>
              <span className="col-span-2 text-xs font-body uppercase tracking-wider text-muted-foreground text-right">Total</span>
            </div>

            {cart.map((item, i) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="grid grid-cols-12 gap-4 py-6 border-b border-border items-center"
              >
                <div className="col-span-12 sm:col-span-6 flex gap-4">
                  <div className="w-20 h-24 sm:w-24 sm:h-28 rounded-md overflow-hidden bg-secondary flex-shrink-0">
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link to={`/product/${item.slug}`} className="font-heading text-base sm:text-lg hover:text-primary transition-colors duration-200 block truncate">{item.name}</Link>
                    <p className="text-xs text-muted-foreground font-body mt-1">{item.volume || '250ml'}</p>
                    <button onClick={() => removeFromCart(item.id)} className="text-xs font-body text-muted-foreground hover:text-destructive transition-colors duration-200 mt-2 flex items-center gap-1">
                      <X className="w-3 h-3" /> Remove
                    </button>
                  </div>
                </div>

                <div className="col-span-4 sm:col-span-2 flex items-center justify-center">
                  <div className="flex items-center border border-border rounded-sm">
                    <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="w-8 h-8 flex items-center justify-center hover:bg-secondary transition-colors duration-200">
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-8 text-center text-sm font-body">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="w-8 h-8 flex items-center justify-center hover:bg-secondary transition-colors duration-200">
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <div className="col-span-4 sm:col-span-2 text-right">
                  <span className="font-body text-sm">R{item.price.toFixed(2)}</span>
                </div>

                <div className="col-span-4 sm:col-span-2 text-right">
                  <span className="font-body font-semibold">R{(item.price * item.quantity).toFixed(2)}</span>
                </div>
              </motion.div>
            ))}

            <div className="pt-4">
              <Button variant="ghost" className="text-sm" asChild>
                <Link to="/products"><ArrowRight className="w-4 h-4 rotate-180 mr-1" /> Continue Shopping</Link>
              </Button>
            </div>
          </div>

          {/* Summary */}
          <div className="lg:col-span-1">
            <div className="bg-card rounded-lg border border-border p-6 sticky top-32">
              <h2 className="font-heading text-xl mb-6">Order Summary</h2>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm font-body">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>R{cartTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm font-body">
                  <span className="text-muted-foreground">Shipping</span>
                  <span>{shipping === 0 ? <span className="text-success">Free</span> : `R${shipping.toFixed(2)}`}</span>
                </div>
                {shipping > 0 && (
                  <div className="flex items-center gap-2 text-xs font-body text-primary bg-primary/5 rounded-sm p-2">
                    <Truck className="w-3.5 h-3.5" />
                    <span>Add R{(50 - cartTotal).toFixed(2)} more for free shipping</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between">
                  <span className="font-body font-medium">Total</span>
                  <span className="font-heading text-xl">R{total.toFixed(2)}</span>
                </div>
              </div>

              {/* Promo code */}
              <div className="flex gap-2 mb-6">
                <Input placeholder="Promo code" className="h-9 text-sm rounded-sm font-body" />
                <Button variant="outline" size="sm" className="rounded-sm">Apply</Button>
              </div>

              <Button variant="elegant" size="lg" className="w-full rounded-sm" asChild>
                <Link to="/checkout">Proceed to Checkout</Link>
              </Button>

              <p className="text-[10px] text-muted-foreground font-body text-center mt-3">Taxes calculated at checkout</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
