import { FormEvent, useEffect, useState } from "react";
import { apiRequest } from "../api/client";
import { useAdminAuth } from "../context/AdminAuthContext";
import { EmptyState, ErrorState, LoadingState } from "../components/AdminState";
import { toast } from "sonner";

interface StaffUser {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  role: string;
  status: string;
  lastLoginAt?: string | null;
  createdAt: string;
}

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  STORE_MANAGER: "Store Manager",
  CONTENT_EDITOR: "Content Editor",
  SUPPORT_AGENT: "Support Agent",
  ANALYST: "Analyst",
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-50 text-green-700",
  INVITED: "bg-blue-50 text-blue-700",
  SUSPENDED: "bg-red-50 text-red-700",
};

export default function AdminStaffUsers() {
  const { session } = useAdminAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<StaffUser[]>([]);

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ email: "", firstName: "", lastName: "", role: "STORE_MANAGER", password: "" });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ firstName: "", lastName: "", role: "", status: "" });

  const load = async () => {
    if (!session?.accessToken) return;
    try {
      setLoading(true);
      setError(null);
      const res = await apiRequest<{ data: StaffUser[] }>("/admin/staff-users", {}, session.accessToken);
      setUsers(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load staff users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [session?.accessToken]);

  const createUser = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.accessToken) return;
    try {
      await apiRequest("/admin/staff-users", { method: "POST", body: JSON.stringify(createForm) }, session.accessToken);
      toast.success("Staff user created");
      setShowCreate(false);
      setCreateForm({ email: "", firstName: "", lastName: "", role: "STORE_MANAGER", password: "" });
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create staff user");
    }
  };

  const startEdit = (user: StaffUser) => {
    setEditingId(user.id);
    setEditForm({ firstName: user.firstName ?? "", lastName: user.lastName ?? "", role: user.role, status: user.status });
  };

  const saveEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.accessToken || !editingId) return;
    try {
      await apiRequest(`/admin/staff-users/${editingId}`, { method: "PATCH", body: JSON.stringify(editForm) }, session.accessToken);
      toast.success("Staff user updated");
      setEditingId(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update staff user");
    }
  };

  const suspend = async (id: string) => {
    if (!session?.accessToken) return;
    if (!window.confirm("Suspend this user? They will no longer be able to log in.")) return;
    try {
      await apiRequest(`/admin/staff-users/${id}`, { method: "DELETE" }, session.accessToken);
      toast.success("User suspended");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to suspend user");
    }
  };

  if (loading) return <LoadingState label="Loading staff users..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-gray-900">Admin Users</h2>
          <p className="text-sm text-gray-500">Manage who has access to the admin portal and what they can do.</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm">Add User</button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-3 text-xs text-gray-500 space-y-1">
        <p><strong>Store Manager</strong> — Full access to products, orders, customers, shipping and settings.</p>
        <p><strong>Content Editor</strong> — Can upload media and read catalog only.</p>
        <p><strong>Support Agent</strong> — Can view and update orders and customer records.</p>
        <p><strong>Analyst</strong> — Read-only access to reports and dashboards.</p>
        <p><strong>Super Admin</strong> — Unrestricted access including admin users.</p>
      </div>

      <section className="bg-white border border-gray-200 rounded-xl p-5">
        {users.length === 0 ? <EmptyState label="No staff users found." /> : (
          <div className="space-y-3">
            {users.map((user) => (
              <div key={user.id} className="border border-gray-100 rounded-lg p-3">
                {editingId === user.id ? (
                  <form onSubmit={saveEdit} className="grid grid-cols-1 md:grid-cols-5 gap-2 items-center">
                    <input className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm" placeholder="First name" value={editForm.firstName} onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))} />
                    <input className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm" placeholder="Last name" value={editForm.lastName} onChange={(e) => setEditForm((f) => ({ ...f, lastName: e.target.value }))} />
                    <select className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm" value={editForm.role} onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))}>
                      <option value="SUPER_ADMIN">Super Admin</option>
                      <option value="STORE_MANAGER">Store Manager</option>
                      <option value="CONTENT_EDITOR">Content Editor</option>
                      <option value="SUPPORT_AGENT">Support Agent</option>
                      <option value="ANALYST">Analyst</option>
                    </select>
                    <select className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm" value={editForm.status} onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}>
                      <option value="ACTIVE">Active</option>
                      <option value="SUSPENDED">Suspended</option>
                    </select>
                    <div className="flex gap-2">
                      <button type="submit" className="px-3 py-1.5 rounded-lg bg-gray-900 text-white text-xs">Save</button>
                      <button type="button" onClick={() => setEditingId(null)} className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs">Cancel</button>
                    </div>
                  </form>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-sm">{[user.firstName, user.lastName].filter(Boolean).join(" ") || "Unnamed"}</p>
                      <p className="text-xs text-gray-500">{user.email}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100">{ROLE_LABELS[user.role] ?? user.role}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[user.status] ?? "bg-gray-100"}`}>{user.status}</span>
                        <span className="text-xs text-gray-400">{user.lastLoginAt ? `Last login: ${new Date(user.lastLoginAt).toLocaleDateString()}` : "Never logged in"}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => startEdit(user)} className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs">Edit</button>
                      {user.status === "ACTIVE" && user.id !== session?.id && (
                        <button onClick={() => suspend(user.id)} className="px-3 py-1.5 rounded-lg border border-red-200 text-red-700 text-xs">Suspend</button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {showCreate && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
          <form onSubmit={createUser} className="w-full max-w-lg bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <h3 className="font-bold">Add Staff User</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input required type="email" className="md:col-span-2 rounded-lg border border-gray-200 px-3 py-2 text-sm" placeholder="Email address" value={createForm.email} onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))} />
              <input className="rounded-lg border border-gray-200 px-3 py-2 text-sm" placeholder="First name" value={createForm.firstName} onChange={(e) => setCreateForm((f) => ({ ...f, firstName: e.target.value }))} />
              <input className="rounded-lg border border-gray-200 px-3 py-2 text-sm" placeholder="Last name" value={createForm.lastName} onChange={(e) => setCreateForm((f) => ({ ...f, lastName: e.target.value }))} />
              <input required type="password" minLength={8} className="md:col-span-2 rounded-lg border border-gray-200 px-3 py-2 text-sm" placeholder="Temporary password (min. 8 characters)" value={createForm.password} onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))} />
              <select className="md:col-span-2 rounded-lg border border-gray-200 px-3 py-2 text-sm" value={createForm.role} onChange={(e) => setCreateForm((f) => ({ ...f, role: e.target.value }))}>
                <option value="STORE_MANAGER">Store Manager — Full access</option>
                <option value="CONTENT_EDITOR">Content Editor — Media and catalog</option>
                <option value="SUPPORT_AGENT">Support Agent — CRM and orders</option>
                <option value="ANALYST">Analyst — Reports only</option>
                <option value="SUPER_ADMIN">Super Admin — Unrestricted</option>
              </select>
            </div>
            <p className="text-xs text-gray-500">Share the temporary password with the user and ask them to change it on first login.</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm">Create User</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
