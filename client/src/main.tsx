import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { queryClient } from "./lib/queryClient";

if (import.meta.env.DEV) {
  const params = new URLSearchParams(window.location.search);
  const debugToken = params.get("__debug_token");
  const debugUser = params.get("__debug_user");
  if (debugToken) {
    localStorage.setItem("token", debugToken);
    if (debugUser) localStorage.setItem("auth-user", debugUser);
    params.delete("__debug_token");
    params.delete("__debug_user");
    const newUrl = window.location.pathname + (params.toString() ? `?${params}` : "") + window.location.hash;
    window.history.replaceState({}, "", newUrl);
  }
}

queryClient.prefetchQuery({
  queryKey: ["/api/public/settings"],
  staleTime: 5 * 60 * 1000,
});

createRoot(document.getElementById("root")!).render(<App />);
