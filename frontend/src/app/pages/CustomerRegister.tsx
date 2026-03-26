import { FormEvent, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useCustomerAuth } from "../context/CustomerAuthContext";

export default function CustomerRegister() {
  const { register } = useCustomerAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") || "/checkout";
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    phone: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "United States",
  });
  const [captureAddress, setCaptureAddress] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await register({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        password: form.password,
        phone: form.phone,
        address: captureAddress
          ? {
              recipientName: `${form.firstName} ${form.lastName}`.trim(),
              line1: form.addressLine1,
              line2: form.addressLine2 || undefined,
              city: form.city,
              state: form.state || undefined,
              postalCode: form.postalCode,
              country: form.country,
              phone: form.phone || undefined,
            }
          : undefined,
      });
      navigate(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-black mb-6">Create Account</h1>
      <form className="space-y-4" onSubmit={submit}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <input className="w-full border rounded-lg px-4 py-3" placeholder="First name" value={form.firstName} onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))} required />
          <input className="w-full border rounded-lg px-4 py-3" placeholder="Last name" value={form.lastName} onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))} required />
        </div>
        <input className="w-full border rounded-lg px-4 py-3" placeholder="Email" type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} required />
        <input className="w-full border rounded-lg px-4 py-3" placeholder="Password" type="password" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} required />
        <input className="w-full border rounded-lg px-4 py-3" placeholder="Phone" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={captureAddress} onChange={(e) => setCaptureAddress(e.target.checked)} />
          Add my default delivery address now (recommended)
        </label>

        {captureAddress ? (
          <div className="space-y-3 rounded-xl border border-gray-200 p-4 bg-gray-50">
            <input className="w-full border rounded-lg px-4 py-2.5" placeholder="Address line 1" value={form.addressLine1} onChange={(e) => setForm((p) => ({ ...p, addressLine1: e.target.value }))} required={captureAddress} />
            <input className="w-full border rounded-lg px-4 py-2.5" placeholder="Address line 2" value={form.addressLine2} onChange={(e) => setForm((p) => ({ ...p, addressLine2: e.target.value }))} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input className="w-full border rounded-lg px-4 py-2.5" placeholder="City / Suburb" value={form.city} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))} required={captureAddress} />
              <input className="w-full border rounded-lg px-4 py-2.5" placeholder="Province / State" value={form.state} onChange={(e) => setForm((p) => ({ ...p, state: e.target.value }))} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input className="w-full border rounded-lg px-4 py-2.5" placeholder="Postal code" value={form.postalCode} onChange={(e) => setForm((p) => ({ ...p, postalCode: e.target.value }))} required={captureAddress} />
              <input className="w-full border rounded-lg px-4 py-2.5" placeholder="Country" value={form.country} onChange={(e) => setForm((p) => ({ ...p, country: e.target.value }))} required={captureAddress} />
            </div>
          </div>
        ) : null}

        <button className="w-full py-3 rounded-full bg-gradient-to-r from-pink-500 to-orange-500 text-white font-bold">Create account</button>
        {error ? <p className="text-sm text-red-500">{error}</p> : null}
      </form>
      <p className="text-sm mt-4">
        Already have account? <Link className="text-pink-600" to={`/account/login?next=${encodeURIComponent(next)}`}>Login</Link>
      </p>
    </div>
  );
}
