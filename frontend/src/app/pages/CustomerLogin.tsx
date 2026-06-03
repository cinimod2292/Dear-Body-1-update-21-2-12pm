import { FormEvent, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useCustomerAuth } from "../context/CustomerAuthContext";
import { Lock, Mail } from "lucide-react";

export default function CustomerLogin() {
  const { login } = useCustomerAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const next = params.get("next") || "/account";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed. Please check your email and password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-pink-100 to-orange-100 flex items-center justify-center mx-auto mb-4">
            <Lock size={28} className="text-pink-500" />
          </div>
          <h1 className="text-3xl font-black text-gray-900">Welcome back</h1>
          <p className="text-gray-500 mt-2">Sign in to your Dear Body account</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-8">
          <form className="space-y-5" onSubmit={submit}>
            <div className="relative">
              <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className="w-full pl-11 pr-4 py-3.5 border border-gray-200 rounded-xl focus:outline-none focus:border-pink-400 text-gray-900 placeholder-gray-400"
                placeholder="Email address"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="relative">
              <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className="w-full pl-11 pr-4 py-3.5 border border-gray-200 rounded-xl focus:outline-none focus:border-pink-400 text-gray-900 placeholder-gray-400"
                placeholder="Password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
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
              className="w-full py-3.5 rounded-full bg-gradient-to-r from-pink-500 to-orange-500 text-white font-bold text-base hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>

          <div className="mt-6 flex flex-col items-center gap-3 text-sm text-gray-500">
            <Link to="/account/forgot-password" className="text-pink-600 hover:underline">
              Forgot your password?
            </Link>
            <p>
              No account?{" "}
              <Link
                className="text-pink-600 font-medium hover:underline"
                to={`/account/register?next=${encodeURIComponent(next)}`}
              >
                Create one
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
