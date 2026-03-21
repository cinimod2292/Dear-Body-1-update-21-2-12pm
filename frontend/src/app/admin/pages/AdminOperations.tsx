import { FormEvent, useEffect, useState } from "react";
import { apiRequest } from "../api/client";
import { useAdminAuth } from "../context/AdminAuthContext";
import { ErrorState, LoadingState } from "../components/AdminState";
import { toast } from "sonner";

export default function AdminOperations() {
  const { session } = useAdminAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dashboard, setDashboard] = useState<any>(null);
  const [sales, setSales] = useState<any>(null);
  const [orderReport, setOrderReport] = useState<any>(null);
  const [customerReport, setCustomerReport] = useState<any>(null);
  const [inventory, setInventory] = useState<any>(null);
  const [activity, setActivity] = useState<any>(null);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [shippingMethods, setShippingMethods] = useState<any[]>([]);
  const [taxRates, setTaxRates] = useState<any[]>([]);
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [newsletter, setNewsletter] = useState<any[]>([]);

  const [couponCode, setCouponCode] = useState("");
  const [couponValue, setCouponValue] = useState("10");

  const load = async () => {
    if (!session?.accessToken) return;
    try {
      setLoading(true);
      setError(null);
      const [dashboardRes, salesRes, ordersRes, customersRes, inventoryRes, activityRes, couponsRes, shippingRes, taxRes, inquiriesRes, newsletterRes] = await Promise.all([
        apiRequest<{ data: any }>("/admin/reports/dashboard", {}, session.accessToken),
        apiRequest<{ data: any }>("/admin/reports/sales", {}, session.accessToken),
        apiRequest<{ data: any }>("/admin/reports/orders", {}, session.accessToken),
        apiRequest<{ data: any }>("/admin/reports/customers", {}, session.accessToken),
        apiRequest<{ data: any }>("/admin/reports/inventory", {}, session.accessToken),
        apiRequest<{ data: any }>("/admin/reports/recent-activity", {}, session.accessToken),
        apiRequest<{ data: any[] }>("/admin/ops/coupons", {}, session.accessToken),
        apiRequest<{ data: any[] }>("/admin/ops/shipping-methods", {}, session.accessToken),
        apiRequest<{ data: any[] }>("/admin/ops/tax-rates", {}, session.accessToken),
        apiRequest<{ data: any[] }>("/admin/ops/inquiries", {}, session.accessToken),
        apiRequest<{ data: any[] }>("/admin/ops/newsletter", {}, session.accessToken),
      ]);

      setDashboard(dashboardRes.data);
      setSales(salesRes.data);
      setOrderReport(ordersRes.data);
      setCustomerReport(customersRes.data);
      setInventory(inventoryRes.data);
      setActivity(activityRes.data);
      setCoupons(couponsRes.data);
      setShippingMethods(shippingRes.data);
      setTaxRates(taxRes.data);
      setInquiries(inquiriesRes.data);
      setNewsletter(newsletterRes.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load operations data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [session?.accessToken]);

  const createCoupon = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.accessToken) return;
    try {
      await apiRequest("/admin/ops/coupons", { method: "PUT", body: JSON.stringify({ code: couponCode, discountType: "PERCENT", discountValue: Number(couponValue), isActive: true }) }, session.accessToken);
      toast.success("Coupon saved");
      setCouponCode("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save coupon");
    }
  };

  const updateInquiryStatus = async (id: string, status: string) => {
    if (!session?.accessToken) return;
    try {
      await apiRequest(`/admin/ops/inquiries/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }, session.accessToken);
      toast.success("Inquiry updated");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update inquiry");
    }
  };


  const exportNewsletter = async () => {
    if (!session?.accessToken) return;
    try {
      const res = await fetch(`${(import.meta as any).env.VITE_API_BASE_URL ?? "http://localhost:4000/api"}/admin/ops/newsletter/export.csv`, {
        headers: { Authorization: `Bearer ${session.accessToken}` },
      });
      const text = await res.text();
      const blob = new Blob([text], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "newsletter-subscribers.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    }
  };

  if (loading) return <LoadingState label="Loading operations..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black text-gray-900">Operations & Reporting</h2>
        <p className="text-sm text-gray-500">KPIs, sales/orders/customers, inventory/low-stock, coupons, shipping/tax, inquiries, and newsletter operations.</p>
      </div>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl p-4"><p className="text-xs text-gray-500">Revenue</p><p className="text-xl font-black">{Number(dashboard?.revenue ?? 0).toFixed(2)}</p></div>
        <div className="bg-white border border-gray-200 rounded-xl p-4"><p className="text-xs text-gray-500">Orders</p><p className="text-xl font-black">{dashboard?.ordersCount ?? 0}</p></div>
        <div className="bg-white border border-gray-200 rounded-xl p-4"><p className="text-xs text-gray-500">Customers</p><p className="text-xl font-black">{dashboard?.customersCount ?? 0}</p></div>
        <div className="bg-white border border-gray-200 rounded-xl p-4"><p className="text-xs text-gray-500">Low Stock</p><p className="text-xl font-black">{dashboard?.lowStockCount ?? 0}</p></div>
      </section>

      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="font-bold mb-2">Sales Summary</h3>
        <p className="text-sm text-gray-600">Gross: {Number(sales?.gross ?? 0).toFixed(2)} · Discounts: {Number(sales?.discounts ?? 0).toFixed(2)} · AOV: {Number(sales?.averageOrderValue ?? 0).toFixed(2)}</p>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-bold mb-3">Coupon Management + Bulk-ready list</h3>
          <form onSubmit={createCoupon} className="flex gap-2 mb-3">
            <input className="flex-1 rounded-lg border border-gray-200 px-3 py-2" placeholder="Code" value={couponCode} onChange={(e) => setCouponCode(e.target.value)} required />
            <input className="w-28 rounded-lg border border-gray-200 px-3 py-2" placeholder="%" value={couponValue} onChange={(e) => setCouponValue(e.target.value)} required />
            <button className="px-3 py-2 bg-gray-900 text-white rounded-lg text-sm">Save</button>
          </form>
          <div className="space-y-2 max-h-64 overflow-auto">
            {coupons.map((coupon) => <div key={coupon.id} className="text-sm border border-gray-100 rounded-lg p-2">{coupon.code} · {coupon.discountType} {coupon.discountValue} · {coupon.isActive ? "Active" : "Inactive"}</div>)}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-bold mb-3">Low Stock Report</h3>
          <div className="space-y-2 max-h-64 overflow-auto">
            {(inventory?.lowStockItems ?? []).map((item: any) => <div key={item.id} className="text-sm border border-gray-100 rounded-lg p-2">{item.variant?.product?.name} · {item.variant?.sku} · {item.quantityOnHand}/{item.lowStockThreshold}</div>)}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-bold mb-3">Shipping Settings</h3>
          <div className="space-y-2">{shippingMethods.map((m) => <div key={m.id} className="text-sm border border-gray-100 rounded-lg p-2">{m.name} ({m.code}) · {m.price}</div>)}</div>
          <h3 className="font-bold mt-5 mb-3">Tax Settings</h3>
          <div className="space-y-2">{taxRates.map((t) => <div key={t.id} className="text-sm border border-gray-100 rounded-lg p-2">{t.country} {t.state || ""} · {t.name} · {t.rate}</div>)}</div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-bold mb-3">Contact / Inquiry Management</h3>
          <div className="space-y-2 max-h-72 overflow-auto">
            {inquiries.map((inq) => (
              <div key={inq.id} className="text-sm border border-gray-100 rounded-lg p-2">
                <p className="font-medium">{inq.subject}</p>
                <p className="text-xs text-gray-500">{inq.email} · {inq.status}</p>
                <div className="mt-2 flex gap-2">
                  <button onClick={() => updateInquiryStatus(inq.id, "IN_PROGRESS")} className="px-2 py-1 text-xs border rounded">In Progress</button>
                  <button onClick={() => updateInquiryStatus(inq.id, "RESOLVED")} className="px-2 py-1 text-xs border rounded">Resolve</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-bold mb-3">Newsletter Capture</h3>
          <p className="text-sm text-gray-500 mb-2">Total subscribers: {newsletter.length}</p>
          <button onClick={exportNewsletter} className="text-sm text-indigo-600 underline">Export CSV</button>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-bold mb-3">Recent Activity</h3>
          <p className="text-sm text-gray-600">Orders: {activity?.orders?.length ?? 0} · Inquiries: {activity?.inquiries?.length ?? 0} · Stock Moves: {activity?.stockMovements?.length ?? 0}</p>
          <p className="text-xs text-gray-500 mt-1">Order report groups: {orderReport?.byStatus?.length ?? 0} · Customer report totals: {customerReport?.total ?? 0}</p>
        </div>
      </section>
    </div>
  );
}
