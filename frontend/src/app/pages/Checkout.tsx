import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Check, Lock, ArrowLeft, Truck } from "lucide-react";
import { useCart } from "../context/CartContext";
import logoImage from "../../assets/2f83d3b5e95347ddf4ffa7687e1ec032dc27ba54.png";
import { API_BASE } from "../admin/api/client";
import { useCustomerAuth } from "../context/CustomerAuthContext";
import { formatRand } from "../lib/currency";

type Step = "contact" | "shipping" | "payment" | "confirm";

type SavedAddress = {
  id: string;
  recipientName?: string | null;
  phone?: string | null;
  line1: string;
  line2?: string | null;
  city: string;
  state?: string | null;
  postalCode: string;
  country: string;
  isDefaultShipping: boolean;
};

type StoreShippingMethod = {
  id: string;
  name: string;
  price: number;
  description?: string | null;
};

type QuoteTotals = {
  subtotalAmount: number;
  discountAmount: number;
  shippingAmount: number;
  taxAmount: number;
  totalAmount: number;
  shippingMethodId: string | null;
  shippingMethodInvalid: boolean;
  freeShippingEnabled: boolean;
  freeShippingThreshold: number;
  freeShippingRemaining: number | null;
  shippingMethods: StoreShippingMethod[];
};

export default function Checkout() {
  const { cartItems, cartTotal, cartCount, clearCart } = useCart();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<Step>("contact");
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [processingTimedOut, setProcessingTimedOut] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [orderInfo, setOrderInfo] = useState<{ id: string; orderNumber: string; paymentStatus: string; status: string; checkoutUrl?: string | null } | null>(null);
  const [orderNumber] = useState(() => Math.floor(Math.random() * 900000) + 100000);
  const { customer, token } = useCustomerAuth();
  const [shippingMethods, setShippingMethods] = useState<StoreShippingMethod[]>([]);
  const [selectedShippingMethodId, setSelectedShippingMethodId] = useState<string>("");
  const [quote, setQuote] = useState<QuoteTotals | null>(null);
  const shipping = Number(quote?.shippingAmount ?? 0);
  const total = Number(quote?.totalAmount ?? cartTotal + shipping);

  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", phone: "",
    address: "", city: "", state: "", zip: "", country: "United States",
    sameAsShipping: true,
  });
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>("");

  const update = (key: string, value: string | boolean) => setForm(f => ({ ...f, [key]: value }));

  const steps: { key: Step; label: string }[] = [
    { key: "contact", label: "Contact" },
    { key: "shipping", label: "Shipping" },
    { key: "payment", label: "Payment" },
  ];

  const stepIndex = steps.findIndex(s => s.key === step);

  const returnUrl = useMemo(() => `${window.location.origin}/checkout`, []);

  const loadExistingOrder = async (orderId: string) => {
    if (!token) return;
    const res = await fetch(`${API_BASE}/store/orders/${orderId}`, { headers: { Authorization: `Bearer ${token}` } });
    const payload = await res.json().catch(() => null);
    if (!res.ok || !payload?.data) throw new Error(payload?.error?.message || "Failed to load order");
    const o = payload.data;
    setOrderInfo({
      id: o.id,
      orderNumber: o.orderNumber,
      paymentStatus: o.paymentStatus,
      status: o.status,
      checkoutUrl: null,
    });
    setOrderPlaced(o.paymentStatus === "PAID");
    setProcessingPayment(["AWAITING_PAYMENT", "PENDING"].includes(o.paymentStatus));
  };

  useEffect(() => {
    const orderId = searchParams.get("orderId");
    if (!orderId) return;
    loadExistingOrder(orderId).catch(() => undefined);
  }, [searchParams, token]);

  useEffect(() => {
    if (cartItems.length === 0) return;
    const items = cartItems
      .filter(({ product }) => !!product.backendVariantId)
      .map(({ product, quantity }) => ({ variantId: product.backendVariantId!, quantity }));
    if (!items.length) return;
    fetch(`${API_BASE}/store/cart/quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items,
        shippingMethodId: selectedShippingMethodId || undefined,
        shippingAddress: { country: form.country, state: form.state || undefined },
      }),
    })
      .then((r) => r.json())
      .then((payload) => {
        const q = payload?.data as QuoteTotals | undefined;
        if (!q) return;
        setQuote(q);
        setShippingMethods(q.shippingMethods || []);
        if (q.shippingMethodInvalid) setSelectedShippingMethodId("");
        else if (q.shippingMethodId) setSelectedShippingMethodId(q.shippingMethodId);
        else if (!selectedShippingMethodId && q.shippingMethods?.length) setSelectedShippingMethodId(q.shippingMethods[0].id);
      })
      .catch(() => undefined);
  }, [cartItems, selectedShippingMethodId, form.country, form.state]);


  useEffect(() => {
    if (!customer) {
      navigate(`/account/login?next=${encodeURIComponent('/checkout')}`);
    }
  }, [customer, navigate]);

  useEffect(() => {
    if (!token) return;

    fetch(`${API_BASE}/store/account/profile`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((payload) => {
        const profile = payload?.data;
        if (!profile) return;
        setForm((prev) => ({
          ...prev,
          firstName: prev.firstName || profile.firstName || "",
          lastName: prev.lastName || profile.lastName || "",
          email: prev.email || customer?.email || profile.email || "",
          phone: prev.phone || profile.phone || "",
        }));
      })
      .catch(() => undefined);

    fetch(`${API_BASE}/store/account/addresses`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((payload) => {
        const addresses = (payload?.data || []) as SavedAddress[];
        setSavedAddresses(addresses);
        const preferred = addresses.find((a) => a.isDefaultShipping) || addresses[0];
        if (!preferred) return;
        setSelectedAddressId(preferred.id);
        setForm((prev) => ({
          ...prev,
          address: prev.address || preferred.line1,
          city: prev.city || preferred.city,
          state: prev.state || preferred.state || "",
          zip: prev.zip || preferred.postalCode,
          country: prev.country || preferred.country,
          phone: prev.phone || preferred.phone || "",
        }));
      })
      .catch(() => undefined);
  }, [token, customer?.email]);


  useEffect(() => {
    if (!processingPayment) return;
    const orderId = searchParams.get("orderId");
    if (!orderId || !token) return;

    let attempts = 0;
    setProcessingTimedOut(false);
    const timer = window.setInterval(async () => {
      attempts += 1;
      try {
        const res = await fetch(`${API_BASE}/store/orders/${orderId}`, { headers: { Authorization: `Bearer ${token}` } });
        const payload = await res.json().catch(() => null);
        if (!res.ok || !payload?.data) return;
        const status = payload.data.paymentStatus;
        console.info("[checkout] processing poll payload", payload.data);
        console.info("[checkout] processing poll", {
          orderId,
          orderStatus: payload.data.status,
          orderPaymentStatus: payload.data.paymentStatus,
          shouldClearProcessing: status === "PAID" || status === "FAILED",
        });
        setOrderInfo((prev) => prev ? { ...prev, paymentStatus: status, status: payload.data.status } : prev);
        if (status === "PAID") {
          setProcessingPayment(false);
          setOrderPlaced(true);
          clearCart();
        }
        if (status === "FAILED") {
          setProcessingPayment(false);
        }
        if (attempts >= 20) {
          setProcessingTimedOut(true);
          setProcessingPayment(false);
        }
      } catch {}
    }, 3000);

    return () => window.clearInterval(timer);
  }, [processingPayment, searchParams, token, clearCart]);

  const applySavedAddress = (addressId: string) => {
    setSelectedAddressId(addressId);
    const selected = savedAddresses.find((address) => address.id === addressId);
    if (!selected) return;
    setForm((prev) => ({
      ...prev,
      address: selected.line1,
      city: selected.city,
      state: selected.state || "",
      zip: selected.postalCode,
      country: selected.country,
      phone: selected.phone || prev.phone,
    }));
  };

  const handlePlaceOrder = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setCheckoutError(null);

    try {
      setSubmitting(true);

      if (!token || !customer) {
        navigate(`/account/login?next=${encodeURIComponent("/checkout")}`);
        return;
      }
      if (shippingMethods.length > 0 && !selectedShippingMethodId) {
        throw new Error("Please select a shipping method");
      }

      const resolveRes = await fetch(`${API_BASE}/store/checkout/resolve-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cartItems.map(({ product, quantity }) => ({
            variantId: product.variantId as string,
            productId: product.id,
            quantity,
          })),
        }),
      });
      const resolvePayload = await resolveRes.json().catch(() => null);
      if (!resolveRes.ok) throw new Error(resolvePayload?.error?.message || "Unable to resolve product variants for checkout");

      const cartRes = await fetch(`${API_BASE}/store/cart`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currency: "ZAR" }),
      });
      const cartPayload = await cartRes.json().catch(() => null);
      if (!cartRes.ok) throw new Error(cartPayload?.error?.message || "Failed to create checkout cart");
      const cartId = cartPayload?.data?.id as string | undefined;
      if (!cartId) throw new Error("Checkout cart missing");

      for (const item of resolvePayload.data.items as Array<{ variantId: string; quantity: number }>) {
        const addRes = await fetch(`${API_BASE}/store/cart/${cartId}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ variantId: item.variantId, quantity: item.quantity }),
        });
        if (!addRes.ok) {
          const payload = await addRes.json().catch(() => null);
          throw new Error(payload?.error?.message || "Failed to add item to checkout cart");
        }
      }

      const checkoutRes = await fetch(`${API_BASE}/store/checkout/${cartId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          email: customer.email,
          shippingMethodId: selectedShippingMethodId || undefined,
          shippingAddress: {
            firstName: form.firstName,
            lastName: form.lastName,
            phone: form.phone,
            line1: form.address,
            city: form.city,
            state: form.state,
            postalCode: form.zip,
            country: form.country,
          },
          payment: {
            gateway: "stitch",
            returnUrl,
            cancelUrl: `${returnUrl}?cancelled=1`,
          },
        }),
      });
      const checkoutPayload = await checkoutRes.json().catch(() => null);
      if (!checkoutRes.ok) throw new Error(checkoutPayload?.error?.message || "Checkout failed");

      const order = checkoutPayload?.data?.order;
      const payment = checkoutPayload?.data?.payment;
      if (!order?.id) throw new Error("Order creation failed");
      const backendTotal = Number(order.totalAmount ?? 0);
      if (Math.abs(backendTotal - total) > 0.001) {
        console.warn("[checkout] frontend/backend total mismatch", {
          orderId: order.id,
          frontendTotal: total,
          backendTotal,
          cartSubtotal: Number(quote?.subtotalAmount ?? cartTotal),
          shipping,
        });
      } else {
        console.info("[checkout] frontend/backend total match", {
          orderId: order.id,
          frontendTotal: total,
          backendTotal,
        });
      }

      const finalReturnUrl = `${window.location.origin}/checkout?orderId=${order.id}`;
      if (payment && !payment.checkoutUrl) {
        const retryRes = await fetch(`${API_BASE}/store/orders/${order.id}/payments/initiate`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ gateway: "stitch", returnUrl: finalReturnUrl, cancelUrl: `${window.location.origin}/checkout?orderId=${order.id}&cancelled=1` }),
        });
        const retryPayload = await retryRes.json().catch(() => null);
        if (retryRes.ok && retryPayload?.data?.checkoutUrl) {
          console.info("[checkout] retry redirect", {
            checkoutUrlFromBackend: retryPayload.data.checkoutUrl,
            redirectTarget: retryPayload.data.checkoutUrl,
          });
          window.location.href = retryPayload.data.checkoutUrl;
          return;
        }
      }

      setOrderInfo({
        id: order.id,
        orderNumber: order.orderNumber,
        paymentStatus: order.paymentStatus,
        status: order.status,
        checkoutUrl: payment?.checkoutUrl ?? null,
      });
      setProcessingPayment(order.paymentStatus !== "PAID");
      setOrderPlaced(order.paymentStatus === "PAID");

      if (payment?.checkoutUrl) {
        console.info("[checkout] initial redirect", {
          checkoutUrlFromBackend: payment.checkoutUrl,
          redirectTarget: payment.checkoutUrl,
        });
        window.location.href = payment.checkoutUrl;
      }
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (cartCount === 0 && !orderPlaced && !searchParams.get("orderId")) {
    navigate("/shop");
    return null;
  }

  if (processingPayment) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-20">
        <div className="max-w-md w-full text-center bg-white rounded-2xl p-8 shadow-sm">
          <h1 className="text-2xl font-black mb-3">Processing payment…</h1>
          <p className="text-gray-500 text-sm">We are waiting for Stitch webhook confirmation. This may take a few seconds.</p>
          {searchParams.get("cancelled") ? <p className="text-amber-600 text-sm mt-3">Payment was cancelled on Stitch. You can retry payment from your account.</p> : null}
          <Link to="/account" className="inline-block mt-5 text-pink-600 text-sm">Go to My Account</Link>
        </div>
      </div>
    );
  }


  if (processingTimedOut) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-20">
        <div className="max-w-md w-full text-center bg-white rounded-2xl p-8 shadow-sm">
          <h1 className="text-2xl font-black mb-3">Payment confirmation delayed</h1>
          <p className="text-gray-500 text-sm">We have not received webhook confirmation yet. Your order is safe; please check My Account and retry payment if needed.</p>
          <Link to="/account" className="inline-block mt-5 text-pink-600 text-sm">Go to My Account</Link>
        </div>
      </div>
    );
  }

  if (orderPlaced) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-20">
        <div className="max-w-md w-full text-center">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center mx-auto mb-6 shadow-xl shadow-green-200">
            <Check size={44} className="text-white" strokeWidth={3} />
          </div>
          <div className="h-2 bg-gradient-to-r from-pink-500 via-orange-400 to-yellow-400 rounded-full mb-8" />
          <h1 className="text-gray-900 mb-3" style={{ fontSize: "2rem", fontWeight: 900 }}>Order Confirmed! 🎉</h1>
          <p className="text-gray-500 mb-2">
            Thank you for your order! We're getting your goodies ready.
          </p>
          <p className="text-gray-400 text-sm mb-8">
            Order #{orderInfo?.orderNumber || orderNumber} · Confirmation sent to <strong>{customer?.email || "your email"}</strong>
          </p>
          <p className="text-sm mb-4">
            Payment status: <strong>{orderInfo?.paymentStatus || "PENDING"}</strong>
          </p>

          <div className="bg-white rounded-2xl p-6 shadow-sm mb-8 text-left">
            <div className="flex items-center gap-3 mb-4">
              <Truck size={20} className="text-pink-500" />
              <div>
                <p className="font-bold text-gray-900">Estimated Delivery</p>
                <p className="text-gray-500 text-sm">3–5 business days</p>
              </div>
            </div>
            <p className="text-gray-500 text-sm">
              Your order will be shipped to: {form.address || "your address"}, {form.city}
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <Link
              to="/shop"
              className="w-full py-4 bg-gradient-to-r from-pink-500 to-orange-500 text-white rounded-full font-bold flex items-center justify-center hover:opacity-90 transition-opacity"
            >
              Continue Shopping
            </Link>
            <Link to="/" className="text-sm text-gray-400 hover:text-pink-500 transition-colors">
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between">
          <Link to="/cart" className="flex items-center gap-2 text-gray-500 hover:text-pink-500 text-sm font-medium transition-colors">
            <ArrowLeft size={16} /> Back to Cart
          </Link>
          <div className="flex items-center gap-2">
            <img
              src={logoImage}
              alt="Dear Body"
              className="h-9 w-auto object-contain"
            />
          </div>
          <div className="flex items-center gap-1 text-gray-400 text-sm">
            <Lock size={14} />
            <span className="hidden sm:inline">Secure Checkout</span>
          </div>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-8 pb-4">
        <div className="flex items-center gap-2">
          {steps.map((s, i) => (
            <div key={s.key} className="flex items-center gap-2">
              <div className={`flex items-center gap-2 ${i <= stepIndex ? "text-pink-500" : "text-gray-400"}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${i < stepIndex ? "bg-green-500 text-white" : i === stepIndex ? "bg-gradient-to-br from-pink-500 to-orange-400 text-white" : "bg-gray-200 text-gray-500"}`}>
                  {i < stepIndex ? <Check size={13} /> : i + 1}
                </div>
                <span className="font-bold text-sm hidden sm:inline">{s.label}</span>
              </div>
              {i < steps.length - 1 && <div className={`h-0.5 flex-1 min-w-6 ${i < stepIndex ? "bg-green-400" : "bg-gray-200"}`} />}
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Form */}
          <div className="lg:col-span-2">

            {/* CONTACT */}
            {step === "contact" && (
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <h2 className="font-black text-gray-900 text-xl mb-6">Contact Information</h2>
                {savedAddresses.length > 0 ? (
                  <div className="mb-4 rounded-xl border border-gray-200 p-3 bg-gray-50">
                    <label className="text-sm font-semibold text-gray-700 block mb-1">Use a saved address</label>
                    <select
                      value={selectedAddressId}
                      onChange={(e) => applySavedAddress(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    >
                      {savedAddresses.map((address) => (
                        <option value={address.id} key={address.id}>
                          {(address.recipientName || "Address")} — {address.line1}, {address.city}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { key: "firstName", label: "First Name", placeholder: "Jane", type: "text" },
                    { key: "lastName", label: "Last Name", placeholder: "Doe", type: "text" },
                    { key: "email", label: "Email Address", placeholder: "jane@example.com", type: "email", full: true },
                    { key: "phone", label: "Phone Number", placeholder: "+1 (555) 000-0000", type: "tel" },
                  ].map(field => (
                    <div key={field.key} className={field.full ? "sm:col-span-2" : ""}>
                      <label className="block text-sm font-bold text-gray-700 mb-1.5">{field.label}</label>
                      <input
                        type={field.type}
                        value={(form as any)[field.key]}
                        onChange={e => update(field.key, e.target.value)}
                        placeholder={field.placeholder}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-pink-400 text-gray-800 transition-colors"
                      />
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setStep("shipping")}
                  className="mt-6 w-full py-4 bg-gradient-to-r from-pink-500 to-orange-500 text-white rounded-full font-bold hover:opacity-90 transition-opacity"
                >
                  Continue to Shipping
                </button>
              </div>
            )}

            {/* SHIPPING */}
            {step === "shipping" && (
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <h2 className="font-black text-gray-900 text-xl mb-6">Shipping Address</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { key: "address", label: "Street Address", placeholder: "123 Main St", full: true },
                    { key: "city", label: "City", placeholder: "Miami" },
                    { key: "state", label: "State / Province", placeholder: "FL" },
                    { key: "zip", label: "ZIP / Postal Code", placeholder: "33101" },
                    { key: "country", label: "Country", placeholder: "United States" },
                  ].map(field => (
                    <div key={field.key} className={field.full ? "sm:col-span-2" : ""}>
                      <label className="block text-sm font-bold text-gray-700 mb-1.5">{field.label}</label>
                      <input
                        type="text"
                        value={(form as any)[field.key]}
                        onChange={e => update(field.key, e.target.value)}
                        placeholder={field.placeholder}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-pink-400 text-gray-800 transition-colors"
                      />
                    </div>
                  ))}
                </div>

                {/* Shipping Method */}
                <div className="mt-6">
                  <h3 className="font-bold text-gray-900 mb-3">Shipping Method</h3>
                  <div className="space-y-3">
                    {(shippingMethods.length ? shippingMethods : []).map((opt) => (
                      <label key={opt.id} className="flex items-center justify-between p-4 border-2 border-gray-200 rounded-xl cursor-pointer hover:border-pink-300 transition-colors has-[:checked]:border-pink-400 has-[:checked]:bg-pink-50">
                        <div className="flex items-center gap-3">
                          <input type="radio" name="shipping" checked={selectedShippingMethodId === opt.id} onChange={() => setSelectedShippingMethodId(opt.id)} className="accent-pink-500" />
                          <div>
                            <p className="font-bold text-gray-900 text-sm">{opt.name}</p>
                            <p className="text-gray-400 text-xs">{opt.description || "Fixed-rate shipping"}</p>
                          </div>
                        </div>
                        <span className="font-bold text-gray-700">{Number(opt.price) === 0 ? "FREE" : formatRand(Number(opt.price))}</span>
                      </label>
                    ))}
                    {shippingMethods.length === 0 ? <p className="text-sm text-gray-500">No shipping methods configured.</p> : null}
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => setStep("contact")}
                    className="px-6 py-4 border-2 border-gray-200 rounded-full font-bold text-gray-700 hover:border-pink-300 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => setStep("payment")}
                    className="flex-1 py-4 bg-gradient-to-r from-pink-500 to-orange-500 text-white rounded-full font-bold hover:opacity-90 transition-opacity"
                  >
                    Continue to Payment
                  </button>
                </div>
              </div>
            )}

            {/* PAYMENT */}
            {step === "payment" && (
              <form onSubmit={handlePlaceOrder} className="bg-white rounded-2xl p-6 shadow-sm">
                <h2 className="font-black text-gray-900 text-xl mb-2">Pay with Stitch</h2>
                <p className="text-gray-400 text-sm mb-6 flex items-center gap-1.5">
                  <Lock size={13} /> Card entry is handled securely on Stitch-hosted checkout.
                </p>

                <div className="rounded-xl border border-pink-100 bg-pink-50 p-4 text-sm text-gray-700">
                  We do not collect raw card details on this site. After you click pay, you will be redirected to Stitch to complete payment.
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setStep("shipping")}
                    className="px-6 py-4 border-2 border-gray-200 rounded-full font-bold text-gray-700 hover:border-pink-300 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 py-4 bg-gradient-to-r from-pink-500 via-red-500 to-orange-500 text-white rounded-full font-black hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-lg shadow-pink-200"
                  >
                    <Lock size={16} />
                    {submitting ? "Redirecting..." : `Pay with Stitch · ${formatRand(total)}`}
                  </button>
                </div>
                {checkoutError ? <p className="text-red-500 text-sm mt-3">{checkoutError}</p> : null}
              </form>
            )}

          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl p-6 shadow-sm sticky top-28">
              <h3 className="font-black text-gray-900 mb-5">Order Summary</h3>
              <div className="flex flex-col gap-3 mb-5">
                {cartItems.map(({ product, quantity }) => (
                  <div key={product.id} className="flex items-center gap-3">
                    <div className="relative shrink-0">
                      <div className="w-14 h-14 rounded-xl overflow-hidden" style={{ backgroundColor: product.bgColor }}>
                        <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                      </div>
                      <span className="absolute -top-2 -right-2 w-5 h-5 bg-pink-500 text-white text-xs rounded-full flex items-center justify-center font-bold">{quantity}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 text-sm truncate">{product.name}</p>
                      <p className="text-gray-400 text-xs">{product.size}</p>
                    </div>
                    <span className="font-bold text-gray-900 text-sm shrink-0">{formatRand(product.price * quantity)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-100 pt-4 flex flex-col gap-2 text-sm">
                <div className="flex justify-between text-gray-500">
                  <span>Subtotal</span><span>{formatRand(Number(quote?.subtotalAmount ?? cartTotal))}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>Shipping</span>
                  <span>{shipping === 0 ? <span className="text-green-500 font-medium">FREE</span> : formatRand(shipping)}</span>
                </div>
                {quote?.freeShippingEnabled && (quote.freeShippingRemaining ?? 0) > 0 ? (
                  <div className="flex justify-between text-gray-500">
                    <span>Free shipping in</span><span>{formatRand(Number(quote.freeShippingRemaining))}</span>
                  </div>
                ) : null}
              </div>
              <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-100">
                <span className="font-black text-gray-900">Total</span>
                <span className="font-black text-xl text-pink-500">{formatRand(total)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
