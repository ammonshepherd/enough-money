import { expect, type Page } from "@playwright/test";
import { readTestEnv } from "../scripts/testEnv";

/** Signs in to the test database as test user A (seeded by db:seed:test). */
export async function signInAsA(page: Page) {
  const env = readTestEnv();
  await page.goto("./");
  await page.getByLabel("Email").fill(env.users.a.email);
  await page.getByLabel("Password").fill(env.users.a.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Budget" })).toBeVisible();
}

/** Saves the visible screen as public/guide/<name>.png, once animations settle. */
export async function shot(page: Page, name: string) {
  await page.waitForTimeout(400);
  await page.screenshot({ path: `public/guide/${name}.png`, animations: "disabled" });
}

/** Drops keyboard focus so no focus ring shows in the picture. */
export async function blur(page: Page) {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
}
