import { Link, useNavigate } from "react-router";
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight, Tag } from "lucide-react";
import { useCart } from "../context/CartContext";
import { useEffect, useState } from "react";
import { useCustomerAuth } from "../context/CustomerAuthContext";
import { formatRand } from "../lib/currency";
import { API_BASE } from "../admin/api/client";

type Quote = {
  subtotalAmount: number;
  discountAmount: number;
  shippingAmount: number;
  taxAmount: number;
  totalAmount: number;
  shippingMethodId: string | null;
  shippingMethodInvalid: boolean;
  freeShippingEnabled: boolean;
  freeShippingRemaining: number | null;
  freeShippingApplied?: boolean;
};

export default function Cart() {
  const { cartItems, removeFromCart, updateQuantity, cartTotal, cartCount, clearCart } = useCart();
  const navigate = useNavigate();
  const [promoCode, setPromoCode] = useState("");
  const { customer } = useCustomerAuth();
  const [promoApplied, setPromoApplied] = useState(false);
  const [promoError, setPromoError] = useState("");

  const [quote, setQuote] = useState<Quote | null>(null);
  const discount = Number(quote?.discountAmount ?? 0);
  const shipping = Number(quote?.shippingAmount ?? 0);
  const total = Number(quote?.totalAmount ?? (cartTotal - discount + shipping));
  const summaryShippingDisplay = quote
    ? (quote.freeShippingApplied ? "FREE" : (shipping > 0 ? formatRand(shipping) : "FREE"))
    : "TBC";
  const canProceedToCheckout = cartCount > 0;


  useEffect(() => {
    document.title = "Cart — Dear Body";
  }, []);

  useEffect(() => {
    const items = cartItems
      .filter(({ product }) => !!product.backendVariantId)
      .map(({ product, quantity }) => ({ variantId: product.backendVariantId!, quantity }));
    if (!items.length) return;
    fetch(`${API_BASE}/store/cart/quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items,
        shippingAddress: { country: "ZA" },
        couponCode: promoApplied ? promoCode : undefined,
      }),
    })
      .then((r) => r.json())
      .then((payload) => {
        const q = payload?.data as Quote | undefined;
        if (!q) return;
        setQuote(q);
      })
      .catch(() => undefined);
  }, [cartItems, promoApplied, promoCode]);

  const handlePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoCode.trim()) return;
    const items = cartItems
      .filter(({ product }) => !!product.backendVariantId)
      .map(({ product, quantity }) => ({ variantId: product.backendVariantId!, quantity }));
    try {
      const res = await fetch(`${API_BASE}/store/cart/quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, shippingAddress: { country: "ZA" }, couponCode: promoCode }),
      });
      const payload = await res.json().catch(() => null);
      const q = payload?.data as Quote | undefined;
      if (q && Number(q.discountAmount) > 0) {
        setPromoApplied(true);
        setPromoError("");
        setQuote(q);
      } else {
        setPromoApplied(false);
        setPromoError("Invalid or expired promo code.");
      }
    } catch {
      setPromoError("Unable to validate promo code. Please try again.");
    }
  };

  if (cartCount === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-6 px-4">
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-pink-100 to-orange-100 flex items-center justify-center">
          <ShoppingBag size={40} className="text-pink-400" />
        </div>
        <h2 className="text-gray-900 text-center" style={{ fontSize: "2rem", fontWeight: 900 }}>Your cart is empty</h2>
        <p className="text-gray-500 text-center max-w-sm">
          Looks like you haven't added anything yet! Explore our vibrant collection and find your signature scent.
        </p>
        <Link
          to="/shop"
          className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-pink-500 to-orange-500 text-white rounded-full font-bold hover:opacity-90 transition-opacity"
        >
          Shop Now <ArrowRight size={18} />
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-pink-500 via-red-500 to-orange-500 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-white">
          <h1 style={{ fontSize: "clamp(2rem, 5vw, 3rem)", fontWeight: 900 }}>Your Cart</h1>
          <p className="text-white/80 mt-2">{cartCount} item{cartCount !== 1 ? "s" : ""} ready to check out</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Cart Items */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            {cartItems.map(({ product, quantity }) => (
              <div key={product.id} className="bg-white rounded-2xl p-5 shadow-sm flex gap-5 items-center">
                {/* Image */}
                <Link to={`/product/${product.id}`} className="shrink-0">
                  <div
                    className="w-24 h-24 rounded-xl overflow-hidden"
                    style={{ backgroundColor: product.bgColor }}
                  >
                    <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                  </div>
                </Link>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400 uppercase tracking-wider">{product.category}</p>
                  <Link to={`/product/${product.id}`} className="font-bold text-gray-900 hover:text-pink-500 transition-colors truncate block">
                    {product.name}
                  </Link>
                  <p className="text-sm text-gray-400 mb-3">{product.size}</p>

                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    {/* Quantity */}
                    <div className="flex items-center border border-gray-200 rounded-full overflow-hidden">
                      <button
                        onClick={() => updateQuantity(product.id, quantity - 1)}
                        className="w-9 h-9 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="w-8 text-center font-bold text-gray-900 text-sm">{quantity}</span>
                      <button
                        onClick={() => updateQuantity(product.id, quantity + 1)}
                        className="w-9 h-9 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors"
                      >
                        <Plus size={14} />
                      </button>
                    </div>

                    {/* Price + Remove */}
                    <div className="flex items-center gap-3">
                      <span className="font-black text-lg" style={{ color: product.textColor }}>
                        {formatRand(product.price * quantity)}
                      </span>
                      <button
                        onClick={() => removeFromCart(product.id)}
                        className="w-9 h-9 rounded-full flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Clear Cart */}
            <button
              onClick={() => clearCart("manual_cart_clear")}
              className="text-sm text-gray-400 hover:text-red-500 transition-colors text-right font-medium"
            >
              Clear entire cart
            </button>
          </div>

          {/* Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl p-6 shadow-sm sticky top-28">
              <h3 className="font-black text-gray-900 text-xl mb-6">Order Summary</h3>

              {/* Promo Code */}
              <form onSubmit={handlePromo} className="mb-5">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Tag size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={promoCode}
                      onChange={e => setPromoCode(e.target.value)}
                      placeholder="Promo code"
                      className="w-full pl-9 pr-4 py-2.5 border rounded-full text-sm focus:outline-none focus:border-pink-400 border-gray-200"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2.5 bg-gray-900 text-white rounded-full text-sm font-bold hover:bg-gray-700 transition-colors"
                  >
                    Apply
                  </button>
                </div>
                {promoError && <p className="text-red-500 text-xs mt-2">{promoError}</p>}
                {promoApplied && <p className="text-green-500 text-xs mt-2">✓ Promo code applied!</p>}
              </form>

              {/* Breakdown */}
              <div className="flex flex-col gap-3 pb-5 border-b border-gray-100">
                <div className="flex justify-between text-gray-600 text-sm">
                  <span>Subtotal ({cartCount} items)</span>
                  <span>{formatRand(Number(quote?.subtotalAmount ?? cartTotal))}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-green-600 text-sm font-medium">
                    <span>Discount</span>
                    <span>-{formatRand(discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-gray-600 text-sm">
                  <span>Shipping</span>
                  <span>{summaryShippingDisplay}</span>
                </div>
                {quote?.freeShippingEnabled && (quote.freeShippingRemaining ?? 0) > 0 ? <p className="text-xs text-pink-500">Add {formatRand(Number(quote.freeShippingRemaining))} more for free shipping!</p> : null}
              </div>

              <div className="flex justify-between items-center mt-4 mb-6">
                <span className="font-black text-gray-900 text-lg">Total</span>
                <span className="font-black text-2xl text-pink-500">{formatRand(total)}</span>
              </div>

              <button
                onClick={() => navigate(customer ? "/checkout" : "/account/login?next=%2Fcheckout")}
                disabled={!canProceedToCheckout}
                className="w-full py-4 bg-gradient-to-r from-pink-500 via-red-500 to-orange-500 text-white rounded-full font-black text-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-lg shadow-pink-200"
              >
                Checkout <ArrowRight size={18} />
              </button>
              <Link
                to="/shop"
                className="block text-center mt-4 text-sm text-gray-400 hover:text-pink-500 transition-colors"
              >
                ← Continue Shopping
              </Link>

              {/* Payment icons */}
              <div className="mt-5 flex flex-col items-center gap-2">
                <div className="flex items-center gap-2">
                  {["PayFast", "Stitch"].map(provider => (
                    <span key={provider} className="px-2 py-1 bg-gray-100 rounded text-xs text-gray-500 font-medium">{provider}</span>
                  ))}
                </div>
                <p className="text-xs text-gray-400">Secured by bank-grade encryption</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
