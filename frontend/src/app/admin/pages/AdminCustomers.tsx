import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { apiRequest, API_BASE } from "../api/client";
import { useAdminAuth } from "../context/AdminAuthContext";
import { AdminPagination } from "../components/AdminPagination";
import { AdminTable } from "../components/AdminTable";
import { EmptyState, ErrorState, LoadingState } from "../components/AdminState";
import { formatRand } from "../../lib/currency";
import { formatAdminDate } from "../../lib/datetime";
import { toast } from "sonner";

interface CustomerListItem {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  status: string;
  marketingEmailConsent: boolean;
  marketingSmsConsent: boolean;
  lifetimeValue: number;
  averageOrderValue: number;
  lastOrderAt?: string;
  tags?: Array<{ tag: { name: string } }>;
  abandonedCarts?: Array<{ id: string }>;
}

interface TagOption { id: string; name: string }

export default function AdminCustomers() {
  const { session } = useAdminAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [tagId, setTagId] = useState("");
  const [tags, setTags] = useState<TagOption[]>([]);

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ email: "", firstName: "", lastName: "", phone: "", status: "LEAD", marketingEmailConsent: false, marketingSmsConsent: false });

  const params = useMemo(() => {
    const sp = new URLSearchParams({ page: String(page), perPage: "20", sortBy: "updatedAt", sortDir: "desc" });
    if (query) sp.set("q", query);
    if (status !== "ALL") sp.set("status", status);
    if (tagId) sp.set("tagId", tagId);
    return sp.toString();
  }, [page, query, status, tagId]);

  const load = async () => {
    if (!session?.accessToken) return;
    try {
      setLoading(true);
      setError(null);
      const customersRes = await apiRequest<{ data: { items: CustomerListItem[]; totalPages: number } }>(`/admin/customers?${params}`, {}, session.accessToken);
      setCustomers(customersRes.data.items);
      setTotalPages(customersRes.data.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load customers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [session?.accessToken, params]);

  useEffect(() => {
    if (!session?.accessToken) return;
    apiRequest<{ data: { items: TagOption[] } }>("/admin/tags?page=1&perPage=200", {}, session.accessToken)
      .then((res) => setTags(res.data.items))
      .catch(() => {
        // Keep customer list usable even if tags fail.
      });
  }, [session?.accessToken]);

  const exportCsv = async () => {
    if (!session?.accessToken) return;
    try {
      const res = await fetch(`${API_BASE}/admin/customers/export.csv`, {
        headers: { Authorization: `Bearer ${session.accessToken}` },
      });
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "customers.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    }
  };

  const createCustomer = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.accessToken) return;
    try {
      await apiRequest("/admin/customers", { method: "POST", body: JSON.stringify(createForm) }, session.accessToken);
      setShowCreate(false);
      setCreateForm({ email: "", firstName: "", lastName: "", phone: "", status: "LEAD", marketingEmailConsent: false, marketingSmsConsent: false });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create customer");
    }
  };

  if (loading) return <LoadingState label="Loading CRM customers..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3">
        <div>
          <h2 className="text-2xl font-black text-gray-900">Customers & CRM</h2>
          <p className="text-sm text-gray-500">Search, segment, and manage customer relationships at scale.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCsv} className="px-4 py-2 border border-gray-200 rounded-lg text-sm">Export CSV</button>
          <button onClick={() => setShowCreate(true)} className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm">New Customer</button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-3 grid grid-cols-1 md:grid-cols-4 gap-3">
        <input className="md:col-span-2 rounded-lg border border-gray-200 px-3 py-2 text-sm" placeholder="Search email/name/phone" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} />
        <select className="rounded-lg border border-gray-200 px-3 py-2 text-sm" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="ALL">All statuses</option>
          <option value="LEAD">Lead</option>
          <option value="ACTIVE">Active</option>
          <option value="VIP">VIP</option>
          <option value="INACTIVE">Inactive</option>
          <option value="BLOCKED">Blocked</option>
        </select>
        <select className="rounded-lg border border-gray-200 px-3 py-2 text-sm" value={tagId} onChange={(e) => { setTagId(e.target.value); setPage(1); }}>
          <option value="">All tags</option>
          {tags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      {customers.length === 0 ? <EmptyState label={query || status !== "ALL" || tagId ? "No customers match the current filters." : "No customers yet."} /> : (
        <AdminTable
          rows={customers}
          columns={[
            { key: "name", header: "Customer", render: (c) => <div><p className="font-semibold">{[c.firstName, c.lastName].filter(Boolean).join(" ") || "Unnamed"}</p><p className="text-xs text-gray-500">{c.email}</p></div> },
            { key: "status", header: "Status", render: (c) => <span className="text-xs px-2 py-1 rounded-full bg-gray-100">{c.status}</span> },
            { key: "consent", header: "Marketing", render: (c) => <span className="text-xs">Email: {c.marketingEmailConsent ? "Yes" : "No"} · SMS: {c.marketingSmsConsent ? "Yes" : "No"}</span> },
            { key: "ltv", header: "LTV / AOV", render: (c) => <span className="text-xs">{formatRand(c.lifetimeValue)} / {formatRand(c.averageOrderValue)}</span> },
            { key: "lastOrder", header: "Last Order", render: (c) => <span className="text-xs">{c.lastOrderAt ? formatAdminDate(c.lastOrderAt) : "—"}</span> },
            { key: "risk", header: "Risk Signals", render: (c) => <span className="text-xs">{(c.abandonedCarts?.length ?? 0) > 0 ? "Abandoned cart" : "—"}</span> },
            { key: "actions", header: "", render: (c) => <Link to={`/admin/customers/${c.id}`} className="text-xs text-blue-600 hover:underline">Open CRM</Link> },
          ]}
        />
      )}

      <AdminPagination page={page} totalPages={totalPages} onChange={setPage} />

      {showCreate && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
          <form onSubmit={createCustomer} className="w-full max-w-xl bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <h3 className="font-bold">Create Customer</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input required className="rounded-lg border border-gray-200 px-3 py-2" placeholder="Email" value={createForm.email} onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))} />
              <input className="rounded-lg border border-gray-200 px-3 py-2" placeholder="Phone" value={createForm.phone} onChange={(e) => setCreateForm((f) => ({ ...f, phone: e.target.value }))} />
              <input className="rounded-lg border border-gray-200 px-3 py-2" placeholder="First name" value={createForm.firstName} onChange={(e) => setCreateForm((f) => ({ ...f, firstName: e.target.value }))} />
              <input className="rounded-lg border border-gray-200 px-3 py-2" placeholder="Last name" value={createForm.lastName} onChange={(e) => setCreateForm((f) => ({ ...f, lastName: e.target.value }))} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <select className="rounded-lg border border-gray-200 px-3 py-2" value={createForm.status} onChange={(e) => setCreateForm((f) => ({ ...f, status: e.target.value }))}>
                <option value="LEAD">Lead</option><option value="ACTIVE">Active</option><option value="VIP">VIP</option><option value="INACTIVE">Inactive</option><option value="BLOCKED">Blocked</option>
              </select>
              <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={createForm.marketingEmailConsent} onChange={(e) => setCreateForm((f) => ({ ...f, marketingEmailConsent: e.target.checked }))} />Email consent</label>
              <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={createForm.marketingSmsConsent} onChange={(e) => setCreateForm((f) => ({ ...f, marketingSmsConsent: e.target.checked }))} />SMS consent</label>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 border border-gray-200 rounded-lg">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-gray-900 text-white rounded-lg">Create</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
