import { test } from "@playwright/test";
import { missingForTests, readTestEnv } from "../scripts/testEnv";
import { shot, signInAsA } from "./shared";

const skipReason = missingForTests(readTestEnv());
test.skip(!!skipReason, skipReason ?? "");

test("desktop budget", async ({ page }) => {
  await signInAsA(page);
  await page
    .locator("div.envelope", { hasText: "Groceries" })
    .locator(".envelope-name")
    .first()
    .click();
  await shot(page, "desktop-budget");
});
