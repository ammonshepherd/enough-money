import { defineConfig, devices } from "@playwright/test";

// Playwright drives a real browser against a production build. That build
// uses the in-memory data store (VITE_DATA_STORE=memory), so UI tests need no
// Supabase project and never touch real data. The app is built into
// dist-e2e/app/ (the build needs a folder named "app") and `vite preview`
// serves it at /app/, as on the live site; the landing page is not served.
export default defineConfig({
  testDir: "./e2e",
  use: { baseURL: "http://localhost:4173/app/" },
  projects: [
    // Phone width: every spec except the desktop ones.
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] },
      testIgnore: /\.desktop\.spec\.ts$/,
    },
    // The desktop layout (1000px and up): only *.desktop.spec.ts.
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
      testMatch: /\.desktop\.spec\.ts$/,
    },
  ],
  webServer: {
    command:
      "VITE_DATA_STORE=memory vite build --outDir dist-e2e/app && vite preview --outDir dist-e2e/app --port 4173 --strictPort",
    url: "http://localhost:4173/app/",
    reuseExistingServer: !process.env.CI,
  },
});
