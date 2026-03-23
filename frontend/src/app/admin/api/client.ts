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

async function parseJsonSafe(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export async function apiRequest<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const payload = await parseJsonSafe(response);

  if (!response.ok) {
    const message = payload?.error?.message || `Request failed (${response.status})`;
    throw new Error(message);
  }

  return payload as T;
}

export { API_BASE };
