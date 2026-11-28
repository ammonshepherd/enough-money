import { useCallback, useEffect, useState } from "react";
// A "virtual" module: vite-plugin-pwa writes it at build time. It registers
// the service worker and tells us when a newer build has downloaded.
import { useRegisterSW } from "virtual:pwa-register/react";
import { APP_VERSION } from "../models/appInfo";
import { WHATS_NEW_FILE, newerNotes, type WhatsNewNote } from "../models/whatsNew";

/** How often an open app asks the server for a newer build. */
const CHECK_EVERY_MS = 60 * 60 * 1000;

/**
 * Notices a new deploy while the app is open. The browser only looks for a
 * new service worker when a page loads, and hash routing never reloads, so
 * this also checks every hour and whenever the app comes back on screen.
 *
 * `ready` is true once the new version is downloaded and waiting. `notes`
 * are what's new in it (and any versions skipped), fetched from the new
 * deploy, or none when that fails. `refresh` swaps it in and reloads;
 * `dismiss` hides the offer until the next check.
 */
export function useAppUpdate(): {
  ready: boolean;
  notes: WhatsNewNote[];
  refresh: () => void;
  dismiss: () => void;
} {
  const {
    needRefresh: [ready, setReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      const check = () => {
        if (registration.installing || !navigator.onLine) return;
        // Fails quietly offline or when the site is unreachable; the next check retries.
        registration.update().catch(() => undefined);
      };
      setInterval(check, CHECK_EVERY_MS);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") check();
      });
    },
  });

  const [notes, setNotes] = useState<WhatsNewNote[]>([]);
  useEffect(() => {
    if (!ready) return;
    let current = true;
    // no-store: always the deployed file, never a copy the browser kept.
    fetch(`${import.meta.env.BASE_URL}${WHATS_NEW_FILE}`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((file: unknown) => {
        if (current) setNotes(newerNotes(file, APP_VERSION));
      })
      // Offline or a bad file: the banner shows without notes.
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [ready]);

  const refresh = useCallback(() => void updateServiceWorker(true), [updateServiceWorker]);
  const dismiss = useCallback(() => setReady(false), [setReady]);
  return { ready, notes, refresh, dismiss };
}
