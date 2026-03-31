const RAW_API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";
const RAW_API_PREFIX = import.meta.env.VITE_API_PREFIX ?? "/api";

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

function normalizePathPrefix(prefix: string): string {
  const trimmed = prefix.trim();
  if (!trimmed) return "";
  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withLeadingSlash.replace(/\/+$/, "");
}

function buildApiBase(baseUrl: string, pathPrefix: string): string {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const normalizedPathPrefix = normalizePathPrefix(pathPrefix);

  if (!normalizedPathPrefix) return normalizedBaseUrl;
  if (normalizedBaseUrl.endsWith(normalizedPathPrefix)) return normalizedBaseUrl;

  return `${normalizedBaseUrl}${normalizedPathPrefix}`;
}

const API_BASE = buildApiBase(RAW_API_BASE, RAW_API_PREFIX);
const AUTH_REFRESH_PATH = "/auth/admin/refresh";

type AdminAuthSession = {
  accessToken: string;
  refreshToken?: string;
};

type AdminAuthHandlers = {
  getSessionToken: () => AdminAuthSession | null;
  refreshSession: () => Promise<string | null>;
  onHardAuthFailure: () => void;
};

let adminAuthHandlers: AdminAuthHandlers | null = null;

export function registerAdminApiAuthHandlers(handlers: AdminAuthHandlers | null) {
  adminAuthHandlers = handlers;
}

async function parseJsonSafe(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export async function apiRequest<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const makeRequest = async (requestToken?: string) => {
    const headers = new Headers(options.headers);
    if (options.body !== undefined && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    if (requestToken) headers.set("Authorization", `Bearer ${requestToken}`);

    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });

    const payload = await parseJsonSafe(response);
    return { response, payload };
  };

  const initialToken = token ?? adminAuthHandlers?.getSessionToken()?.accessToken;
  let { response, payload } = await makeRequest(initialToken);

  const isUnauthorized = response.status === 401;
  const isRefreshCall = path === AUTH_REFRESH_PATH;
  const canTryRefresh = isUnauthorized && !isRefreshCall && Boolean(adminAuthHandlers?.getSessionToken()?.refreshToken);

  if (canTryRefresh) {
    try {
      const refreshedAccessToken = await adminAuthHandlers?.refreshSession();
      if (refreshedAccessToken) {
        ({ response, payload } = await makeRequest(refreshedAccessToken));
      }
    } catch {
      adminAuthHandlers?.onHardAuthFailure();
    }
  }

  if (!response.ok) {
    if (response.status === 401 && !isRefreshCall) {
      adminAuthHandlers?.onHardAuthFailure();
    }
    const validationIssue = Array.isArray(payload?.error?.details) ? payload.error.details[0] : null;
    const validationHint = validationIssue && typeof validationIssue === "object" && validationIssue !== null
      ? `${Array.isArray((validationIssue as { path?: unknown }).path) ? (validationIssue as { path: Array<string | number> }).path.join(".") : "field"}: ${typeof (validationIssue as { message?: unknown }).message === "string" ? (validationIssue as { message: string }).message : "invalid value"}`
      : null;
    const baseMessage = payload?.error?.message || payload?.message || `Request failed (${response.status})`;
    const message = validationHint && baseMessage === "Invalid request data"
      ? `${baseMessage} (${validationHint})`
      : baseMessage;
    throw new Error(message);
  }

  return payload as T;
}

export { API_BASE };
