import { useEffect, useState } from "react";
import { Link } from "react-router";
import { RefreshCw, ExternalLink, Package, Truck, Zap } from "lucide-react";
import { apiRequest } from "../api/client";
import { useAdminAuth } from "../context/AdminAuthContext";
import { toast } from "sonner";
import { formatRand } from "../../lib/currency";

interface PudoOrder {
  id: string;
  orderNumber: string;
  createdAt: string;
  status: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  trackingNumber: string | null;
  courier: string | null;
  pudoDeliveryType: string | null;
  pudoLockerCode: string | null;
  pudoLockerName: string | null;
  totalAmount: string;
  customer: { id: string; firstName: string | null; lastName: string | null; email: string } | null;
}

const FULFILLMENT_COLORS: Record<string, string> = {
  UNFULFILLED: "bg-gray-100 text-gray-700",
  SHIPPED: "bg-blue-100 text-blue-700",
  FULFILLED: "bg-green-100 text-green-700",
  PARTIAL: "bg-amber-100 text-amber-700",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-700",
  AWAITING_PAYMENT: "bg-amber-100 text-amber-700",
  PROCESSING: "bg-blue-100 text-blue-700",
  FULFILLED: "bg-green-100 text-green-700",
  DELIVERED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
};

function Badge({ label, color }: { label: string; color: string }) {
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>{label}</span>;
}

export default function AdminPudoShipments() {
  const { session } = useAdminAuth();
  const token = session?.accessToken;

  const [orders, setOrders] = useState<PudoOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiRequest<{ data: { items: PudoOrder[]; total: number } }>("/admin/pudo/orders?perPage=100", {}, token);
      setOrders(res.data.items);
      setTotal(res.data.total);
    } catch {
      toast.error("Failed to load PUDO shipments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-gray-900">PUDO Shipments</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} orders with PUDO delivery</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-sm font-semibold transition-colors disabled:opacity-60"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <div className="flex items-start gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
        <Zap size={15} className="mt-0.5 shrink-0 text-green-600" />
        <p>
          Tracking statuses update automatically — PUDO sends a webhook each time a shipment status changes.
          Make sure the webhook URL is configured in the PUDO portal under <strong>Tracking → Webhook tracking URLs</strong> (see Admin → Shipping → PUDO Settings).
        </p>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Package size={40} className="mx-auto mb-3 opacity-40" />
          <p>No PUDO orders yet.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Order</th>
                  <th className="px-4 py-3 text-left">Customer</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">Destination</th>
                  <th className="px-4 py-3 text-left">Waybill / Tracking</th>
                  <th className="px-4 py-3 text-left">Fulfillment</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link to={`/admin/orders/${order.id}`} className="font-semibold text-indigo-600 hover:underline">
                        #{order.orderNumber}
                      </Link>
                      <p className="text-xs text-gray-400">{new Date(order.createdAt).toLocaleDateString("en-ZA")}</p>
                    </td>
                    <td className="px-4 py-3">
                      {order.customer ? (
                        <>
                          <p className="font-medium text-gray-900">{[order.customer.firstName, order.customer.lastName].filter(Boolean).join(" ") || "—"}</p>
                          <p className="text-xs text-gray-400">{order.customer.email}</p>
                        </>
                      ) : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
                        <Truck size={11} />
                        {order.pudoDeliveryType === "door" ? "Door" : "Locker"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700 max-w-[160px]">
                      {order.pudoDeliveryType === "locker" && order.pudoLockerName ? (
                        <span title={order.pudoLockerCode ?? ""}>{order.pudoLockerName}</span>
                      ) : order.pudoDeliveryType === "door" ? (
                        <span className="text-gray-400">Door delivery</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {order.trackingNumber ? (
                        <a
                          href={`https://pudo.co.za/track/${order.trackingNumber}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-indigo-600 hover:underline font-mono text-xs"
                        >
                          {order.trackingNumber}
                          <ExternalLink size={11} />
                        </a>
                      ) : (
                        <span className="text-xs text-amber-600 font-medium">Pending</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        label={order.fulfillmentStatus}
                        color={FULFILLMENT_COLORS[order.fulfillmentStatus] ?? "bg-gray-100 text-gray-700"}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        label={order.status.replace(/_/g, " ")}
                        color={STATUS_COLORS[order.status] ?? "bg-gray-100 text-gray-700"}
                      />
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">
                      {formatRand(Number(order.totalAmount))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
