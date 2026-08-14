import React from "react";
import ReactDOM from "react-dom/client";

import App from "@/App";
import "@/index.css";

async function enableMocking() {
  if (import.meta.env.VITE_MOCK_API !== "true" || !import.meta.env.DEV) return;
  const { worker } = await import("@/mocks/browser");
  await worker.start({ onUnhandledRequest: "bypass" });
}

enableMocking().finally(() => {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
});
