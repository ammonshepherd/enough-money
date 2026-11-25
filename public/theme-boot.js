// Sets light or dark on <html data-theme> before the page first paints, so a
// device set to dark never flashes light while the app loads. It reads the
// device's last choice ("system", "light" or "dark"), which
// src/models/theme.ts writes as "bb.theme.device"; once someone signs in,
// the app applies their own choice (useTheme). A plain script, not a module,
// so it runs at once; served from the app's own origin, as the Content
// Security Policy requires.
(function () {
  var choice = null;
  try {
    choice = localStorage.getItem("bb.theme.device");
  } catch (e) {
    // Storage blocked: follow the device.
  }
  var dark =
    choice === "dark" ||
    (choice !== "light" &&
      typeof matchMedia === "function" &&
      matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
})();
