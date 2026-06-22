import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { queryClient } from "./lib/queryClient";

queryClient.prefetchQuery({
  queryKey: ["/api/public/settings"],
  staleTime: 5 * 60 * 1000,
});

createRoot(document.getElementById("root")!).render(<App />);
