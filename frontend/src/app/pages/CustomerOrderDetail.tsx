import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft, Package, Truck, CheckCircle, Circle, AlertCircle, RotateCcw, Clock } from "lucide-react";
import { API_BASE } from "../admin/api/client";
import { useCustomerAuth } from "../context/CustomerAuthContext";
import { formatRand } from "../lib/currency";

type PudoTrackingEvent = { timestamp: string; status: string; statusLabel: string; description: string; location?: string };
type PudoTracking = { waybillNumber: string; currentStatus: string; currentStatusLabel: string; events: PudoTrackingEvent[] };

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-700",
  PROCESSING: "bg-blue-100 text-blue-700",
  FULFILLED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
  AWAITING_PAYMENT: "bg-amber-100 text-amber-700",
  PAYMENT_FAILED: "bg-red-100 text-red-700",
  PAID: "bg-green-100 text-green-700",
  REFUNDED: "bg-purple-100 text-purple-700",
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
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[status] ?? "bg-gray-100 text-gray-700"}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

const TRACKING_STATUS_STYLE: Record<string, { icon: React.ReactNode; color: string }> = {
  delivered:            { icon: <CheckCircle size={14} />, color: "text-green-600" },
  ready_for_collection: { icon: <CheckCircle size={14} />, color: "text-green-600" },
  out_for_delivery:     { icon: <Truck size={14} />,       color: "text-blue-600" },
  in_transit:           { icon: <Truck size={14} />,       color: "text-blue-500" },
  collected:            { icon: <Package size={14} />,     color: "text-indigo-600" },
  failed_delivery:      { icon: <AlertCircle size={14} />, color: "text-amber-600" },
  exception:            { icon: <AlertCircle size={14} />, color: "text-red-600" },
  return_to_sender:     { icon: <RotateCcw size={14} />,   color: "text-orange-600" },
};

function PudoTrackingTimeline({ tracking }: { tracking: PudoTracking }) {
  const { currentStatusLabel, events } = tracking;
  const style = TRACKING_STATUS_STYLE[tracking.currentStatus] ?? { icon: <Circle size={14} />, color: "text-gray-500" };

  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-3">
      {/* Current status banner */}
      <div className={`flex items-center gap-2 font-semibold text-sm ${style.color}`}>
        {style.icon}
        <span>{currentStatusLabel}</span>
      </div>

      {/* Event timeline */}
      {events.length > 0 && (
        <div className="space-y-2 pt-1">
          {events.map((event, i) => (
            <div key={i} className="flex gap-3 text-xs">
              <div className="flex flex-col items-center shrink-0 mt-0.5">
                <div className={`w-2 h-2 rounded-full ${i === 0 ? "bg-pink-500" : "bg-gray-300"}`} />
                {i < events.length - 1 && <div className="w-px flex-1 bg-gray-200 mt-1" />}
              </div>
              <div className="pb-2">
                <p className={`font-semibold ${i === 0 ? "text-gray-900" : "text-gray-600"}`}>
                  {event.statusLabel || event.description}
                </p>
                {event.description && event.description !== event.statusLabel && (
                  <p className="text-gray-400">{event.description}</p>
                )}
                <p className="text-gray-400 mt-0.5 flex items-center gap-1">
                  <Clock size={10} />
                  {event.timestamp
                    ? new Date(event.timestamp).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" })
                    : ""}
                  {event.location ? ` · ${event.location}` : ""}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CustomerOrderDetail() {
  const { orderId } = useParams();
  const { token } = useCustomerAuth();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [preferredGateway, setPreferredGateway] = useState<"stitch" | "payfast">("payfast");
  const [pudoTracking, setPudoTracking] = useState<PudoTracking | null>(null);
  const [trackingLoading, setTrackingLoading] = useState(false);

  useEffect(() => {
    document.title = "Order Details — Dear Body";
  }, []);

  useEffect(() => {
    if (!token || !orderId) return;
    fetch(`${API_BASE}/store/account/orders/${orderId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((payload) => setOrder(payload.data))
      .finally(() => setLoading(false));
  }, [orderId, token]);

  useEffect(() => {
    if (!token || !orderId || !order?.trackingNumber || !order?.courier?.toLowerCase().includes("pudo")) return;
    setTrackingLoading(true);
    fetch(`${API_BASE}/store/orders/${orderId}/pudo-tracking`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((payload) => { if (payload?.data) setPudoTracking(payload.data); })
      .catch(() => undefined)
      .finally(() => setTrackingLoading(false));
  }, [orderId, token, order?.trackingNumber, order?.courier]);

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

  const retryPayment = async () => {
    if (!token || !orderId) return;
    setRetrying(true);
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
      setRetrying(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10 space-y-4">
        <div className="h-6 bg-gray-100 rounded-lg w-32 animate-pulse" />
        <div className="h-10 bg-gray-100 rounded-xl w-56 animate-pulse" />
        <div className="h-40 bg-gray-100 rounded-2xl animate-pulse" />
        <div className="h-48 bg-gray-100 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10 text-center">
        <p className="text-gray-500 mb-3">Order not found.</p>
        <Link to="/account?tab=orders" className="text-sm text-pink-600 hover:underline">
          Back to orders
        </Link>
      </div>
    );
  }

  const canRetryPayment = ["AWAITING_PAYMENT", "PAYMENT_FAILED"].includes(order.paymentStatus);
  const addr = order.shippingAddress;

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
      <Link to="/account?tab=orders" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-pink-500 transition-colors">
        <ArrowLeft size={14} /> Back to orders
      </Link>

      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Order #{order.orderNumber}</h1>
          <p className="text-sm text-gray-500 mt-1">
            Placed {new Date(order.createdAt).toLocaleDateString("en-ZA", { year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge status={order.paymentStatus} />
          <StatusBadge status={order.status} />
        </div>
      </div>

      {canRetryPayment && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="font-bold text-amber-800">Payment required</p>
            <p className="text-sm text-amber-700 mt-0.5">This order is waiting for payment to be completed.</p>
          </div>
          <button
            onClick={() => void retryPayment()}
            disabled={retrying}
            className="px-5 py-2.5 rounded-full font-bold text-sm bg-gradient-to-r from-pink-500 to-orange-500 text-white hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {retrying ? "Redirecting…" : "Complete payment"}
          </button>
        </div>
      )}

      {/* Order items */}
      <div className="bg-white rounded-2xl border p-6">
        <div className="flex items-center gap-2 mb-5">
          <Package size={18} className="text-pink-500" />
          <h2 className="font-bold text-gray-900">Items{order.items?.length ? ` (${order.items.length})` : ""}</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {(order.items ?? []).map((item: any) => (
            <div key={item.id} className="py-4 first:pt-0 last:pb-0 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 text-sm">{item.productName}</p>
                {item.variantTitle ? <p className="text-xs text-gray-400 mt-0.5">{item.variantTitle}</p> : null}
                <p className="text-xs text-gray-500 mt-0.5">Qty: {item.quantity}</p>
              </div>
              <div className="text-right flex-shrink-0">
                {item.lineTotal != null ? (
                  <p className="font-bold text-gray-900 text-sm">{formatRand(Number(item.lineTotal))}</p>
                ) : item.unitPrice != null ? (
                  <p className="font-bold text-gray-900 text-sm">{formatRand(Number(item.unitPrice) * item.quantity)}</p>
                ) : null}
                {item.quantity > 1 && item.unitPrice != null ? (
                  <p className="text-xs text-gray-400">{formatRand(Number(item.unitPrice))} each</p>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="border-t border-gray-100 mt-4 pt-4 space-y-2 text-sm">
          {order.subtotalAmount != null && (
            <div className="flex justify-between">
              <span className="text-gray-600">Subtotal</span>
              <span>{formatRand(Number(order.subtotalAmount))}</span>
            </div>
          )}
          {Number(order.discountAmount) > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Discount</span>
              <span>−{formatRand(Number(order.discountAmount))}</span>
            </div>
          )}
          {order.shippingAmount != null && (
            <div className="flex justify-between">
              <span className="text-gray-600">Shipping</span>
              <span>{Number(order.shippingAmount) === 0 ? "FREE" : formatRand(Number(order.shippingAmount))}</span>
            </div>
          )}
          {Number(order.taxAmount) > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-600">Tax</span>
              <span>{formatRand(Number(order.taxAmount))}</span>
            </div>
          )}
          <div className="flex justify-between pt-3 border-t border-gray-100">
            <span className="font-black text-gray-900 text-base">Total</span>
            <span className="font-black text-gray-900 text-base">{formatRand(Number(order.totalAmount))}</span>
          </div>
        </div>
      </div>

      {/* Shipping info */}
      {(addr || order.trackingNumber || order.courier || order.pudoLockerCode || order.pudoDeliveryType) && (
        <div className="bg-white rounded-2xl border p-6">
          <div className="flex items-center gap-2 mb-4">
            <Truck size={18} className="text-pink-500" />
            <h2 className="font-bold text-gray-900">Shipping</h2>
          </div>

          {/* PUDO locker destination */}
          {order.pudoDeliveryType === "locker" && order.pudoLockerCode ? (
            <div className="mb-4 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 text-sm">
              <p className="text-xs text-indigo-500 uppercase tracking-wide font-semibold mb-1">PUDO Locker Collection</p>
              <p className="font-semibold text-indigo-900">{order.pudoLockerName || order.pudoLockerCode}</p>
              {order.pudoLockerAddress ? (
                <p className="text-indigo-700 text-xs mt-0.5">{order.pudoLockerAddress}</p>
              ) : addr ? (
                <p className="text-indigo-700 text-xs mt-0.5">{addr.line1}, {addr.city}</p>
              ) : null}
            </div>
          ) : order.pudoDeliveryType === "door" ? (
            <div className="mb-4 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 text-sm">
              <p className="text-xs text-indigo-500 uppercase tracking-wide font-semibold mb-1">PUDO Door-to-Door Delivery</p>
              {addr ? (
                <>
                  {addr.recipientName ? <p className="font-semibold text-indigo-900">{addr.recipientName}</p> : null}
                  <p className="text-indigo-700">{addr.line2 ? `${addr.line2}, ` : ""}{addr.line1}</p>
                  <p className="text-indigo-700">{addr.city}{addr.state ? `, ${addr.state}` : ""}{addr.postalCode ? ` ${addr.postalCode}` : ""}</p>
                </>
              ) : null}
            </div>
          ) : addr ? (
            <div className="text-sm text-gray-700 mb-4">
              {addr.recipientName ? <p className="font-semibold">{addr.recipientName}</p> : null}
              <p>{addr.line1}{addr.line2 ? `, ${addr.line2}` : ""}</p>
              <p>
                {addr.city}{addr.state ? `, ${addr.state}` : ""}{addr.postalCode ? `, ${addr.postalCode}` : ""}
              </p>
              {addr.country ? <p>{addr.country}</p> : null}
            </div>
          ) : null}

          {order.pudoDeliveryType && !order.trackingNumber && order.paymentStatus === "PAID" ? (
            <div className="text-sm">
              <p className="text-gray-500 text-xs uppercase tracking-wide font-semibold mb-1">Tracking</p>
              <p className="text-amber-600 text-sm">Waybill being generated — check back shortly.</p>
            </div>
          ) : (order.trackingNumber || order.courier) ? (
            <div className="text-sm">
              <p className="text-gray-500 text-xs uppercase tracking-wide font-semibold mb-1">Tracking</p>
              <p className="font-semibold text-gray-900">
                {order.courier ? `${order.courier} — ` : ""}
                {order.trackingNumber ?? "Not yet assigned"}
              </p>

              {/* Inline PUDO tracking timeline */}
              {order.trackingNumber && order.courier?.toLowerCase().includes("pudo") && (
                <div className="mt-3">
                  {trackingLoading ? (
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <div className="w-3 h-3 border-2 border-pink-300 border-t-pink-500 rounded-full animate-spin" />
                      Loading tracking…
                    </div>
                  ) : pudoTracking ? (
                    <PudoTrackingTimeline tracking={pudoTracking} />
                  ) : (
                    <p className="text-xs text-gray-400">No tracking events yet.</p>
                  )}
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
