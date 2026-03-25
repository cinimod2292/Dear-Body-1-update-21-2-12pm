import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { API_BASE } from "../admin/api/client";
import { useCustomerAuth } from "../context/CustomerAuthContext";

export default function CustomerOrderDetail() {
  const { orderId } = useParams();
  const { token } = useCustomerAuth();
  const [order, setOrder] = useState<any>(null);

  useEffect(() => {
    if (!token || !orderId) return;
    fetch(`${API_BASE}/store/account/orders/${orderId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((payload) => setOrder(payload.data));
  }, [orderId, token]);

  if (!order) return <div className="max-w-4xl mx-auto px-4 py-10">Loading order…</div>;
  return <div className="max-w-4xl mx-auto px-4 py-10"><Link to="/account" className="text-sm text-gray-500">← Back</Link><h1 className="text-2xl font-black mt-2 mb-4">Order #{order.orderNumber}</h1><p className="mb-2">Payment status: <strong>{order.paymentStatus}</strong></p><p className="mb-2">Fulfillment status: <strong>{order.status}</strong></p><p className="mb-2">Tracking: <strong>{order.courier || ""} {order.trackingNumber || "Not yet assigned"}</strong></p><p className="mb-4">Total: <strong>{order.currency} {Number(order.totalAmount).toFixed(2)}</strong></p><div className="space-y-2">{order.items.map((i:any)=><div className="border rounded-lg p-3" key={i.id}>{i.productName} × {i.quantity}</div>)}</div></div>;
}
