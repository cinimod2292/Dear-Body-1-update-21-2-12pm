import { apiRequest } from "../admin/api/client";
import { API_BASE } from "../lib/api";
import { BuilderPageKey, BuilderPageRecord } from "./types";

export async function fetchStoreBuilderPage(pageKey: BuilderPageKey) {
  const response = await fetch(`${API_BASE}/store/builder/pages/${pageKey}`, { cache: "no-store" });
  if (!response.ok) return null;
  const payload = await response.json().catch(() => null);
  return (payload?.data ?? null) as { pageKey: BuilderPageKey; content: { sections: any[] } } | null;
}

export async function fetchAdminBuilderPage(pageKey: BuilderPageKey, token: string) {
  const payload = await apiRequest<{ data: BuilderPageRecord }>(`/admin/builder/pages/${pageKey}`, {}, token);
  return payload.data;
}

export async function saveBuilderDraft(pageKey: BuilderPageKey, content: unknown, token: string) {
  const payload = await apiRequest<{ data: BuilderPageRecord }>(`/admin/builder/pages/${pageKey}/draft`, {
    method: "PUT",
    body: JSON.stringify({ content }),
  }, token);
  return payload.data;
}

export async function publishBuilderDraft(pageKey: BuilderPageKey, token: string) {
  const payload = await apiRequest<{ data: BuilderPageRecord }>(`/admin/builder/pages/${pageKey}/publish`, { method: "POST" }, token);
  return payload.data;
}

export async function discardBuilderDraft(pageKey: BuilderPageKey, token: string) {
  const payload = await apiRequest<{ data: BuilderPageRecord }>(`/admin/builder/pages/${pageKey}/discard-draft`, { method: "POST" }, token);
  return payload.data;
}
