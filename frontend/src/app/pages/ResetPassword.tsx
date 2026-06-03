import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Lock, CheckCircle } from "lucide-react";
import { API_BASE } from "../admin/api/client";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Choose New Password — Dear Body";
  }, []);

  const mismatch = confirm.length > 0 && password !== confirm;
  const tooShort = password.length > 0 && password.length < 8;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords do not match."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (!token) { setError("Missing reset token. Please use the link from your email."); return; }

    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/customer/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.error?.message || "Reset failed. The link may have expired.");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md text-center">
          <div className="bg-white rounded-2xl shadow-sm p-8">
            <p className="text-gray-700 mb-4">This reset link is invalid or incomplete.</p>
            <Link to="/account/forgot-password" className="inline-block px-6 py-3 bg-gradient-to-r from-pink-500 to-orange-500 text-white rounded-full font-bold hover:opacity-90 transition-opacity">
              Request a new link
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-pink-100 to-orange-100 flex items-center justify-center mx-auto mb-4">
            {done ? <CheckCircle size={28} className="text-green-500" /> : <Lock size={28} className="text-pink-500" />}
          </div>
          <h1 className="text-3xl font-black text-gray-900">{done ? "Password updated" : "Choose new password"}</h1>
          <p className="text-gray-500 mt-2">
            {done ? "Your password has been changed successfully." : "Enter a new password for your account."}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-8">
          {done ? (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700">
                You can now sign in with your new password.
              </div>
              <button
                onClick={() => navigate("/account/login")}
                className="w-full py-3.5 rounded-full bg-gradient-to-r from-pink-500 to-orange-500 text-white font-bold text-base hover:opacity-90 transition-opacity"
              >
                Sign In
              </button>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={submit}>
              <div>
                <div className="relative">
                  <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    className={`w-full pl-11 pr-4 py-3.5 border rounded-xl focus:outline-none text-gray-900 placeholder-gray-400 ${tooShort ? "border-red-300 focus:border-red-400" : "border-gray-200 focus:border-pink-400"}`}
                    placeholder="New password"
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    autoFocus
                  />
                </div>
                {tooShort && <p className="text-xs text-red-500 mt-1.5 ml-1">At least 8 characters required</p>}
              </div>

              <div>
                <div className="relative">
                  <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    className={`w-full pl-11 pr-4 py-3.5 border rounded-xl focus:outline-none text-gray-900 placeholder-gray-400 ${mismatch ? "border-red-300 focus:border-red-400" : "border-gray-200 focus:border-pink-400"}`}
                    placeholder="Confirm new password"
                    type="password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    required
                    autoComplete="new-password"
                  />
                </div>
                {mismatch && <p className="text-xs text-red-500 mt-1.5 ml-1">Passwords do not match</p>}
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  <p className="text-sm text-red-600">{error}</p>
                  {error.includes("expired") && (
                    <Link to="/account/forgot-password" className="text-sm text-pink-600 font-medium hover:underline mt-1 block">
                      Request a new link →
                    </Link>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || mismatch || tooShort}
                className="w-full py-3.5 rounded-full bg-gradient-to-r from-pink-500 to-orange-500 text-white font-bold text-base hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? "Updating…" : "Update Password"}
              </button>
            </form>
          )}

          {!done && (
            <div className="mt-6 text-center">
              <Link to="/account/forgot-password" className="text-sm text-gray-500 hover:text-pink-500 transition-colors">
                Need a new link?
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
