import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { apiRequest, registerAdminApiAuthHandlers } from "../api/client";
import { AdminSession } from "../types/admin";
import { toast } from "sonner";

const STORAGE_KEY = "dear-body-admin-session";
const WARNING_LEAD_MS = 5 * 60 * 1000;
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

function shouldAttemptRefreshOnLoad(session: AdminSession) {
  const expiresAt = getAccessExpiryMs(session);
  if (!expiresAt) return false;
  return expiresAt - Date.now() <= WARNING_LEAD_MS;
}

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [showExpiryWarning, setShowExpiryWarning] = useState(false);
  const [warningAcknowledgedForExpiry, setWarningAcknowledgedForExpiry] = useState<string | null>(null);

  const refreshPromiseRef = useRef<Promise<string | null> | null>(null);
  const warningTimerRef = useRef<number | null>(null);
  const refreshTimerRef = useRef<number | null>(null);
  const logoutTimerRef = useRef<number | null>(null);

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

    if (refreshTimerRef.current) {
      window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }

    if (logoutTimerRef.current) {
      window.clearTimeout(logoutTimerRef.current);
      logoutTimerRef.current = null;
    }
  }, []);

  const clearSessionWithMessage = useCallback((message?: string) => {
    clearTimers();
    setShowExpiryWarning(false);
    setWarningAcknowledgedForExpiry(null);
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
      authDebugLog("refresh_scheduled", {
        accessTokenExpiresAt: session.accessTokenExpiresAt ?? null,
        refreshTokenExpiresAt: session.refreshTokenExpiresAt ?? null,
      });
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
        setWarningAcknowledgedForExpiry(null);
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
      const parsed = JSON.parse(raw) as AdminSession;
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

    const accessExpiryMs = getAccessExpiryMs(session);
    if (!accessExpiryMs) return;

    const warningAt = accessExpiryMs - WARNING_LEAD_MS;
    const now = Date.now();
    const refreshExpiryMs = getRefreshExpiryMs(session);
    const shouldShowWarningForRefreshExpiry = !session.refreshToken
      || (refreshExpiryMs ? refreshExpiryMs - now <= WARNING_LEAD_MS : false);
    const timeUntilWarningMs = Math.max(warningAt - now, 0);
    const timeUntilLogoutMs = Math.max(accessExpiryMs - now, 0);

    authDebugLog("timers_calculated", {
      accessTokenExpiresAt: new Date(accessExpiryMs).toISOString(),
      refreshTokenExpiresAt: refreshExpiryMs ? new Date(refreshExpiryMs).toISOString() : null,
      timeUntilWarningMs,
      timeUntilLogoutMs,
      shouldShowWarningForRefreshExpiry,
    });

    const expiryCycleKey = session.accessTokenExpiresAt ?? new Date(accessExpiryMs).toISOString();

    if (shouldShowWarningForRefreshExpiry && warningAt <= now && warningAcknowledgedForExpiry !== expiryCycleKey) {
      setShowExpiryWarning(true);
      setWarningAcknowledgedForExpiry(expiryCycleKey);
      authDebugLog("warning_shown", { reason: "near_access_expiry" });
    } else {
      const warningDelay = warningAt - now;
      if (warningDelay > 0 && shouldShowWarningForRefreshExpiry) {
        warningTimerRef.current = window.setTimeout(() => {
          setShowExpiryWarning(true);
          setWarningAcknowledgedForExpiry(expiryCycleKey);
          authDebugLog("warning_shown", { reason: "warning_timer_elapsed" });
        }, warningDelay);
      }
    }

    if (!shouldShowWarningForRefreshExpiry && session.refreshToken) {
      const refreshDelay = Math.max(accessExpiryMs - now - WARNING_LEAD_MS, 0);
      refreshTimerRef.current = window.setTimeout(() => {
        void refreshSession();
      }, refreshDelay);
      authDebugLog("refresh_scheduled", { refreshDelayMs: refreshDelay });
    } else {
      setShowExpiryWarning((existing) => (shouldShowWarningForRefreshExpiry ? existing : false));
    }

    logoutTimerRef.current = window.setTimeout(() => {
      authDebugLog("auto_logout_triggered", { reason: "access_token_expired" });
      void refreshSession();
    }, timeUntilLogoutMs);

    return clearTimers;
  }, [session, clearTimers, refreshSession, warningAcknowledgedForExpiry]);

  useEffect(() => {
    if (!session || loading) return;

    if (shouldAttemptRefreshOnLoad(session)) {
      void refreshSession();
      return;
    }

    const accessExpiryMs = getAccessExpiryMs(session);
    if (accessExpiryMs && accessExpiryMs <= Date.now()) {
      void refreshSession();
    }
  }, [session, loading, refreshSession]);

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
          <p className="mt-1 text-sm text-amber-800">Stay signed in to keep working without interruption.</p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white"
              onClick={async () => {
                const refreshed = await refreshSession();
                if (!refreshed) {
                  clearSessionWithMessage("Your session expired. Please sign in again.");
                }
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
