import React from 'react';
import { Link } from 'react-router-dom';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../ui/sheet';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';
import { Minus, Plus, X, ShoppingBag } from 'lucide-react';
import { useStore } from '../../context/StoreContext';

export function CartDrawer() {
  const { isCartOpen, closeCart, cart, cartTotal, updateQuantity, removeFromCart } = useStore();

  return (
    <Sheet open={isCartOpen} onOpenChange={closeCart}>
      <SheetContent className="w-full sm:max-w-md flex flex-col bg-card">
        <SheetHeader className="pb-4">
          <SheetTitle className="font-heading text-2xl">Your Bag ({cart.length})</SheetTitle>
        </SheetHeader>

        {cart.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
              <ShoppingBag className="w-7 h-7 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground font-body">Your bag is empty</p>
            <Button variant="beauty" onClick={closeCart} asChild>
              <Link to="/products">Continue Shopping</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto -mx-6 px-6 space-y-4 scrollbar-thin">
              {cart.map((item) => (
                <div key={item.id} className="flex gap-4">
                  <div className="w-20 h-24 rounded-md overflow-hidden bg-secondary flex-shrink-0">
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-heading text-base truncate">{item.name}</h4>
                    <p className="text-sm text-muted-foreground font-body mb-2">R{item.price.toFixed(2)}</p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="w-7 h-7 rounded-sm border border-border flex items-center justify-center hover:bg-secondary transition-colors duration-200"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-sm font-body font-medium w-6 text-center">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="w-7 h-7 rounded-sm border border-border flex items-center justify-center hover:bg-secondary transition-colors duration-200"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col items-end justify-between">
                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="text-muted-foreground hover:text-foreground transition-colors duration-200"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <span className="text-sm font-body font-semibold">R{(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-4 space-y-4">
              <Separator />
              <div className="flex justify-between items-center">
                <span className="font-body text-muted-foreground">Subtotal</span>
                <span className="font-heading text-xl">R{cartTotal.toFixed(2)}</span>
              </div>
              <p className="text-xs text-muted-foreground font-body">Shipping calculated at checkout</p>
              <div className="space-y-2">
                <Button className="w-full rounded-sm" variant="elegant" size="lg" asChild onClick={closeCart}>
                  <Link to="/checkout">Checkout</Link>
                </Button>
                <Button className="w-full rounded-sm" variant="ghost" size="lg" asChild onClick={closeCart}>
                  <Link to="/cart">View Bag</Link>
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
