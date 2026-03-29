import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { API_BASE } from "../admin/api/client";
import { useCustomerAuth } from "../context/CustomerAuthContext";
import { formatRand } from "../lib/currency";

export default function CustomerOrderDetail() {
  const { orderId } = useParams();
  const { token } = useCustomerAuth();
  const [order, setOrder] = useState<any>(null);
  const [retrying, setRetrying] = useState(false);

  const loadOrder = () => {
    if (!token || !orderId) return;
    fetch(`${API_BASE}/store/account/orders/${orderId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((payload) => setOrder(payload.data));
  };

  useEffect(() => {
    loadOrder();
  }, [orderId, token]);

  const retryPayment = async () => {
    if (!token || !orderId) return;
    setRetrying(true);
    try {
      const res = await fetch(`${API_BASE}/store/orders/${orderId}/payments/initiate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ gateway: "stitch", force: true, returnUrl: `${window.location.origin}/checkout?orderId=${orderId}`, cancelUrl: `${window.location.origin}/checkout?orderId=${orderId}&cancelled=1` }),
      });
      const payload = await res.json();
      if (res.ok && payload?.data?.checkoutUrl) window.location.href = payload.data.checkoutUrl;
    } finally {
      setRetrying(false);
    }
  };

  if (!order) return <div className="max-w-4xl mx-auto px-4 py-10">Loading order…</div>;
  return <div className="max-w-4xl mx-auto px-4 py-10"><Link to="/account" className="text-sm text-gray-500">← Back</Link><h1 className="text-2xl font-black mt-2 mb-4">Order #{order.orderNumber}</h1><p className="mb-2">Order lifecycle: <strong>{order.status}</strong></p><p className="mb-2">Payment status: <strong>{order.paymentStatus}</strong></p><p className="mb-2">Fulfillment status: <strong>{order.fulfillmentStatus}</strong></p><p className="mb-2">Tracking: <strong>{order.courier || ""} {order.trackingNumber || "Not yet assigned"}</strong></p><p className="mb-4">Total: <strong>{formatRand(Number(order.totalAmount))}</strong></p>{["AWAITING_PAYMENT","PAYMENT_FAILED"].includes(order.status) ? <button onClick={retryPayment} disabled={retrying} className="mb-4 px-3 py-2 rounded-lg bg-pink-600 text-white text-sm">{retrying?"Retrying...":"Retry payment"}</button> : null}<div className="space-y-2">{order.items.map((i:any)=><div className="border rounded-lg p-3" key={i.id}>{i.productName} × {i.quantity}</div>)}</div></div>;
}
