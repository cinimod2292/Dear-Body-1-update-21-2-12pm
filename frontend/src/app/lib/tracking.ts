const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000") + (import.meta.env.VITE_API_PREFIX ?? "/api");

function getSessionId(): string {
  let id = sessionStorage.getItem("_sid");
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem("_sid", id);
  }
  return id;
}

export function trackPageView(path: string) {
  const sessionId = getSessionId();
  navigator.sendBeacon(
    `${API_BASE}/track/pageview`,
    JSON.stringify({
      sessionId,
      path,
      referrer: document.referrer || null,
      userAgent: navigator.userAgent,
    }),
  );
  return { sessionId, path, startedAt: Date.now() };
}

export function trackPageLeave(sessionId: string, path: string, startedAt: number) {
  const duration = Math.round((Date.now() - startedAt) / 1000);
  navigator.sendBeacon(
    `${API_BASE}/track/pageleave`,
    JSON.stringify({ sessionId, path, duration }),
  );
}
