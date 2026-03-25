import { useEffect, useState } from "react";
import { Link } from "react-router";
import { API_BASE } from "../admin/api/client";
import { useCustomerAuth } from "../context/CustomerAuthContext";

export default function CustomerDashboard() {
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const { customer, token, logout } = useCustomerAuth();
  const [orders, setOrders] = useState<any[]>([]);

  const loadOrders = () => {
    if (!token) return;
    fetch(`${API_BASE}/store/account/orders`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((payload) => setOrders(payload.data || []));
  };

  useEffect(() => {
    loadOrders();
  }, [token]);

  const retryPayment = async (orderId: string) => {
    if (!token) return;
    setRetryingId(orderId);
    try {
      const res = await fetch(`${API_BASE}/store/orders/${orderId}/payments/initiate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ gateway: "stitch", force: true, returnUrl: `${window.location.origin}/checkout?orderId=${orderId}`, cancelUrl: `${window.location.origin}/checkout?orderId=${orderId}&cancelled=1` }),
      });
      const payload = await res.json();
      if (res.ok && payload?.data?.checkoutUrl) window.location.href = payload.data.checkoutUrl;
    } finally {
      setRetryingId(null);
    }
  };

  return <div className="max-w-5xl mx-auto px-4 py-10"><div className="flex items-center justify-between mb-6"><div><h1 className="text-2xl font-black">My Account</h1><p className="text-sm text-gray-500">{customer?.email}</p></div><button onClick={logout} className="px-3 py-2 border rounded-lg text-sm">Logout</button></div><div className="bg-white rounded-2xl border p-5"><h2 className="font-bold mb-4">Order History</h2><div className="space-y-3">{orders.map((o)=><div key={o.id} className="block border rounded-xl p-3"><Link to={`/account/orders/${o.id}`} className="block hover:bg-gray-50"><div className="flex justify-between"><p className="font-semibold">#{o.orderNumber}</p><p className="text-sm">{new Date(o.createdAt).toLocaleDateString()}</p></div><p className="text-sm">Order: {o.status} · Payment: {o.paymentStatus} · Fulfillment: {o.fulfillmentStatus}</p><p className="text-sm">Tracking: {o.trackingNumber || "—"}</p></Link>{["AWAITING_PAYMENT","PAYMENT_FAILED"].includes(o.status) ? <button disabled={retryingId===o.id} onClick={()=>retryPayment(o.id)} className="mt-2 px-3 py-1.5 rounded-lg text-xs bg-pink-600 text-white">{retryingId===o.id?"Retrying...":"Retry payment"}</button> : null}</div>)}{orders.length===0?<p className="text-sm text-gray-500">No orders yet.</p>:null}</div></div></div>;
}
