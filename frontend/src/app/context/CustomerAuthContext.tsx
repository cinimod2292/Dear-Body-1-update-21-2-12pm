import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { API_BASE } from "../lib/api";

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
const STOREFRONT_INACTIVITY_TIMEOUT_MS = 4 * 60 * 60 * 1000;
const WARNING_LEAD_MS = 5 * 60 * 1000;
const USER_ACTIVITY_EVENTS: Array<keyof WindowEventMap> = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"];
const Ctx = createContext<CustomerAuthContextValue | undefined>(undefined);

interface StoredCustomerSession {
  token: string;
  refreshToken?: string;
  accessTokenExpiresAt?: string | null;
  refreshTokenExpiresAt?: string | null;
  customer: Customer;
}

const emptySessionState = {
  token: null,
  refreshToken: null,
  accessTokenExpiresAt: null,
  refreshTokenExpiresAt: null,
  customer: null,
} as const;

function parseStoredSession(raw: string | null) {
  if (!raw) return emptySessionState;
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
    return emptySessionState;
  }
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

function isStorefrontPath(pathname: string) {
  return !pathname.startsWith("/admin");
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
    return parseStoredSession(raw);
  });

  const [showExpiryWarning, setShowExpiryWarning] = useState(false);
  const warningTimerRef = useRef<number | null>(null);
  const inactivityLogoutTimerRef = useRef<number | null>(null);
  const tokenRefreshTimerRef = useRef<number | null>(null);
  const refreshPromiseRef = useRef<Promise<string | null> | null>(null);

  const clearTimers = useCallback(() => {
    if (warningTimerRef.current) {
      window.clearTimeout(warningTimerRef.current);
      warningTimerRef.current = null;
    }
    if (inactivityLogoutTimerRef.current) {
      window.clearTimeout(inactivityLogoutTimerRef.current);
      inactivityLogoutTimerRef.current = null;
    }
    if (tokenRefreshTimerRef.current) {
      window.clearTimeout(tokenRefreshTimerRef.current);
      tokenRefreshTimerRef.current = null;
    }
  }, []);

  const buildLoginUrl = useCallback((preservePath: boolean) => {
    const path = `${window.location.pathname}${window.location.search}`;
    const onStorefront = isStorefrontPath(window.location.pathname);
    if (!onStorefront) return null;

    const shouldPreserve = preservePath
      && path !== "/account/login"
      && path !== "/account/register";
    return shouldPreserve ? `/account/login?next=${encodeURIComponent(path)}` : "/account/login";
  }, []);

  const persist = useCallback((session: StoredCustomerSession | null) => {
    if (!session) {
      localStorage.removeItem(STORAGE_KEY);
      setState(emptySessionState);
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
      const redirectTarget = buildLoginUrl(preservePath);
      if (redirectTarget) {
        window.location.assign(redirectTarget);
      }
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

  const resetInactivityTimer = useCallback(() => {
    if (!state.token || !state.customer) return;

    if (warningTimerRef.current) {
      window.clearTimeout(warningTimerRef.current);
      warningTimerRef.current = null;
    }

    if (inactivityLogoutTimerRef.current) {
      window.clearTimeout(inactivityLogoutTimerRef.current);
      inactivityLogoutTimerRef.current = null;
    }

    setShowExpiryWarning(false);

    warningTimerRef.current = window.setTimeout(() => {
      setShowExpiryWarning(true);
    }, STOREFRONT_INACTIVITY_TIMEOUT_MS - WARNING_LEAD_MS);

    inactivityLogoutTimerRef.current = window.setTimeout(() => {
      clearSession(true, true);
    }, STOREFRONT_INACTIVITY_TIMEOUT_MS);
  }, [clearSession, state.customer, state.token]);

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

    resetInactivityTimer();

    const handleUserActivity = () => {
      resetInactivityTimer();
    };

    for (const eventName of USER_ACTIVITY_EVENTS) {
      window.addEventListener(eventName, handleUserActivity, { passive: true });
    }

    return () => {
      for (const eventName of USER_ACTIVITY_EVENTS) {
        window.removeEventListener(eventName, handleUserActivity);
      }
      clearTimers();
    };
  }, [clearTimers, resetInactivityTimer, state.customer, state.token]);

  useEffect(() => {
    if (!state.token || !state.customer) return;
    const accessExpiryMs = getAccessExpiryMs();
    if (!accessExpiryMs) return;

    const now = Date.now();
    if (accessExpiryMs <= now) {
      void refreshSession();
      return;
    }

    const refreshInMs = Math.max(accessExpiryMs - now - WARNING_LEAD_MS, 0);
    tokenRefreshTimerRef.current = window.setTimeout(() => {
      void refreshSession();
    }, refreshInMs);

    return () => {
      if (tokenRefreshTimerRef.current) {
        window.clearTimeout(tokenRefreshTimerRef.current);
        tokenRefreshTimerRef.current = null;
      }
    };
  }, [getAccessExpiryMs, refreshSession, state.customer, state.token]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;

      const next = parseStoredSession(event.newValue);
      clearTimers();
      setShowExpiryWarning(false);
      setState(next);
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [clearTimers]);

  const value = useMemo(() => ({ customer: state.customer, token: state.token, login, register, logout, refreshSession }), [state.customer, state.token, refreshSession]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {showExpiryWarning && state.customer && isStorefrontPath(window.location.pathname) ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-black text-gray-900">Your session is about to expire</h3>
            <p className="mt-2 text-sm text-gray-600">
              You've been inactive for a while. You will be logged out soon for security.
            </p>
            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700"
                onClick={() => logout()}
              >
                Log out
              </button>
              <button
                type="button"
                className="rounded-lg bg-pink-600 px-4 py-2 text-sm font-medium text-white"
                onClick={async () => {
                  const refreshed = await refreshSession();
                  if (!refreshed) {
                    clearSession(true, true);
                    return;
                  }
                  resetInactivityTimer();
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
