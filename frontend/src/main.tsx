import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import { API_BASE } from "./app/admin/api/client";
import "./styles/index.css";
import { BUILD_MARKER, logBuildMarker } from "./app/lib/build-marker";
import { initAnalytics } from "./app/lib/analytics";

try {
  const apiOrigin = new URL(API_BASE).origin;
  if (apiOrigin !== window.location.origin) {
    const preconnect = document.createElement("link");
    preconnect.rel = "preconnect";
    preconnect.href = apiOrigin;
    preconnect.crossOrigin = "anonymous";
    document.head.appendChild(preconnect);

    // Wake the backend from cold start (Render free tier sleeps after inactivity).
    // Fire-and-forget: errors are intentionally ignored.
    fetch(`${API_BASE}/ping`).catch(() => {});
  }
} catch {
  // no-op: invalid API base URL should not block app bootstrap
}

logBuildMarker("main-bootstrap");

// Defer analytics until after first paint so it doesn't block FCP
if (typeof requestIdleCallback !== "undefined") {
  requestIdleCallback(() => initAnalytics(), { timeout: 3000 });
} else {
  setTimeout(() => initAnalytics(), 200);
}

window.addEventListener("error", (event) => {
  console.error("[global-error]", {
    message: event.message,
    stack: (event.error as any)?.stack,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    buildMarker: BUILD_MARKER,
  });
});

// When Vite can't fetch a pre-loaded chunk (stale tab after deploy), reload once.
window.addEventListener("vite:preloadError", () => {
  const alreadyRetried = sessionStorage.getItem("vite_chunk_reload_attempted") === "1";
  if (!alreadyRetried) {
    sessionStorage.setItem("vite_chunk_reload_attempted", "1");
    window.location.reload();
  }
});

window.addEventListener("unhandledrejection", (event) => {
  const reason = (event as PromiseRejectionEvent).reason as any;
  console.error("[global-unhandledrejection]", {
    message: reason?.message ?? String(reason),
    stack: reason?.stack,
    filename: "n/a",
    lineno: null,
    colno: null,
    buildMarker: BUILD_MARKER,
  });
});

createRoot(document.getElementById("root")!).render(<App />);
