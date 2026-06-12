import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { apiRequest } from "../api/client";
import { useAdminAuth } from "../context/AdminAuthContext";
import { ErrorState, LoadingState } from "../components/AdminState";
import { formatRand } from "../../lib/currency";
import { formatAdminDatetime } from "../../lib/datetime";

type DatePreset = "7d" | "30d" | "90d" | "365d";

interface DateRange {
  from: string;
  to: string;
}

interface KpiData {
  dateRange: DateRange;
  ordersCount: number;
  revenue: number;
  customersCount: number;
  lowStockCount: number;
  pendingInquiries: number;
  abandonedCarts: number;
}

interface SalesData {
  dateRange: DateRange;
  orders: number;
  gross: number;
  discounts: number;
  shipping: number;
  taxes: number;
  averageOrderValue: number;
}

interface OrderStatusItem {
  status: string;
  _count: { _all: number };
}

interface OrderPaymentStatusItem {
  paymentStatus: string;
  _count: { _all: number };
}

interface OrderReportData {
  dateRange: DateRange;
  byStatus: OrderStatusItem[];
  byPaymentStatus: OrderPaymentStatusItem[];
}

interface CustomerData {
  dateRange: DateRange;
  total: number;
  newCustomers: number;
  vip: number;
  inactive: number;
}

interface RecentOrder {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: number;
  createdAt: string;
}

interface RecentActivityData {
  orders: RecentOrder[];
}

const STATUS_COLORS: Record<string, string> = {
  PLACED: "#3b82f6",
  CONFIRMED: "#6366f1",
  PROCESSING: "#f59e0b",
  SHIPPED: "#8b5cf6",
  DELIVERED: "#10b981",
  CANCELLED: "#ef4444",
  REFUNDED: "#6b7280",
  PAID: "#10b981",
  PENDING: "#f59e0b",
  FAILED: "#ef4444",
  REFUND_PENDING: "#8b5cf6",
  PARTIALLY_REFUNDED: "#f97316",
};

const PRESET_LABELS: Record<DatePreset, string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  "365d": "Last year",
};

function getPresetQuery(preset: DatePreset) {
  const now = new Date();
  const days = { "7d": 7, "30d": 30, "90d": 90, "365d": 365 }[preset];
  const from = new Date(now);
  from.setDate(from.getDate() - days);
  return `from=${from.toISOString()}&to=${now.toISOString()}`;
}

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-black text-gray-900 mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-4">
      <h3 className="text-lg font-bold text-gray-900">{title}</h3>
      {description && <p className="text-sm text-gray-500">{description}</p>}
    </div>
  );
}

export default function AdminAnalytics() {
  const { session } = useAdminAuth();
  const [preset, setPreset] = useState<DatePreset>("30d");
  const [kpi, setKpi] = useState<KpiData | null>(null);
  const [sales, setSales] = useState<SalesData | null>(null);
  const [orders, setOrders] = useState<OrderReportData | null>(null);
  const [customers, setCustomers] = useState<CustomerData | null>(null);
  const [activity, setActivity] = useState<RecentActivityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async (p: DatePreset) => {
    if (!session?.accessToken) return;
    try {
      setLoading(true);
      setError(null);
      const q = getPresetQuery(p);
      const [kpiRes, salesRes, ordersRes, customersRes, activityRes] = await Promise.all([
        apiRequest<{ data: KpiData }>(`/admin/reports/dashboard?${q}`, {}, session.accessToken),
        apiRequest<{ data: SalesData }>(`/admin/reports/sales?${q}`, {}, session.accessToken),
        apiRequest<{ data: OrderReportData }>(`/admin/reports/orders?${q}`, {}, session.accessToken),
        apiRequest<{ data: CustomerData }>(`/admin/reports/customers?${q}`, {}, session.accessToken),
        apiRequest<{ data: RecentActivityData }>("/admin/reports/recent-activity", {}, session.accessToken),
      ]);
      setKpi(kpiRes.data);
      setSales(salesRes.data);
      setOrders(ordersRes.data);
      setCustomers(customersRes.data);
      setActivity(activityRes.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(preset);
  }, [session?.accessToken, preset]);

  if (loading) return <LoadingState label="Loading analytics..." />;
  if (error) return <ErrorState message={error} onRetry={() => load(preset)} />;
  if (!kpi || !sales || !orders || !customers) return null;

  const salesBreakdown = [
    { name: "Revenue", value: sales.gross },
    { name: "Discounts", value: sales.discounts },
    { name: "Shipping", value: sales.shipping },
    { name: "Taxes", value: sales.taxes },
  ];

  const orderStatusData = orders.byStatus.map((s) => ({
    name: s.status,
    count: s._count._all,
    fill: STATUS_COLORS[s.status] ?? "#6b7280",
  }));

  const paymentStatusData = orders.byPaymentStatus.map((s) => ({
    name: s.paymentStatus,
    count: s._count._all,
    fill: STATUS_COLORS[s.paymentStatus] ?? "#6b7280",
  }));

  const customerBreakdown = [
    { name: "New", value: customers.newCustomers, fill: "#ec4899" },
    { name: "VIP", value: customers.vip, fill: "#8b5cf6" },
    { name: "Inactive", value: customers.inactive, fill: "#6b7280" },
    { name: "Other", value: Math.max(0, customers.total - customers.newCustomers - customers.vip - customers.inactive), fill: "#10b981" },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-900">Analytics</h2>
          <p className="text-sm text-gray-500">Store performance — revenue, orders, customers, and activity.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(["7d", "30d", "90d", "365d"] as DatePreset[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPreset(p)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                preset === p
                  ? "bg-pink-600 text-white"
                  : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {PRESET_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard label="Revenue" value={formatRand(kpi.revenue)} />
        <KpiCard label="Orders" value={kpi.ordersCount.toLocaleString()} />
        <KpiCard label="New Customers" value={kpi.customersCount.toLocaleString()} />
        <KpiCard label="Avg Order Value" value={formatRand(sales.averageOrderValue)} />
        <KpiCard label="Pending Inquiries" value={kpi.pendingInquiries.toLocaleString()} />
        <KpiCard
          label="Abandoned Carts"
          value={kpi.abandonedCarts.toLocaleString()}
          sub={kpi.abandonedCarts > 0 ? "needs attention" : undefined}
        />
      </div>

      {/* Sales Breakdown */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <SectionHeader title="Sales Breakdown" description="Revenue composition for the selected period." />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Gross Revenue</p>
            <p className="text-xl font-black text-gray-900 mt-1">{formatRand(sales.gross)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Discounts</p>
            <p className="text-xl font-black text-red-500 mt-1">−{formatRand(sales.discounts)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Shipping</p>
            <p className="text-xl font-black text-gray-900 mt-1">{formatRand(sales.shipping)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Taxes</p>
            <p className="text-xl font-black text-gray-900 mt-1">{formatRand(sales.taxes)}</p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={salesBreakdown} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} tickFormatter={(v) => `R${(v / 100).toFixed(0)}`} />
            <Tooltip formatter={(v: number) => formatRand(v)} contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 13 }} />
            <Bar dataKey="value" fill="#ec4899" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Orders by Status + Payment Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <SectionHeader title="Orders by Status" />
          {orderStatusData.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No orders in this period.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={orderStatusData} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {orderStatusData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => `${v} orders`} contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 13 }} />
                <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <SectionHeader title="Orders by Payment Status" />
          {paymentStatusData.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No orders in this period.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={paymentStatusData} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {paymentStatusData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => `${v} orders`} contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 13 }} />
                <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Customers */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <SectionHeader title="Customer Overview" description="Customer base snapshot." />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Total Customers</p>
            <p className="text-xl font-black text-gray-900 mt-1">{customers.total.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">New This Period</p>
            <p className="text-xl font-black text-pink-600 mt-1">+{customers.newCustomers.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">VIP</p>
            <p className="text-xl font-black text-purple-600 mt-1">{customers.vip.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Inactive</p>
            <p className="text-xl font-black text-gray-500 mt-1">{customers.inactive.toLocaleString()}</p>
          </div>
        </div>
        {customerBreakdown.length > 0 && (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={customerBreakdown} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 13 }} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {customerBreakdown.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Recent Activity */}
      {activity && activity.orders.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="font-bold text-gray-900">Recent Orders</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {activity.orders.slice(0, 10).map((order) => (
              <div key={order.id} className="flex items-center justify-between px-6 py-3 hover:bg-gray-50">
                <div>
                  <p className="text-sm font-semibold text-gray-900">#{order.orderNumber}</p>
                  <p className="text-xs text-gray-400">{formatAdminDatetime(order.createdAt)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{
                      backgroundColor: (STATUS_COLORS[order.status] ?? "#6b7280") + "22",
                      color: STATUS_COLORS[order.status] ?? "#6b7280",
                    }}
                  >
                    {order.status}
                  </span>
                  <span className="text-sm font-semibold text-gray-900">{formatRand(order.totalAmount)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
