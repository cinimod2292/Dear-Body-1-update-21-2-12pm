import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Package, ChevronRight } from "lucide-react";
import { API_BASE } from "../admin/api/client";
import { useCustomerAuth } from "../context/CustomerAuthContext";
import { formatRand } from "../lib/currency";

type Order = {
  id: string;
  orderNumber: string;
  createdAt: string;
  status: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  totalAmount?: number | string | null;
  trackingNumber?: string | null;
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-700",
  PROCESSING: "bg-blue-100 text-blue-700",
  FULFILLED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
  AWAITING_PAYMENT: "bg-amber-100 text-amber-700",
  PAYMENT_FAILED: "bg-red-100 text-red-700",
  PAID: "bg-green-100 text-green-700",
  REFUNDED: "bg-purple-100 text-purple-700",
  READY_FOR_COLLECTION: "bg-teal-100 text-teal-700",
  REFUND_DUE: "bg-orange-100 text-orange-700",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  PROCESSING: "Processing",
  FULFILLED: "Fulfilled",
  CANCELLED: "Cancelled",
  AWAITING_PAYMENT: "Awaiting Payment",
  PAYMENT_FAILED: "Payment Failed",
  PAID: "Paid",
  REFUNDED: "Refunded",
  READY_FOR_COLLECTION: "Ready for Collection",
  REFUND_DUE: "Refund Due",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[status] ?? "bg-gray-100 text-gray-700"}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

export default function CustomerOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [preferredGateway, setPreferredGateway] = useState<"stitch" | "payfast">("payfast");
  const { token } = useCustomerAuth();

  useEffect(() => {
    document.title = "My Orders — Dear Body";
  }, []);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE}/store/account/orders`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((payload) => setOrders(payload.data || []));
  }, [token]);

  useEffect(() => {
    fetch(`${API_BASE}/store/payments/gateways`)
      .then((r) => r.json())
      .then((payload) => {
        const preferred = payload?.data?.preferredGateway as "stitch" | "payfast" | undefined;
        const first = payload?.data?.enabledGateways?.[0]?.id as "stitch" | "payfast" | undefined;
        if (preferred || first) setPreferredGateway(preferred ?? first!);
      })
      .catch(() => undefined);
  }, []);

  const retryPayment = async (orderId: string) => {
    if (!token) return;
    setRetryingId(orderId);
    try {
      const res = await fetch(`${API_BASE}/store/orders/${orderId}/payments/initiate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          gateway: preferredGateway,
          force: true,
          returnUrl: `${window.location.origin}/checkout?orderId=${orderId}`,
          cancelUrl: `${window.location.origin}/checkout?orderId=${orderId}&cancelled=1`,
        }),
      });
      const payload = await res.json();
      if (res.ok && payload?.data?.checkoutUrl) window.location.href = payload.data.checkoutUrl;
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
      <div>
        <h1 className="text-2xl font-black text-gray-900">Order History</h1>
        <p className="text-sm text-gray-500 mt-1">Track and manage your orders</p>
      </div>

      {orders.length === 0 ? (
        <div className="bg-white rounded-2xl border p-10 text-center">
          <div className="w-14 h-14 rounded-full bg-pink-50 flex items-center justify-center mx-auto mb-4">
            <Package size={24} className="text-pink-400" />
          </div>
          <h3 className="font-bold text-gray-900 mb-1">No orders yet</h3>
          <p className="text-sm text-gray-500 mb-5">When you place your first order it will appear here.</p>
          <Link
            to="/shop"
            className="inline-block px-5 py-2.5 rounded-full bg-gradient-to-r from-pink-500 to-orange-500 text-white text-sm font-bold hover:opacity-90 transition-opacity"
          >
            Start shopping
          </Link>
        </div>
      ) : (
        <div className="space-y-3" data-testid="account-orders-section">
          {orders.map((o) => (
            <div key={o.id} className="bg-white rounded-2xl border hover:border-pink-200 transition-colors">
              <Link to={`/account/orders/${o.id}`} className="flex items-center justify-between p-5 group">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <span className="font-black text-gray-900">#{o.orderNumber}</span>
                    <StatusBadge status={o.paymentStatus} />
                    <StatusBadge status={o.status} />
                  </div>
                  <p className="text-sm text-gray-500">
                    {new Date(o.createdAt).toLocaleDateString("en-ZA", { year: "numeric", month: "long", day: "numeric" })}
                    {o.totalAmount != null ? ` · ${formatRand(Number(o.totalAmount))}` : ""}
                  </p>
                  {o.trackingNumber ? (
                    <p className="text-xs text-gray-400 mt-0.5">Tracking: {o.trackingNumber}</p>
                  ) : null}
                </div>
                <ChevronRight size={18} className="text-gray-300 group-hover:text-pink-400 flex-shrink-0 ml-3 transition-colors" />
              </Link>
              {["AWAITING_PAYMENT", "PAYMENT_FAILED"].includes(o.paymentStatus) ? (
                <div className="px-5 pb-5 pt-0">
                  <div className="h-px bg-gray-100 mb-4" />
                  <button
                    disabled={retryingId === o.id}
                    onClick={() => void retryPayment(o.id)}
                    className="px-4 py-2 rounded-full text-sm font-bold bg-gradient-to-r from-pink-500 to-orange-500 text-white hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {retryingId === o.id ? "Redirecting…" : "Complete payment"}
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
