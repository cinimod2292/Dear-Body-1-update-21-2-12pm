import { useEffect, useState } from "react";
import { Link } from "react-router";
import { API_BASE } from "../admin/api/client";
import { useCustomerAuth } from "../context/CustomerAuthContext";

export default function CustomerDashboard() {
  const { customer, token, logout } = useCustomerAuth();
  const [orders, setOrders] = useState<any[]>([]);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE}/store/account/orders`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((payload) => setOrders(payload.data || []));
  }, [token]);

  return <div className="max-w-5xl mx-auto px-4 py-10"><div className="flex items-center justify-between mb-6"><div><h1 className="text-2xl font-black">My Account</h1><p className="text-sm text-gray-500">{customer?.email}</p></div><button onClick={logout} className="px-3 py-2 border rounded-lg text-sm">Logout</button></div><div className="bg-white rounded-2xl border p-5"><h2 className="font-bold mb-4">Order History</h2><div className="space-y-3">{orders.map((o)=><Link to={`/account/orders/${o.id}`} key={o.id} className="block border rounded-xl p-3 hover:bg-gray-50"><div className="flex justify-between"><p className="font-semibold">#{o.orderNumber}</p><p className="text-sm">{new Date(o.createdAt).toLocaleDateString()}</p></div><p className="text-sm">Payment: {o.paymentStatus} · Fulfillment: {o.status}</p><p className="text-sm">Tracking: {o.trackingNumber || "—"}</p></Link>)}{orders.length===0?<p className="text-sm text-gray-500">No orders yet.</p>:null}</div></div></div>;
}
