import { defineConfig, devices } from "@playwright/test";
import { missingForTests, readTestEnv } from "./scripts/testEnv";
import { assertTestTarget } from "./scripts/testTarget";

// Takes the guide's pictures (npm run guide:screenshots): the real app built
// against the test database, signed in as test user A, saved into
// public/guide/. Never production. Same build and port as test:ui:db.
const env = readTestEnv();
const configured = !missingForTests(env);
if (configured) assertTestTarget(env.url);

export default defineConfig({
  testDir: "./guide-screenshots",
  workers: 1,
  use: { baseURL: "http://localhost:4174/app/" },
  projects: [
    {
      name: "phone",
      use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 },
      testIgnore: /\.desktop\.spec\.ts$/,
    },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
      testMatch: /\.desktop\.spec\.ts$/,
    },
  ],
  webServer: configured
    ? {
        command:
          "vite build --mode test --outDir dist-e2e-db && vite preview --mode test --outDir dist-e2e-db --port 4174 --strictPort",
        url: "http://localhost:4174/app/",
        reuseExistingServer: !process.env.CI,
        env: { VITE_SUPABASE_URL: env.url, VITE_SUPABASE_ANON_KEY: env.anonKey },
      }
    : undefined,
});
