import { expect, test, type Page } from "@playwright/test";
import { missingForTests, readTestEnv } from "../scripts/testEnv";

// The landing page's pictures, from Test Household A (npm run
// landing:screenshots reseeds first). Nothing is saved: every dialog is
// closed without saving, so each test starts from the seeded data.
const env = readTestEnv();
const skipReason = missingForTests(env);
test.skip(!!skipReason, skipReason ?? "");

// Raw pictures (ignored by git); scripts/landing-images.ts makes the webp files.
const OUT = "landing-screenshots/out";

async function signIn(page: Page) {
  await page.goto("./");
  await page.getByLabel("Email").fill(env.users.a.email);
  await page.getByLabel("Password").fill(env.users.a.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Budget" })).toBeVisible();
}

/** Saves the screen once animations settle, with no focus ring showing. */
async function shot(page: Page, name: string, clipHeight?: number, keepFocus = false) {
  if (!keepFocus) await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.waitForTimeout(400);
  await page.screenshot({
    path: `${OUT}/${name}.png`,
    animations: "disabled",
    clip: clipHeight ? { x: 0, y: 0, width: 390, height: clipHeight } : undefined,
  });
}

const envelope = (page: Page, name: string) =>
  page.locator("div.envelope").filter({ has: page.locator(".envelope-name", { hasText: name }) });
const nav = (page: Page, name: string) =>
  page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name }).click();

test("budget: the page, its top and its envelopes", async ({ page }) => {
  await signIn(page);
  await shot(page, "budget");
  await shot(page, "debt", 420);
  await page.mouse.wheel(0, 420);
  await shot(page, "envelopes");
  // The Everyday group alone: its envelopes' sparkling Saved pills.
  const everyday = page.getByRole("region", { name: "Everyday" });
  await everyday.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await everyday.screenshot({ path: `${OUT}/saved-grow.png`, animations: "disabled" });
});

test("assign from the green banner", async ({ page }) => {
  await signIn(page);
  await page
    .getByRole("region", { name: "Available to Assign" })
    .getByRole("button")
    .first()
    .click();
  await page.getByRole("dialog").waitFor();
  await shot(page, "assign");
});

test("Saved in an envelope", async ({ page }) => {
  await signIn(page);
  await envelope(page, "Groceries").locator(".envelope-top").click();
  const sheet = page.getByRole("dialog", { name: "Groceries envelope" });
  await sheet.getByRole("button", { name: /Move some into Remaining/ }).scrollIntoViewIfNeeded();
  await shot(page, "saved");
});

test("adding a transaction, and an envelope without enough", async ({ page }) => {
  await signIn(page);
  await page.getByRole("button", { name: "Add transaction", exact: true }).click();
  const dialog = page.getByRole("dialog");
  // The envelope list also offers Income.
  const picker = dialog.getByLabel("Envelope");
  await picker.click();
  await picker.fill("Inc");
  await page.getByRole("listbox", { name: "Matches" }).waitFor();
  await shot(page, "income", undefined, true);
  await picker.fill("");
  // Fun Money has $60.00 left; $85.00 needs $25.00 more.
  await dialog.getByLabel("Amount").fill("85.00");
  await dialog.getByLabel("Payee").fill("Concert tickets");
  await picker.click();
  await picker.fill("Fun Money");
  await picker.press("Enter");
  await shot(page, "add-transaction");
  await dialog.getByRole("button", { name: "Save" }).click();
  const prompt = page.getByRole("alertdialog");
  await expect(prompt).toContainText("Fun Money");
  await shot(page, "not-enough");
  await prompt.getByRole("button", { name: "Back" }).click();
});

test("accounts, review and reconcile", async ({ page }) => {
  await signIn(page);
  await nav(page, "Accounts");
  await expect(page.locator("a.account-row", { hasText: "Test Checking" })).toBeVisible();
  await shot(page, "accounts");
  await page.getByRole("link", { name: /^Open All accounts/ }).click();
  await page.getByRole("region", { name: "To review" }).scrollIntoViewIfNeeded();
  await shot(page, "review");
  // Tick two rows: the bar offers Mark reconciled (not clicked).
  await page.getByRole("link", { name: "Back to accounts" }).click();
  await page.locator("a.account-row", { hasText: "Test Checking" }).click();
  await page.getByRole("checkbox", { name: /^Select Big Box Store/ }).check();
  await page
    .getByRole("checkbox", { name: /^Select Fresh Market/ })
    .first()
    .check();
  await expect(page.getByRole("button", { name: "Mark reconciled" })).toBeVisible();
  await shot(page, "reconcile");
});

test("a new month offers last month's plan", async ({ page }) => {
  await signIn(page);
  await page.getByRole("link", { name: "Next month" }).click();
  await expect(page.getByRole("heading", { name: /No plan for/ })).toBeVisible();
  await page.getByRole("heading", { name: /No plan for/ }).scrollIntoViewIfNeeded();
  await shot(page, "new-month");
});

test("setting this month's Expected income", async ({ page }) => {
  await signIn(page);
  await page.getByRole("region", { name: "Plan" }).getByRole("button").click();
  await page.getByRole("dialog").getByRole("group", { name: "Suggested amounts" }).waitFor();
  await shot(page, "expected-income");
});
