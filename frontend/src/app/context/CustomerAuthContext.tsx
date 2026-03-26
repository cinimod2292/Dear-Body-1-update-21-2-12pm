import { createContext, ReactNode, useContext, useMemo, useState } from "react";
import { API_BASE } from "../admin/api/client";

interface Customer {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
}

interface CustomerAuthContextValue {
  customer: Customer | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (input: { email: string; password: string; firstName?: string; lastName?: string; phone?: string; address?: { recipientName?: string; line1: string; line2?: string; city: string; state?: string; postalCode: string; country: string; phone?: string } }) => Promise<void>;
  logout: () => void;
}

const STORAGE_KEY = "storefront_customer_session";
const Ctx = createContext<CustomerAuthContextValue | undefined>(undefined);

export function CustomerAuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ token: string | null; customer: Customer | null }>(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { token: null, customer: null };
    try {
      return JSON.parse(raw);
    } catch {
      return { token: null, customer: null };
    }
  });

  const persist = (token: string, customer: Customer) => {
    const payload = { token, customer };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    setState(payload);
  };

  const login = async (email: string, password: string) => {
    const res = await fetch(`${API_BASE}/auth/customer/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const payload = await res.json();
    if (!res.ok) throw new Error(payload?.error?.message || "Login failed");
    persist(payload.data.accessToken, payload.data.customer);
  };

  const register = async (input: { email: string; password: string; firstName?: string; lastName?: string; phone?: string; address?: { recipientName?: string; line1: string; line2?: string; city: string; state?: string; postalCode: string; country: string; phone?: string } }) => {
    const res = await fetch(`${API_BASE}/auth/customer/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const payload = await res.json();
    if (!res.ok) throw new Error(payload?.error?.message || "Registration failed");
    persist(payload.data.accessToken, payload.data.customer);
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setState({ token: null, customer: null });
  };

  const value = useMemo(() => ({ customer: state.customer, token: state.token, login, register, logout }), [state]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCustomerAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCustomerAuth must be used within CustomerAuthProvider");
  return ctx;
}
