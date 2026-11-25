// Stylelint checks the app's CSS (src/styles/). Its one job for now: keep
// colours in 01-tokens.css, so dark mode and theme colours only change that
// file. Elsewhere a colour must be a variable: var(--brand), or
// rgb(var(--brand-rgb) / 0.1) for a see-through one.
/** @type {import("stylelint").Config} */
export default {
  rules: {
    "color-no-hex": [true, { message: "Use a colour variable from 01-tokens.css." }],
    "color-named": ["never", { message: "Use a colour variable from 01-tokens.css." }],
    "function-disallowed-list": [
      ["rgba", "hsl", "hsla", "hwb", "lab", "lch", "oklab", "oklch"],
      { message: "Use a colour variable from 01-tokens.css." },
    ],
    // rgb() only with a variable's channels, never typed-in numbers.
    "declaration-property-value-disallowed-list": [
      { "/.*/": ["/rgb\\(\\s*\\d/"] },
      { message: "Use a colour variable from 01-tokens.css." },
    ],
  },
  overrides: [
    {
      files: ["src/styles/01-tokens.css"],
      rules: {
        "color-no-hex": null,
        "color-named": null,
        "function-disallowed-list": null,
        "declaration-property-value-disallowed-list": null,
      },
    },
  ],
};
