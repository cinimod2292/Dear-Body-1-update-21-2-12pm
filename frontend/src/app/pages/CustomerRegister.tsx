import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useCustomerAuth } from "../context/CustomerAuthContext";
import { Lock, Mail, User, Phone } from "lucide-react";

export default function CustomerRegister() {
  const { register } = useCustomerAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") || "/account";

  useEffect(() => {
    document.title = "Create Account — Dear Body";
  }, []);

  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", password: "", phone: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const update = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register(form);
      navigate(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-pink-100 to-orange-100 flex items-center justify-center mx-auto mb-4">
            <User size={28} className="text-pink-500" />
          </div>
          <h1 className="text-3xl font-black text-gray-900">Create account</h1>
          <p className="text-gray-500 mt-2">Join Dear Body and start shopping</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-8">
          <form className="space-y-4" onSubmit={submit}>
            <div className="grid grid-cols-2 gap-3">
              <div className="relative">
                <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  className="w-full pl-10 pr-3 py-3.5 border border-gray-200 rounded-xl focus:outline-none focus:border-pink-400 text-gray-900 placeholder-gray-400 text-sm"
                  placeholder="First name"
                  type="text"
                  value={form.firstName}
                  onChange={e => update("firstName", e.target.value)}
                  required
                  autoComplete="given-name"
                />
              </div>
              <div className="relative">
                <input
                  className="w-full px-3 py-3.5 border border-gray-200 rounded-xl focus:outline-none focus:border-pink-400 text-gray-900 placeholder-gray-400 text-sm"
                  placeholder="Last name"
                  type="text"
                  value={form.lastName}
                  onChange={e => update("lastName", e.target.value)}
                  required
                  autoComplete="family-name"
                />
              </div>
            </div>

            <div className="relative">
              <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className="w-full pl-11 pr-4 py-3.5 border border-gray-200 rounded-xl focus:outline-none focus:border-pink-400 text-gray-900 placeholder-gray-400"
                placeholder="Email address"
                type="email"
                value={form.email}
                onChange={e => update("email", e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="relative">
              <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className="w-full pl-11 pr-4 py-3.5 border border-gray-200 rounded-xl focus:outline-none focus:border-pink-400 text-gray-900 placeholder-gray-400"
                placeholder="Phone number (optional)"
                type="tel"
                value={form.phone}
                onChange={e => update("phone", e.target.value)}
                autoComplete="tel"
              />
            </div>

            <div className="relative">
              <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className="w-full pl-11 pr-4 py-3.5 border border-gray-200 rounded-xl focus:outline-none focus:border-pink-400 text-gray-900 placeholder-gray-400"
                placeholder="Password"
                type="password"
                value={form.password}
                onChange={e => update("password", e.target.value)}
                required
                autoComplete="new-password"
                minLength={8}
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-full bg-gradient-to-r from-pink-500 to-orange-500 text-white font-bold text-base hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            >
              {loading ? "Creating account…" : "Create Account"}
            </button>
          </form>

          <p className="text-sm text-center text-gray-500 mt-6">
            Already have an account?{" "}
            <Link
              className="text-pink-600 font-medium hover:underline"
              to={`/account/login?next=${encodeURIComponent(next)}`}
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
