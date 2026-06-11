import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Product } from "../data/products";

export interface CartItem {
  product: Product;
  quantity: number;
}

interface CartContextType {
  cartItems: CartItem[];
  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: (reason?: string) => void;
  cartCount: number;
  cartTotal: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);
const CUID_REGEX = /^c[a-z0-9]{24}$/;
const CART_STORAGE_KEY = "storefront_cart";
const CART_SESSION_KEYS = ["storefront_cart_id", "storefront_checkout_session_id", "storefront_quote_id"] as const;

function isCuid(value: unknown): value is string {
  return typeof value === "string" && CUID_REGEX.test(value);
}

function sanitizeStoredCart(raw: unknown): CartItem[] {
  if (!Array.isArray(raw)) return [];

  return raw.filter((entry): entry is CartItem => {
    const quantity = (entry as { quantity?: unknown })?.quantity;
    const product = (entry as { product?: Product })?.product;
    if (!product || !isCuid(product.id)) return false;
    if (!isCuid(product.variantId)) return false;
    if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity <= 0) return false;
    return true;
  });
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [cartItems, setCartItems] = useState<CartItem[]>(() => {
    const stored = localStorage.getItem(CART_STORAGE_KEY);
    if (!stored) return [];
    try {
      return sanitizeStoredCart(JSON.parse(stored));
    } catch {
      return [];
    }
  });

  const addToCart = (product: Product, quantity = 1) => {
    if (!isCuid(product.variantId)) return;
    setCartItems(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prev, { product, quantity }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCartItems(prev => prev.filter(item => item.product.id !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCartItems(prev =>
      prev.map(item =>
        item.product.id === productId ? { ...item, quantity } : item
      )
    );
  };

  const clearCart = (_reason?: string) => {
    setCartItems([]);
    localStorage.removeItem(CART_STORAGE_KEY);
    for (const key of CART_SESSION_KEYS) sessionStorage.removeItem(key);
  };

  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems));
  }, [cartItems]);

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cartItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  return (
    <CartContext.Provider value={{ cartItems, addToCart, removeFromCart, updateQuantity, clearCart, cartCount, cartTotal }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
