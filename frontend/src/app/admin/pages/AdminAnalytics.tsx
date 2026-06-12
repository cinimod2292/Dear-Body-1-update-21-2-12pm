import { useEffect, useRef, useState } from "react";
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
  LineChart,
  Line,
  Area,
  AreaChart,
} from "recharts";
import { apiRequest } from "../api/client";
import { useAdminAuth } from "../context/AdminAuthContext";
import { ErrorState, LoadingState } from "../components/AdminState";
import { formatRand } from "../../lib/currency";
import { formatAdminDatetime } from "../../lib/datetime";

type DatePreset = "7d" | "30d" | "90d" | "365d";
type Tab = "store" | "site";

interface DateRange { from: string; to: string; }

// ---------- Store types ----------
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
  orders: number;
  gross: number;
  discounts: number;
  shipping: number;
  taxes: number;
  averageOrderValue: number;
}
interface OrderStatusItem { status: string; _count: { _all: number }; }
interface OrderPaymentStatusItem { paymentStatus: string; _count: { _all: number }; }
interface OrderReportData { byStatus: OrderStatusItem[]; byPaymentStatus: OrderPaymentStatusItem[]; }
interface CustomerData { total: number; newCustomers: number; vip: number; inactive: number; }
interface RecentOrder { id: string; orderNumber: string; status: string; totalAmount: number; createdAt: string; }
interface RecentActivityData { orders: RecentOrder[]; }

// ---------- Site types ----------
interface LiveData { count: number; since: string; }
interface SiteOverview { totalViews: number; uniqueSessions: number; avgDuration: number; bounceRate: number; }
interface TopPage { path: string; views: number; }
interface LocationRow { country: string; views: number; }
interface DayRow { date: string; views: number; sessions: number; }

// ---------- Helpers ----------
const STATUS_COLORS: Record<string, string> = {
  PLACED: "#3b82f6", CONFIRMED: "#6366f1", PROCESSING: "#f59e0b",
  SHIPPED: "#8b5cf6", DELIVERED: "#10b981", CANCELLED: "#ef4444",
  REFUNDED: "#6b7280", PAID: "#10b981", PENDING: "#f59e0b",
  FAILED: "#ef4444", REFUND_PENDING: "#8b5cf6", PARTIALLY_REFUNDED: "#f97316",
};

const PRESET_LABELS: Record<DatePreset, string> = {
  "7d": "Last 7 days", "30d": "Last 30 days", "90d": "Last 90 days", "365d": "Last year",
};

const COUNTRY_FLAG: Record<string, string> = {
  ZA: "🇿🇦", US: "🇺🇸", GB: "🇬🇧", DE: "🇩🇪", FR: "🇫🇷", AU: "🇦🇺",
  CA: "🇨🇦", NL: "🇳🇱", IN: "🇮🇳", BR: "🇧🇷", NG: "🇳🇬", KE: "🇰🇪",
};

function getPresetQuery(preset: DatePreset) {
  const now = new Date();
  const days = { "7d": 7, "30d": 30, "90d": 90, "365d": 365 }[preset];
  const from = new Date(now);
  from.setDate(from.getDate() - days);
  return `from=${from.toISOString()}&to=${now.toISOString()}`;
}

function KpiCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`text-2xl font-black mt-1 ${accent ?? "text-gray-900"}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <h3 className="text-base font-bold text-gray-900 mb-4">{title}</h3>
      {children}
    </div>
  );
}

function formatDuration(secs: number) {
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m ${secs % 60}s`;
}

// ---------- Store Analytics ----------
function StoreAnalytics({ preset, token }: { preset: DatePreset; token: string }) {
  const [kpi, setKpi] = useState<KpiData | null>(null);
  const [sales, setSales] = useState<SalesData | null>(null);
  const [orders, setOrders] = useState<OrderReportData | null>(null);
  const [customers, setCustomers] = useState<CustomerData | null>(null);
  const [activity, setActivity] = useState<RecentActivityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const q = getPresetQuery(preset);
      const [kpiRes, salesRes, ordersRes, customersRes, activityRes] = await Promise.all([
        apiRequest<{ data: KpiData }>(`/admin/reports/dashboard?${q}`, {}, token),
        apiRequest<{ data: SalesData }>(`/admin/reports/sales?${q}`, {}, token),
        apiRequest<{ data: OrderReportData }>(`/admin/reports/orders?${q}`, {}, token),
        apiRequest<{ data: CustomerData }>(`/admin/reports/customers?${q}`, {}, token),
        apiRequest<{ data: RecentActivityData }>("/admin/reports/recent-activity", {}, token),
      ]);
      setKpi(kpiRes.data);
      setSales(salesRes.data);
      setOrders(ordersRes.data);
      setCustomers(customersRes.data);
      setActivity(activityRes.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load store analytics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [preset, token]);

  if (loading) return <LoadingState label="Loading store analytics..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!kpi || !sales || !orders || !customers) return null;

  const salesBreakdown = [
    { name: "Revenue", value: sales.gross },
    { name: "Discounts", value: sales.discounts },
    { name: "Shipping", value: sales.shipping },
    { name: "Taxes", value: sales.taxes },
  ];

  const orderStatusData = orders.byStatus.map((s) => ({
    name: s.status, count: s._count._all, fill: STATUS_COLORS[s.status] ?? "#6b7280",
  }));
  const paymentStatusData = orders.byPaymentStatus.map((s) => ({
    name: s.paymentStatus, count: s._count._all, fill: STATUS_COLORS[s.paymentStatus] ?? "#6b7280",
  }));
  const customerBreakdown = [
    { name: "New", value: customers.newCustomers, fill: "#ec4899" },
    { name: "VIP", value: customers.vip, fill: "#8b5cf6" },
    { name: "Inactive", value: customers.inactive, fill: "#6b7280" },
    { name: "Other", value: Math.max(0, customers.total - customers.newCustomers - customers.vip - customers.inactive), fill: "#10b981" },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard label="Revenue" value={formatRand(kpi.revenue)} />
        <KpiCard label="Orders" value={kpi.ordersCount.toLocaleString()} />
        <KpiCard label="New Customers" value={kpi.customersCount.toLocaleString()} />
        <KpiCard label="Avg Order Value" value={formatRand(sales.averageOrderValue)} />
        <KpiCard label="Pending Inquiries" value={kpi.pendingInquiries.toLocaleString()} />
        <KpiCard label="Abandoned Carts" value={kpi.abandonedCarts.toLocaleString()} sub={kpi.abandonedCarts > 0 ? "needs attention" : undefined} />
      </div>

      <SectionCard title="Sales Breakdown">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div><p className="text-xs text-gray-500 uppercase tracking-wide">Gross</p><p className="text-xl font-black text-gray-900 mt-1">{formatRand(sales.gross)}</p></div>
          <div><p className="text-xs text-gray-500 uppercase tracking-wide">Discounts</p><p className="text-xl font-black text-red-500 mt-1">−{formatRand(sales.discounts)}</p></div>
          <div><p className="text-xs text-gray-500 uppercase tracking-wide">Shipping</p><p className="text-xl font-black text-gray-900 mt-1">{formatRand(sales.shipping)}</p></div>
          <div><p className="text-xs text-gray-500 uppercase tracking-wide">Taxes</p><p className="text-xl font-black text-gray-900 mt-1">{formatRand(sales.taxes)}</p></div>
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
      </SectionCard>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SectionCard title="Orders by Status">
          {orderStatusData.length === 0
            ? <p className="text-sm text-gray-400 text-center py-8">No orders in this period.</p>
            : <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={orderStatusData} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {orderStatusData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => `${v} orders`} contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 13 }} />
                  <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>}
        </SectionCard>

        <SectionCard title="Orders by Payment Status">
          {paymentStatusData.length === 0
            ? <p className="text-sm text-gray-400 text-center py-8">No orders in this period.</p>
            : <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={paymentStatusData} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {paymentStatusData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => `${v} orders`} contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 13 }} />
                  <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>}
        </SectionCard>
      </div>

      <SectionCard title="Customer Overview">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div><p className="text-xs text-gray-500 uppercase tracking-wide">Total</p><p className="text-xl font-black text-gray-900 mt-1">{customers.total.toLocaleString()}</p></div>
          <div><p className="text-xs text-gray-500 uppercase tracking-wide">New This Period</p><p className="text-xl font-black text-pink-600 mt-1">+{customers.newCustomers.toLocaleString()}</p></div>
          <div><p className="text-xs text-gray-500 uppercase tracking-wide">VIP</p><p className="text-xl font-black text-purple-600 mt-1">{customers.vip.toLocaleString()}</p></div>
          <div><p className="text-xs text-gray-500 uppercase tracking-wide">Inactive</p><p className="text-xl font-black text-gray-500 mt-1">{customers.inactive.toLocaleString()}</p></div>
        </div>
        {customerBreakdown.length > 0 && (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={customerBreakdown} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 13 }} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {customerBreakdown.map((e, i) => <Cell key={i} fill={e.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </SectionCard>

      {activity && activity.orders.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="px-6 py-4 border-b border-gray-100"><h3 className="font-bold text-gray-900">Recent Orders</h3></div>
          <div className="divide-y divide-gray-100">
            {activity.orders.slice(0, 10).map((order) => (
              <div key={order.id} className="flex items-center justify-between px-6 py-3 hover:bg-gray-50">
                <div>
                  <p className="text-sm font-semibold text-gray-900">#{order.orderNumber}</p>
                  <p className="text-xs text-gray-400">{formatAdminDatetime(order.createdAt)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: (STATUS_COLORS[order.status] ?? "#6b7280") + "22", color: STATUS_COLORS[order.status] ?? "#6b7280" }}>{order.status}</span>
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

// ---------- Site Analytics ----------
function SiteAnalytics({ preset, token }: { preset: DatePreset; token: string }) {
  const [live, setLive] = useState<LiveData | null>(null);
  const [overview, setOverview] = useState<SiteOverview | null>(null);
  const [topPages, setTopPages] = useState<TopPage[]>([]);
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [viewsByDay, setViewsByDay] = useState<DayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const liveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadLive = async () => {
    try {
      const res = await apiRequest<{ data: LiveData }>("/admin/reports/site/live", {}, token);
      setLive(res.data);
    } catch {
      // silently ignore live refresh errors
    }
  };

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const q = getPresetQuery(preset);
      const [overviewRes, topPagesRes, locationsRes, viewsByDayRes, liveRes] = await Promise.all([
        apiRequest<{ data: SiteOverview }>(`/admin/reports/site/overview?${q}`, {}, token),
        apiRequest<{ data: TopPage[] }>(`/admin/reports/site/top-pages?${q}`, {}, token),
        apiRequest<{ data: LocationRow[] }>(`/admin/reports/site/locations?${q}`, {}, token),
        apiRequest<{ data: DayRow[] }>(`/admin/reports/site/views-by-day?${q}`, {}, token),
        apiRequest<{ data: LiveData }>("/admin/reports/site/live", {}, token),
      ]);
      setOverview(overviewRes.data);
      setTopPages(topPagesRes.data);
      setLocations(locationsRes.data);
      setViewsByDay(viewsByDayRes.data);
      setLive(liveRes.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load site analytics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    liveIntervalRef.current = setInterval(loadLive, 30_000);
    return () => { if (liveIntervalRef.current) clearInterval(liveIntervalRef.current); };
  }, [preset, token]);

  if (loading) return <LoadingState label="Loading site analytics..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const totalLocationViews = locations.reduce((s, r) => s + r.views, 0);

  return (
    <div className="space-y-6">
      {/* Live visitors */}
      <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4">
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
        </span>
        <div>
          <span className="text-2xl font-black text-emerald-800">{live?.count ?? 0}</span>
          <span className="ml-2 text-sm text-emerald-700">visitors on site right now</span>
        </div>
        <p className="ml-auto text-xs text-emerald-600">Active in last 5 min · refreshes every 30s</p>
      </div>

      {/* Overview KPIs */}
      {overview && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="Total Page Views" value={overview.totalViews.toLocaleString()} />
          <KpiCard label="Unique Sessions" value={overview.uniqueSessions.toLocaleString()} />
          <KpiCard label="Avg Time on Page" value={formatDuration(overview.avgDuration)} />
          <KpiCard label="Bounce Rate" value={`${overview.bounceRate}%`} accent={overview.bounceRate > 70 ? "text-red-500" : overview.bounceRate > 50 ? "text-amber-500" : "text-gray-900"} />
        </div>
      )}

      {/* Traffic over time */}
      {viewsByDay.length > 0 && (
        <SectionCard title="Traffic Over Time">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={viewsByDay} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="viewsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ec4899" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#ec4899" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="sessionsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={(d) => d.slice(5)} />
              <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 13 }} />
              <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="views" stroke="#ec4899" strokeWidth={2} fill="url(#viewsGrad)" dot={false} name="Page Views" />
              <Area type="monotone" dataKey="sessions" stroke="#8b5cf6" strokeWidth={2} fill="url(#sessionsGrad)" dot={false} name="Sessions" />
            </AreaChart>
          </ResponsiveContainer>
        </SectionCard>
      )}

      {viewsByDay.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
          <p className="text-gray-500 font-medium">No tracking data yet</p>
          <p className="text-sm text-gray-400 mt-1">The storefront tracking script fires automatically on every page visit. Data will appear here once visitors browse the site.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top pages */}
        <SectionCard title="Top Pages">
          {topPages.length === 0
            ? <p className="text-sm text-gray-400 text-center py-6">No data yet.</p>
            : <div className="space-y-2">
                {topPages.map((p, i) => {
                  const max = topPages[0].views;
                  const pct = Math.round((p.views / max) * 100);
                  return (
                    <div key={i}>
                      <div className="flex justify-between text-sm mb-0.5">
                        <span className="text-gray-700 truncate max-w-[70%]">{p.path}</span>
                        <span className="text-gray-500 font-medium">{p.views.toLocaleString()}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full">
                        <div className="h-1.5 bg-pink-400 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>}
        </SectionCard>

        {/* Locations */}
        <SectionCard title="Visitors by Country">
          {locations.length === 0
            ? <p className="text-sm text-gray-400 text-center py-6">No location data yet.</p>
            : <div className="space-y-2">
                {locations.map((l, i) => {
                  const pct = Math.round((l.views / totalLocationViews) * 100);
                  return (
                    <div key={i}>
                      <div className="flex justify-between text-sm mb-0.5">
                        <span className="text-gray-700">{COUNTRY_FLAG[l.country] ?? "🌐"} {l.country}</span>
                        <span className="text-gray-500 font-medium">{l.views.toLocaleString()} <span className="text-gray-400">({pct}%)</span></span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full">
                        <div className="h-1.5 bg-purple-400 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>}
        </SectionCard>
      </div>
    </div>
  );
}

// ---------- Main ----------
export default function AdminAnalytics() {
  const { session } = useAdminAuth();
  const [tab, setTab] = useState<Tab>("store");
  const [preset, setPreset] = useState<DatePreset>("30d");

  if (!session?.accessToken) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-900">Analytics</h2>
          <p className="text-sm text-gray-500">Store performance and site traffic.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(["7d", "30d", "90d", "365d"] as DatePreset[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPreset(p)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${preset === p ? "bg-pink-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}
            >
              {PRESET_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {([["store", "Store Analytics"], ["site", "Site Analytics"]] as [Tab, string][]).map(([t, label]) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === t ? "border-pink-600 text-pink-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "store"
        ? <StoreAnalytics preset={preset} token={session.accessToken} />
        : <SiteAnalytics preset={preset} token={session.accessToken} />}
    </div>
  );
}
