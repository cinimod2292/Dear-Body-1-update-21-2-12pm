import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
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
  register: (input: { email: string; password: string; firstName?: string; lastName?: string; phone?: string }) => Promise<void>;
  logout: () => void;
  refreshSession: () => Promise<string | null>;
}

const STORAGE_KEY = "storefront_customer_session";
const WARNING_LEAD_MS = 5 * 60 * 1000;
const Ctx = createContext<CustomerAuthContextValue | undefined>(undefined);

interface StoredCustomerSession {
  token: string;
  refreshToken?: string;
  accessTokenExpiresAt?: string | null;
  refreshTokenExpiresAt?: string | null;
  customer: Customer;
}

function parseTime(input?: string | null) {
  if (!input) return null;
  const t = new Date(input).getTime();
  return Number.isNaN(t) ? null : t;
}

function decodeJwtExpiryMs(token?: string | null) {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length < 2) return null;

  try {
    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const payload = JSON.parse(atob(padded)) as { exp?: number };
    if (!payload.exp) return null;
    return payload.exp * 1000;
  } catch {
    return null;
  }
}

export function CustomerAuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{
    token: string | null;
    refreshToken: string | null;
    accessTokenExpiresAt: string | null;
    refreshTokenExpiresAt: string | null;
    customer: Customer | null;
  }>(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { token: null, refreshToken: null, accessTokenExpiresAt: null, refreshTokenExpiresAt: null, customer: null };
    try {
      const parsed = JSON.parse(raw) as Partial<StoredCustomerSession>;
      return {
        token: parsed.token ?? null,
        refreshToken: parsed.refreshToken ?? null,
        accessTokenExpiresAt: parsed.accessTokenExpiresAt ?? null,
        refreshTokenExpiresAt: parsed.refreshTokenExpiresAt ?? null,
        customer: parsed.customer ?? null,
      };
    } catch {
      return { token: null, refreshToken: null, accessTokenExpiresAt: null, refreshTokenExpiresAt: null, customer: null };
    }
  });

  const [showExpiryWarning, setShowExpiryWarning] = useState(false);
  const warningTimerRef = useRef<number | null>(null);
  const logoutTimerRef = useRef<number | null>(null);
  const refreshPromiseRef = useRef<Promise<string | null> | null>(null);

  const clearTimers = useCallback(() => {
    if (warningTimerRef.current) {
      window.clearTimeout(warningTimerRef.current);
      warningTimerRef.current = null;
    }
    if (logoutTimerRef.current) {
      window.clearTimeout(logoutTimerRef.current);
      logoutTimerRef.current = null;
    }
  }, []);

  const buildLoginUrl = useCallback((preservePath: boolean) => {
    const path = `${window.location.pathname}${window.location.search}`;
    const shouldPreserve = preservePath
      && path !== "/account/login"
      && path !== "/account/register";
    return shouldPreserve ? `/account/login?next=${encodeURIComponent(path)}` : "/account/login";
  }, []);

  const persist = useCallback((session: StoredCustomerSession | null) => {
    if (!session) {
      localStorage.removeItem(STORAGE_KEY);
      setState({
        token: null,
        refreshToken: null,
        accessTokenExpiresAt: null,
        refreshTokenExpiresAt: null,
        customer: null,
      });
      return;
    }

    const payload = {
      token: session.token,
      refreshToken: session.refreshToken ?? null,
      accessTokenExpiresAt: session.accessTokenExpiresAt ?? null,
      refreshTokenExpiresAt: session.refreshTokenExpiresAt ?? null,
      customer: session.customer,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    setState(payload);
  }, []);

  const clearSession = useCallback((redirectToLogin = false, preservePath = true) => {
    clearTimers();
    setShowExpiryWarning(false);
    persist(null);
    if (redirectToLogin) {
      window.location.assign(buildLoginUrl(preservePath));
    }
  }, [buildLoginUrl, clearTimers, persist]);

  const getAccessExpiryMs = useCallback(() => {
    return parseTime(state.accessTokenExpiresAt) ?? decodeJwtExpiryMs(state.token);
  }, [state.accessTokenExpiresAt, state.token]);

  const refreshSession = useCallback(async (): Promise<string | null> => {
    if (!state.refreshToken) {
      clearSession(true, true);
      return null;
    }

    const refreshExpiryMs = parseTime(state.refreshTokenExpiresAt) ?? decodeJwtExpiryMs(state.refreshToken);
    if (refreshExpiryMs && refreshExpiryMs <= Date.now()) {
      clearSession(true, true);
      return null;
    }

    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    const pending = (async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/customer/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: state.refreshToken }),
        });
        const payload = await res.json();
        if (!res.ok || !payload?.data?.accessToken) throw new Error(payload?.error?.message || "Session refresh failed");

        const session: StoredCustomerSession = {
          token: payload.data.accessToken,
          refreshToken: payload.data.refreshToken,
          accessTokenExpiresAt: payload.data.accessTokenExpiresAt ?? null,
          refreshTokenExpiresAt: payload.data.refreshTokenExpiresAt ?? null,
          customer: payload.data.customer,
        };
        setShowExpiryWarning(false);
        persist(session);
        return session.token;
      } catch {
        clearSession(true, true);
        return null;
      } finally {
        refreshPromiseRef.current = null;
      }
    })();

    refreshPromiseRef.current = pending;
    return pending;
  }, [clearSession, persist, state.refreshToken, state.refreshTokenExpiresAt]);

  const login = async (email: string, password: string) => {
    const res = await fetch(`${API_BASE}/auth/customer/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const payload = await res.json();
    if (!res.ok) throw new Error(payload?.error?.message || "Login failed");
    persist({
      token: payload.data.accessToken,
      refreshToken: payload.data.refreshToken,
      accessTokenExpiresAt: payload.data.accessTokenExpiresAt ?? null,
      refreshTokenExpiresAt: payload.data.refreshTokenExpiresAt ?? null,
      customer: payload.data.customer,
    });
  };

  const register = async (input: { email: string; password: string; firstName?: string; lastName?: string; phone?: string }) => {
    const res = await fetch(`${API_BASE}/auth/customer/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const payload = await res.json();
    if (!res.ok) throw new Error(payload?.error?.message || "Registration failed");
    persist({
      token: payload.data.accessToken,
      refreshToken: payload.data.refreshToken,
      accessTokenExpiresAt: payload.data.accessTokenExpiresAt ?? null,
      refreshTokenExpiresAt: payload.data.refreshTokenExpiresAt ?? null,
      customer: payload.data.customer,
    });
  };

  const logout = () => {
    clearSession(true, true);
  };

  useEffect(() => {
    if (!state.token || !state.customer) {
      clearTimers();
      setShowExpiryWarning(false);
      return;
    }

    const accessExpiryMs = getAccessExpiryMs();
    if (!accessExpiryMs) return;

    const now = Date.now();
    if (accessExpiryMs <= now) {
      void refreshSession();
      return;
    }

    const warningAtMs = accessExpiryMs - WARNING_LEAD_MS;
    const warningDelayMs = Math.max(warningAtMs - now, 0);
    const logoutDelayMs = Math.max(accessExpiryMs - now, 0);

    if (warningAtMs <= now) {
      setShowExpiryWarning(true);
    } else {
      warningTimerRef.current = window.setTimeout(() => {
        setShowExpiryWarning(true);
      }, warningDelayMs);
    }

    logoutTimerRef.current = window.setTimeout(() => {
      clearSession(true, true);
    }, logoutDelayMs);

    return clearTimers;
  }, [clearSession, clearTimers, getAccessExpiryMs, refreshSession, state.customer, state.token]);

  useEffect(() => {
    if (!state.token || !state.customer) return;
    const accessExpiryMs = getAccessExpiryMs();
    if (!accessExpiryMs) return;
    if (accessExpiryMs - Date.now() <= WARNING_LEAD_MS) {
      void refreshSession();
    }
  }, [getAccessExpiryMs, refreshSession, state.customer, state.token]);

  const value = useMemo(() => ({ customer: state.customer, token: state.token, login, register, logout, refreshSession }), [state.customer, state.token, refreshSession]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {showExpiryWarning && state.customer ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-black text-gray-900">Your session is about to expire</h3>
            <p className="mt-2 text-sm text-gray-600">
              You will be logged out soon for security. Stay logged in to keep shopping and manage your account.
            </p>
            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700"
                onClick={() => logout()}
              >
                Logout
              </button>
              <button
                type="button"
                className="rounded-lg bg-pink-600 px-4 py-2 text-sm font-medium text-white"
                onClick={async () => {
                  const refreshed = await refreshSession();
                  if (!refreshed) {
                    clearSession(true, true);
                  }
                }}
              >
                Stay logged in
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </Ctx.Provider>
  );
}

export function useCustomerAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCustomerAuth must be used within CustomerAuthProvider");
  return ctx;
}
