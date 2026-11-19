// Until v0.43.0 the app lived at https://enoughmoney.app/ and used hash
// routes (/#budget, /#accounts/…). It now lives at /app/. This runs before
// the landing page draws and sends two kinds of visit on to the app:
//
// - an old link or bookmark with an app route after the # (the server never
//   sees the #, so only the page can do this), and
// - a home screen icon saved before v0.43.0, which still opens "/" as an
//   installed app (standalone window, or navigator.standalone on iOS):
//   on iOS always, on Android until Chrome moves the install to /app/
//   (the manifest id stays "/", see vite.config.ts).
//
// It must stay a separate file loaded first in <head>: the Content Security
// Policy forbids inline scripts.
(function () {
  var hasAppRoute = window.location.hash.length > 1;
  var installed =
    window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  if (hasAppRoute || installed) window.location.replace("/app/" + window.location.hash);
})();
