import { defineConfig, devices } from "@playwright/test";
import { missingForTests, readTestEnv } from "./scripts/testEnv";
import { assertTestTarget } from "./scripts/testTarget";

// Takes the landing page's pictures (npm run landing:screenshots): the real
// app built against the test database, signed in as test user A, at phone
// size. Never production. Same build and port as test:ui:db. The pictures
// land in landing-screenshots/out/ and scripts/landing-images.ts turns
// them into landing/images/*.webp.
const env = readTestEnv();
const configured = !missingForTests(env);
if (configured) assertTestTarget(env.url);

export default defineConfig({
  testDir: "./landing-screenshots",
  workers: 1,
  use: {
    baseURL: "http://localhost:4174/app/",
    ...devices["Pixel 7"],
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  },
  webServer: configured
    ? {
        command:
          "vite build --mode test --outDir dist-e2e-db/app && vite preview --mode test --outDir dist-e2e-db/app --port 4174 --strictPort",
        url: "http://localhost:4174/app/",
        reuseExistingServer: !process.env.CI,
        env: { VITE_SUPABASE_URL: env.url, VITE_SUPABASE_ANON_KEY: env.anonKey },
      }
    : undefined,
});
