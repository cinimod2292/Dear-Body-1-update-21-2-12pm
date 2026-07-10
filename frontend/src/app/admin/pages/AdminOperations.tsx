import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router";
import { apiRequest, API_BASE } from "../api/client";
import { useAdminAuth } from "../context/AdminAuthContext";
import { ErrorState, LoadingState } from "../components/AdminState";
import { toast } from "sonner";
import { formatRand } from "../../lib/currency";

interface Coupon {
  id: string;
  code: string;
  discountType: string;
  discountValue: number;
  isActive: boolean;
  usageCount: number;
  usageLimit?: number | null;
}

interface CouponSaleProduct {
  productName: string;
  sku: string;
  quantity: number;
  revenue: number;
}

interface CouponSaleOrderItem {
  productName: string;
  variantTitle?: string | null;
  sku: string;
  quantity: number;
  lineTotal: number;
}

interface CouponSaleOrder {
  id: string;
  orderNumber: string;
  placedAt: string;
  customerName?: string | null;
  customerEmail?: string | null;
  totalAmount: number;
  discountAmount: number;
  items: CouponSaleOrderItem[];
}

interface CouponSalesReport {
  couponId: string;
  code: string;
  orderCount: number;
  totalDiscount: number;
  totalRevenue: number;
  products: CouponSaleProduct[];
  orders: CouponSaleOrder[];
}

interface InventoryItem {
  id: string;
  quantityOnHand: number;
  lowStockThreshold: number;
  variant?: { sku: string; product?: { name: string } | null } | null;
}

interface TaxRate {
  id: string;
  country: string;
  state?: string | null;
  name: string;
  rate: number;
}

interface SupportInquiry {
  id: string;
  email: string;
  subject: string;
  message: string;
  status: string;
  createdAt: string;
}

interface NewsletterSubscriber {
  id: string;
  email: string;
  createdAt: string;
}

const getData = <T,>(result: PromiseSettledResult<{ data: T }>, fallback: T): T =>
  result.status === "fulfilled" ? result.value.data : fallback;

export default function AdminOperations() {
  const { session } = useAdminAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [couponSales, setCouponSales] = useState<CouponSalesReport[]>([]);
  const [inventory, setInventory] = useState<{ lowStockItems: InventoryItem[] } | null>(null);
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [inquiries, setInquiries] = useState<SupportInquiry[]>([]);
  const [newsletter, setNewsletter] = useState<NewsletterSubscriber[]>([]);

  // Coupon form state
  const [couponCode, setCouponCode] = useState("");
  const [couponDiscountType, setCouponDiscountType] = useState<"PERCENT" | "FIXED">("PERCENT");
  const [couponValue, setCouponValue] = useState("10");
  const [couponUsageLimit, setCouponUsageLimit] = useState("");

  // Tax rate form state
  const [taxCountry, setTaxCountry] = useState("");
  const [taxState, setTaxState] = useState("");
  const [taxName, setTaxName] = useState("");
  const [taxRate, setTaxRate] = useState("");

  const load = async () => {
    if (!session?.accessToken) return;
    try {
      setLoading(true);
      setError(null);

      const [couponsResult, couponSalesResult, inventoryResult, taxRatesResult, inquiriesResult, newsletterResult] =
        await Promise.allSettled([
          apiRequest<{ data: Coupon[] }>("/admin/ops/coupons", {}, session.accessToken),
          apiRequest<{ data: CouponSalesReport[] }>("/admin/ops/coupons/sales", {}, session.accessToken),
          apiRequest<{ data: { lowStockItems: InventoryItem[] } }>("/admin/reports/inventory", {}, session.accessToken),
          apiRequest<{ data: TaxRate[] }>("/admin/ops/tax-rates", {}, session.accessToken),
          apiRequest<{ data: SupportInquiry[] }>("/admin/ops/inquiries", {}, session.accessToken),
          apiRequest<{ data: NewsletterSubscriber[] }>("/admin/ops/newsletter", {}, session.accessToken),
        ]);

      setCoupons(getData(couponsResult, []));
      setCouponSales(getData(couponSalesResult, []));
      setInventory(getData(inventoryResult, null));
      setTaxRates(getData(taxRatesResult, []));
      setInquiries(getData(inquiriesResult, []));
      setNewsletter(getData(newsletterResult, []));
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
      await apiRequest(
        "/admin/ops/coupons",
        {
          method: "PUT",
          body: JSON.stringify({
            code: couponCode,
            discountType: couponDiscountType,
            discountValue: Number(couponValue),
            isActive: true,
            ...(couponUsageLimit !== "" ? { usageLimit: Number(couponUsageLimit) } : {}),
          }),
        },
        session.accessToken
      );
      toast.success("Coupon created");
      setCouponCode("");
      setCouponDiscountType("PERCENT");
      setCouponValue("10");
      setCouponUsageLimit("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create coupon");
    }
  };

  const toggleCouponActive = async (coupon: Coupon) => {
    if (!session?.accessToken) return;
    const action = coupon.isActive ? "deactivate" : "activate";
    try {
      await apiRequest(
        "/admin/ops/coupons/bulk",
        {
          method: "POST",
          body: JSON.stringify({ action, ids: [coupon.id] }),
        },
        session.accessToken
      );
      toast.success(`Coupon ${action}d`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to ${action} coupon`);
    }
  };


  const deleteCoupon = async (coupon: Coupon) => {
    if (!session?.accessToken) return;
    if (!confirm(`Delete promo code ${coupon.code}? This cannot be undone.`)) return;
    try {
      await apiRequest(
        "/admin/ops/coupons/bulk",
        {
          method: "POST",
          body: JSON.stringify({ action: "delete", ids: [coupon.id] }),
        },
        session.accessToken
      );
      toast.success("Promo code deleted");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete promo code");
    }
  };

  const createTaxRate = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.accessToken) return;
    try {
      await apiRequest(
        "/admin/ops/tax-rates",
        {
          method: "POST",
          body: JSON.stringify({
            country: taxCountry,
            ...(taxState.trim() !== "" ? { state: taxState.trim() } : {}),
            name: taxName,
            rate: Number(taxRate),
          }),
        },
        session.accessToken
      );
      toast.success("Tax rate created");
      setTaxCountry("");
      setTaxState("");
      setTaxName("");
      setTaxRate("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create tax rate");
    }
  };

  const deleteTaxRate = async (id: string) => {
    if (!session?.accessToken) return;
    if (!confirm("Delete this tax rate?")) return;
    try {
      await apiRequest(`/admin/ops/tax-rates/${id}`, { method: "DELETE" }, session.accessToken);
      toast.success("Tax rate deleted");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete tax rate");
    }
  };

  const updateInquiryStatus = async (id: string, status: string) => {
    if (!session?.accessToken) return;
    try {
      await apiRequest(
        `/admin/ops/inquiries/${id}`,
        { method: "PATCH", body: JSON.stringify({ status }) },
        session.accessToken
      );
      toast.success("Inquiry updated");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update inquiry");
    }
  };

  const exportNewsletter = async () => {
    if (!session?.accessToken) return;
    try {
      const res = await fetch(`${API_BASE}/admin/ops/newsletter/export.csv`, {
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
      {/* Page heading */}
      <div>
        <h2 className="text-2xl font-black text-gray-900">Operations</h2>
        <p className="text-sm text-gray-500">
          Manage coupons, tax rates, contact inquiries, and newsletter subscribers.
        </p>
        <p className="mt-1 text-xs text-blue-600 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 inline-block">
          Note: Dashboard KPIs and stock levels are on the{" "}
          <Link to="/admin" className="underline font-medium">
            Dashboard page
          </Link>
          .
        </p>
      </div>

      {/* Row 1: Coupons | Low Stock */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Coupons */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-bold mb-3">Coupons</h3>
          <form onSubmit={createCoupon} className="space-y-2 mb-4">
            <div className="flex gap-2">
              <input
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                placeholder="Code (e.g. SAVE10)"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value)}
                required
              />
              <select
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                value={couponDiscountType}
                onChange={(e) => setCouponDiscountType(e.target.value as "PERCENT" | "FIXED")}
              >
                <option value="PERCENT">PERCENT</option>
                <option value="FIXED">FIXED</option>
              </select>
            </div>
            <div className="flex gap-2">
              <input
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                placeholder="Value"
                type="number"
                min="0"
                step="0.01"
                value={couponValue}
                onChange={(e) => setCouponValue(e.target.value)}
                required
              />
              <input
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                placeholder="Usage limit (optional)"
                type="number"
                min="1"
                value={couponUsageLimit}
                onChange={(e) => setCouponUsageLimit(e.target.value)}
              />
              <button type="submit" className="px-3 py-2 bg-gray-900 text-white rounded-lg text-sm whitespace-nowrap">
                Create Coupon
              </button>
            </div>
          </form>
          <div className="space-y-2 max-h-64 overflow-auto">
            {coupons.length === 0 && (
              <p className="text-sm text-gray-400">No coupons yet.</p>
            )}
            {coupons.map((coupon) => (
              <div
                key={coupon.id}
                className="text-sm border border-gray-100 rounded-lg p-2 flex items-center justify-between gap-2"
              >
                <div>
                  <span className="font-mono font-semibold">{coupon.code}</span>
                  <span className="text-gray-500 ml-2">
                    {coupon.discountType === "PERCENT"
                      ? `${coupon.discountValue}%`
                      : formatRand(coupon.discountValue)}
                  </span>
                  <span className="ml-2 text-xs text-gray-400">
                    Used: {coupon.usageCount}
                    {coupon.usageLimit != null ? `/${coupon.usageLimit}` : ""}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={coupon.isActive}
                    aria-label={`${coupon.isActive ? "Turn off" : "Turn on"} promo code ${coupon.code}`}
                    onClick={() => toggleCouponActive(coupon)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      coupon.isActive ? "bg-green-500" : "bg-gray-300"
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                        coupon.isActive ? "translate-x-5" : "translate-x-1"
                      }`}
                    />
                  </button>
                  <span className={`text-xs ${coupon.isActive ? "text-green-700" : "text-gray-500"}`}>
                    {coupon.isActive ? "On" : "Off"}
                  </span>
                  <button
                    type="button"
                    onClick={() => deleteCoupon(coupon)}
                    className="px-2 py-1 rounded border border-red-200 text-xs text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Low Stock Report */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-bold mb-3">Low Stock Report</h3>
          <div className="space-y-2 max-h-64 overflow-auto">
            {(inventory?.lowStockItems ?? []).length === 0 && (
              <p className="text-sm text-gray-400">No low-stock items.</p>
            )}
            {(inventory?.lowStockItems ?? []).map((item) => (
              <div key={item.id} className="text-sm border border-gray-100 rounded-lg p-2">
                <span className="font-medium">{item.variant?.product?.name ?? "—"}</span>
                <span className="text-gray-500 ml-2">{item.variant?.sku}</span>
                <span className="ml-2 text-xs text-red-600">
                  {item.quantityOnHand} / {item.lowStockThreshold}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Promo code sales report */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex flex-col gap-1 mb-4">
          <h3 className="font-bold">Promo code sales</h3>
          <p className="text-sm text-gray-500">
            Track which customers used each promo code and what products those codes helped sell.
          </p>
        </div>
        <div className="space-y-4 max-h-96 overflow-auto">
          {couponSales.every((report) => report.orderCount === 0) && (
            <p className="text-sm text-gray-400">No promo-code orders yet.</p>
          )}
          {couponSales.filter((report) => report.orderCount > 0).map((report) => (
            <div key={report.couponId} className="border border-gray-100 rounded-lg p-3 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-mono font-semibold">{report.code}</span>
                  <span className="ml-2 text-xs text-gray-500">{report.orderCount} orders</span>
                </div>
                <div className="text-xs text-gray-500">
                  Revenue: <span className="font-semibold text-gray-700">{formatRand(report.totalRevenue)}</span>
                  <span className="mx-2">•</span>
                  Discounts: <span className="font-semibold text-gray-700">{formatRand(report.totalDiscount)}</span>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Products sold</p>
                <div className="flex flex-wrap gap-2">
                  {report.products.slice(0, 6).map((product) => (
                    <span key={`${product.productName}-${product.sku}`} className="text-xs bg-gray-50 border border-gray-100 rounded-full px-2 py-1">
                      {product.productName} · {product.quantity} sold · {formatRand(product.revenue)}
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Orders</p>
                {report.orders.slice(0, 5).map((order) => (
                  <div key={order.id} className="rounded-lg border border-gray-100 p-2 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="font-semibold">#{order.orderNumber}</span>
                        <span className="ml-2 text-gray-500">
                          {[order.customerName, order.customerEmail].filter(Boolean).join(" · ") || "Guest customer"}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(order.placedAt).toLocaleDateString()} · {formatRand(order.totalAmount)} · -{formatRand(order.discountAmount)}
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      {order.items.map((item) => `${item.productName}${item.variantTitle ? ` (${item.variantTitle})` : ""} ×${item.quantity}`).join(", ")}
                    </p>
                  </div>
                ))}
                {report.orders.length > 5 && (
                  <p className="text-xs text-gray-400">Showing latest 5 of {report.orders.length} orders.</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Row 2: Tax Rates | Inquiries */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Tax Rates */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-bold mb-3">Tax Rates</h3>
          <form onSubmit={createTaxRate} className="space-y-2 mb-4">
            <div className="flex gap-2">
              <input
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                placeholder="Country (e.g. ZA)"
                value={taxCountry}
                onChange={(e) => setTaxCountry(e.target.value)}
                minLength={2}
                required
              />
              <input
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                placeholder="State (optional)"
                value={taxState}
                onChange={(e) => setTaxState(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <input
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                placeholder="Name (e.g. VAT)"
                value={taxName}
                onChange={(e) => setTaxName(e.target.value)}
                required
              />
              <input
                className="w-28 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                placeholder="Rate"
                type="number"
                min="0"
                step="0.001"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
                required
              />
              <button type="submit" className="px-3 py-2 bg-gray-900 text-white rounded-lg text-sm whitespace-nowrap">
                Add Rate
              </button>
            </div>
          </form>
          <div className="space-y-2 max-h-64 overflow-auto">
            {taxRates.length === 0 && (
              <p className="text-sm text-gray-400">No tax rates configured.</p>
            )}
            {taxRates.map((t) => (
              <div
                key={t.id}
                className="text-sm border border-gray-100 rounded-lg p-2 flex items-center justify-between gap-2"
              >
                <div>
                  <span className="font-medium">{t.name}</span>
                  <span className="text-gray-500 ml-2">
                    {t.country}
                    {t.state ? ` / ${t.state}` : ""}
                  </span>
                  <span className="ml-2 text-xs text-gray-400">{t.rate}%</span>
                </div>
                <button
                  onClick={() => deleteTaxRate(t.id)}
                  className="px-2 py-1 rounded border border-red-200 text-red-700 text-xs"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Inquiries */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-bold mb-3">Contact Inquiries</h3>
          <div className="space-y-2 max-h-72 overflow-auto">
            {inquiries.length === 0 && (
              <p className="text-sm text-gray-400">No inquiries.</p>
            )}
            {inquiries.map((inq) => (
              <div key={inq.id} className="text-sm border border-gray-100 rounded-lg p-2">
                <p className="font-medium">{inq.subject}</p>
                <p className="text-xs text-gray-500">
                  {inq.email} · <span className="capitalize">{inq.status.toLowerCase().replace("_", " ")}</span>
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => updateInquiryStatus(inq.id, "IN_PROGRESS")}
                    className="px-2 py-1 text-xs border border-gray-200 rounded text-gray-700"
                  >
                    In Progress
                  </button>
                  <button
                    onClick={() => updateInquiryStatus(inq.id, "RESOLVED")}
                    className="px-2 py-1 text-xs border border-gray-200 rounded text-gray-700"
                  >
                    Resolve
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 3: Newsletter */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-bold mb-3">Newsletter Subscribers</h3>
          <p className="text-sm text-gray-500 mb-3">
            Total subscribers: <span className="font-semibold text-gray-900">{newsletter.length}</span>
          </p>
          <button
            onClick={exportNewsletter}
            className="px-3 py-2 bg-gray-900 text-white rounded-lg text-sm"
          >
            Export CSV
          </button>
        </div>
      </div>
    </div>
  );
}
