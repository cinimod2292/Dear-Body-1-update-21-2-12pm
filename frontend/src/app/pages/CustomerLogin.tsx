import { FormEvent, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useCustomerAuth } from "../context/CustomerAuthContext";

export default function CustomerLogin() {
  const { login } = useCustomerAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const next = params.get("next") || "/checkout";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password);
      navigate(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    }
  };

  return <div className="max-w-md mx-auto px-4 py-12"><h1 className="text-2xl font-black mb-6">Customer Login</h1><form className="space-y-4" onSubmit={submit}><input className="w-full border rounded-lg px-4 py-3" placeholder="Email" type="email" value={email} onChange={(e)=>setEmail(e.target.value)} required /><input className="w-full border rounded-lg px-4 py-3" placeholder="Password" type="password" value={password} onChange={(e)=>setPassword(e.target.value)} required /><button className="w-full py-3 rounded-full bg-gradient-to-r from-pink-500 to-orange-500 text-white font-bold">Login</button>{error ? <p className="text-sm text-red-500">{error}</p> : null}</form><p className="text-sm mt-4">No account? <Link className="text-pink-600" to={`/account/register?next=${encodeURIComponent(next)}`}>Register</Link></p></div>;
}
