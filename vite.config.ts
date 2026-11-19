/// <reference types="vitest/config" />
import { cpSync, writeFileSync } from "node:fs";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import packageJson from "./package.json" with { type: "json" };

// The site (decided in v0.43.0): the landing page at https://enoughmoney.app/
// and the app at https://enoughmoney.app/app/. Every URL the app's build
// produces starts with this path, and the build goes into an `app` folder
// inside the site folder (dist/app/, see sitePlugin).
const BASE = "/app/";
const APP_OUT_DIR = "dist/app";

// The landing page's files, copied as they are to the site root.
const LANDING_DIR = "landing";

// The test Supabase project (see docs/testing.md); production is lkaurrcarzzkbqdwqfge.
const TEST_PROJECT_REF = "kiqbgjgvptgknmboazaq";

/**
 * Stops a build that would ship a secret or point production at the test
 * database. Only VITE_ variables reach the browser, so a secret must never
 * have that prefix.
 */
function checkBuildEnv(mode: string) {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const secret = Object.keys(env).find((name) => /SERVICE_ROLE|SECRET|PASSWORD/i.test(name));
  if (secret) throw new Error(`${secret} would be bundled into the app; remove the VITE_ prefix.`);
  if (mode === "production" && env.VITE_SUPABASE_URL?.includes(TEST_PROJECT_REF)) {
    throw new Error("The production build points at the test Supabase project.");
  }
}

/**
 * The built page's Content Security Policy: the browser runs only the app's
 * own scripts and styles and talks only to the app and its Supabase project,
 * so injected code could neither load more code nor send data elsewhere.
 * Build only: the dev server injects inline scripts for hot reload.
 */
function contentSecurityPolicy(supabaseUrl: string | undefined): string {
  const supabase = supabaseUrl ? ` ${new URL(supabaseUrl).origin}` : "";
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src 'self'${supabase}`,
    "manifest-src 'self'",
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

/**
 * Cloudflare reads `_headers` from the root of the built site and sends these
 * headers with every response, the landing page's too (the file itself is
 * not served). A header can do what
 * the <meta> tag cannot: `frame-ancestors 'none'` stops other sites showing
 * the app in a frame. The <meta> tag stays so `vite preview` (the UI tests)
 * applies the same policy.
 */
function headersFile(policy: string): string {
  return [
    "/*",
    `  Content-Security-Policy: ${policy}; frame-ancestors 'none'`,
    "  X-Content-Type-Options: nosniff",
    "  Referrer-Policy: strict-origin-when-cross-origin",
    "  Permissions-Policy: camera=(), microphone=(), geolocation=()",
    "",
  ].join("\n");
}

function policyFor(mode: string): string {
  // loadEnv also picks up VITE_ variables set in the shell (CI, Playwright).
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const supabaseUrl = env.VITE_DATA_STORE === "memory" ? undefined : env.VITE_SUPABASE_URL;
  return contentSecurityPolicy(supabaseUrl);
}

function securityPlugin(policy: string): Plugin {
  return {
    name: "enough-money-security",
    apply: "build",
    transformIndexHtml: () => [
      {
        tag: "meta",
        attrs: { "http-equiv": "Content-Security-Policy", content: policy },
        injectTo: "head-prepend",
      },
    ],
  };
}

/**
 * Builds the rest of the site around the app. The app's output folder must
 * be named `app` (dist/app, or dist-e2e/app for the UI tests); its parent is
 * the site root, which gets the landing page's files and `_headers`. Old
 * files in the site root are overwritten, never deleted.
 */
function sitePlugin(policy: string): Plugin {
  let siteRoot = "";
  let landingDir = "";
  return {
    name: "enough-money-site",
    apply: "build",
    configResolved(config) {
      const outDir = path.resolve(config.root, config.build.outDir);
      if (path.basename(outDir) !== "app") {
        throw new Error(`Build the app into a folder named "app" (got ${config.build.outDir}).`);
      }
      siteRoot = path.dirname(outDir);
      landingDir = path.resolve(config.root, LANDING_DIR);
    },
    writeBundle() {
      cpSync(landingDir, siteRoot, {
        recursive: true,
        // Notes for whoever edits the landing page stay out of the site.
        filter: (source) => path.basename(source) !== "README.md",
      });
      writeFileSync(path.join(siteRoot, "_headers"), headersFile(policy));
    },
  };
}

// Vite is the dev server and bundler. This one file configures the build,
// the PWA plugin and Vitest (which reuses Vite's settings). `mode` is
// "production" for `vite build`, "development" for `vite`, and "test" with
// `--mode test`, which loads .env.test (the test database).
export default defineConfig(({ command, mode }) => {
  if (command === "build") checkBuildEnv(mode);
  const policy = policyFor(mode);
  return {
    base: BASE,
    build: { outDir: APP_OUT_DIR },
    define: {
      // Replaced at build time; read through src/models/appInfo.ts.
      __APP_VERSION__: JSON.stringify(packageJson.version),
    },
    plugins: [
      react(),
      securityPlugin(policy),
      sitePlugin(policy),
      VitePWA({
        // Generates the service worker and manifest that sw.js and
        // manifest.webmanifest used to provide by hand.
        // "prompt": a new build waits until the user taps Refresh on the
        // new version banner (src/controllers/useAppUpdate.ts), so the app
        // never reloads in the middle of an edit.
        registerType: "prompt",
        // Cached by the service worker so the icons work offline.
        includeAssets: [
          "icons/favicon.svg",
          "icons/favicon-32.png",
          "icons/favicon.ico",
          "icons/apple-touch-icon.png",
          "icons/icon.svg",
        ],
        manifest: {
          name: "Enough Money",
          short_name: "Enough Money",
          description: "A simple envelope-style budgeting app.",
          // Changed from "/" in v0.43.0, so the browser treats it as a new
          // app: a home screen icon saved before then opens the landing
          // page, which sends it on to /app/ (landing/legacy-redirect.js).
          start_url: BASE,
          scope: BASE,
          id: BASE,
          display: "standalone",
          background_color: "#faf8fc",
          theme_color: "#4b2a68",
          // "any" icons are shown as drawn; the "maskable" one has extra
          // padding so Android can crop it to a circle or rounded square.
          icons: [
            { src: "icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
            { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
            {
              src: "icons/icon-maskable-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
            { src: "icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
          ],
        },
      }),
    ],
    test: {
      // Two groups ("projects"): unit tests need no database; integration tests
      // run against the test database and reseed it first. Playwright owns e2e/.
      projects: [
        {
          extends: true,
          test: {
            name: "unit",
            include: ["src/**/*.test.ts", "src/**/*.test.tsx", "scripts/**/*.test.ts"],
          },
        },
        {
          extends: true,
          test: {
            name: "integration",
            include: ["integration/**/*.test.ts"],
            globalSetup: ["integration/globalSetup.ts"],
            // The files share two test users, so they run one at a time.
            fileParallelism: false,
            testTimeout: 30_000,
            hookTimeout: 60_000,
          },
        },
      ],
    },
  };
});
