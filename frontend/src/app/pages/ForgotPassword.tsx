import { FormEvent, useState } from "react";
import { Link } from "react-router";
import { Mail, ArrowLeft } from "lucide-react";
import { API_BASE } from "../admin/api/client";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/customer/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error?.message || "Something went wrong. Please try again.");
      }
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-pink-100 to-orange-100 flex items-center justify-center mx-auto mb-4">
            <Mail size={28} className="text-pink-500" />
          </div>
          <h1 className="text-3xl font-black text-gray-900">Reset password</h1>
          <p className="text-gray-500 mt-2">
            {submitted
              ? "Check your inbox for the reset link."
              : "Enter your email and we'll send you a reset link."}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-8">
          {submitted ? (
            <div className="space-y-5">
              <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-4 text-sm text-green-700">
                <p className="font-semibold mb-1">Reset link sent</p>
                <p>If an account exists for <strong>{email}</strong>, you'll receive an email with instructions within a few minutes. Check your spam folder if it doesn't arrive.</p>
              </div>
              <p className="text-sm text-gray-500 text-center">
                The link expires after 60 minutes.
              </p>
              <button
                onClick={() => { setSubmitted(false); setEmail(""); }}
                className="w-full py-3 rounded-full border-2 border-gray-200 text-gray-700 font-medium hover:border-pink-300 transition-colors text-sm"
              >
                Send another link
              </button>
            </div>
          ) : (
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
                  autoFocus
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
                {loading ? "Sending…" : "Send Reset Link"}
              </button>
            </form>
          )}

          <div className="mt-6 text-center">
            <Link to="/account/login" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-pink-500 transition-colors">
              <ArrowLeft size={14} />
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
