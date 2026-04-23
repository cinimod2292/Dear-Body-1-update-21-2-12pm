
  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import { API_BASE } from "./app/admin/api/client";
  import "./styles/index.css";

  try {
    const apiOrigin = new URL(API_BASE).origin;
    if (apiOrigin !== window.location.origin) {
      const preconnect = document.createElement("link");
      preconnect.rel = "preconnect";
      preconnect.href = apiOrigin;
      preconnect.crossOrigin = "anonymous";
      document.head.appendChild(preconnect);
    }
  } catch {
    // no-op: invalid API base URL should not block app bootstrap
  }

  createRoot(document.getElementById("root")!).render(<App />);
  
