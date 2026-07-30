import { createRoot } from "react-dom/client";
import "./index.css";
import "./font.css";
import App from "./App.tsx";
import { BrowserRouter } from "react-router-dom";
import { initAnalytics } from "./util/analytics.ts";

// Straight to the document rather than through a component, since it has nothing
// to say about the tree. Route changes need no help: the tracker follows the
// history API by itself.
initAnalytics();

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
)
