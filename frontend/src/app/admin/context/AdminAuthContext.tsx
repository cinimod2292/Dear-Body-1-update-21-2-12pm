import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { apiRequest, registerAdminApiAuthHandlers } from "../api/client";
import { AdminSession } from "../types/admin";
import { toast } from "sonner";

const STORAGE_KEY = "dear-body-admin-session";
const ADMIN_INACTIVITY_TIMEOUT_MS = 4 * 60 * 60 * 1000;
const WARNING_LEAD_MS = 5 * 60 * 1000;
const USER_ACTIVITY_EVENTS: Array<keyof WindowEventMap> = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"];
const DEBUG_ADMIN_AUTH = import.meta.env.DEV || import.meta.env.VITE_ADMIN_AUTH_DEBUG === "true";

interface LoginInput {
  email: string;
  password: string;
}

interface AuthTokenResponse {
  data: {
    accessToken: string;
    refreshToken: string;
    permissions: string[];
    accessTokenExpiresAt?: string;
    refreshTokenExpiresAt?: string;
  };
}

interface AdminAuthContextValue {
  session: AdminSession | null;
  loading: boolean;
  login: (input: LoginInput) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
  refreshSession: () => Promise<string | null>;
}

const AdminAuthContext = createContext<AdminAuthContextValue | undefined>(undefined);

function getTime(input?: string) {
  if (!input) return null;
  const timestamp = new Date(input).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

function decodeJwtExpiryMs(token?: string) {
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

function getAccessExpiryMs(session: AdminSession) {
  return getTime(session.accessTokenExpiresAt) ?? decodeJwtExpiryMs(session.accessToken);
}

function getRefreshExpiryMs(session: AdminSession) {
  return getTime(session.refreshTokenExpiresAt) ?? decodeJwtExpiryMs(session.refreshToken);
}

function authDebugLog(event: string, details?: Record<string, unknown>) {
  if (!DEBUG_ADMIN_AUTH) return;
  console.info("[admin-auth]", event, details ?? {});
}

function parseStoredAdminSession(raw: string | null): AdminSession | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AdminSession;
  } catch {
    return null;
  }
}

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [showExpiryWarning, setShowExpiryWarning] = useState(false);

  const refreshPromiseRef = useRef<Promise<string | null> | null>(null);
  const warningTimerRef = useRef<number | null>(null);
  const inactivityLogoutTimerRef = useRef<number | null>(null);
  const tokenRefreshTimerRef = useRef<number | null>(null);

  const persist = useCallback((next: AdminSession | null) => {
    setSession(next);
    if (!next) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

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

  const clearSessionWithMessage = useCallback((message?: string) => {
    clearTimers();
    setShowExpiryWarning(false);
    persist(null);

    if (window.location.pathname.startsWith("/admin") && window.location.pathname !== "/admin/login") {
      if (message) toast.error(message);
      window.location.assign("/admin/login");
    }
  }, [clearTimers, persist]);

  const refreshSession = useCallback(async (): Promise<string | null> => {
    if (!session?.refreshToken) return null;

    const refreshExpiresAt = getRefreshExpiryMs(session);
    if (refreshExpiresAt && refreshExpiresAt <= Date.now()) {
      authDebugLog("auto_logout_triggered", { reason: "refresh_token_expired" });
      clearSessionWithMessage("Your session expired. Please sign in again.");
      return null;
    }

    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    const pendingRefresh = (async () => {
      try {
        const response = await apiRequest<AuthTokenResponse>("/auth/admin/refresh", {
          method: "POST",
          body: JSON.stringify({ refreshToken: session.refreshToken }),
        });

        const me = await apiRequest<{ data: { id: string; email: string; role: string; permissions: string[] } }>("/auth/admin/me", {}, response.data.accessToken);

        const nextSession: AdminSession = {
          accessToken: response.data.accessToken,
          refreshToken: response.data.refreshToken,
          accessTokenExpiresAt: response.data.accessTokenExpiresAt,
          refreshTokenExpiresAt: response.data.refreshTokenExpiresAt,
          permissions: me.data.permissions,
          email: me.data.email,
          role: me.data.role,
          id: me.data.id,
        };

        setShowExpiryWarning(false);
        persist(nextSession);
        authDebugLog("refresh_succeeded", {
          accessTokenExpiresAt: nextSession.accessTokenExpiresAt ?? null,
          refreshTokenExpiresAt: nextSession.refreshTokenExpiresAt ?? null,
        });
        return nextSession.accessToken;
      } catch {
        authDebugLog("refresh_failed");
        clearSessionWithMessage("Your session expired. Please sign in again.");
        return null;
      } finally {
        refreshPromiseRef.current = null;
      }
    })();

    refreshPromiseRef.current = pendingRefresh;
    return pendingRefresh;
  }, [session, clearSessionWithMessage, persist]);

  const resetInactivityTimer = useCallback(() => {
    if (!session) return;

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
      authDebugLog("warning_shown", { reason: "inactivity_warning_timer_elapsed" });
    }, ADMIN_INACTIVITY_TIMEOUT_MS - WARNING_LEAD_MS);

    inactivityLogoutTimerRef.current = window.setTimeout(() => {
      authDebugLog("auto_logout_triggered", { reason: "inactivity_timeout_elapsed" });
      clearSessionWithMessage("You were signed out due to inactivity.");
    }, ADMIN_INACTIVITY_TIMEOUT_MS);
  }, [clearSessionWithMessage, session]);

  const logout = useCallback(async () => {
    try {
      if (session?.refreshToken) {
        await apiRequest("/auth/admin/logout", {
          method: "POST",
          body: JSON.stringify({ refreshToken: session.refreshToken }),
        });
      }
    } catch {
      // Ignore logout transport errors and always clear local session.
    } finally {
      clearSessionWithMessage();
    }
  }, [session?.refreshToken, clearSessionWithMessage]);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      setLoading(false);
      return;
    }

    try {
      const parsed = parseStoredAdminSession(raw);
      if (!parsed) throw new Error("invalid_admin_session");
      setSession(parsed);
      authDebugLog("session_loaded", {
        hasAccessTokenExpiry: Boolean(parsed.accessTokenExpiresAt),
        accessTokenExpiresAt: parsed.accessTokenExpiresAt ?? null,
        inferredAccessTokenExpiry: decodeJwtExpiryMs(parsed.accessToken)
          ? new Date(decodeJwtExpiryMs(parsed.accessToken) as number).toISOString()
          : null,
      });
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!session) {
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
  }, [clearTimers, resetInactivityTimer, session]);

  useEffect(() => {
    if (!session || loading) return;
    const accessExpiryMs = getAccessExpiryMs(session);
    if (!accessExpiryMs) return;

    const now = Date.now();
    if (accessExpiryMs <= now) {
      void refreshSession();
      return;
    }

    const refreshInMs = Math.max(accessExpiryMs - now - WARNING_LEAD_MS, 0);
    tokenRefreshTimerRef.current = window.setTimeout(() => {
      authDebugLog("token_refresh_scheduled", { refreshInMs });
      void refreshSession();
    }, refreshInMs);

    return () => {
      if (tokenRefreshTimerRef.current) {
        window.clearTimeout(tokenRefreshTimerRef.current);
        tokenRefreshTimerRef.current = null;
      }
    };
  }, [session, loading, refreshSession]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      clearTimers();
      setShowExpiryWarning(false);

      const next = parseStoredAdminSession(event.newValue);
      if (!next) {
        setSession(null);
        return;
      }

      setSession(next);
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [clearTimers]);

  useEffect(() => {
    registerAdminApiAuthHandlers({
      getSessionToken: () => session,
      refreshSession,
      onHardAuthFailure: () => clearSessionWithMessage("Your session expired. Please sign in again."),
    });

    return () => registerAdminApiAuthHandlers(null);
  }, [session, refreshSession, clearSessionWithMessage]);

  const login = async ({ email, password }: LoginInput) => {
    const response = await apiRequest<AuthTokenResponse>("/auth/admin/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    const me = await apiRequest<{ data: { id: string; email: string; role: string; permissions: string[] } }>("/auth/admin/me", {}, response.data.accessToken);

    persist({
      accessToken: response.data.accessToken,
      refreshToken: response.data.refreshToken,
      accessTokenExpiresAt: response.data.accessTokenExpiresAt,
      refreshTokenExpiresAt: response.data.refreshTokenExpiresAt,
      permissions: me.data.permissions,
      email: me.data.email,
      role: me.data.role,
      id: me.data.id,
    });
  };

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

  const value = useMemo(() => ({ session, loading, login, logout, refreshMe, refreshSession }), [session, loading, logout, refreshSession]);

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
      {showExpiryWarning && Boolean(session) && window.location.pathname.startsWith("/admin") && window.location.pathname !== "/admin/login" ? (
        <div className="fixed bottom-4 right-4 z-50 w-full max-w-sm rounded-xl border border-amber-300 bg-amber-50 p-4 shadow-lg">
          <p className="font-semibold text-amber-900">Your session is about to expire.</p>
          <p className="mt-1 text-sm text-amber-800">You have been inactive. Stay signed in to keep working without interruption.</p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white"
              onClick={async () => {
                const refreshed = await refreshSession();
                if (!refreshed) {
                  clearSessionWithMessage("Your session expired. Please sign in again.");
                  return;
                }
                resetInactivityTimer();
              }}
            >
              Stay signed in
            </button>
            <button
              type="button"
              className="rounded-lg border border-amber-400 px-3 py-2 text-sm font-medium text-amber-900"
              onClick={() => {
                void logout();
              }}
            >
              Log out
            </button>
          </div>
        </div>
      ) : null}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used within AdminAuthProvider");
  return ctx;
}
