import { lazy, type ComponentType, type LazyExoticComponent } from "react";

const RELOAD_KEY = "vite_chunk_reload_attempted";

// Clear the reload flag once the page loads successfully so future deploys can also auto-recover.
if (typeof window !== "undefined") {
  window.addEventListener("load", () => sessionStorage.removeItem(RELOAD_KEY));
}

export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T } | Record<string, any>>
): LazyExoticComponent<T> {
  return lazy(() =>
    factory().catch((err: unknown) => {
      const alreadyRetried = sessionStorage.getItem(RELOAD_KEY) === "1";
      if (
        !alreadyRetried &&
        err instanceof Error &&
        err.message.includes("Failed to fetch dynamically imported module")
      ) {
        sessionStorage.setItem(RELOAD_KEY, "1");
        window.location.reload();
        return new Promise<never>(() => {});
      }
      throw err;
    })
  );
}
