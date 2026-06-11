import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { apiRequest } from "../api/client";
import { useAdminAuth } from "../context/AdminAuthContext";
import { LoadingState } from "../components/AdminState";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DashboardSummary {
  pendingPick: number; picking: number; picked: number;
  packing: number; packed: number; awaitingCollection: number;
  exception: number; stockIssues: number; urgent: number; missed: number;
}

interface PickTaskItem {
  id: string; orderItemId: string;
  status: "PENDING" | "PICKED" | "ISSUE";
  issueType: "NONE" | "PARTIAL_STOCK" | "OUT_OF_STOCK" | "DAMAGED";
  issueNotes: string | null; pickedAt: string | null;
}

interface OrderItem {
  id: string; sku: string; productName: string; variantTitle: string | null;
  quantity: number; pickTaskItems: PickTaskItem[];
}

interface WarehouseOrder {
  id: string; orderNumber: string;
  warehouseStatus: string; stockIssueStatus: string;
  slaStatus: "green" | "amber" | "red" | "critical" | "missed";
  slaDeadline: string | null;
  collectionWindowStart: string | null; collectionWindowEnd: string | null;
  totalAmount: number; currency: string; placedAt: string;
  warehouseNotes: string | null;
  customer: { firstName?: string; lastName?: string; email: string } | null;
  items: { id: string; sku: string; productName: string; quantity: number }[];
  shippingMethod: { name: string; type: string } | null;
  pickedBy: { id: string; firstName?: string; lastName?: string; email?: string } | null;
  packedBy: { id: string; firstName?: string; lastName?: string } | null;
}

interface WarehouseOrderDetail extends Omit<WarehouseOrder, "items"> {
  items: OrderItem[];
  shippingAddress: {
    recipientName?: string; firstName?: string; lastName?: string;
    line1: string; line2?: string; suburb?: string; city: string; postalCode: string; country: string;
  } | null;
  pickedAt: string | null; packedAt: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SLA_TIMER_COLOR: Record<string, string> = {
  green: "text-green-600", amber: "text-amber-600",
  red: "text-orange-600", critical: "text-red-600 animate-pulse", missed: "text-red-700",
};

const SLA_BORDER: Record<string, string> = {
  green: "border-l-green-400", amber: "border-l-amber-400",
  red: "border-l-orange-500", critical: "border-l-red-600", missed: "border-l-red-700",
};

function customerName(order: WarehouseOrder) {
  if (!order.customer) return "Guest";
  return `${order.customer.firstName ?? ""} ${order.customer.lastName ?? ""}`.trim() || order.customer.email;
}

function bySla(a: WarehouseOrder, b: WarehouseOrder) {
  if (!a.slaDeadline) return 1;
  if (!b.slaDeadline) return -1;
  return new Date(a.slaDeadline).getTime() - new Date(b.slaDeadline).getTime();
}

// ─── CountdownTimer ───────────────────────────────────────────────────────────

function CountdownTimer({ deadline, large = false }: { deadline: string | null; large?: boolean }) {
  const [remaining, setRemaining] = useState("");

  useEffect(() => {
    if (!deadline) return;
    const update = () => {
      const ms = new Date(deadline).getTime() - Date.now();
      if (ms <= 0) { setRemaining("MISSED"); return; }
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      setRemaining(h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [deadline]);

  if (!deadline) return <span className={`text-gray-400 font-mono ${large ? "text-2xl" : "text-xs"}`}>—</span>;
  return <span className={`font-mono font-bold ${large ? "text-3xl" : "text-sm"}`}>{remaining}</span>;
}

// ─── ExpandedPickPanel ────────────────────────────────────────────────────────

function ExpandedPickPanel({
  orderId, accessToken, onDone,
}: {
  orderId: string; accessToken: string; onDone: () => void;
}) {
  const [detail, setDetail] = useState<WarehouseOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [packNotes, setPackNotes] = useState("");
  const [issueState, setIssueState] = useState<Record<string, { type: string; notes: string; open: boolean }>>({});

  const loadDetail = useCallback(async () => {
    const res = await apiRequest<{ data: WarehouseOrderDetail }>(
      `/admin/warehouse/orders/${orderId}`, {}, accessToken,
    );
    setDetail(res.data);
    setLoading(false);
  }, [orderId, accessToken]);

  useEffect(() => { void loadDetail(); }, [loadDetail]);

  const doAction = async (endpoint: string, body?: object) => {
    setActing(true);
    try {
      await apiRequest(
        `/admin/warehouse/orders/${orderId}/${endpoint}`,
        { method: "POST", body: body ? JSON.stringify(body) : undefined },
        accessToken,
      );
      await loadDetail();
      onDone();
      toast.success("Updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActing(false);
    }
  };

  const updateItem = async (pickTaskItemId: string, status: "PICKED" | "ISSUE", issueType?: string, issueNotes?: string) => {
    setActing(true);
    try {
      await apiRequest(
        `/admin/warehouse/orders/${orderId}/pick-items/${pickTaskItemId}`,
        { method: "PATCH", body: JSON.stringify({ status, ...(issueType ? { issueType, issueNotes } : {}) }) },
        accessToken,
      );
      await loadDetail();
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update item");
    } finally {
      setActing(false);
    }
  };

  if (loading) return <div className="p-4 text-sm text-gray-400">Loading items…</div>;
  if (!detail) return null;

  const ws = detail.warehouseStatus;
  const allPickItems = detail.items.flatMap((i) => i.pickTaskItems);
  const pickedCount = allPickItems.filter((p) => p.status === "PICKED").length;
  const issueCount = allPickItems.filter((p) => p.status === "ISSUE").length;
  const totalItems = allPickItems.length;
  const allDone = totalItems > 0 && pickedCount + issueCount === totalItems;

  return (
    <div className="border-t border-gray-100 bg-gray-50">
      {/* Progress bar */}
      <div className="px-4 pt-3 pb-1">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
          <span>Pick progress</span>
          <span className="font-medium">{pickedCount + issueCount}/{totalItems}</span>
        </div>
        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 transition-all"
            style={{ width: `${totalItems ? ((pickedCount + issueCount) / totalItems) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Items */}
      <div className="px-4 py-2 space-y-2">
        {detail.items.map((item) => {
          const pick = item.pickTaskItems[0];
          const isPicked = pick?.status === "PICKED";
          const isIssue = pick?.status === "ISSUE";
          const iState = issueState[item.id] ?? { type: "OUT_OF_STOCK", notes: "", open: false };

          return (
            <div
              key={item.id}
              className={`rounded-lg border p-3 text-sm transition ${
                isPicked ? "bg-green-50 border-green-200" :
                isIssue ? "bg-red-50 border-red-200" : "bg-white border-gray-200"
              }`}
            >
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <span className="font-mono text-xs text-gray-400 mr-2">{item.sku}</span>
                  <span className="font-medium text-gray-900">{item.productName}</span>
                  {item.variantTitle && <span className="text-gray-500"> — {item.variantTitle}</span>}
                  <span className="ml-2 text-gray-500">×{item.quantity}</span>
                  {isPicked && <span className="ml-2 text-green-600 font-bold text-xs">✓ PICKED</span>}
                  {isIssue && <span className="ml-2 text-red-600 font-bold text-xs">⚠ {pick?.issueType?.replace(/_/g, " ")}</span>}
                </div>
                {ws === "PICKING" && !acting && (
                  <div className="flex gap-1.5 shrink-0">
                    {!isPicked && (
                      <button
                        onClick={() => pick && updateItem(pick.id, "PICKED")}
                        disabled={!pick}
                        className="px-2.5 py-1 rounded bg-green-600 text-white text-xs font-medium hover:bg-green-700 disabled:opacity-40"
                      >
                        Picked
                      </button>
                    )}
                    {isPicked && (
                      <button
                        onClick={() => pick && updateItem(pick.id, "ISSUE", "OUT_OF_STOCK", "")}
                        className="px-2.5 py-1 rounded border border-gray-300 text-gray-600 text-xs hover:bg-gray-100"
                      >
                        Undo
                      </button>
                    )}
                    {!isPicked && !iState.open && (
                      <button
                        onClick={() => setIssueState((s) => ({ ...s, [item.id]: { ...iState, open: true } }))}
                        disabled={!pick}
                        className="px-2.5 py-1 rounded border border-red-300 text-red-600 text-xs hover:bg-red-50 disabled:opacity-40"
                      >
                        Issue
                      </button>
                    )}
                  </div>
                )}
              </div>

              {iState.open && ws === "PICKING" && (
                <div className="mt-2 space-y-1.5">
                  <select
                    value={iState.type}
                    onChange={(e) => setIssueState((s) => ({ ...s, [item.id]: { ...iState, type: e.target.value } }))}
                    className="w-full border rounded px-2 py-1 text-xs bg-white"
                  >
                    <option value="OUT_OF_STOCK">Out of Stock</option>
                    <option value="PARTIAL_STOCK">Partial Stock</option>
                    <option value="DAMAGED">Damaged</option>
                  </select>
                  <textarea
                    value={iState.notes}
                    onChange={(e) => setIssueState((s) => ({ ...s, [item.id]: { ...iState, notes: e.target.value } }))}
                    placeholder="Notes (required)"
                    rows={2}
                    className="w-full border rounded px-2 py-1 text-xs resize-none"
                  />
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => {
                        if (!iState.notes.trim()) { toast.error("Notes required"); return; }
                        if (pick) void updateItem(pick.id, "ISSUE", iState.type, iState.notes);
                        setIssueState((s) => ({ ...s, [item.id]: { ...iState, open: false } }));
                      }}
                      className="px-2.5 py-1 rounded bg-red-600 text-white text-xs font-medium"
                    >
                      Report
                    </button>
                    <button
                      onClick={() => setIssueState((s) => ({ ...s, [item.id]: { ...iState, open: false } }))}
                      className="px-2.5 py-1 rounded border text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Action buttons */}
      <div className="px-4 pb-4 pt-2 flex flex-wrap gap-2">
        {ws === "PICKING" && (
          <button
            onClick={() => doAction("complete-picking")}
            disabled={acting || !allDone}
            className="flex-1 py-2 rounded-lg bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-50"
          >
            {allDone ? "Complete Picking →" : `Complete Picking (${pickedCount + issueCount}/${totalItems})`}
          </button>
        )}
        {ws === "PICKED" && (
          <button
            onClick={() => doAction("start-packing")}
            disabled={acting}
            className="flex-1 py-2 rounded-lg bg-purple-600 text-white text-sm font-bold hover:bg-purple-700 disabled:opacity-50"
          >
            Start Packing
          </button>
        )}
        {ws === "PACKING" && (
          <>
            <input
              type="text"
              value={packNotes}
              onChange={(e) => setPackNotes(e.target.value)}
              placeholder="Packing notes (optional)"
              className="flex-1 border rounded-lg px-3 py-2 text-sm min-w-0"
            />
            <button
              onClick={() => doAction("complete-packing", { notes: packNotes })}
              disabled={acting}
              className="py-2 px-4 rounded-lg bg-green-600 text-white text-sm font-bold hover:bg-green-700 disabled:opacity-50"
            >
              Complete Packing
            </button>
          </>
        )}
        {ws === "PACKED" && (
          <button
            onClick={() => doAction("awaiting-collection")}
            disabled={acting}
            className="flex-1 py-2 rounded-lg bg-teal-600 text-white text-sm font-bold hover:bg-teal-700 disabled:opacity-50"
          >
            Mark Awaiting Collection
          </button>
        )}
        <button
          onClick={() => window.open(`/api/admin/warehouse/orders/${orderId}/packing-slip`, "_blank")}
          className="py-2 px-3 rounded-lg border border-gray-300 text-gray-600 text-xs hover:bg-gray-50"
        >
          Packing Slip ↗
        </button>
      </div>
    </div>
  );
}

// ─── OrderCard ────────────────────────────────────────────────────────────────

function OrderCard({
  order, expanded, onToggle, children,
}: {
  order: WarehouseOrder; expanded: boolean; onToggle: () => void; children?: React.ReactNode;
}) {
  const slaColor = SLA_TIMER_COLOR[order.slaStatus] ?? "text-gray-500";
  const borderColor = SLA_BORDER[order.slaStatus] ?? "border-l-gray-300";

  return (
    <div className={`bg-white rounded-xl border border-gray-200 border-l-4 ${borderColor} overflow-hidden shadow-sm`}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left px-4 py-3 hover:bg-gray-50 transition"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-gray-900">#{order.orderNumber}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-medium">
                {order.warehouseStatus.replace(/_/g, " ")}
              </span>
              {order.stockIssueStatus !== "NONE" && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
                  {order.stockIssueStatus.replace(/_/g, " ")}
                </span>
              )}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              {customerName(order)} · {order.items.length} item{order.items.length !== 1 ? "s" : ""}
              {order.collectionWindowStart && (
                <span className="ml-1">
                  · Collection {new Date(order.collectionWindowStart).toLocaleTimeString("en-ZA", { timeZone: "Africa/Johannesburg", hour: "2-digit", minute: "2-digit" })}
                  {order.collectionWindowEnd && `–${new Date(order.collectionWindowEnd).toLocaleTimeString("en-ZA", { timeZone: "Africa/Johannesburg", hour: "2-digit", minute: "2-digit" })}`}
                </span>
              )}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className={`font-mono font-bold text-base ${slaColor}`}>
              <CountdownTimer deadline={order.slaDeadline} />
            </div>
            <div className="text-xs text-gray-400">until cutoff</div>
          </div>
          <span className="text-gray-400 text-sm">{expanded ? "▲" : "▼"}</span>
        </div>
      </button>
      {children}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function AdminWarehouseDashboard() {
  const { session } = useAdminAuth();
  const myId = session?.id ?? "";

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [allOrders, setAllOrders] = useState<WarehouseOrder[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);

  const load = useCallback(async () => {
    if (!session?.accessToken) return;
    try {
      const [summaryRes, ordersRes] = await Promise.all([
        apiRequest<{ data: DashboardSummary }>("/admin/warehouse/summary", {}, session.accessToken),
        apiRequest<{ data: { items: WarehouseOrder[]; total: number } }>(
          "/admin/warehouse/orders?perPage=100",
          {}, session.accessToken,
        ),
      ]);
      setSummary(summaryRes.data);
      setAllOrders(ordersRes.data.items);
    } catch {
      // keep showing stale data on background refresh errors
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  const claimOrder = async (orderId: string) => {
    if (!session?.accessToken) return;
    setActing(orderId);
    try {
      await apiRequest(
        `/admin/warehouse/orders/${orderId}/start-picking`,
        { method: "POST" },
        session.accessToken,
      );
      await load();
      setExpandedId(orderId);
      toast.success("Order claimed — start picking!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to claim order");
    } finally {
      setActing(null);
    }
  };

  // Split orders
  const unassigned = allOrders.filter((o) => o.warehouseStatus === "PENDING_PICK").sort(bySla);
  const myActive = allOrders
    .filter((o) => ["PICKING", "PACKING"].includes(o.warehouseStatus) && o.pickedBy?.id === myId)
    .sort(bySla);
  const otherActive = allOrders
    .filter((o) => ["PICKING", "PACKING"].includes(o.warehouseStatus) && o.pickedBy?.id !== myId)
    .sort(bySla);
  const myPicked = allOrders
    .filter((o) => ["PICKED", "PACKED"].includes(o.warehouseStatus) && (o.pickedBy?.id === myId || o.packedBy?.id === myId))
    .sort(bySla);
  const done = allOrders.filter((o) => ["AWAITING_COLLECTION", "EXCEPTION"].includes(o.warehouseStatus));
  const exceptions = allOrders.filter((o) => o.warehouseStatus === "EXCEPTION");

  const nextPick = myActive[0] ?? unassigned[0] ?? null;

  const printAllSlips = () => {
    const toPrint = [...myActive, ...myPicked];
    if (toPrint.length === 0) { toast.error("No assigned orders to print"); return; }
    toPrint.forEach((o) => window.open(`/api/admin/warehouse/orders/${o.id}/packing-slip`, "_blank"));
  };

  if (loading && allOrders.length === 0) return <LoadingState label="Loading warehouse…" />;

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Warehouse</h1>
          <p className="text-xs text-gray-400">Auto-refreshes every 30s</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={printAllSlips}
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-1.5"
          >
            🖨 Print My Slips {myActive.length + myPicked.length > 0 && `(${myActive.length + myPicked.length})`}
          </button>
          <Link
            to="/admin/fulfillment/collection-schedule"
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50"
          >
            Schedule
          </Link>
          <button
            onClick={load}
            className="px-3 py-2 rounded-lg bg-pink-600 text-sm font-medium text-white hover:bg-pink-700"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Stats strip */}
      {summary && (
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
          {[
            { label: "Pending", value: summary.pendingPick, bg: "bg-yellow-50 text-yellow-800" },
            { label: "Picking", value: summary.picking, bg: "bg-blue-50 text-blue-800" },
            { label: "Picked", value: summary.picked, bg: "bg-indigo-50 text-indigo-800" },
            { label: "Packing", value: summary.packing, bg: "bg-purple-50 text-purple-800" },
            { label: "Packed", value: summary.packed, bg: "bg-green-50 text-green-800" },
            { label: "Awaiting", value: summary.awaitingCollection, bg: "bg-teal-50 text-teal-800" },
            { label: "Urgent", value: summary.urgent, bg: "bg-orange-50 text-orange-700" },
            { label: "Missed SLA", value: summary.missed, bg: "bg-red-50 text-red-700" },
          ].map(({ label, value, bg }) => (
            <div key={label} className={`rounded-lg px-3 py-2 text-center ${bg}`}>
              <div className="text-xl font-black">{value}</div>
              <div className="text-xs font-medium leading-tight">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* My Next Pick — highlighted banner */}
      {nextPick && (
        <div className={`rounded-2xl border-2 p-4 ${
          nextPick.slaStatus === "critical" || nextPick.slaStatus === "missed"
            ? "border-red-400 bg-red-50"
            : nextPick.slaStatus === "red"
            ? "border-orange-400 bg-orange-50"
            : nextPick.slaStatus === "amber"
            ? "border-yellow-400 bg-yellow-50"
            : "border-blue-300 bg-blue-50"
        }`}>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
                {myActive.length > 0 ? "My Next Active Order" : "Next Unassigned Order"}
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xl font-black text-gray-900">#{nextPick.orderNumber}</span>
                <span className="text-sm text-gray-600">{customerName(nextPick)}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-white border border-gray-300 text-gray-700">
                  {nextPick.items.length} items
                </span>
              </div>
              {nextPick.collectionWindowStart && (
                <p className="text-xs text-gray-500 mt-1">
                  Collection {new Date(nextPick.collectionWindowStart).toLocaleString("en-ZA", {
                    timeZone: "Africa/Johannesburg", weekday: "short", month: "short", day: "numeric",
                    hour: "2-digit", minute: "2-digit",
                  })}
                  {nextPick.collectionWindowEnd && ` – ${new Date(nextPick.collectionWindowEnd).toLocaleTimeString("en-ZA", { timeZone: "Africa/Johannesburg", hour: "2-digit", minute: "2-digit" })}`}
                </p>
              )}
            </div>
            <div className="text-center">
              <div className={`${SLA_TIMER_COLOR[nextPick.slaStatus] ?? "text-gray-700"}`}>
                <CountdownTimer deadline={nextPick.slaDeadline} large />
              </div>
              <p className="text-xs text-gray-500 mt-1">until cutoff</p>
            </div>
            <div>
              {myActive.length > 0 && myActive[0].id === nextPick.id ? (
                <button
                  onClick={() => setExpandedId((id) => id === nextPick.id ? null : nextPick.id)}
                  className="px-6 py-3 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700"
                >
                  {expandedId === nextPick.id ? "Collapse ▲" : "Continue Picking ▼"}
                </button>
              ) : (
                <button
                  onClick={() => claimOrder(nextPick.id)}
                  disabled={acting === nextPick.id}
                  className="px-6 py-3 rounded-xl bg-pink-600 text-white font-bold text-sm hover:bg-pink-700 disabled:opacity-50"
                >
                  {acting === nextPick.id ? "Claiming…" : "Claim & Start Picking →"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">

        {/* Left: My Active Orders */}
        <div className="lg:col-span-3 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-gray-900 text-sm uppercase tracking-wide">
              My Queue <span className="ml-1 text-gray-400 font-normal normal-case">({myActive.length + myPicked.length})</span>
            </h2>
          </div>

          {myActive.length === 0 && myPicked.length === 0 && (
            <div className="rounded-xl border border-dashed border-gray-300 py-8 text-center text-sm text-gray-400">
              No active orders — claim one from the queue →
            </div>
          )}

          {[...myActive, ...myPicked].map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              expanded={expandedId === order.id}
              onToggle={() => setExpandedId((id) => id === order.id ? null : order.id)}
            >
              {expandedId === order.id && session?.accessToken && (
                <ExpandedPickPanel
                  orderId={order.id}
                  accessToken={session.accessToken}
                  onDone={load}
                />
              )}
            </OrderCard>
          ))}

          {/* Other pickers' active orders */}
          {otherActive.length > 0 && (
            <details className="group">
              <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-600 select-none py-1">
                {otherActive.length} order{otherActive.length !== 1 ? "s" : ""} being picked by others ▾
              </summary>
              <div className="mt-2 space-y-2 opacity-70">
                {otherActive.map((order) => (
                  <div key={order.id} className="rounded-lg border border-gray-200 bg-white px-4 py-3 flex items-center justify-between gap-3">
                    <div>
                      <span className="font-bold text-gray-700">#{order.orderNumber}</span>
                      <span className="text-xs text-gray-400 ml-2">
                        {order.pickedBy ? `${order.pickedBy.firstName ?? ""} ${order.pickedBy.lastName ?? ""}`.trim() : "Unknown"}
                      </span>
                      <span className="text-xs text-gray-400 ml-2">{order.items.length} items</span>
                    </div>
                    <div className={`font-mono text-sm font-bold ${SLA_TIMER_COLOR[order.slaStatus]}`}>
                      <CountdownTimer deadline={order.slaDeadline} />
                    </div>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>

        {/* Right: Unassigned Queue */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-gray-900 text-sm uppercase tracking-wide">
              Unassigned <span className="ml-1 text-gray-400 font-normal normal-case">({unassigned.length})</span>
            </h2>
          </div>

          {unassigned.length === 0 && (
            <div className="rounded-xl border border-dashed border-gray-300 py-8 text-center text-sm text-gray-400">
              No unassigned orders
            </div>
          )}

          {unassigned.map((order) => (
            <div
              key={order.id}
              className={`bg-white rounded-xl border border-l-4 ${SLA_BORDER[order.slaStatus] ?? "border-l-gray-300"} border-gray-200 p-3`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-gray-900 text-sm">#{order.orderNumber}</span>
                    {order.stockIssueStatus !== "NONE" && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">{order.stockIssueStatus.replace(/_/g, " ")}</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{customerName(order)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {order.items.length} item{order.items.length !== 1 ? "s" : ""}
                    {order.items.length > 0 && ` · ${order.items.slice(0, 2).map((i) => i.productName).join(", ")}${order.items.length > 2 ? ` +${order.items.length - 2}` : ""}`}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <div className={`font-mono font-bold text-sm ${SLA_TIMER_COLOR[order.slaStatus]}`}>
                    <CountdownTimer deadline={order.slaDeadline} />
                  </div>
                  <div className="text-xs text-gray-400">cutoff</div>
                </div>
              </div>
              <button
                onClick={() => claimOrder(order.id)}
                disabled={acting === order.id}
                className="mt-2 w-full py-1.5 rounded-lg bg-pink-600 text-white text-xs font-bold hover:bg-pink-700 disabled:opacity-50"
              >
                {acting === order.id ? "Claiming…" : "Claim Order →"}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Done / Awaiting Collection */}
      {done.length > 0 && (
        <div>
          <button
            onClick={() => setShowDone((s) => !s)}
            className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 py-1"
          >
            {showDone ? "▲" : "▼"} Awaiting Collection &amp; Exceptions ({done.length})
            {exceptions.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">{exceptions.length} exception{exceptions.length !== 1 ? "s" : ""}</span>
            )}
          </button>
          {showDone && (
            <div className="mt-2 space-y-1.5">
              {done.map((order) => (
                <div key={order.id} className={`rounded-lg border bg-white px-3 py-2 flex items-center justify-between gap-3 ${order.warehouseStatus === "EXCEPTION" ? "border-red-300 bg-red-50" : "border-gray-200"}`}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-sm text-gray-700">#{order.orderNumber}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${order.warehouseStatus === "EXCEPTION" ? "bg-red-100 text-red-800" : "bg-teal-100 text-teal-800"}`}>
                      {order.warehouseStatus.replace(/_/g, " ")}
                    </span>
                    <span className="text-xs text-gray-400">{customerName(order)}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {order.slaDeadline && (
                      <div className={`font-mono text-xs ${SLA_TIMER_COLOR[order.slaStatus]}`}>
                        <CountdownTimer deadline={order.slaDeadline} />
                      </div>
                    )}
                    <Link
                      to={`/admin/warehouse/orders/${order.id}`}
                      className="text-xs text-pink-600 hover:underline"
                    >
                      Open →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
