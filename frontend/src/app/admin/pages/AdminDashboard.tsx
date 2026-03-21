import { useEffect, useState } from "react";
import { apiRequest } from "../api/client";
import { useAdminAuth } from "../context/AdminAuthContext";
import { ErrorState, LoadingState } from "../components/AdminState";

interface DashboardMetrics {
  totalProducts: number;
  activeProducts: number;
  lowStockVariants: number;
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

      const [productsRes, inventoryRes] = await Promise.all([
        apiRequest<{ data: { total: number; items: Array<{ status: string }> } }>("/admin/products?page=1&perPage=100", {}, session.accessToken),
        apiRequest<{ data: { items: Array<{ quantityOnHand: number; lowStockThreshold: number }> } }>("/admin/inventory?page=1&perPage=200", {}, session.accessToken),
      ]);

      const activeProducts = productsRes.data.items.filter((p) => p.status === "ACTIVE").length;
      const lowStockVariants = inventoryRes.data.items.filter((i) => i.quantityOnHand <= i.lowStockThreshold).length;

      setData({ totalProducts: productsRes.data.total, activeProducts, lowStockVariants });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [session?.accessToken]);

  if (loading) return <LoadingState label="Loading dashboard metrics..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return null;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-black text-gray-900">Dashboard</h2>
        <p className="text-sm text-gray-500">Store health at a glance.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">Total Products</p>
          <p className="text-3xl font-black text-gray-900 mt-1">{data.totalProducts}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">Active Products</p>
          <p className="text-3xl font-black text-gray-900 mt-1">{data.activeProducts}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">Low Stock Variants</p>
          <p className="text-3xl font-black text-gray-900 mt-1">{data.lowStockVariants}</p>
        </div>
      </div>
    </div>
  );
}
