import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { apiRequest } from "../api/client";
import { useAdminAuth } from "../context/AdminAuthContext";
import { ErrorState, LoadingState } from "../components/AdminState";
import { formatRand } from "../../lib/currency";

interface DashboardSummary {
  pendingPick: number;
  picking: number;
  picked: number;
  packing: number;
  packed: number;
  awaitingCollection: number;
  exception: number;
  stockIssues: number;
  urgent: number;
  missed: number;
}

interface WarehouseOrder {
  id: string;
  orderNumber: string;
  warehouseStatus: string;
  stockIssueStatus: string;
  slaStatus: "green" | "amber" | "red" | "critical" | "missed";
  collectionDate: string | null;
  collectionWindowStart: string | null;
  collectionWindowEnd: string | null;
  slaDeadline: string | null;
  totalAmount: number;
  currency: string;
  placedAt: string;
  customer: { firstName?: string; lastName?: string; email: string } | null;
  items: { sku: string; productName: string; quantity: number }[];
  shippingMethod: { name: string; type: string } | null;
  pickedBy: { firstName?: string; lastName?: string } | null;
}

const STATUS_LABELS: Record<string, string> = {
  PENDING_PICK: "Pending Pick",
  PICKING: "Picking",
  PICKED: "Picked",
  PACKING: "Packing",
  PACKED: "Packed",
  AWAITING_COLLECTION: "Awaiting Collection",
  EXCEPTION: "Exception",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING_PICK: "bg-yellow-100 text-yellow-800",
  PICKING: "bg-blue-100 text-blue-800",
  PICKED: "bg-indigo-100 text-indigo-800",
  PACKING: "bg-purple-100 text-purple-800",
  PACKED: "bg-green-100 text-green-800",
  AWAITING_COLLECTION: "bg-teal-100 text-teal-800",
  EXCEPTION: "bg-red-100 text-red-800",
};

const SLA_COLORS: Record<string, string> = {
  green: "bg-green-100 text-green-800",
  amber: "bg-yellow-100 text-yellow-800",
  red: "bg-orange-100 text-orange-800",
  critical: "bg-red-100 text-red-800",
  missed: "bg-red-200 text-red-900",
};

const ISSUE_COLORS: Record<string, string> = {
  NONE: "",
  PARTIAL_STOCK: "bg-yellow-50 border-l-4 border-yellow-400",
  OUT_OF_STOCK: "bg-red-50 border-l-4 border-red-500",
  DAMAGED: "bg-orange-50 border-l-4 border-orange-500",
};

function CountdownTimer({ deadline }: { deadline: string | null }) {
  const [remaining, setRemaining] = useState("");

  useEffect(() => {
    if (!deadline) return;
    const update = () => {
      const ms = new Date(deadline).getTime() - Date.now();
      if (ms <= 0) { setRemaining("MISSED"); return; }
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      setRemaining(`${h}h ${m}m ${s}s`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [deadline]);

  if (!deadline) return <span className="text-gray-400 text-xs">No deadline</span>;
  return <span className="text-xs font-mono font-medium">{remaining}</span>;
}

function SummaryCard({ label, value, color, filter, onFilter }: {
  label: string; value: number; color: string; filter?: string; onFilter?: (f: string) => void;
}) {
  return (
    <button
      onClick={() => onFilter?.(filter ?? "")}
      className={`rounded-xl p-4 text-left transition hover:shadow-md ${color} w-full`}
    >
      <p className="text-2xl font-black">{value}</p>
      <p className="text-sm font-medium mt-1">{label}</p>
    </button>
  );
}

export default function AdminWarehouseDashboard() {
  const { session } = useAdminAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [orders, setOrders] = useState<WarehouseOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session?.accessToken) return;
    try {
      setLoading(true);
      setError(null);
      const [summaryRes, ordersRes] = await Promise.all([
        apiRequest<{ data: DashboardSummary }>("/admin/warehouse/summary", {}, session.accessToken),
        apiRequest<{ data: { items: WarehouseOrder[]; total: number } }>(
          `/admin/warehouse/orders?perPage=30&page=${page}${filter ? `&warehouseStatus=${filter}` : ""}`,
          {},
          session.accessToken,
        ),
      ]);
      setSummary(summaryRes.data);
      setOrders(ordersRes.data.items);
      setTotal(ordersRes.data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load warehouse data");
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken, page, filter]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  if (!summary && loading) return <LoadingState label="Loading warehouse dashboard..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Warehouse Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Fulfilment operations — auto-refreshes every 30s</p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/admin/fulfillment/collection-schedule"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Collection Schedule
          </Link>
          <button
            onClick={load}
            className="rounded-lg bg-pink-600 px-4 py-2 text-sm font-medium text-white hover:bg-pink-700"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
          <SummaryCard label="Pending Pick" value={summary.pendingPick} color="bg-yellow-50" filter="PENDING_PICK" onFilter={setFilter} />
          <SummaryCard label="Picking" value={summary.picking} color="bg-blue-50" filter="PICKING" onFilter={setFilter} />
          <SummaryCard label="Picked" value={summary.picked} color="bg-indigo-50" filter="PICKED" onFilter={setFilter} />
          <SummaryCard label="Packing" value={summary.packing} color="bg-purple-50" filter="PACKING" onFilter={setFilter} />
          <SummaryCard label="Packed" value={summary.packed} color="bg-green-50" filter="PACKED" onFilter={setFilter} />
          <SummaryCard label="Awaiting Collection" value={summary.awaitingCollection} color="bg-teal-50" filter="AWAITING_COLLECTION" onFilter={setFilter} />
          <SummaryCard label="Exceptions" value={summary.exception} color="bg-red-50" filter="EXCEPTION" onFilter={setFilter} />
          <SummaryCard label="Stock Issues" value={summary.stockIssues} color="bg-orange-50" filter="" onFilter={() => setFilter("")} />
          <SummaryCard label="Urgent (< 3h)" value={summary.urgent} color="bg-amber-50" filter="" onFilter={() => setFilter("")} />
          <SummaryCard label="Missed SLA" value={summary.missed} color="bg-red-100" filter="" onFilter={() => setFilter("")} />
        </div>
      )}

      {/* Filter bar */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => { setFilter(""); setPage(1); }}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${!filter ? "bg-pink-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
        >
          All ({total})
        </button>
        {Object.entries(STATUS_LABELS).map(([key, label]) => (
          <button
            key={key}
            onClick={() => { setFilter(key); setPage(1); }}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${filter === key ? "bg-pink-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Orders table */}
      {loading && <div className="text-center py-8 text-gray-400">Refreshing...</div>}
      <div className="space-y-3">
        {orders.length === 0 && !loading && (
          <div className="text-center py-12 text-gray-400">No orders matching this filter</div>
        )}
        {orders.map((order) => (
          <div
            key={order.id}
            className={`bg-white rounded-xl shadow-sm border ${ISSUE_COLORS[order.stockIssueStatus] || "border-gray-200"} overflow-hidden`}
          >
            <div className="p-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      to={`/admin/warehouse/orders/${order.id}`}
                      className="text-base font-bold text-pink-600 hover:underline"
                    >
                      #{order.orderNumber}
                    </Link>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[order.warehouseStatus] ?? "bg-gray-100 text-gray-700"}`}>
                      {STATUS_LABELS[order.warehouseStatus] ?? order.warehouseStatus}
                    </span>
                    {order.stockIssueStatus !== "NONE" && (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                        {order.stockIssueStatus.replace(/_/g, " ")}
                      </span>
                    )}
                    {order.slaStatus !== "green" && (
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${SLA_COLORS[order.slaStatus]}`}>
                        SLA: {order.slaStatus.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    {order.customer ? `${order.customer.firstName ?? ""} ${order.customer.lastName ?? ""}`.trim() || order.customer.email : "Guest"}
                    {" · "}
                    {order.items.length} item{order.items.length !== 1 ? "s" : ""}
                    {" · "}
                    {formatRand(order.totalAmount)}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {order.items.slice(0, 3).map((i) => `${i.productName} ×${i.quantity}`).join(", ")}
                    {order.items.length > 3 && ` +${order.items.length - 3} more`}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  {order.slaDeadline && (
                    <div className={`text-xs font-medium mb-1 ${order.slaStatus === "missed" ? "text-red-600" : order.slaStatus === "critical" ? "text-red-500" : order.slaStatus === "red" ? "text-orange-500" : "text-gray-500"}`}>
                      <CountdownTimer deadline={order.slaDeadline} />
                    </div>
                  )}
                  {order.collectionWindowStart && (
                    <p className="text-xs text-gray-400">
                      Collection: {new Date(order.collectionWindowStart).toLocaleString("en-ZA", {
                        timeZone: "Africa/Johannesburg",
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  )}
                  {order.pickedBy && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      Picker: {`${order.pickedBy.firstName ?? ""} ${order.pickedBy.lastName ?? ""}`.trim()}
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="border-t border-gray-100 px-4 py-2 bg-gray-50 flex items-center justify-between">
              <span className="text-xs text-gray-400">
                Placed {new Date(order.placedAt).toLocaleDateString("en-ZA")}
                {order.shippingMethod && ` · ${order.shippingMethod.name}`}
              </span>
              <Link
                to={`/admin/warehouse/orders/${order.id}`}
                className="text-xs font-medium text-pink-600 hover:underline"
              >
                Open →
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {total > 30 && (
        <div className="flex justify-center gap-2">
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1.5 text-sm border rounded disabled:opacity-40"
          >
            Prev
          </button>
          <span className="px-3 py-1.5 text-sm text-gray-600">Page {page}</span>
          <button
            disabled={orders.length < 30}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1.5 text-sm border rounded disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
