import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router";
import { API_BASE } from "../admin/api/client";
import { useCustomerAuth } from "../context/CustomerAuthContext";

type Address = {
  id: string;
  recipientName?: string | null;
  phone?: string | null;
  line1: string;
  line2?: string | null;
  city: string;
  state?: string | null;
  postalCode: string;
  country: string;
  deliveryNotes?: string | null;
  isDefaultShipping: boolean;
  isDefaultBilling: boolean;
};

const emptyAddress = {
  recipientName: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "United States",
  deliveryNotes: "",
  isDefaultShipping: false,
  isDefaultBilling: false,
};

export default function CustomerDashboard() {
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const { customer, token, logout } = useCustomerAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [profileForm, setProfileForm] = useState({ firstName: "", lastName: "", phone: "" });
  const [profileSaving, setProfileSaving] = useState(false);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressForm, setAddressForm] = useState(emptyAddress);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);

  const authHeaders = token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : undefined;

  const loadOrders = () => {
    if (!token) return;
    fetch(`${API_BASE}/store/account/orders`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((payload) => setOrders(payload.data || []));
  };

  const loadProfile = () => {
    if (!token) return;
    fetch(`${API_BASE}/store/account/profile`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((payload) => {
        const p = payload.data;
        if (!p) return;
        setProfileForm({ firstName: p.firstName || "", lastName: p.lastName || "", phone: p.phone || "" });
      });
  };

  const loadAddresses = () => {
    if (!token) return;
    fetch(`${API_BASE}/store/account/addresses`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((payload) => setAddresses(payload.data || []));
  };

  useEffect(() => {
    loadOrders();
    loadProfile();
    loadAddresses();
  }, [token]);

  const retryPayment = async (orderId: string) => {
    if (!token) return;
    setRetryingId(orderId);
    try {
      const res = await fetch(`${API_BASE}/store/orders/${orderId}/payments/initiate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ gateway: "stitch", force: true, returnUrl: `${window.location.origin}/checkout?orderId=${orderId}`, cancelUrl: `${window.location.origin}/checkout?orderId=${orderId}&cancelled=1` }),
      });
      const payload = await res.json();
      if (res.ok && payload?.data?.checkoutUrl) window.location.href = payload.data.checkoutUrl;
    } finally {
      setRetryingId(null);
    }
  };

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setProfileSaving(true);
    try {
      await fetch(`${API_BASE}/store/account/profile`, { method: "PATCH", headers: authHeaders, body: JSON.stringify(profileForm) });
      loadProfile();
    } finally {
      setProfileSaving(false);
    }
  };

  const saveAddress = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    const url = editingAddressId ? `${API_BASE}/store/account/addresses/${editingAddressId}` : `${API_BASE}/store/account/addresses`;
    const method = editingAddressId ? "PATCH" : "POST";
    await fetch(url, { method, headers: authHeaders, body: JSON.stringify(addressForm) });
    setAddressForm(emptyAddress);
    setEditingAddressId(null);
    loadAddresses();
  };

  const editAddress = (address: Address) => {
    setEditingAddressId(address.id);
    setAddressForm({
      recipientName: address.recipientName || "",
      phone: address.phone || "",
      line1: address.line1,
      line2: address.line2 || "",
      city: address.city,
      state: address.state || "",
      postalCode: address.postalCode,
      country: address.country,
      deliveryNotes: address.deliveryNotes || "",
      isDefaultShipping: address.isDefaultShipping,
      isDefaultBilling: address.isDefaultBilling,
    });
  };

  const deleteAddress = async (addressId: string) => {
    if (!token) return;
    await fetch(`${API_BASE}/store/account/addresses/${addressId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    loadAddresses();
  };

  const setDefault = async (addressId: string, type: "shipping" | "billing") => {
    if (!token) return;
    await fetch(`${API_BASE}/store/account/addresses/${addressId}/default`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ type }),
    });
    loadAddresses();
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black">My Account</h1>
          <p className="text-sm text-gray-500">{customer?.email}</p>
        </div>
        <button onClick={logout} className="px-3 py-2 border rounded-lg text-sm">Logout</button>
      </div>

      <section className="bg-white rounded-2xl border p-5">
        <h2 className="font-bold mb-4">Profile / Personal Details</h2>
        <form onSubmit={saveProfile} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input className="border rounded-lg px-3 py-2" placeholder="First name" value={profileForm.firstName} onChange={(e) => setProfileForm((p) => ({ ...p, firstName: e.target.value }))} />
          <input className="border rounded-lg px-3 py-2" placeholder="Last name" value={profileForm.lastName} onChange={(e) => setProfileForm((p) => ({ ...p, lastName: e.target.value }))} />
          <input className="border rounded-lg px-3 py-2" placeholder="Phone" value={profileForm.phone} onChange={(e) => setProfileForm((p) => ({ ...p, phone: e.target.value }))} />
          <div className="sm:col-span-3">
            <button disabled={profileSaving} className="px-4 py-2 rounded-lg bg-pink-600 text-white text-sm">{profileSaving ? "Saving..." : "Save profile"}</button>
          </div>
        </form>
      </section>

      <section className="bg-white rounded-2xl border p-5">
        <h2 className="font-bold mb-4">Addresses</h2>
        <form className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5" onSubmit={saveAddress}>
          <input className="border rounded-lg px-3 py-2" placeholder="Recipient name" value={addressForm.recipientName} onChange={(e) => setAddressForm((p) => ({ ...p, recipientName: e.target.value }))} />
          <input className="border rounded-lg px-3 py-2" placeholder="Phone" value={addressForm.phone} onChange={(e) => setAddressForm((p) => ({ ...p, phone: e.target.value }))} />
          <input className="border rounded-lg px-3 py-2 sm:col-span-2" placeholder="Address line 1" value={addressForm.line1} onChange={(e) => setAddressForm((p) => ({ ...p, line1: e.target.value }))} required />
          <input className="border rounded-lg px-3 py-2 sm:col-span-2" placeholder="Address line 2" value={addressForm.line2} onChange={(e) => setAddressForm((p) => ({ ...p, line2: e.target.value }))} />
          <input className="border rounded-lg px-3 py-2" placeholder="City / Suburb" value={addressForm.city} onChange={(e) => setAddressForm((p) => ({ ...p, city: e.target.value }))} required />
          <input className="border rounded-lg px-3 py-2" placeholder="Province / State" value={addressForm.state} onChange={(e) => setAddressForm((p) => ({ ...p, state: e.target.value }))} />
          <input className="border rounded-lg px-3 py-2" placeholder="Postal code" value={addressForm.postalCode} onChange={(e) => setAddressForm((p) => ({ ...p, postalCode: e.target.value }))} required />
          <input className="border rounded-lg px-3 py-2" placeholder="Country" value={addressForm.country} onChange={(e) => setAddressForm((p) => ({ ...p, country: e.target.value }))} required />
          <input className="border rounded-lg px-3 py-2 sm:col-span-2" placeholder="Delivery notes (optional)" value={addressForm.deliveryNotes} onChange={(e) => setAddressForm((p) => ({ ...p, deliveryNotes: e.target.value }))} />
          <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={addressForm.isDefaultShipping} onChange={(e) => setAddressForm((p) => ({ ...p, isDefaultShipping: e.target.checked }))} />Default shipping</label>
          <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={addressForm.isDefaultBilling} onChange={(e) => setAddressForm((p) => ({ ...p, isDefaultBilling: e.target.checked }))} />Default billing</label>
          <div className="sm:col-span-2 flex gap-2">
            <button className="px-4 py-2 rounded-lg bg-pink-600 text-white text-sm">{editingAddressId ? "Update address" : "Add address"}</button>
            {editingAddressId ? <button type="button" onClick={() => { setEditingAddressId(null); setAddressForm(emptyAddress); }} className="px-4 py-2 rounded-lg border text-sm">Cancel</button> : null}
          </div>
        </form>

        <div className="space-y-3">
          {addresses.map((address) => (
            <div key={address.id} className="border rounded-xl p-3 text-sm">
              <p className="font-semibold">{address.recipientName || [address.firstName, address.lastName].filter(Boolean).join(" ") || "Recipient"}</p>
              <p>{address.line1}{address.line2 ? `, ${address.line2}` : ""}, {address.city}{address.state ? `, ${address.state}` : ""}, {address.postalCode}, {address.country}</p>
              {address.phone ? <p>Phone: {address.phone}</p> : null}
              <div className="flex flex-wrap gap-2 mt-2">
                {address.isDefaultShipping ? <span className="text-xs px-2 py-1 rounded-full bg-blue-100">Default shipping</span> : <button onClick={() => setDefault(address.id, "shipping")} className="text-xs px-2 py-1 rounded-full border">Set shipping default</button>}
                {address.isDefaultBilling ? <span className="text-xs px-2 py-1 rounded-full bg-purple-100">Default billing</span> : <button onClick={() => setDefault(address.id, "billing")} className="text-xs px-2 py-1 rounded-full border">Set billing default</button>}
                <button onClick={() => editAddress(address)} className="text-xs px-2 py-1 rounded-full border">Edit</button>
                <button onClick={() => deleteAddress(address.id)} className="text-xs px-2 py-1 rounded-full border text-red-600">Delete</button>
              </div>
            </div>
          ))}
          {addresses.length === 0 ? <p className="text-sm text-gray-500">No saved addresses yet.</p> : null}
        </div>
      </section>

      <section className="bg-white rounded-2xl border p-5">
        <h2 className="font-bold mb-4">Orders</h2>
        <div className="space-y-3">
          {orders.map((o) => (
            <div key={o.id} className="block border rounded-xl p-3">
              <Link to={`/account/orders/${o.id}`} className="block hover:bg-gray-50">
                <div className="flex justify-between"><p className="font-semibold">#{o.orderNumber}</p><p className="text-sm">{new Date(o.createdAt).toLocaleDateString()}</p></div>
                <p className="text-sm">Order: {o.status} · Payment: {o.paymentStatus} · Fulfillment: {o.fulfillmentStatus}</p>
                <p className="text-sm">Tracking: {o.trackingNumber || "—"}</p>
              </Link>
              {["AWAITING_PAYMENT", "PAYMENT_FAILED"].includes(o.status) ? <button disabled={retryingId === o.id} onClick={() => retryPayment(o.id)} className="mt-2 px-3 py-1.5 rounded-lg text-xs bg-pink-600 text-white">{retryingId === o.id ? "Retrying..." : "Retry payment"}</button> : null}
            </div>
          ))}
          {orders.length === 0 ? <p className="text-sm text-gray-500">No orders yet.</p> : null}
        </div>
      </section>
    </div>
  );
}
