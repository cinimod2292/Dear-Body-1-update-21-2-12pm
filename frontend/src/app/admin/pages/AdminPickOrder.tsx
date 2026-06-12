import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { apiRequest } from "../api/client";
import { API_BASE } from "../../lib/api";
import { useAdminAuth } from "../context/AdminAuthContext";
import { ErrorState, LoadingState } from "../components/AdminState";
import { toast } from "sonner";

interface PickTaskItem {
  id: string;
  orderItemId: string;
  status: "PENDING" | "PICKED" | "ISSUE";
  issueType: "NONE" | "PARTIAL_STOCK" | "OUT_OF_STOCK" | "DAMAGED";
  issueNotes: string | null;
  pickedAt: string | null;
}

interface OrderItem {
  id: string;
  sku: string;
  productName: string;
  variantTitle: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  pickTaskItems: PickTaskItem[];
}

interface WarehouseOrderDetail {
  id: string;
  orderNumber: string;
  status: string;
  warehouseStatus: string;
  stockIssueStatus: string;
  slaStatus: string;
  collectionDate: string | null;
  collectionWindowStart: string | null;
  collectionWindowEnd: string | null;
  slaDeadline: string | null;
  pickedAt: string | null;
  packedAt: string | null;
  pickingStartedAt: string | null;
  warehouseNotes: string | null;
  totalAmount: number;
  currency: string;
  placedAt: string;
  trackingNumber: string | null;
  customer: {
    id: string;
    firstName?: string;
    lastName?: string;
    email: string;
    phone?: string;
  } | null;
  items: OrderItem[];
  shippingMethod: { name: string; type: string } | null;
  shippingAddress: {
    firstName?: string; lastName?: string; recipientName?: string;
    line1: string; line2?: string; suburb?: string; city: string;
    state?: string; postalCode: string; country: string;
  } | null;
  pickedBy: { id: string; firstName?: string; lastName?: string; email: string } | null;
  packedBy: { id: string; firstName?: string; lastName?: string; email: string } | null;
}

const SLA_BORDER: Record<string, string> = {
  green: "border-green-400",
  amber: "border-yellow-400",
  red: "border-orange-500",
  critical: "border-red-600",
  missed: "border-red-700",
};

const SLA_BG: Record<string, string> = {
  green: "bg-green-50",
  amber: "bg-yellow-50",
  red: "bg-orange-50",
  critical: "bg-red-50",
  missed: "bg-red-100",
};

function CountdownTimer({ deadline }: { deadline: string | null }) {
  const [remaining, setRemaining] = useState("");

  useEffect(() => {
    if (!deadline) return;
    const update = () => {
      const ms = new Date(deadline).getTime() - Date.now();
      if (ms <= 0) { setRemaining("MISSED!"); return; }
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      setRemaining(`${h}h ${m}m ${s}s`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [deadline]);

  if (!deadline) return null;
  return <span className="font-mono font-bold text-lg">{remaining}</span>;
}

function PickItemRow({
  item,
  pickTask,
  onUpdate,
  disabled,
}: {
  item: OrderItem;
  pickTask: PickTaskItem | undefined;
  onUpdate: (pickTaskItemId: string, status: "PICKED" | "ISSUE", issueType?: string, issueNotes?: string) => void;
  disabled: boolean;
}) {
  const [showIssue, setShowIssue] = useState(false);
  const [issueType, setIssueType] = useState("OUT_OF_STOCK");
  const [issueNotes, setIssueNotes] = useState("");

  const status = pickTask?.status ?? "PENDING";
  const isPicked = status === "PICKED";
  const isIssue = status === "ISSUE";

  return (
    <div className={`border rounded-xl p-4 transition ${isPicked ? "bg-green-50 border-green-300" : isIssue ? "bg-red-50 border-red-300" : "bg-white border-gray-200"}`}>
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{item.sku}</span>
            {isPicked && <span className="text-green-600 text-xs font-bold">✓ PICKED</span>}
            {isIssue && <span className="text-red-600 text-xs font-bold">⚠ ISSUE: {pickTask?.issueType?.replace(/_/g, " ")}</span>}
          </div>
          <p className="font-semibold text-gray-900 mt-1">
            {item.productName}
            {item.variantTitle && <span className="text-gray-500 font-normal"> — {item.variantTitle}</span>}
          </p>
          <p className="text-sm text-gray-600 mt-0.5">
            Qty: <strong>{item.quantity}</strong>
          </p>
          {isIssue && pickTask?.issueNotes && (
            <p className="text-xs text-red-600 mt-1">Note: {pickTask.issueNotes}</p>
          )}
        </div>

        {!disabled && (
          <div className="flex gap-2 shrink-0">
            {!isPicked && (
              <button
                onClick={() => {
                  if (!pickTask) return;
                  onUpdate(pickTask.id, "PICKED");
                  setShowIssue(false);
                }}
                disabled={!pickTask}
                className="px-3 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-40"
              >
                Mark Picked
              </button>
            )}
            {isPicked && (
              <button
                onClick={() => {
                  if (!pickTask) return;
                  onUpdate(pickTask.id, "ISSUE", "OUT_OF_STOCK", "");
                }}
                disabled={!pickTask}
                className="px-3 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm hover:bg-gray-50"
              >
                Undo
              </button>
            )}
            {!isPicked && !showIssue && (
              <button
                onClick={() => setShowIssue(true)}
                disabled={!pickTask}
                className="px-3 py-2 rounded-lg border border-red-300 text-red-600 text-sm hover:bg-red-50 disabled:opacity-40"
              >
                Issue
              </button>
            )}
          </div>
        )}
      </div>

      {showIssue && !disabled && (
        <div className="mt-3 p-3 bg-red-50 rounded-lg border border-red-200 space-y-2">
          <select
            value={issueType}
            onChange={(e) => setIssueType(e.target.value)}
            className="w-full border rounded px-2 py-1.5 text-sm"
          >
            <option value="OUT_OF_STOCK">Out of Stock</option>
            <option value="PARTIAL_STOCK">Partial Stock</option>
            <option value="DAMAGED">Damaged</option>
          </select>
          <textarea
            value={issueNotes}
            onChange={(e) => setIssueNotes(e.target.value)}
            placeholder="Notes (required for issue reporting)"
            rows={2}
            className="w-full border rounded px-2 py-1.5 text-sm resize-none"
          />
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (!pickTask) return;
                if (!issueNotes.trim()) { toast.error("Notes are required for issue reports"); return; }
                onUpdate(pickTask.id, "ISSUE", issueType, issueNotes);
                setShowIssue(false);
              }}
              disabled={!pickTask}
              className="px-3 py-1.5 rounded bg-red-600 text-white text-sm font-medium"
            >
              Report Issue
            </button>
            <button onClick={() => setShowIssue(false)} className="px-3 py-1.5 rounded border text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminPickOrder() {
  const { session } = useAdminAuth();
  const { orderId } = useParams();
  const [order, setOrder] = useState<WarehouseOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [packNotes, setPackNotes] = useState("");

  const load = useCallback(async () => {
    if (!session?.accessToken || !orderId) return;
    try {
      setLoading(true);
      const res = await apiRequest<{ data: WarehouseOrderDetail }>(
        `/admin/warehouse/orders/${orderId}`,
        {},
        session.accessToken,
      );
      setOrder(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load order");
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken, orderId]);

  useEffect(() => { load(); }, [load]);

  const doAction = async (endpoint: string, method = "POST", body?: object) => {
    if (!session?.accessToken) return;
    setActionLoading(true);
    try {
      await apiRequest(
        `/admin/warehouse/orders/${orderId}/${endpoint}`,
        { method, body: body ? JSON.stringify(body) : undefined },
        session.accessToken,
      );
      await load();
      toast.success("Updated successfully");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActionLoading(false);
    }
  };

  const updatePickItem = async (pickTaskItemId: string, status: "PICKED" | "ISSUE", issueType?: string, issueNotes?: string) => {
    if (!session?.accessToken) return;
    try {
      await apiRequest(
        `/admin/warehouse/orders/${orderId}/pick-items/${pickTaskItemId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ status, ...(issueType ? { issueType, issueNotes } : {}) }),
        },
        session.accessToken,
      );
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update item");
    }
  };

  const openPackingSlip = () => {
    window.open(`${API_BASE}/admin/warehouse/orders/${orderId}/packing-slip`, "_blank");
  };

  if (loading && !order) return <LoadingState label="Loading order..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!order) return null;

  const ws = order.warehouseStatus;
  const allPickItems = order.items.flatMap((i) => i.pickTaskItems);
  const pickedCount = allPickItems.filter((p) => p.status === "PICKED").length;
  const issueCount = allPickItems.filter((p) => p.status === "ISSUE").length;
  const totalItems = allPickItems.length;
  const allDone = totalItems > 0 && pickedCount + issueCount === totalItems;

  const slaColor = SLA_BORDER[order.slaStatus] ?? "border-gray-300";
  const slaBg = SLA_BG[order.slaStatus] ?? "";

  const customerName = order.customer
    ? (`${order.customer.firstName ?? ""} ${order.customer.lastName ?? ""}`.trim() || order.customer.email)
    : "Guest";

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/admin/warehouse" className="text-gray-400 hover:text-gray-600 text-sm">
          ← Warehouse
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-black text-gray-900">Order #{order.orderNumber}</h1>
      </div>

      {/* SLA Banner */}
      <div className={`rounded-xl border-2 ${slaColor} ${slaBg} p-4`}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Time Until Collection Cutoff</p>
            <CountdownTimer deadline={order.slaDeadline} />
            {!order.slaDeadline && <p className="text-gray-400 text-sm">No collection deadline set</p>}
          </div>
          {order.collectionWindowStart && (
            <div className="text-right">
              <p className="text-xs text-gray-500">Collection Window</p>
              <p className="font-semibold text-gray-800 text-sm">
                {new Date(order.collectionWindowStart).toLocaleString("en-ZA", {
                  timeZone: "Africa/Johannesburg",
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                })}
              </p>
              <p className="text-xs text-gray-600">
                {new Date(order.collectionWindowStart).toLocaleTimeString("en-ZA", { timeZone: "Africa/Johannesburg", hour: "2-digit", minute: "2-digit" })}
                {" – "}
                {order.collectionWindowEnd && new Date(order.collectionWindowEnd).toLocaleTimeString("en-ZA", { timeZone: "Africa/Johannesburg", hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => doAction("recalculate-collection")}
              disabled={actionLoading}
              className="px-3 py-1.5 text-xs border rounded text-gray-600 hover:bg-gray-50"
            >
              Recalculate
            </button>
            <button
              onClick={openPackingSlip}
              className="px-3 py-1.5 text-xs border rounded text-gray-600 hover:bg-gray-50"
            >
              Packing Slip ↗
            </button>
          </div>
        </div>
      </div>

      {/* Order Info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Order Info</h3>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Customer</dt>
              <dd className="font-medium">{customerName}</dd>
            </div>
            {order.customer?.phone && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Phone</dt>
                <dd className="font-medium">{order.customer.phone}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-gray-500">Shipping</dt>
              <dd className="font-medium">{order.shippingMethod?.name ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Tracking</dt>
              <dd className="font-medium">{order.trackingNumber ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Total</dt>
              <dd className="font-medium">R {Number(order.totalAmount).toFixed(2)}</dd>
            </div>
          </dl>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Warehouse Status</h3>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Status</dt>
              <dd>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
                  {ws.replace(/_/g, " ")}
                </span>
              </dd>
            </div>
            {order.pickedBy && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Picker</dt>
                <dd className="font-medium">
                  {`${order.pickedBy.firstName ?? ""} ${order.pickedBy.lastName ?? ""}`.trim() || order.pickedBy.email}
                </dd>
              </div>
            )}
            {order.pickedAt && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Picked At</dt>
                <dd className="font-medium">{new Date(order.pickedAt).toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" })}</dd>
              </div>
            )}
            {order.packedBy && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Packer</dt>
                <dd className="font-medium">
                  {`${order.packedBy.firstName ?? ""} ${order.packedBy.lastName ?? ""}`.trim() || order.packedBy.email}
                </dd>
              </div>
            )}
            {order.packedAt && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Packed At</dt>
                <dd className="font-medium">{new Date(order.packedAt).toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" })}</dd>
              </div>
            )}
            {order.stockIssueStatus !== "NONE" && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Stock Issue</dt>
                <dd className="text-red-600 font-medium">{order.stockIssueStatus.replace(/_/g, " ")}</dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      {/* Shipping address */}
      {order.shippingAddress && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Ship To</h3>
          <p className="text-sm text-gray-700">
            {[
              order.shippingAddress.recipientName ?? `${order.shippingAddress.firstName ?? ""} ${order.shippingAddress.lastName ?? ""}`.trim(),
              order.shippingAddress.line1,
              order.shippingAddress.line2,
              order.shippingAddress.suburb,
              order.shippingAddress.city,
              order.shippingAddress.postalCode,
              order.shippingAddress.country,
            ].filter(Boolean).join(", ")}
          </p>
        </div>
      )}

      {/* Pick progress */}
      {totalItems > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Pick Progress — {pickedCount + issueCount}/{totalItems}
            </h3>
            <div className="h-2 w-32 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all"
                style={{ width: `${totalItems ? ((pickedCount + issueCount) / totalItems) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Picking list */}
      <div className="space-y-3">
        <h2 className="text-base font-bold text-gray-900">
          {ws === "PICKING" ? "Pick List" : ws === "PACKING" ? "Pack List" : "Items"}
        </h2>
        {order.items.map((item) => {
          const pickTask = item.pickTaskItems[0];
          return (
            <PickItemRow
              key={item.id}
              item={item}
              pickTask={pickTask}
              onUpdate={updatePickItem}
              disabled={ws !== "PICKING" || actionLoading}
            />
          );
        })}
      </div>

      {/* Actions */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</h3>

        {ws === "PENDING_PICK" && (
          <button
            onClick={() => doAction("start-picking")}
            disabled={actionLoading}
            className="w-full py-3 rounded-xl bg-blue-600 text-white font-bold text-base hover:bg-blue-700 disabled:opacity-50"
          >
            Start Picking
          </button>
        )}

        {ws === "PICKING" && (
          <button
            onClick={() => doAction("complete-picking")}
            disabled={actionLoading || !allDone}
            className="w-full py-3 rounded-xl bg-indigo-600 text-white font-bold text-base hover:bg-indigo-700 disabled:opacity-50"
          >
            {allDone ? "Complete Picking" : `Complete Picking (${pickedCount + issueCount}/${totalItems} done)`}
          </button>
        )}

        {ws === "PICKED" && (
          <button
            onClick={() => doAction("start-packing")}
            disabled={actionLoading}
            className="w-full py-3 rounded-xl bg-purple-600 text-white font-bold text-base hover:bg-purple-700 disabled:opacity-50"
          >
            Start Packing
          </button>
        )}

        {ws === "PACKING" && (
          <div className="space-y-2">
            <textarea
              value={packNotes}
              onChange={(e) => setPackNotes(e.target.value)}
              placeholder="Packing notes (optional)"
              rows={2}
              className="w-full border rounded-lg px-3 py-2 text-sm resize-none"
            />
            <button
              onClick={() => doAction("complete-packing", "POST", { notes: packNotes })}
              disabled={actionLoading}
              className="w-full py-3 rounded-xl bg-green-600 text-white font-bold text-base hover:bg-green-700 disabled:opacity-50"
            >
              Complete Packing
            </button>
          </div>
        )}

        {ws === "PACKED" && (
          <button
            onClick={() => doAction("awaiting-collection")}
            disabled={actionLoading}
            className="w-full py-3 rounded-xl bg-teal-600 text-white font-bold text-base hover:bg-teal-700 disabled:opacity-50"
          >
            Mark Awaiting Collection
          </button>
        )}

        {order.stockIssueStatus !== "NONE" && ws !== "EXCEPTION" && (
          <button
            onClick={() => doAction("apply-stock-adjustments")}
            disabled={actionLoading}
            className="w-full py-2 rounded-xl border border-orange-300 text-orange-700 text-sm font-medium hover:bg-orange-50 disabled:opacity-50"
          >
            Apply Stock Adjustments
          </button>
        )}

        {ws !== "EXCEPTION" && ws !== "AWAITING_COLLECTION" && (
          <details className="text-sm">
            <summary className="cursor-pointer text-gray-400 hover:text-gray-600">Flag as Exception</summary>
            <div className="mt-2 space-y-2">
              <textarea
                id="exception-notes"
                placeholder="Describe the exception..."
                rows={2}
                className="w-full border rounded px-2 py-1.5 text-sm resize-none"
              />
              <button
                onClick={() => {
                  const notes = (document.getElementById("exception-notes") as HTMLTextAreaElement)?.value ?? "";
                  if (!notes.trim()) { toast.error("Exception notes are required"); return; }
                  doAction("exception", "POST", { notes });
                }}
                disabled={actionLoading}
                className="px-3 py-1.5 rounded bg-red-600 text-white text-sm font-medium"
              >
                Flag Exception
              </button>
            </div>
          </details>
        )}
      </div>

      {order.warehouseNotes && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <h3 className="text-xs font-semibold text-yellow-800 uppercase tracking-wide mb-1">Warehouse Notes</h3>
          <p className="text-sm text-yellow-900 whitespace-pre-wrap">{order.warehouseNotes}</p>
        </div>
      )}

      <Link to="/admin/orders/:id" className="hidden">hidden</Link>
    </div>
  );
}
