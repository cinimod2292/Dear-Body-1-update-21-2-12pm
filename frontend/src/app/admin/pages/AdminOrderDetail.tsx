import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { apiRequest } from "../api/client";
import { useAdminAuth } from "../context/AdminAuthContext";
import { ErrorState, LoadingState } from "../components/AdminState";
import { toast } from "sonner";
import { formatRand } from "../../lib/currency";

type PudoLocker = {
  lockerCode: string;
  name: string;
  address: string;
  city: string;
  province?: string;
  postalCode?: string;
};

type PudoSettings = {
  enabled: boolean;
  senderName?: string;
  senderPhone?: string;
  senderEmail?: string;
};

interface OrderAddress {
  firstName?: string | null;
  lastName?: string | null;
  recipientName?: string | null;
  company?: string | null;
  line1: string;
  line2?: string | null;
  suburb?: string | null;
  city: string;
  state?: string | null;
  postalCode: string;
  country: string;
  phone?: string | null;
  deliveryNotes?: string | null;
}

interface OrderDetail {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  warehouseStatus?: string | null;
  stockIssueStatus?: string | null;
  collectionDate?: string | null;
  collectionWindowStart?: string | null;
  collectionWindowEnd?: string | null;
  slaDeadline?: string | null;
  pickedAt?: string | null;
  packedAt?: string | null;
  trackingNumber?: string | null;
  courier?: string | null;
  pudoLockerCode?: string | null;
  pudoLockerName?: string | null;
  pudoDeliveryType?: string | null;
  shippedAt?: string | null;
  deliveredAt?: string | null;
  currency: string;
  subtotalAmount: number;
  discountAmount: number;
  taxAmount: number;
  shippingAmount: number;
  totalAmount: number;
  placedAt: string;
  customer?: { id: string; email: string; firstName?: string; lastName?: string; phone?: string } | null;
  shippingAddress?: OrderAddress | null;
  billingAddress?: OrderAddress | null;
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
  const [refundReason, setRefundReason] = useState("");
  const [verificationReference, setVerificationReference] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // PUDO state
  const [pudoSuburbOverride, setPudoSuburbOverride] = useState("");
  const [pudoSettings, setPudoSettings] = useState<PudoSettings | null>(null);
  const [pudoLockerSearch, setPudoLockerSearch] = useState("");
  const [pudoLockers, setPudoLockers] = useState<PudoLocker[]>([]);
  const [pudoLockersLoading, setPudoLockersLoading] = useState(false);
  const [pudoSelectedLocker, setPudoSelectedLocker] = useState<PudoLocker | null>(null);
  const [pudoSenderName, setPudoSenderName] = useState("");
  const [pudoSenderPhone, setPudoSenderPhone] = useState("");
  const [pudoSenderEmail, setPudoSenderEmail] = useState("");
  const [pudoRecipientName, setPudoRecipientName] = useState("");
  const [pudoRecipientPhone, setPudoRecipientPhone] = useState("");
  const [pudoRecipientEmail, setPudoRecipientEmail] = useState("");
  const [pudoWeight, setPudoWeight] = useState("0.5");
  const [pudoPieces, setPudoPieces] = useState("1");
  const [pudoShipmentLoading, setPudoShipmentLoading] = useState(false);
  const [pudoResult, setPudoResult] = useState<{ waybillNumber: string; labelUrl?: unknown } | null>(null);

  const latestPaymentReference = useMemo(() => order?.payments?.[0]?.referenceId ?? "", [order?.payments]);

  const load = async () => {
    if (!session?.accessToken || !orderId) return;
    try {
      setLoading(true);
      setError(null);
      const [res, pudoRes] = await Promise.all([
        apiRequest<{ data: OrderDetail }>(`/admin/orders/${orderId}`, {}, session.accessToken),
        apiRequest<{ data: PudoSettings }>("/admin/integrations/pudo/settings", {}, session.accessToken).catch(() => null),
      ]);
      setOrder(res.data);
      setStatusValue(res.data.status);
      setPaymentValue(res.data.paymentStatus);
      setFulfillmentValue(res.data.fulfillmentStatus);
      setTrackingNumber(res.data.trackingNumber ?? "");
      setCourier(res.data.courier ?? "");
      setRefundAmount(String(Number(res.data.totalAmount).toFixed(2)));
      setVerificationReference(res.data.payments?.[0]?.referenceId ?? "");
      if (pudoRes) {
        setPudoSettings(pudoRes.data);
        setPudoSenderName(pudoRes.data.senderName ?? "");
        setPudoSenderPhone(pudoRes.data.senderPhone ?? "");
        setPudoSenderEmail(pudoRes.data.senderEmail ?? "");
        if (res.data.customer) {
          const fullName = [res.data.customer.firstName, res.data.customer.lastName].filter(Boolean).join(" ");
          setPudoRecipientName(fullName || "");
          setPudoRecipientPhone(res.data.customer.phone ?? "");
          setPudoRecipientEmail(res.data.customer.email ?? "");
        }
        // Pre-fill locker from customer's checkout selection
        if (res.data.pudoLockerCode) {
          setPudoSelectedLocker({
            lockerCode: res.data.pudoLockerCode,
            name: res.data.pudoLockerName ?? res.data.pudoLockerCode,
            address: res.data.shippingAddress?.line1 ?? "",
            city: res.data.shippingAddress?.city ?? "",
            postalCode: res.data.shippingAddress?.postalCode,
          });
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load order");
    } finally {
      setLoading(false);
    }
  };

  const searchPudoLockers = useCallback(async () => {
    if (!session?.accessToken) return;
    try {
      setPudoLockersLoading(true);
      const q = pudoLockerSearch.trim() ? `?search=${encodeURIComponent(pudoLockerSearch.trim())}` : "";
      const res = await apiRequest<{ data: PudoLocker[] }>(`/admin/pudo/lockers${q}`, {}, session.accessToken);
      setPudoLockers(res.data ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to fetch PUDO lockers");
    } finally {
      setPudoLockersLoading(false);
    }
  }, [session?.accessToken, pudoLockerSearch]);

  const createPudoShipment = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.accessToken || !orderId || !pudoSelectedLocker) return;
    try {
      setPudoShipmentLoading(true);
      const res = await apiRequest<{ data: { waybillNumber: string; labelUrl?: unknown } }>(
        "/admin/pudo/shipment",
        {
          method: "POST",
          body: JSON.stringify({
            orderId,
            lockerCode: pudoSelectedLocker.lockerCode,
            senderName: pudoSenderName,
            senderPhone: pudoSenderPhone,
            senderEmail: pudoSenderEmail || undefined,
            recipientName: pudoRecipientName,
            recipientPhone: pudoRecipientPhone,
            recipientEmail: pudoRecipientEmail || undefined,
            weight: Number(pudoWeight),
            pieces: Number(pudoPieces),
          }),
        },
        session.accessToken,
      );
      setPudoResult(res.data);
      toast.success(`PUDO shipment created — waybill ${res.data.waybillNumber}`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create PUDO shipment");
    } finally {
      setPudoShipmentLoading(false);
    }
  };

  const triggerAutoShipment = async () => {
    if (!session?.accessToken || !orderId) return;
    if (order?.pudoDeliveryType === "door" && !order.shippingAddress?.suburb && !pudoSuburbOverride.trim()) {
      toast.error("Suburb / Local Area is required for door delivery geocoding");
      return;
    }
    try {
      setPudoShipmentLoading(true);
      const body: Record<string, unknown> = {};
      if (pudoSuburbOverride.trim()) body.suburb = pudoSuburbOverride.trim();
      const res = await apiRequest<{ data: { waybillNumber: string; alreadyExists?: boolean } }>(
        `/admin/orders/${orderId}/pudo-shipment`,
        { method: "POST", body: JSON.stringify(body) },
        session.accessToken,
      );
      if (res.data.alreadyExists) {
        toast.success(`Shipment already exists — waybill ${res.data.waybillNumber}`);
      } else {
        toast.success(`PUDO shipment created — waybill ${res.data.waybillNumber}`);
      }
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create PUDO shipment");
    } finally {
      setPudoShipmentLoading(false);
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
  const cancelOrder = async (e: FormEvent) => {
    e.preventDefault();
    if (!cancelReason) return;
    if (!window.confirm(`Cancel this order? Reason: "${cancelReason}"\n\nThis cannot be undone.`)) return;
    try {
      await post(`/admin/orders/${orderId}/cancel`, { reason: cancelReason });
      setCancelReason("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Cancel failed");
    }
  };
  const createRefund = async (e: FormEvent) => {
    e.preventDefault();
    const amount = Number(refundAmount);
    if (!amount) return;
    const reason = refundReason.trim() || "Manual refund";
    if (!window.confirm(`Issue a refund of ${formatRand(amount)}?\nReason: "${reason}"\n\nThis action cannot be undone.`)) return;
    try {
      await post(`/admin/orders/${orderId}/refunds`, { amount, reason });
      setRefundReason("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Refund failed");
    }
  };

  const initiateGatewayPayment = async () => {
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
      toast.success(res.data.reused ? "Reused existing payment intent" : "Payment initiated");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to initiate payment");
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

  const verifyGatewayPayment = async (e: FormEvent) => {
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
        <div><p className="text-xs text-gray-400">Placed</p><p className="font-semibold">{new Date(order.placedAt).toLocaleString()}</p></div>
        {order.warehouseStatus && (
          <div className="md:col-span-2 bg-blue-50 rounded-lg px-3 py-2">
            <p className="text-xs text-blue-500 font-semibold">Warehouse Status</p>
            <div className="flex items-center gap-2 flex-wrap mt-0.5">
              <span className="font-bold text-blue-900">{order.warehouseStatus.replace(/_/g, " ")}</span>
              {order.stockIssueStatus && order.stockIssueStatus !== "NONE" && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-800 font-semibold">
                  {order.stockIssueStatus.replace(/_/g, " ")}
                </span>
              )}
              <Link
                to={`/admin/warehouse/orders/${order.id}`}
                className="text-xs text-blue-600 underline hover:text-blue-800 ml-auto"
              >
                Open in Warehouse →
              </Link>
            </div>
            {order.collectionWindowStart && (
              <p className="text-xs text-blue-700 mt-1">
                Collection: {new Date(order.collectionWindowStart).toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg", weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                {order.collectionWindowEnd && ` – ${new Date(order.collectionWindowEnd).toLocaleTimeString("en-ZA", { timeZone: "Africa/Johannesburg", hour: "2-digit", minute: "2-digit" })}`}
              </p>
            )}
          </div>
        )}
        {order.pudoLockerCode && (
          <div className="md:col-span-2 bg-indigo-50 rounded-lg px-3 py-2">
            <p className="text-xs text-indigo-500 font-semibold">Customer chose PUDO locker</p>
            <p className="font-semibold text-indigo-900 text-sm">{order.pudoLockerName ?? order.pudoLockerCode}</p>
          </div>
        )}
        {order.customer && (
          <div className="md:col-span-3">
            <p className="text-xs text-gray-400">Customer</p>
            <p className="font-semibold">{[order.customer.firstName, order.customer.lastName].filter(Boolean).join(" ") || order.customer.email}</p>
            {order.customer.phone && <p className="text-xs text-gray-500">{order.customer.phone}</p>}
          </div>
        )}
      </section>

      {(order.shippingAddress || order.billingAddress) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {order.shippingAddress && (
            <section className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="font-bold mb-2">Shipping Address</h3>
              <address className="not-italic text-sm text-gray-700 space-y-0.5">
                {order.shippingAddress.recipientName && <p className="font-medium">{order.shippingAddress.recipientName}</p>}
                {(order.shippingAddress.firstName || order.shippingAddress.lastName) && !order.shippingAddress.recipientName && (
                  <p className="font-medium">{[order.shippingAddress.firstName, order.shippingAddress.lastName].filter(Boolean).join(" ")}</p>
                )}
                {order.shippingAddress.company && <p>{order.shippingAddress.company}</p>}
                <p>{order.shippingAddress.line1}</p>
                {order.shippingAddress.line2 && <p>{order.shippingAddress.line2}</p>}
                {order.shippingAddress.suburb && <p>{order.shippingAddress.suburb}</p>}
                <p>{[order.shippingAddress.city, order.shippingAddress.state, order.shippingAddress.postalCode].filter(Boolean).join(", ")}</p>
                <p>{order.shippingAddress.country}</p>
                {order.shippingAddress.phone && <p className="text-gray-500 mt-1">{order.shippingAddress.phone}</p>}
                {order.shippingAddress.deliveryNotes && <p className="text-gray-500 italic mt-1">Note: {order.shippingAddress.deliveryNotes}</p>}
              </address>
            </section>
          )}
          {order.billingAddress && order.billingAddress !== order.shippingAddress && (
            <section className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="font-bold mb-2">Billing Address</h3>
              <address className="not-italic text-sm text-gray-700 space-y-0.5">
                {order.billingAddress.recipientName && <p className="font-medium">{order.billingAddress.recipientName}</p>}
                {(order.billingAddress.firstName || order.billingAddress.lastName) && !order.billingAddress.recipientName && (
                  <p className="font-medium">{[order.billingAddress.firstName, order.billingAddress.lastName].filter(Boolean).join(" ")}</p>
                )}
                {order.billingAddress.company && <p>{order.billingAddress.company}</p>}
                <p>{order.billingAddress.line1}</p>
                {order.billingAddress.line2 && <p>{order.billingAddress.line2}</p>}
                <p>{[order.billingAddress.city, order.billingAddress.state, order.billingAddress.postalCode].filter(Boolean).join(", ")}</p>
                <p>{order.billingAddress.country}</p>
              </address>
            </section>
          )}
        </div>
      )}

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
          <form onSubmit={updateStatus} className="flex gap-2"><select className="flex-1 rounded-lg border border-gray-200 px-2 py-2" value={statusValue} onChange={(e) => setStatusValue(e.target.value)}><option value="PLACED">Placed</option><option value="CONFIRMED">Confirmed</option><option value="PROCESSING">Processing</option><option value="SHIPPED">Shipped</option><option value="DELIVERED">Delivered</option><option value="READY_FOR_COLLECTION">Ready for Collection</option><option value="CANCELLED">Cancelled</option><option value="REFUNDED">Refunded</option></select><button className="px-3 py-2 bg-gray-900 text-white rounded-lg text-sm">Update Status</button></form>
          <form onSubmit={updatePayment} className="flex gap-2"><select className="flex-1 rounded-lg border border-gray-200 px-2 py-2" value={paymentValue} onChange={(e) => setPaymentValue(e.target.value)}><option value="PENDING">Pending</option><option value="AUTHORIZED">Authorized</option><option value="PAID">Paid</option><option value="PARTIALLY_REFUNDED">Partially Refunded</option><option value="REFUNDED">Refunded</option><option value="FAILED">Failed</option><option value="CANCELLED">Cancelled</option><option value="REFUND_DUE">Refund Due</option></select><button className="px-3 py-2 bg-gray-900 text-white rounded-lg text-sm">Update Payment</button></form>
          <form onSubmit={updateFulfillment} className="space-y-2"><div className="flex gap-2"><select className="flex-1 rounded-lg border border-gray-200 px-2 py-2" value={fulfillmentValue} onChange={(e) => setFulfillmentValue(e.target.value)}><option>UNFULFILLED</option><option>PARTIALLY_FULFILLED</option><option>FULFILLED</option><option>RETURNED</option><option>CANCELLED</option></select><button className="px-3 py-2 bg-gray-900 text-white rounded-lg text-sm">Update Fulfillment</button></div><div className="flex gap-2"><input className="flex-1 rounded-lg border border-gray-200 px-3 py-2" placeholder="Courier" value={courier} onChange={(e) => setCourier(e.target.value)} /><input className="flex-1 rounded-lg border border-gray-200 px-3 py-2" placeholder="Tracking number" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} /></div></form>

          <form onSubmit={addNote} className="flex gap-2"><input className="flex-1 rounded-lg border border-gray-200 px-3 py-2" placeholder="Internal note" value={note} onChange={(e) => setNote(e.target.value)} /><button className="px-3 py-2 border border-gray-200 rounded-lg text-sm">Add Note</button></form>

          <form onSubmit={createRefund} className="space-y-2">
            <div className="flex gap-2">
              <input type="number" step="0.01" className="w-32 rounded-lg border border-gray-200 px-3 py-2" placeholder="Amount" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} />
              <input className="flex-1 rounded-lg border border-gray-200 px-3 py-2" placeholder="Reason (required)" value={refundReason} onChange={(e) => setRefundReason(e.target.value)} required />
              <button className="px-3 py-2 border border-red-200 text-red-700 rounded-lg text-sm whitespace-nowrap">Issue Refund</button>
            </div>
          </form>

          <form onSubmit={cancelOrder} className="flex gap-2"><input className="flex-1 rounded-lg border border-gray-200 px-3 py-2" placeholder="Cancellation reason" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} /><button className="px-3 py-2 border border-red-200 text-red-700 rounded-lg text-sm">Cancel Order</button></form>
        </section>
      </div>

      {/* PUDO Shipment Panel */}
      {pudoSettings?.enabled && order?.pudoDeliveryType && (
        <section className="bg-white border border-indigo-200 rounded-xl p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h3 className="font-bold text-indigo-900">PUDO Shipment</h3>
              <p className="text-xs text-indigo-600 mt-0.5">
                {order.pudoDeliveryType === "locker"
                  ? `Locker: ${order.pudoLockerName ?? order.pudoLockerCode ?? "—"}`
                  : "Door-to-door delivery"}
              </p>
            </div>
            {order.trackingNumber ? (
              <div className="text-sm text-right">
                <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-0.5">Waybill</p>
                <a
                  href={`https://pudo.co.za/track/${order.trackingNumber}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono font-bold text-indigo-700 hover:underline"
                >
                  {order.trackingNumber}
                </a>
                <p className="text-xs text-gray-400 mt-0.5">{order.courier}</p>
              </div>
            ) : (
              <div className="flex flex-col items-end gap-2 min-w-[220px]">
                {order.pudoDeliveryType === "door" && !order.shippingAddress?.suburb && (
                  <div className="w-full">
                    <label className="text-xs font-semibold text-amber-700 block mb-1">
                      Suburb / Local Area <span className="text-red-500">*</span>
                      <span className="font-normal ml-1 text-amber-600">(missing — required for geocoding)</span>
                    </label>
                    <input
                      className="w-full rounded-lg border border-amber-300 px-3 py-2 text-sm"
                      placeholder="e.g. Claremont"
                      value={pudoSuburbOverride}
                      onChange={(e) => setPudoSuburbOverride(e.target.value)}
                    />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => void triggerAutoShipment()}
                  disabled={pudoShipmentLoading}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold disabled:opacity-60 transition-colors"
                >
                  {pudoShipmentLoading ? "Creating…" : "Create PUDO Shipment"}
                </button>
                <p className="text-xs text-amber-600">No waybill assigned yet</p>
              </div>
            )}
          </div>
        </section>
      )}

      <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
        <h3 className="font-bold">Payments</h3>
        <div className="flex gap-2">
          <button type="button" onClick={initiateGatewayPayment} disabled={actionLoading} className="px-3 py-2 bg-indigo-700 text-white rounded-lg text-sm disabled:opacity-60">Initiate Payment</button>
          <button type="button" onClick={syncOrderToXero} disabled={actionLoading} className="px-3 py-2 border border-emerald-300 text-emerald-700 rounded-lg text-sm disabled:opacity-60">Sync Invoice to Xero</button>
        </div>
        <form onSubmit={verifyGatewayPayment} className="flex gap-2">
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
