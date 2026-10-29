import "./site.css";
import { appRedirect } from "./appRedirect";

// The app lived at / until v0.39.0. An installed copy may still open here,
// and old links carry the app's page in the hash (/#budget/2026-10): send
// both on to the app at /app/.
const target = appRedirect({
  hash: location.hash,
  standalone:
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true,
});
if (target) location.replace(target);
