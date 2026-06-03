import { useEffect, useState } from "react";
import { Link } from "react-router";
import { apiRequest } from "../api/client";
import { useAdminAuth } from "../context/AdminAuthContext";
import { ErrorState, LoadingState } from "../components/AdminState";
import { formatRand } from "../../lib/currency";

interface RecentOrder {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  totalAmount: number;
  placedAt: string;
  customer?: { email: string } | null;
}

interface DashboardMetrics {
  revenue: number;
  ordersCount: number;
  customersCount: number;
  lowStockCount: number;
  totalProducts: number;
  activeProducts: number;
  recentOrders: RecentOrder[];
}

export default function AdminDashboard() {
  const { session } = useAdminAuth();
  const [data, setData] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!session?.accessToken) return;
    try {
      setLoading(true);
      setError(null);

      const [reportRes, productsRes, ordersRes] = await Promise.all([
        apiRequest<{ data: { revenue: number; ordersCount: number; customersCount: number; lowStockCount: number } }>("/admin/reports/dashboard", {}, session.accessToken),
        apiRequest<{ data: { total: number; items: Array<{ status: string }> } }>("/admin/products?page=1&perPage=100", {}, session.accessToken),
        apiRequest<{ data: { items: RecentOrder[] } }>("/admin/orders?page=1&perPage=5&sortBy=placedAt&sortDir=desc", {}, session.accessToken),
      ]);

      const activeProducts = productsRes.data.items.filter((p) => p.status === "ACTIVE").length;

      setData({
        revenue: reportRes.data.revenue,
        ordersCount: reportRes.data.ordersCount,
        customersCount: reportRes.data.customersCount,
        lowStockCount: reportRes.data.lowStockCount,
        totalProducts: productsRes.data.total,
        activeProducts,
        recentOrders: ordersRes.data.items,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [session?.accessToken]);

  if (loading) return <LoadingState label="Loading dashboard..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return null;

  const statusColor: Record<string, string> = {
    PLACED: "bg-blue-100 text-blue-700",
    CONFIRMED: "bg-indigo-100 text-indigo-700",
    PROCESSING: "bg-yellow-100 text-yellow-700",
    SHIPPED: "bg-purple-100 text-purple-700",
    DELIVERED: "bg-green-100 text-green-700",
    CANCELLED: "bg-red-100 text-red-700",
    REFUNDED: "bg-gray-100 text-gray-700",
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black text-gray-900">Dashboard</h2>
        <p className="text-sm text-gray-500">Store overview — orders, revenue, products, and stock.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">Total Revenue</p>
          <p className="text-2xl font-black text-gray-900 mt-1">{formatRand(data.revenue)}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">Total Orders</p>
          <p className="text-2xl font-black text-gray-900 mt-1">{data.ordersCount}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">Customers</p>
          <p className="text-2xl font-black text-gray-900 mt-1">{data.customersCount}</p>
        </div>
        <div className={`rounded-xl border p-5 ${data.lowStockCount > 0 ? "border-amber-200 bg-amber-50" : "border-gray-200 bg-white"}`}>
          <p className={`text-sm ${data.lowStockCount > 0 ? "text-amber-600" : "text-gray-500"}`}>Low Stock</p>
          <p className={`text-2xl font-black mt-1 ${data.lowStockCount > 0 ? "text-amber-700" : "text-gray-900"}`}>{data.lowStockCount}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">Active Products</p>
          <p className="text-2xl font-black text-gray-900 mt-1">{data.activeProducts} <span className="text-sm font-normal text-gray-400">of {data.totalProducts}</span></p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">Recent Orders</h3>
          <Link to="/admin/orders" className="text-sm text-pink-600 hover:underline">View all orders →</Link>
        </div>
        {data.recentOrders.length === 0 ? (
          <p className="px-5 py-8 text-sm text-gray-500 text-center">No orders yet.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {data.recentOrders.map((order) => (
              <div key={order.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50">
                <div>
                  <Link to={`/admin/orders/${order.id}`} className="font-semibold text-sm hover:text-pink-600">#{order.orderNumber}</Link>
                  <p className="text-xs text-gray-500">{order.customer?.email || "Guest"} · {new Date(order.placedAt).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[order.status] ?? "bg-gray-100 text-gray-700"}`}>{order.status}</span>
                  <span className="text-sm font-semibold text-gray-900">{formatRand(order.totalAmount)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
