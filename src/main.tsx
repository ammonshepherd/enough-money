import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./views/App";
import "./styles/index.css";

// Mounts the React app into <div id="root"> in index.html. StrictMode runs
// extra development-only checks that catch common bugs early.
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
