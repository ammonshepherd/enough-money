import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist",
      "dist-e2e",
      "dist-e2e-db",
      "dev-dist",
      "coverage",
      "playwright-report",
      "test-results",
    ],
  },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { globals: globals.browser },
    plugins: { "react-hooks": reactHooks, "react-refresh": reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    },
  },
  {
    // MVC guard: views display data only, so they may not import Supabase
    // or reach past controllers into data access.
    files: ["src/views/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@supabase/*"],
              message: "Views must not talk to Supabase; use a controller.",
            },
          ],
        },
      ],
      // Colours live in src/styles/01-tokens.css, so a theme can change them.
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "JSXAttribute[name.name=/^(fill|stroke|color|stopColor)$/][value.type='Literal'][value.value=/^(#|rgb|hsl)/]",
          message: "Give the element a class and colour it with a variable from 01-tokens.css.",
        },
      ],
    },
  },
);
