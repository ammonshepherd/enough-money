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

const brand = (page: Page) =>
  page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--brand").trim(),
  );

test("Theme colour: a ready-made colour or any colour, kept readable", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await signInWithHousehold(page);
  await openManage(page, "Appearance");
  const colours = page.getByRole("radiogroup", { name: "Theme colour" });
  await expect(colours.getByRole("radio", { name: "Purple" })).toBeChecked();
  expect(await brand(page)).toBe("#4b2a68");

  // A ready-made colour recolours the whole app at once.
  await colours.getByRole("radio", { name: "Teal" }).check();
  await expect.poll(() => brand(page)).toBe("#0e6668");
  await expect(browserBar(page)).toHaveAttribute("content", /^#[0-9a-f]{6}$/);
  await expect(page.getByText("Adjusted for readability")).toHaveCount(0);

  // Any colour: a light yellow is darkened so white text on it reads.
  await colours.getByRole("radio", { name: "Custom" }).check();
  await page.getByLabel("Hex").fill("#ffd400");
  await expect(page.getByText(/^Adjusted for readability/)).toBeVisible();
  expect(await brand(page)).not.toBe("#ffd400");

  // The shading square moves with the arrow keys (the Hex field shows the pick).
  const square = page.getByRole("slider", { name: "Shade" });
  await square.focus();
  await square.press("Shift+ArrowDown");
  await expect(page.getByLabel("Hex")).toHaveValue("#e6bf00");

  // Red and green get a warning; Back to purple undoes it all.
  await page.getByLabel("Hex").fill("#b01010");
  await expect(page.getByText(/^Red and green also mean money out and in/)).toBeVisible();
  await page.getByRole("button", { name: "Back to purple" }).click();
  await expect.poll(() => brand(page)).toBe("#4b2a68");
  await expect(colours.getByRole("radio", { name: "Purple" })).toBeChecked();
});

test("the theme colour applies before anyone signs in", async ({ page }) => {
  await signInWithHousehold(page);
  await openManage(page, "Appearance");
  await page
    .getByRole("radiogroup", { name: "Theme colour" })
    .getByRole("radio", { name: "Rose" })
    .check();
  await page.reload();
  await expect(page.getByLabel("Email")).toBeVisible();
  expect(await brand(page)).toBe("#9c2459");
});
