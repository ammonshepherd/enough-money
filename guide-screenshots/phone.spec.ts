import { expect, test } from "@playwright/test";
import { missingForTests, readTestEnv } from "../scripts/testEnv";
import { blur, shot, signInAsA } from "./shared";

// Each test starts from freshly seeded data (npm run guide:screenshots seeds
// first) and leaves nothing changed: dialogs are cancelled, not saved.
const skipReason = missingForTests(readTestEnv());
test.skip(!!skipReason, skipReason ?? "");

const envelope = (page: import("@playwright/test").Page, name: string) =>
  page.locator("div.envelope").filter({ has: page.locator(".envelope-name", { hasText: name }) });

test("sign in", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await shot(page, "sign-in");
});

test("budget", async ({ page }) => {
  await signInAsA(page);
  await shot(page, "budget");
  await page.mouse.wheel(0, 500);
  await shot(page, "budget-cards");
});

test("assign pad", async ({ page }) => {
  await signInAsA(page);
  await envelope(page, "Groceries")
    .getByRole("button", { name: /^Edit assigned amount/ })
    .click();
  await page.getByRole("dialog", { name: "Assigned for Groceries" }).waitFor();
  await page.keyboard.type("+2500");
  await blur(page);
  await shot(page, "assign-pad");
});

test("available to assign", async ({ page }) => {
  await signInAsA(page);
  await page
    .getByRole("region", { name: "Available to Assign" })
    .getByRole("button")
    .first()
    .click();
  await page.getByRole("dialog").waitFor();
  await shot(page, "assign-dialog");
});

test("envelope sheet", async ({ page }) => {
  await signInAsA(page);
  await envelope(page, "Groceries").locator(".envelope-top").click();
  await page.getByRole("dialog", { name: "Groceries envelope" }).waitFor();
  await blur(page);
  await shot(page, "envelope-sheet");
});

test("move money", async ({ page }) => {
  await signInAsA(page);
  await envelope(page, "Dining Out").locator(".envelope-remaining").click();
  await page.getByRole("dialog", { name: "Move money" }).waitFor();
  await shot(page, "move-money");
});

test("accounts", async ({ page }) => {
  await signInAsA(page);
  await page
    .getByRole("navigation", { name: "Primary navigation" })
    .getByRole("link", { name: "Accounts" })
    .click();
  await expect(page.getByText("Test Checking")).toBeVisible();
  await shot(page, "accounts");
  await page.getByRole("link", { name: /^Open All accounts/ }).click();
  await expect(page.getByRole("region", { name: "To review" })).toBeVisible();
  await shot(page, "all-accounts");
});

test("an account", async ({ page }) => {
  await signInAsA(page);
  await page
    .getByRole("navigation", { name: "Primary navigation" })
    .getByRole("link", { name: "Accounts" })
    .click();
  await page.locator("a.account-row", { hasText: "Test Checking" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Test Checking" })).toBeVisible();
  await shot(page, "account");
});

test("add transaction and the cover prompt", async ({ page }) => {
  await signInAsA(page);
  await page.getByRole("button", { name: /add transaction/i }).click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  // Fun Money has $60.00 left (and $100.00 Saved): $85.00 is $25.00 short.
  await dialog.getByLabel("Amount").fill("85.00");
  await dialog.getByLabel("Payee").fill("Concert tickets");
  const picker = dialog.getByLabel("Envelope");
  await picker.click();
  await picker.fill("Fun Money");
  await picker.press("Enter");
  await blur(page);
  await shot(page, "add-transaction");
  await dialog.getByRole("button", { name: "Save" }).click();
  const cover = page.getByRole("alertdialog");
  await expect(cover).toContainText("short");
  await blur(page);
  await shot(page, "cover-prompt");
  // Cancelled: nothing is saved.
  await cover.getByRole("button", { name: "Back" }).click();
});

// Made-up rows in a bank export's layout (never real data).
const CSV = [
  "Date,Description,Amount",
  "10/20/2026,PAYROLL ACME CORP SALARY,3000.00",
  "10/21/2026,CORNER BAKERY,-12.40",
  "10/22/2026,GAS N GO,-41.18",
  "10/23/2026,CITY WATER,-38.00",
].join("\n");

test("import preview", async ({ page }) => {
  await signInAsA(page);
  await page
    .getByRole("navigation", { name: "Primary navigation" })
    .getByRole("link", { name: "Accounts" })
    .click();
  await page.locator("a.account-row", { hasText: "Test Checking" }).click();
  await page.getByRole("button", { name: "Import CSV" }).click();
  const sheet = page.getByRole("dialog", { name: "Import CSV into Test Checking" });
  await sheet.getByLabel("Bank CSV file").setInputFiles({
    name: "checking.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(CSV),
  });
  await expect(sheet.getByRole("status")).toContainText("new transaction");
  // Columns were found on their own: fold them away and show the preview.
  await sheet.locator("details.import-columns summary").click();
  await sheet.getByRole("status").scrollIntoViewIfNeeded();
  await blur(page);
  await shot(page, "import-preview");
});

test("settings", async ({ page }) => {
  await signInAsA(page);
  await page
    .getByRole("navigation", { name: "Primary navigation" })
    .getByRole("link", { name: "Settings" })
    .click();
  await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
  await shot(page, "settings");
});
