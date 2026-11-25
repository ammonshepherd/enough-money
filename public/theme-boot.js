// Sets light or dark (<html data-theme>) and the theme colour before the
// page first paints, so neither flashes while the app loads. It reads the
// device's last choices, which the app writes (src/models/theme.ts and
// src/models/themeColour.ts): "bb.theme.device" ("system", "light" or
// "dark") and "bb.theme.colourVars" (the colour variables for each theme,
// as JSON). Once someone signs in, the app applies their own (useTheme).
// A plain script, not a module, so it runs at once; served from the app's
// own origin, as the Content Security Policy requires.
(function () {
  var root = document.documentElement;
  var choice = null;
  var vars = null;
  try {
    choice = localStorage.getItem("bb.theme.device");
    vars = JSON.parse(localStorage.getItem("bb.theme.colourVars") || "null");
  } catch (e) {
    // Storage blocked or unreadable: follow the device, in purple.
  }
  var dark =
    choice === "dark" ||
    (choice !== "light" &&
      typeof matchMedia === "function" &&
      matchMedia("(prefers-color-scheme: dark)").matches);
  var theme = dark ? "dark" : "light";
  root.setAttribute("data-theme", theme);
  var set = vars && vars[theme];
  if (set && typeof set === "object") {
    for (var name in set) {
      if (/^--[\w-]+$/.test(name) && typeof set[name] === "string") {
        root.style.setProperty(name, set[name]);
      }
    }
  }
})();
