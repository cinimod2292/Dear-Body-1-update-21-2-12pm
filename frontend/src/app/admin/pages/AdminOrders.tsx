import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { apiRequest } from "../api/client";
import { useAdminAuth } from "../context/AdminAuthContext";
import { AdminPagination } from "../components/AdminPagination";
import { AdminTable } from "../components/AdminTable";
import { EmptyState, ErrorState, LoadingState } from "../components/AdminState";
import { formatRand } from "../../lib/currency";

interface OrderRow {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  totalAmount: number;
  currency: string;
  placedAt: string;
  customer?: { id: string; email: string } | null;
}

export default function AdminOrders() {
  const { session } = useAdminAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [paymentStatus, setPaymentStatus] = useState("ALL");

  const params = useMemo(() => {
    const sp = new URLSearchParams({ page: String(page), perPage: "20", sortBy: "placedAt", sortDir: "desc" });
    if (query) sp.set("q", query);
    if (status !== "ALL") sp.set("status", status);
    if (paymentStatus !== "ALL") sp.set("paymentStatus", paymentStatus);
    return sp.toString();
  }, [page, query, status, paymentStatus]);

  const load = async () => {
    if (!session?.accessToken) return;
    try {
      setLoading(true);
      setError(null);
      const res = await apiRequest<{ data: { items: OrderRow[]; totalPages: number } }>(`/admin/orders?${params}`, {}, session.accessToken);
      setOrders(res.data.items);
      setTotalPages(res.data.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [session?.accessToken, params]);

  if (loading) return <LoadingState label="Loading orders..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-black text-gray-900">Orders</h2>
        <p className="text-sm text-gray-500">Track transactions, payment states, fulfillment progress, and manual actions.</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-3 grid grid-cols-1 md:grid-cols-4 gap-3">
        <input className="md:col-span-2 rounded-lg border border-gray-200 px-3 py-2 text-sm" placeholder="Search order # or customer email" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} />
        <select className="rounded-lg border border-gray-200 px-3 py-2 text-sm" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="ALL">All order statuses</option>
          <option value="PLACED">Placed</option><option value="CONFIRMED">Confirmed</option><option value="PICKING">Picking &amp; Packing</option><option value="PROCESSING">Processing</option><option value="SHIPPED">Shipped</option><option value="DELIVERED">Delivered</option><option value="READY_FOR_COLLECTION">Ready for Collection</option><option value="CANCELLED">Cancelled</option><option value="REFUNDED">Refunded</option>
        </select>
        <select className="rounded-lg border border-gray-200 px-3 py-2 text-sm" value={paymentStatus} onChange={(e) => { setPaymentStatus(e.target.value); setPage(1); }}>
          <option value="ALL">All payment statuses</option>
          <option value="PENDING">Pending</option><option value="AUTHORIZED">Authorized</option><option value="PAID">Paid</option><option value="PARTIALLY_REFUNDED">Partially refunded</option><option value="REFUNDED">Refunded</option><option value="FAILED">Failed</option><option value="CANCELLED">Cancelled</option><option value="REFUND_DUE">Refund Due</option>
        </select>
      </div>

      {orders.length === 0 ? <EmptyState label="No orders found for selected filters." /> : (
        <AdminTable
          rows={orders}
          columns={[
            { key: "num", header: "Order", render: (o) => <div><p className="font-semibold">#{o.orderNumber}</p><p className="text-xs text-gray-500">{new Date(o.placedAt).toLocaleString()}</p></div> },
            { key: "cust", header: "Customer", render: (o) => <span className="text-xs">{o.customer?.email || "Guest"}</span> },
            { key: "status", header: "Status", render: (o) => <span className="text-xs px-2 py-1 rounded-full bg-gray-100">{o.status}</span> },
            { key: "payment", header: "Payment", render: (o) => <span className="text-xs">{o.paymentStatus}</span> },
            { key: "fulfillment", header: "Fulfillment", render: (o) => <span className="text-xs">{o.fulfillmentStatus}</span> },
            { key: "total", header: "Total", render: (o) => <span className="text-xs font-semibold">{formatRand(o.totalAmount)}</span> },
            { key: "action", header: "", render: (o) => <Link to={`/admin/orders/${o.id}`} className="text-xs text-blue-600 hover:underline">View</Link> },
          ]}
        />
      )}

      <AdminPagination page={page} totalPages={totalPages} onChange={setPage} />
    </div>
  );
}
