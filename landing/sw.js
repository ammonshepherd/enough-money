// Retires the service worker the app registered at the site root before
// v0.43.0, when the app lived at https://enoughmoney.app/ (it now has its
// own at /app/sw.js). Browsers that still run the old one fetch this file
// when they check for an update, and the old app then shows its "new
// version" banner. Refresh (or closing every tab) switches to this worker,
// which deletes the old app's caches, unregisters itself and leaves the
// landing page to the network. The page then reloads at "/" and
// legacy-redirect.js sends it on to /app/.
//
// Keep this file for as long as anyone might open a copy of the app from
// before v0.43.0.

// The old app's Refresh button asks the waiting worker to take over.
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Workbox names its caches after the registration scope, so this only
      // matches the old root app's ("…-https://enoughmoney.app/"), never the
      // new one's ("…-https://enoughmoney.app/app/").
      const oldSuffix = "-" + self.registration.scope;
      const names = await caches.keys();
      await Promise.all(
        names.filter((name) => name.endsWith(oldSuffix)).map((name) => caches.delete(name)),
      );
      await self.registration.unregister();
    })(),
  );
});
