import { expect, test, type Page } from "@playwright/test";
import { openManage, signInWithHousehold } from "./helpers";

const theme = (page: Page) => page.evaluate(() => document.documentElement.dataset.theme);
const browserBar = (page: Page) => page.locator('meta[name="theme-color"]');

test("Appearance: Match system follows the device; Light and Dark win over it", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await signInWithHousehold(page);
  // Match system is the default: a dark device gets the dark theme.
  expect(await theme(page)).toBe("dark");
  await openManage(page, "Appearance");
  const choices = page.getByRole("radiogroup", { name: "Theme" });
  await expect(choices.getByRole("radio", { name: "Match system" })).toBeChecked();
  await expect(page.getByText("(dark now)")).toBeVisible();

  // It follows the device as it changes.
  await page.emulateMedia({ colorScheme: "light" });
  await expect.poll(() => theme(page)).toBe("light");
  await expect(page.getByText("(light now)")).toBeVisible();

  // An explicit choice wins over the device; the browser bar follows.
  await choices.getByRole("radio", { name: "Dark" }).check();
  await expect.poll(() => theme(page)).toBe("dark");
  await expect(browserBar(page)).toHaveAttribute("content", "#16121b");
  await choices.getByRole("radio", { name: "Light" }).check();
  await page.emulateMedia({ colorScheme: "dark" });
  await expect.poll(() => theme(page)).toBe("light");
  await expect(browserBar(page)).toHaveAttribute("content", "#4b2a68");
});

test("the device's last choice applies before anyone signs in", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await signInWithHousehold(page);
  await openManage(page, "Appearance");
  await page.getByRole("radio", { name: "Dark" }).check();
  // A reload starts signed out (the test store keeps nothing), so only
  // public/theme-boot.js has set the theme by then.
  await page.reload();
  await expect(page.getByLabel("Email")).toBeVisible();
  expect(await theme(page)).toBe("dark");
});
