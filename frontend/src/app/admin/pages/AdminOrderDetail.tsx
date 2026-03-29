import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { apiRequest } from "../api/client";
import { useAdminAuth } from "../context/AdminAuthContext";
import { ErrorState, LoadingState } from "../components/AdminState";
import { toast } from "sonner";
import { formatRand } from "../../lib/currency";

interface OrderDetail {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  trackingNumber?: string | null;
  courier?: string | null;
  shippedAt?: string | null;
  deliveredAt?: string | null;
  currency: string;
  subtotalAmount: number;
  discountAmount: number;
  taxAmount: number;
  shippingAmount: number;
  totalAmount: number;
  placedAt: string;
  customer?: { id: string; email: string } | null;
  items: Array<{ id: string; sku: string; productName: string; variantTitle?: string; quantity: number; lineTotal: number }>;
  notes: Array<{ id: string; note: string; isInternal: boolean; createdAt: string; author?: { email?: string } }>;
  events: Array<{ id: string; eventType: string; previousValue?: string; nextValue?: string; createdAt: string; actor?: { email?: string } }>;
  refunds: Array<{ id: string; amount: number; reason?: string; status: string; createdAt: string }>;
  payments: Array<{ id: string; provider: string; referenceId?: string; status: string; amount: number; createdAt: string; errorMessage?: string }>;
  cancellation?: { reason?: string; createdAt: string } | null;
}

export default function AdminOrderDetail() {
  const { session } = useAdminAuth();
  const { orderId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<OrderDetail | null>(null);

  const [statusValue, setStatusValue] = useState("PROCESSING");
  const [paymentValue, setPaymentValue] = useState("PAID");
  const [fulfillmentValue, setFulfillmentValue] = useState("FULFILLED");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [courier, setCourier] = useState("");
  const [note, setNote] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [verificationReference, setVerificationReference] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const latestPaymentReference = useMemo(() => order?.payments?.[0]?.referenceId ?? "", [order?.payments]);

  const load = async () => {
    if (!session?.accessToken || !orderId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await apiRequest<{ data: OrderDetail }>(`/admin/orders/${orderId}`, {}, session.accessToken);
      setOrder(res.data);
      setStatusValue(res.data.status);
      setPaymentValue(res.data.paymentStatus);
      setFulfillmentValue(res.data.fulfillmentStatus);
      setTrackingNumber(res.data.trackingNumber ?? "");
      setCourier(res.data.courier ?? "");
      setRefundAmount(String(Number(res.data.totalAmount).toFixed(2)));
      setVerificationReference(res.data.payments?.[0]?.referenceId ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load order");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [session?.accessToken, orderId]);

  const post = async (path: string, body: object) => {
    if (!session?.accessToken || !orderId) return;
    await apiRequest(path, { method: "POST", body: JSON.stringify(body) }, session.accessToken);
    await load();
  };

  const updateStatus = async (e: FormEvent) => { e.preventDefault(); try { await post(`/admin/orders/${orderId}/status`, { value: statusValue }); } catch (err) { toast.error(err instanceof Error ? err.message : "Status update failed"); } };
  const updatePayment = async (e: FormEvent) => { e.preventDefault(); try { await post(`/admin/orders/${orderId}/payment-status`, { value: paymentValue }); } catch (err) { toast.error(err instanceof Error ? err.message : "Payment update failed"); } };
  const updateFulfillment = async (e: FormEvent) => { e.preventDefault(); try { await post(`/admin/orders/${orderId}/fulfillment-status`, { value: fulfillmentValue, trackingNumber: trackingNumber || undefined, courier: courier || undefined, shippedAt: fulfillmentValue === "FULFILLED" || fulfillmentValue === "PARTIALLY_FULFILLED" ? new Date().toISOString() : undefined, deliveredAt: fulfillmentValue === "FULFILLED" ? new Date().toISOString() : undefined }); } catch (err) { toast.error(err instanceof Error ? err.message : "Fulfillment update failed"); } };
  const addNote = async (e: FormEvent) => { e.preventDefault(); if (!note) return; try { await post(`/admin/orders/${orderId}/notes`, { note, isInternal: true }); setNote(""); } catch (err) { toast.error(err instanceof Error ? err.message : "Note failed"); } };
  const cancelOrder = async (e: FormEvent) => { e.preventDefault(); if (!cancelReason) return; try { await post(`/admin/orders/${orderId}/cancel`, { reason: cancelReason }); setCancelReason(""); } catch (err) { toast.error(err instanceof Error ? err.message : "Cancel failed"); } };
  const createRefund = async (e: FormEvent) => { e.preventDefault(); const amount = Number(refundAmount); if (!amount) return; try { await post(`/admin/orders/${orderId}/refunds`, { amount, reason: "Manual refund" }); } catch (err) { toast.error(err instanceof Error ? err.message : "Refund failed"); } };

  const initiateStitchPayment = async () => {
    if (!session?.accessToken || !orderId) return;
    try {
      setActionLoading(true);
      const res = await apiRequest<{ data: { checkoutUrl?: string; referenceId?: string; reused: boolean } }>(
        `/admin/orders/${orderId}/payments/initiate`,
        { method: "POST", body: JSON.stringify({ gateway: "stitch" }) },
        session.accessToken,
      );
      if (res.data.referenceId) setVerificationReference(res.data.referenceId);
      if (res.data.checkoutUrl) {
        window.open(res.data.checkoutUrl, "_blank", "noopener,noreferrer");
      }
      toast.success(res.data.reused ? "Reused existing payment intent" : "Stitch payment initiated");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to initiate Stitch payment");
    } finally {
      setActionLoading(false);
    }
  };


  const syncOrderToXero = async () => {
    if (!session?.accessToken || !orderId) return;
    try {
      setActionLoading(true);
      await apiRequest(`/admin/integrations/xero/sync/order/${orderId}`, { method: "POST", body: JSON.stringify({}) }, session.accessToken);
      toast.success("Order synced to Xero");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Xero sync failed");
    } finally {
      setActionLoading(false);
    }
  };

  const verifyStitchPayment = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.accessToken || !orderId || !verificationReference) return;

    try {
      setActionLoading(true);
      await apiRequest(
        `/admin/orders/${orderId}/payments/verify`,
        { method: "POST", body: JSON.stringify({ gateway: "stitch", referenceId: verificationReference }) },
        session.accessToken,
      );
      toast.success("Payment verification complete");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Payment verification failed");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <LoadingState label="Loading order..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!order) return null;

  return (
    <div className="space-y-5">
      <div>
        <Link to="/admin/orders" className="text-sm text-gray-500 hover:text-gray-800">← Back to Orders</Link>
        <h2 className="text-2xl font-black text-gray-900 mt-1">Order #{order.orderNumber}</h2>
        <p className="text-sm text-gray-500">Customer: {order.customer?.email || "Guest"}</p>
      </div>

      <section className="bg-white border border-gray-200 rounded-xl p-5 grid grid-cols-2 md:grid-cols-4 gap-3">
        <div><p className="text-xs text-gray-400">Order Status</p><p className="font-semibold">{order.status}</p></div>
        <div><p className="text-xs text-gray-400">Payment Status</p><p className="font-semibold">{order.paymentStatus}</p></div>
        <div><p className="text-xs text-gray-400">Fulfillment</p><p className="font-semibold">{order.fulfillmentStatus}</p></div>
        <div><p className="text-xs text-gray-400">Total</p><p className="font-semibold">{formatRand(order.totalAmount)}</p></div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <h3 className="font-bold">Items</h3>
          {order.items.map((i) => <div key={i.id} className="text-sm border border-gray-100 rounded-lg p-2 flex justify-between"><div><p className="font-medium">{i.productName}</p><p className="text-xs text-gray-500">{i.sku} · {i.variantTitle || ""} · Qty {i.quantity}</p></div><p className="font-semibold">{formatRand(i.lineTotal)}</p></div>)}
          <div className="text-sm border-t border-gray-100 pt-3 space-y-1">
            <p>Subtotal: {formatRand(order.subtotalAmount)}</p>
            <p>Discount: -{formatRand(order.discountAmount)}</p>
            <p>Tax: {formatRand(order.taxAmount)}</p>
            <p>Shipping: {formatRand(order.shippingAmount)}</p>
            <p className="font-bold">Total: {formatRand(order.totalAmount)}</p>
          </div>
        </section>

        <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <h3 className="font-bold">Manual Actions</h3>
          <form onSubmit={updateStatus} className="flex gap-2"><select className="flex-1 rounded-lg border border-gray-200 px-2 py-2" value={statusValue} onChange={(e) => setStatusValue(e.target.value)}><option>PENDING</option><option>AWAITING_PAYMENT</option><option>PAID</option><option>PROCESSING</option><option>SHIPPED</option><option>DELIVERED</option><option>CANCELLED</option><option>PAYMENT_FAILED</option></select><button className="px-3 py-2 bg-gray-900 text-white rounded-lg text-sm">Update Status</button></form>
          <form onSubmit={updatePayment} className="flex gap-2"><select className="flex-1 rounded-lg border border-gray-200 px-2 py-2" value={paymentValue} onChange={(e) => setPaymentValue(e.target.value)}><option>PENDING</option><option>AWAITING_PAYMENT</option><option>PAID</option><option>FAILED</option></select><button className="px-3 py-2 bg-gray-900 text-white rounded-lg text-sm">Update Payment</button></form>
          <form onSubmit={updateFulfillment} className="space-y-2"><div className="flex gap-2"><select className="flex-1 rounded-lg border border-gray-200 px-2 py-2" value={fulfillmentValue} onChange={(e) => setFulfillmentValue(e.target.value)}><option>UNFULFILLED</option><option>PARTIALLY_FULFILLED</option><option>FULFILLED</option><option>RETURNED</option><option>CANCELLED</option></select><button className="px-3 py-2 bg-gray-900 text-white rounded-lg text-sm">Update Fulfillment</button></div><div className="flex gap-2"><input className="flex-1 rounded-lg border border-gray-200 px-3 py-2" placeholder="Courier" value={courier} onChange={(e) => setCourier(e.target.value)} /><input className="flex-1 rounded-lg border border-gray-200 px-3 py-2" placeholder="Tracking number" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} /></div></form>

          <form onSubmit={addNote} className="flex gap-2"><input className="flex-1 rounded-lg border border-gray-200 px-3 py-2" placeholder="Internal note" value={note} onChange={(e) => setNote(e.target.value)} /><button className="px-3 py-2 border border-gray-200 rounded-lg text-sm">Add Note</button></form>

          <form onSubmit={createRefund} className="flex gap-2"><input type="number" step="0.01" className="flex-1 rounded-lg border border-gray-200 px-3 py-2" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} /><button className="px-3 py-2 border border-gray-200 rounded-lg text-sm">Refund</button></form>

          <form onSubmit={cancelOrder} className="flex gap-2"><input className="flex-1 rounded-lg border border-gray-200 px-3 py-2" placeholder="Cancellation reason" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} /><button className="px-3 py-2 border border-red-200 text-red-700 rounded-lg text-sm">Cancel Order</button></form>
        </section>
      </div>

      <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
        <h3 className="font-bold">Payments</h3>
        <div className="flex gap-2">
          <button type="button" onClick={initiateStitchPayment} disabled={actionLoading} className="px-3 py-2 bg-indigo-700 text-white rounded-lg text-sm disabled:opacity-60">Initiate Stitch Payment</button>
          <button type="button" onClick={syncOrderToXero} disabled={actionLoading} className="px-3 py-2 border border-emerald-300 text-emerald-700 rounded-lg text-sm disabled:opacity-60">Sync Invoice to Xero</button>
        </div>
        <form onSubmit={verifyStitchPayment} className="flex gap-2">
          <input className="flex-1 rounded-lg border border-gray-200 px-3 py-2" value={verificationReference} onChange={(e) => setVerificationReference(e.target.value)} placeholder={latestPaymentReference || "Payment reference"} />
          <button className="px-3 py-2 border border-gray-200 rounded-lg text-sm" disabled={actionLoading}>Verify Payment</button>
        </form>
        <div className="space-y-2">
          {order.payments.map((p) => (
            <div key={p.id} className="text-sm border border-gray-100 rounded-lg p-2">
              <p className="font-medium">{p.provider.toUpperCase()} · {p.status}</p>
              <p className="text-xs text-gray-500">Ref: {p.referenceId || "-"} · {new Date(p.createdAt).toLocaleString()} · {formatRand(p.amount)}</p>
              {p.errorMessage ? <p className="text-xs text-red-600 mt-1">{p.errorMessage}</p> : null}
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section className="bg-white border border-gray-200 rounded-xl p-5"><h3 className="font-bold mb-2">Notes</h3><div className="space-y-2">{order.notes.map((n) => <div key={n.id} className="text-sm border border-gray-100 rounded-lg p-2"><p>{n.note}</p><p className="text-xs text-gray-400">{n.author?.email || "System"} · {new Date(n.createdAt).toLocaleString()}</p></div>)}</div></section>
        <section className="bg-white border border-gray-200 rounded-xl p-5"><h3 className="font-bold mb-2">Audit History</h3><div className="space-y-2">{order.events.map((e) => <div key={e.id} className="text-sm border border-gray-100 rounded-lg p-2"><p className="font-medium">{e.eventType}</p><p className="text-xs text-gray-600">{e.previousValue || ""} {e.previousValue || e.nextValue ? "→" : ""} {e.nextValue || ""}</p><p className="text-xs text-gray-400">{e.actor?.email || "System"} · {new Date(e.createdAt).toLocaleString()}</p></div>)}</div></section>
      </div>
    </div>
  );
}
