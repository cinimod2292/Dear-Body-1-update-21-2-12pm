import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { apiRequest } from "../api/client";
import { AdminSession } from "../types/admin";

const STORAGE_KEY = "dear-body-admin-session";

interface LoginInput {
  email: string;
  password: string;
}

interface AdminAuthContextValue {
  session: AdminSession | null;
  loading: boolean;
  login: (input: LoginInput) => Promise<void>;
  logout: () => void;
  refreshMe: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextValue | undefined>(undefined);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      setLoading(false);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as AdminSession;
      setSession(parsed);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setLoading(false);
    }
  }, []);

  const persist = (next: AdminSession | null) => {
    setSession(next);
    if (!next) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const login = async ({ email, password }: LoginInput) => {
    const response = await apiRequest<{ data: { accessToken: string; refreshToken: string; permissions: string[] } }>("/auth/admin/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    const me = await apiRequest<{ data: { id: string; email: string; role: string; permissions: string[] } }>("/auth/admin/me", {}, response.data.accessToken);

    persist({
      accessToken: response.data.accessToken,
      refreshToken: response.data.refreshToken,
      permissions: me.data.permissions,
      email: me.data.email,
      role: me.data.role,
      id: me.data.id,
    });
  };

  const logout = () => persist(null);

  const refreshMe = async () => {
    if (!session?.accessToken) return;
    const me = await apiRequest<{ data: { id: string; email: string; role: string; permissions: string[] } }>("/auth/admin/me", {}, session.accessToken);
    persist({
      ...session,
      permissions: me.data.permissions,
      email: me.data.email,
      role: me.data.role,
      id: me.data.id,
    });
  };

  const value = useMemo(() => ({ session, loading, login, logout, refreshMe }), [session, loading]);

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used within AdminAuthProvider");
  return ctx;
}
