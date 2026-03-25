import { FormEvent, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useCustomerAuth } from "../context/CustomerAuthContext";

export default function CustomerRegister() {
  const { register } = useCustomerAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") || "/checkout";
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", password: "", phone: "" });
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await register(form);
      navigate(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    }
  };

  return <div className="max-w-md mx-auto px-4 py-12"><h1 className="text-2xl font-black mb-6">Create Account</h1><form className="space-y-4" onSubmit={submit}>{Object.entries(form).map(([k,v])=><input key={k} className="w-full border rounded-lg px-4 py-3" placeholder={k} type={k==='password'?'password':'text'} value={v} onChange={(e)=>setForm((p)=>({...p,[k]:e.target.value}))} required={k==='email'||k==='password'||k==='firstName'||k==='lastName'} />)}<button className="w-full py-3 rounded-full bg-gradient-to-r from-pink-500 to-orange-500 text-white font-bold">Create account</button>{error ? <p className="text-sm text-red-500">{error}</p> : null}</form><p className="text-sm mt-4">Already have account? <Link className="text-pink-600" to={`/account/login?next=${encodeURIComponent(next)}`}>Login</Link></p></div>;
}
