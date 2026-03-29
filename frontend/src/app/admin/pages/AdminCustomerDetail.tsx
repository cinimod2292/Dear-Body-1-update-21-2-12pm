import { FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { apiRequest } from "../api/client";
import { useAdminAuth } from "../context/AdminAuthContext";
import { ErrorState, LoadingState } from "../components/AdminState";
import { toast } from "sonner";
import { formatRand } from "../../lib/currency";

interface CustomerDetail {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  status: string;
  marketingEmailConsent: boolean;
  marketingSmsConsent: boolean;
  lifetimeValue: number;
  averageOrderValue: number;
  lastOrderAt?: string;
  tags: Array<{ tagId: string; tag: { id: string; name: string } }>;
  orders: Array<{ id: string; orderNumber: string; status: string; totalAmount: number; placedAt: string }>;
  notes: Array<{ id: string; note: string; isPinned: boolean; createdAt: string; author?: { email?: string } }>;
  interactions: Array<{ id: string; type: string; channel?: string; subject?: string; summary: string; happenedAt: string; staffUser?: { email?: string } }>;
  abandonedCarts: Array<{ id: string; itemCount: number; totalValue: number; abandonedAt: string; recoveredAt?: string | null }>;
  inquiries: Array<{ id: string; email: string; subject: string; message: string; status: string; createdAt: string }>;
}

interface TagOption { id: string; name: string }

export default function AdminCustomerDetail() {
  const { session } = useAdminAuth();
  const { customerId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [tagOptions, setTagOptions] = useState<TagOption[]>([]);
  const [note, setNote] = useState("");
  const [interaction, setInteraction] = useState({ type: "NOTE", channel: "", subject: "", summary: "" });
  const [inquiry, setInquiry] = useState({ email: "", subject: "", message: "" });

  const load = async () => {
    if (!session?.accessToken || !customerId) return;
    try {
      setLoading(true);
      setError(null);
      const [customerRes, tagsRes] = await Promise.all([
        apiRequest<{ data: CustomerDetail }>(`/admin/customers/${customerId}`, {}, session.accessToken),
        apiRequest<{ data: { items: TagOption[] } }>("/admin/tags?page=1&perPage=200", {}, session.accessToken),
      ]);
      setCustomer(customerRes.data);
      setTagOptions(tagsRes.data.items);
      setInquiry((i) => ({ ...i, email: customerRes.data.email }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load customer");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [session?.accessToken, customerId]);

  const addNote = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.accessToken || !customerId || !note) return;
    try {
      await apiRequest(`/admin/customers/${customerId}/notes`, { method: "POST", body: JSON.stringify({ note }) }, session.accessToken);
      setNote("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add note");
    }
  };

  const addInteraction = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.accessToken || !customerId || !interaction.summary) return;
    try {
      await apiRequest(`/admin/customers/${customerId}/interactions`, { method: "POST", body: JSON.stringify(interaction) }, session.accessToken);
      setInteraction({ type: "NOTE", channel: "", subject: "", summary: "" });
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add interaction");
    }
  };

  const addTag = async (tagId: string) => {
    if (!session?.accessToken || !customerId) return;
    try {
      await apiRequest(`/admin/customers/${customerId}/tags`, { method: "POST", body: JSON.stringify({ tagId }) }, session.accessToken);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add tag");
    }
  };

  const removeTag = async (tagId: string) => {
    if (!session?.accessToken || !customerId) return;
    await apiRequest(`/admin/customers/${customerId}/tags/${tagId}`, { method: "DELETE" }, session.accessToken);
    await load();
  };

  const createInquiry = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.accessToken || !customerId) return;
    try {
      await apiRequest("/admin/support/inquiries", { method: "POST", body: JSON.stringify({ ...inquiry, customerId }) }, session.accessToken);
      setInquiry((i) => ({ ...i, subject: "", message: "" }));
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create inquiry");
    }
  };

  if (loading) return <LoadingState label="Loading customer CRM record..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!customer) return null;

  return (
    <div className="space-y-5">
      <div>
        <Link to="/admin/customers" className="text-sm text-gray-500 hover:text-gray-800">← Back to Customers</Link>
        <h2 className="text-2xl font-black text-gray-900 mt-1">{[customer.firstName, customer.lastName].filter(Boolean).join(" ") || customer.email}</h2>
        <p className="text-sm text-gray-500">CRM profile with orders, notes, interactions, and support context.</p>
      </div>

      <section className="bg-white border border-gray-200 rounded-xl p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div><p className="text-xs text-gray-400">Status</p><p className="font-semibold">{customer.status}</p></div>
        <div><p className="text-xs text-gray-400">LTV / AOV</p><p className="font-semibold">{formatRand(customer.lifetimeValue)} / {formatRand(customer.averageOrderValue)}</p></div>
        <div><p className="text-xs text-gray-400">Last Order</p><p className="font-semibold">{customer.lastOrderAt ? new Date(customer.lastOrderAt).toLocaleString() : "—"}</p></div>
        <div><p className="text-xs text-gray-400">Email</p><p className="font-semibold">{customer.email}</p></div>
        <div><p className="text-xs text-gray-400">Phone</p><p className="font-semibold">{customer.phone || "—"}</p></div>
        <div><p className="text-xs text-gray-400">Marketing</p><p className="font-semibold">Email {customer.marketingEmailConsent ? "Yes" : "No"} · SMS {customer.marketingSmsConsent ? "Yes" : "No"}</p></div>
      </section>

      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="font-bold mb-3">Tags / Labels</h3>
        <div className="flex flex-wrap gap-2 mb-3">
          {customer.tags.map((t) => (
            <button key={t.tagId} type="button" onClick={() => removeTag(t.tagId)} className="px-2 py-1 rounded-full text-xs border border-pink-300 bg-pink-50">{t.tag.name} ✕</button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {tagOptions.filter((t) => !customer.tags.some((ct) => ct.tagId === t.id)).map((t) => (
            <button key={t.id} type="button" onClick={() => addTag(t.id)} className="px-2 py-1 rounded-full text-xs border border-gray-200">+ {t.name}</button>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-bold mb-3">Internal Notes</h3>
          <form onSubmit={addNote} className="flex gap-2 mb-3">
            <input className="flex-1 rounded-lg border border-gray-200 px-3 py-2" placeholder="Add note" value={note} onChange={(e) => setNote(e.target.value)} />
            <button className="px-3 py-2 rounded-lg bg-gray-900 text-white text-sm">Add</button>
          </form>
          <div className="space-y-2 max-h-56 overflow-auto">
            {customer.notes.map((n) => <div key={n.id} className="text-sm border border-gray-100 rounded-lg p-2"><p>{n.note}</p><p className="text-xs text-gray-400 mt-1">{n.author?.email || "System"} · {new Date(n.createdAt).toLocaleString()}</p></div>)}
          </div>
        </section>

        <section className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-bold mb-3">Contact / Interaction Log</h3>
          <form onSubmit={addInteraction} className="space-y-2 mb-3">
            <div className="grid grid-cols-3 gap-2">
              <select className="rounded-lg border border-gray-200 px-2 py-2" value={interaction.type} onChange={(e) => setInteraction((i) => ({ ...i, type: e.target.value }))}><option>NOTE</option><option>EMAIL</option><option>PHONE</option><option>CHAT</option><option>TICKET</option></select>
              <input className="rounded-lg border border-gray-200 px-2 py-2" placeholder="Channel" value={interaction.channel} onChange={(e) => setInteraction((i) => ({ ...i, channel: e.target.value }))} />
              <input className="rounded-lg border border-gray-200 px-2 py-2" placeholder="Subject" value={interaction.subject} onChange={(e) => setInteraction((i) => ({ ...i, subject: e.target.value }))} />
            </div>
            <textarea className="w-full rounded-lg border border-gray-200 px-3 py-2" placeholder="Summary" value={interaction.summary} onChange={(e) => setInteraction((i) => ({ ...i, summary: e.target.value }))} />
            <button className="px-3 py-2 rounded-lg bg-gray-900 text-white text-sm">Log Interaction</button>
          </form>
          <div className="space-y-2 max-h-56 overflow-auto">
            {customer.interactions.map((i) => <div key={i.id} className="text-sm border border-gray-100 rounded-lg p-2"><p className="font-medium">{i.type} · {i.subject || "No subject"}</p><p>{i.summary}</p><p className="text-xs text-gray-400 mt-1">{i.staffUser?.email || "System"} · {new Date(i.happenedAt).toLocaleString()}</p></div>)}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-bold mb-3">Order History</h3>
          <div className="space-y-2 max-h-56 overflow-auto">
            {customer.orders.length === 0 ? <p className="text-sm text-gray-500">No orders yet.</p> : customer.orders.map((o) => <div key={o.id} className="text-sm border border-gray-100 rounded-lg p-2 flex items-center justify-between"><div><p className="font-medium">#{o.orderNumber}</p><p className="text-xs text-gray-500">{o.status} · {new Date(o.placedAt).toLocaleDateString()}</p></div><p className="font-semibold">{formatRand(o.totalAmount)}</p></div>)}
          </div>
        </section>

        <section className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-bold mb-3">Abandoned Carts</h3>
          <div className="space-y-2 max-h-56 overflow-auto">
            {customer.abandonedCarts.length === 0 ? <p className="text-sm text-gray-500">No abandoned carts.</p> : customer.abandonedCarts.map((c) => <div key={c.id} className="text-sm border border-gray-100 rounded-lg p-2 flex items-center justify-between"><div><p>{c.itemCount} items</p><p className="text-xs text-gray-500">{new Date(c.abandonedAt).toLocaleString()}</p></div><p className="font-semibold">{formatRand(c.totalValue)}</p></div>)}
          </div>
        </section>
      </div>

      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="font-bold mb-3">Support / Inquiry</h3>
        <form onSubmit={createInquiry} className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
          <input className="rounded-lg border border-gray-200 px-3 py-2" value={inquiry.email} onChange={(e) => setInquiry((i) => ({ ...i, email: e.target.value }))} placeholder="Email" />
          <input className="rounded-lg border border-gray-200 px-3 py-2" value={inquiry.subject} onChange={(e) => setInquiry((i) => ({ ...i, subject: e.target.value }))} placeholder="Subject" />
          <button className="rounded-lg bg-gray-900 text-white text-sm">Create Inquiry</button>
          <textarea className="md:col-span-3 rounded-lg border border-gray-200 px-3 py-2" value={inquiry.message} onChange={(e) => setInquiry((i) => ({ ...i, message: e.target.value }))} placeholder="Message" />
        </form>
        <div className="space-y-2">
          {customer.inquiries.map((iq) => <div key={iq.id} className="text-sm border border-gray-100 rounded-lg p-2"><p className="font-medium">{iq.subject}</p><p>{iq.message}</p><p className="text-xs text-gray-500">{iq.status} · {new Date(iq.createdAt).toLocaleString()}</p></div>)}
        </div>
      </section>
    </div>
  );
}
