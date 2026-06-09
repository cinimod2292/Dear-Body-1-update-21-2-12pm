import { Dispatch, FormEvent, SetStateAction, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Package, ChevronRight } from "lucide-react";
import { API_BASE } from "../admin/api/client";
import { useCustomerAuth } from "../context/CustomerAuthContext";
import { formatRand } from "../lib/currency";

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

type AddressFormState = {
  recipientName: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  deliveryNotes: string;
  isDefaultShipping: boolean;
  isDefaultBilling: boolean;
};

type Order = {
  id: string;
  orderNumber: string;
  createdAt: string;
  status: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  totalAmount?: number | string | null;
  trackingNumber?: string | null;
};

const emptyAddress: AddressFormState = {
  recipientName: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "South Africa",
  deliveryNotes: "",
  isDefaultShipping: false,
  isDefaultBilling: false,
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-700",
  PROCESSING: "bg-blue-100 text-blue-700",
  FULFILLED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
  AWAITING_PAYMENT: "bg-amber-100 text-amber-700",
  PAYMENT_FAILED: "bg-red-100 text-red-700",
  PAID: "bg-green-100 text-green-700",
  REFUNDED: "bg-purple-100 text-purple-700",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  PROCESSING: "Processing",
  FULFILLED: "Fulfilled",
  CANCELLED: "Cancelled",
  AWAITING_PAYMENT: "Awaiting Payment",
  PAYMENT_FAILED: "Payment Failed",
  PAID: "Paid",
  REFUNDED: "Refunded",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[status] ?? "bg-gray-100 text-gray-700"}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

const parseApiError = async (response: Response, fallback: string) => {
  try {
    const payload = await response.json();
    return payload?.error?.message || fallback;
  } catch {
    return fallback;
  }
};

function ProfileSection({
  profileForm, setProfileForm, profileError, profileSaving, onSave,
}: {
  profileForm: { firstName: string; lastName: string; phone: string };
  setProfileForm: Dispatch<SetStateAction<{ firstName: string; lastName: string; phone: string }>>;
  profileError: string | null;
  profileSaving: boolean;
  onSave: (e: FormEvent) => Promise<void>;
}) {
  return (
    <section className="bg-white rounded-2xl border p-5" data-testid="account-profile-section">
      <h2 className="font-bold mb-4">Personal Details</h2>
      <form onSubmit={(e) => void onSave(e)} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">First Name</span>
          <input className="border rounded-lg px-3 py-2" placeholder="Jane" value={profileForm.firstName} onChange={(e) => setProfileForm((p) => ({ ...p, firstName: e.target.value }))} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Last Name</span>
          <input className="border rounded-lg px-3 py-2" placeholder="Smith" value={profileForm.lastName} onChange={(e) => setProfileForm((p) => ({ ...p, lastName: e.target.value }))} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Phone</span>
          <input className="border rounded-lg px-3 py-2" placeholder="+27 82 000 0000" value={profileForm.phone} onChange={(e) => setProfileForm((p) => ({ ...p, phone: e.target.value }))} />
        </label>
        {profileError ? <p className="sm:col-span-3 text-sm text-red-600">{profileError}</p> : null}
        <div className="sm:col-span-3">
          <button disabled={profileSaving} className="px-4 py-2 rounded-lg bg-pink-600 text-white text-sm">
            {profileSaving ? "Saving..." : "Save profile"}
          </button>
        </div>
      </form>
    </section>
  );
}

function AddressSection({
  addressForm, setAddressForm, addressError, editingAddressId, addresses,
  onSave, onEdit, onDelete, onSetDefault, onCancelEdit,
}: {
  addressForm: AddressFormState;
  setAddressForm: Dispatch<SetStateAction<AddressFormState>>;
  addressError: string | null;
  editingAddressId: string | null;
  addresses: Address[];
  onSave: (e: FormEvent) => Promise<void>;
  onEdit: (address: Address) => void;
  onDelete: (addressId: string) => Promise<void>;
  onSetDefault: (addressId: string, type: "shipping" | "billing") => Promise<void>;
  onCancelEdit: () => void;
}) {
  return (
    <section className="bg-white rounded-2xl border p-5" data-testid="account-address-section">
      <h2 className="font-bold mb-4">Shipping Address</h2>
      <form className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5" onSubmit={(e) => void onSave(e)}>
        {addressError ? <p className="sm:col-span-2 text-sm text-red-600">{addressError}</p> : null}
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Recipient Name</span>
          <input className="border rounded-lg px-3 py-2" placeholder="Jane Smith" value={addressForm.recipientName} onChange={(e) => setAddressForm((p) => ({ ...p, recipientName: e.target.value }))} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Phone</span>
          <input className="border rounded-lg px-3 py-2" placeholder="+27 82 000 0000" value={addressForm.phone} onChange={(e) => setAddressForm((p) => ({ ...p, phone: e.target.value }))} />
        </label>
        <label className="sm:col-span-2 flex flex-col gap-1">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Unit / Complex / Building <span className="normal-case font-normal">(optional)</span></span>
          <input className="border rounded-lg px-3 py-2" placeholder="Unit 4, The Palms" value={addressForm.line2} onChange={(e) => setAddressForm((p) => ({ ...p, line2: e.target.value }))} />
        </label>
        <label className="sm:col-span-2 flex flex-col gap-1">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Street Address</span>
          <input className="border rounded-lg px-3 py-2" placeholder="123 Main Street" value={addressForm.line1} onChange={(e) => setAddressForm((p) => ({ ...p, line1: e.target.value }))} required />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">City / Suburb</span>
          <input className="border rounded-lg px-3 py-2" placeholder="Cape Town" value={addressForm.city} onChange={(e) => setAddressForm((p) => ({ ...p, city: e.target.value }))} required />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Province</span>
          <input className="border rounded-lg px-3 py-2" placeholder="Western Cape" value={addressForm.state} onChange={(e) => setAddressForm((p) => ({ ...p, state: e.target.value }))} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Postal Code</span>
          <input className="border rounded-lg px-3 py-2" placeholder="8001" value={addressForm.postalCode} onChange={(e) => setAddressForm((p) => ({ ...p, postalCode: e.target.value }))} required />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Country</span>
          <input className="border rounded-lg px-3 py-2" placeholder="South Africa" value={addressForm.country} onChange={(e) => setAddressForm((p) => ({ ...p, country: e.target.value }))} required />
        </label>
        <label className="sm:col-span-2 flex flex-col gap-1">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Delivery Notes <span className="normal-case font-normal">(optional)</span></span>
          <input className="border rounded-lg px-3 py-2" placeholder="e.g. Leave at gate / Ring doorbell" value={addressForm.deliveryNotes} onChange={(e) => setAddressForm((p) => ({ ...p, deliveryNotes: e.target.value }))} />
        </label>
        <label className="text-sm flex items-center gap-2">
          <input type="checkbox" checked={addressForm.isDefaultShipping} onChange={(e) => setAddressForm((p) => ({ ...p, isDefaultShipping: e.target.checked }))} />
          Default shipping
        </label>
        <label className="text-sm flex items-center gap-2">
          <input type="checkbox" checked={addressForm.isDefaultBilling} onChange={(e) => setAddressForm((p) => ({ ...p, isDefaultBilling: e.target.checked }))} />
          Default billing
        </label>
        <div className="sm:col-span-2 flex gap-2">
          <button className="px-4 py-2 rounded-lg bg-pink-600 text-white text-sm">
            {editingAddressId ? "Update address" : "Add address"}
          </button>
          {editingAddressId ? (
            <button type="button" onClick={onCancelEdit} className="px-4 py-2 rounded-lg border text-sm">Cancel</button>
          ) : null}
        </div>
      </form>

      <div className="space-y-3">
        {addresses.map((address) => (
          <div key={address.id} className="border rounded-xl p-3 text-sm">
            <p className="font-semibold">{address.recipientName || "Recipient"}</p>
            <p>
              {address.line2 ? `${address.line2}, ` : ""}
              {address.line1}, {address.city}
              {address.state ? `, ${address.state}` : ""}, {address.postalCode}, {address.country}
            </p>
            {address.phone ? <p>Phone: {address.phone}</p> : null}
            <div className="flex flex-wrap gap-2 mt-2">
              {address.isDefaultShipping
                ? <span className="text-xs px-2 py-1 rounded-full bg-blue-100">Default shipping</span>
                : <button onClick={() => void onSetDefault(address.id, "shipping")} className="text-xs px-2 py-1 rounded-full border">Set shipping default</button>}
              {address.isDefaultBilling
                ? <span className="text-xs px-2 py-1 rounded-full bg-purple-100">Default billing</span>
                : <button onClick={() => void onSetDefault(address.id, "billing")} className="text-xs px-2 py-1 rounded-full border">Set billing default</button>}
              <button onClick={() => onEdit(address)} className="text-xs px-2 py-1 rounded-full border">Edit</button>
              <button onClick={() => void onDelete(address.id)} className="text-xs px-2 py-1 rounded-full border text-red-600">Delete</button>
            </div>
          </div>
        ))}
        {addresses.length === 0 ? <p className="text-sm text-gray-500">No saved addresses yet.</p> : null}
      </div>
    </section>
  );
}

function OrdersSection({
  orders, retryingId, onRetryPayment,
}: {
  orders: Order[];
  retryingId: string | null;
  onRetryPayment: (orderId: string) => void;
}) {
  if (orders.length === 0) {
    return (
      <div className="bg-white rounded-2xl border p-10 text-center">
        <div className="w-14 h-14 rounded-full bg-pink-50 flex items-center justify-center mx-auto mb-4">
          <Package size={24} className="text-pink-400" />
        </div>
        <h3 className="font-bold text-gray-900 mb-1">No orders yet</h3>
        <p className="text-sm text-gray-500 mb-5">When you place your first order it will appear here.</p>
        <Link
          to="/shop"
          className="inline-block px-5 py-2.5 rounded-full bg-gradient-to-r from-pink-500 to-orange-500 text-white text-sm font-bold hover:opacity-90 transition-opacity"
        >
          Start shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="account-orders-section">
      {orders.map((o) => (
        <div key={o.id} className="bg-white rounded-2xl border hover:border-pink-200 transition-colors">
          <Link to={`/account/orders/${o.id}`} className="flex items-center justify-between p-5 group">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                <span className="font-black text-gray-900">#{o.orderNumber}</span>
                <StatusBadge status={o.paymentStatus} />
                <StatusBadge status={o.status} />
              </div>
              <p className="text-sm text-gray-500">
                {new Date(o.createdAt).toLocaleDateString("en-ZA", { year: "numeric", month: "long", day: "numeric" })}
                {o.totalAmount != null ? ` · ${formatRand(Number(o.totalAmount))}` : ""}
              </p>
              {o.trackingNumber ? (
                <p className="text-xs text-gray-400 mt-0.5">Tracking: {o.trackingNumber}</p>
              ) : null}
            </div>
            <ChevronRight size={18} className="text-gray-300 group-hover:text-pink-400 flex-shrink-0 ml-3 transition-colors" />
          </Link>
          {["AWAITING_PAYMENT", "PAYMENT_FAILED"].includes(o.paymentStatus) ? (
            <div className="px-5 pb-5 pt-0">
              <div className="h-px bg-gray-100 mb-4" />
              <button
                disabled={retryingId === o.id}
                onClick={() => onRetryPayment(o.id)}
                className="px-4 py-2 rounded-full text-sm font-bold bg-gradient-to-r from-pink-500 to-orange-500 text-white hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {retryingId === o.id ? "Redirecting…" : "Complete payment"}
              </button>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export default function CustomerDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get("tab") || "personal") as "personal" | "addresses" | "orders";
  const { customer, token, logout } = useCustomerAuth();

  useEffect(() => {
    document.title = "My Account — Dear Body";
  }, []);

  const [profileForm, setProfileForm] = useState({ firstName: "", lastName: "", phone: "" });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressForm, setAddressForm] = useState<AddressFormState>(emptyAddress);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [preferredGateway, setPreferredGateway] = useState<"stitch" | "payfast">("payfast");

  const authHeaders = token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : undefined;

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
    if (!token) return;
    loadProfile();
    loadAddresses();
    fetch(`${API_BASE}/store/account/orders`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((payload) => setOrders(payload.data || []));
  }, [token]);

  useEffect(() => {
    fetch(`${API_BASE}/store/payments/gateways`)
      .then((r) => r.json())
      .then((payload) => {
        const preferred = payload?.data?.preferredGateway as "stitch" | "payfast" | undefined;
        const first = payload?.data?.enabledGateways?.[0]?.id as "stitch" | "payfast" | undefined;
        if (preferred || first) setPreferredGateway(preferred ?? first!);
      })
      .catch(() => undefined);
  }, []);

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setProfileError(null);
    setProfileSaving(true);
    try {
      const res = await fetch(`${API_BASE}/store/account/profile`, { method: "PATCH", headers: authHeaders, body: JSON.stringify(profileForm) });
      if (!res.ok) { setProfileError(await parseApiError(res, "Failed to update profile")); return; }
      loadProfile();
    } finally {
      setProfileSaving(false);
    }
  };

  const saveAddress = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setAddressError(null);
    const url = editingAddressId ? `${API_BASE}/store/account/addresses/${editingAddressId}` : `${API_BASE}/store/account/addresses`;
    const method = editingAddressId ? "PATCH" : "POST";
    const res = await fetch(url, { method, headers: authHeaders, body: JSON.stringify(addressForm) });
    if (!res.ok) { setAddressError(await parseApiError(res, editingAddressId ? "Failed to update address" : "Failed to add address")); return; }
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
    setAddressError(null);
    const res = await fetch(`${API_BASE}/store/account/addresses/${addressId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) { setAddressError(await parseApiError(res, "Failed to delete address")); return; }
    loadAddresses();
  };

  const setDefault = async (addressId: string, type: "shipping" | "billing") => {
    if (!token) return;
    setAddressError(null);
    const res = await fetch(`${API_BASE}/store/account/addresses/${addressId}/default`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ type }),
    });
    if (!res.ok) { setAddressError(await parseApiError(res, `Failed to set default ${type} address`)); return; }
    loadAddresses();
  };

  const retryPayment = async (orderId: string) => {
    if (!token) return;
    setRetryingId(orderId);
    try {
      const res = await fetch(`${API_BASE}/store/orders/${orderId}/payments/initiate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          gateway: preferredGateway,
          force: true,
          returnUrl: `${window.location.origin}/checkout?orderId=${orderId}`,
          cancelUrl: `${window.location.origin}/checkout?orderId=${orderId}&cancelled=1`,
        }),
      });
      const payload = await res.json();
      if (res.ok && payload?.data?.checkoutUrl) window.location.href = payload.data.checkoutUrl;
    } finally {
      setRetryingId(null);
    }
  };

  const tabs = [
    { id: "personal", label: "Personal Details" },
    { id: "addresses", label: "Shipping Address" },
    { id: "orders", label: "Orders" },
  ] as const;

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black">My Account</h1>
          <p className="text-sm text-gray-500">{customer?.email}</p>
        </div>
        <button onClick={logout} className="px-3 py-2 border rounded-lg text-sm">Logout</button>
      </div>

      <div className="border-b border-gray-200 mb-6">
        <nav className="flex">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSearchParams({ tab: tab.id })}
              className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors -mb-px ${
                activeTab === tab.id
                  ? "border-pink-500 text-pink-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === "personal" && (
        <ProfileSection
          profileForm={profileForm}
          setProfileForm={setProfileForm}
          profileError={profileError}
          profileSaving={profileSaving}
          onSave={saveProfile}
        />
      )}

      {activeTab === "addresses" && (
        <AddressSection
          addressForm={addressForm}
          setAddressForm={setAddressForm}
          addressError={addressError}
          editingAddressId={editingAddressId}
          addresses={addresses}
          onSave={saveAddress}
          onEdit={editAddress}
          onDelete={deleteAddress}
          onSetDefault={setDefault}
          onCancelEdit={() => { setEditingAddressId(null); setAddressForm(emptyAddress); }}
        />
      )}

      {activeTab === "orders" && (
        <OrdersSection
          orders={orders}
          retryingId={retryingId}
          onRetryPayment={(id) => void retryPayment(id)}
        />
      )}
    </div>
  );
}
