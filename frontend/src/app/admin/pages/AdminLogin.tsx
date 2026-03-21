import { FormEvent, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { useAdminAuth } from "../context/AdminAuthContext";
import { toast } from "sonner";

export default function AdminLogin() {
  const { login } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const redirectTo = (location.state as { from?: string } | undefined)?.from || "/admin";

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      await login({ email, password });
      toast.success("Signed in successfully");
      navigate(redirectTo, { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to sign in");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <form onSubmit={onSubmit} className="w-full max-w-md bg-white border border-gray-200 rounded-2xl p-7 shadow-sm">
        <p className="text-xs uppercase tracking-wide text-gray-400 mb-2">Dear Body</p>
        <h1 className="text-2xl font-black text-gray-900 mb-1">Admin Login</h1>
        <p className="text-sm text-gray-500 mb-6">Sign in to manage products, media, inventory, and settings.</p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-3"
              placeholder="admin@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-3"
              placeholder="••••••••"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-6 w-full bg-gradient-to-r from-pink-500 to-orange-500 text-white rounded-xl py-3 font-semibold disabled:opacity-70"
        >
          {isSubmitting ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </div>
  );
}
