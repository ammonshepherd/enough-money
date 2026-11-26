import { existsSync, readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { choosePageMenu, goTo, signInWithHousehold, openAllAccounts } from "./helpers";

test("shows sign-in first, with no version or menu in the header", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
  // The version is on Manage; signed out there is no page menu either.
  await expect(page.getByLabel("Application version")).toHaveCount(0);
  await expect(page.locator(".app-header").getByRole("button", { name: / menu$/ })).toHaveCount(0);
  // Public sign-up is off: no way to create an account here.
  await expect(page.getByText(/create an account|create account/i)).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Primary navigation" })).toHaveCount(0);
});

test("bottom navigation switches pages and updates the URL hash", async ({ page }) => {
  await signInWithHousehold(page);
  const nav = page.getByRole("navigation", { name: "Primary navigation" });

  await expect(nav.getByRole("link")).toHaveText(["Budget", "Accounts", "Manage"]);
  // The tabs share the bar's width equally, centred.
  const bar = (await nav.boundingBox())!;
  const tabs = await Promise.all((await nav.getByRole("link").all()).map((l) => l.boundingBox()));
  const [left, middle, right] = tabs.map((t) => t!.x + t!.width / 2 - bar.x) as [
    number,
    number,
    number,
  ];
  expect(Math.abs(middle - bar.width / 2)).toBeLessThan(2);
  expect(Math.abs(middle - left - (right - middle))).toBeLessThan(2);
  for (const name of ["Accounts", "Manage", "Budget"]) {
    await nav.getByRole("link", { name }).click();
    // Budget and Accounts carry the month, so it stays the same between them.
    await expect(page).toHaveURL(new RegExp(`#${name.toLowerCase()}(/\\d{4}-\\d{2})?$`));
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
    await expect(nav.getByRole("link", { name })).toHaveAttribute("aria-current", "page");
    await expect(page).toHaveTitle(`${name} | Enough Money`);
  }
});

test("Budget and Accounts keep the chosen month in the URL and between them", async ({ page }) => {
  await signInWithHousehold(page);
  await page.evaluate(() => (location.hash = "#budget/2030-01"));
  await expect(page.locator(".budget-month")).toContainText("January 2030");
  await openAllAccounts(page);
  await expect(page).toHaveURL(/#accounts\/all\/2030-01$/);
  await expect(page.locator(".budget-month")).toContainText("January 2030");
  await page.getByRole("link", { name: "Next month" }).click();
  await expect(page).toHaveURL(/#accounts\/all\/2030-02$/);
  await expect(page.locator(".budget-month")).toContainText("February 2030");
  await goTo(page, "Manage");
  await goTo(page, "Budget");
  await expect(page).toHaveURL(/#budget\/2030-02$/);
  await expect(page.locator(".budget-month")).toContainText("February 2030");
});

test("the old Activity link opens All accounts, and Back closes what is open", async ({ page }) => {
  await signInWithHousehold(page);
  await page.evaluate(() => (location.hash = "#activity/2030-01"));
  await expect(page).toHaveURL(/#accounts\/all\/2030-01$/);
  await expect(page.getByRole("heading", { level: 2, name: "All accounts" })).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Primary navigation" });
  await expect(nav.getByRole("link", { name: "Accounts" })).toHaveAttribute("aria-current", "page");

  // The "← Accounts" link returns to the list; so does the browser's Back button.
  await page.getByRole("link", { name: "Back to accounts" }).click();
  await expect(page).toHaveURL(/#accounts\/2030-01$/);
  await page.getByRole("link", { name: /^Open All accounts/ }).click();
  await expect(page.getByRole("heading", { level: 2, name: "All accounts" })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/#accounts\/2030-01$/);
  await expect(page.getByRole("link", { name: /^Open All accounts/ })).toBeVisible();
});

test("signing out returns to the sign-in page", async ({ page }) => {
  await signInWithHousehold(page);
  await goTo(page, "Manage");
  await expect(page.locator(".manage-greeting")).toHaveText("Hi, test@example.com");
  await expect(page.getByRole("region", { name: "Information" })).toContainText(
    /Version\d+\.\d+\.\d+$/,
  );
  // Sign out is in the page menu and in Manage → Settings.
  await expect(
    page.getByRole("region", { name: "Settings" }).getByRole("button", { name: /^Sign Out/ }),
  ).toBeVisible();
  await choosePageMenu(page, "Sign out");
  await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
});

test("Manage lists its options; each opens its own page, and Back returns to the list", async ({
  page,
}) => {
  await signInWithHousehold(page);
  await goTo(page, "Manage");
  const list = page.getByRole("navigation", { name: "Manage options" });
  // No page title or introduction: a greeting heads the list.
  await expect(page.locator(".page-heading")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1, name: "Manage" })).toHaveClass(
    /visually-hidden/,
  );
  await expect(list.getByRole("heading", { level: 2 })).toHaveText([
    "Settings",
    "Budget",
    "Transactions",
    "Information",
  ]);
  await expect(list.getByRole("listitem").locator("strong")).toHaveText([
    "Appearance",
    "Account Info",
    "Household",
    "Sign Out",
    "Envelopes",
    "Import Envelope Plan",
    "Backup",
    "Restore from Backup",
    "Payees",
    "Tags",
    "Income Rules",
    "About Enough Money",
    "Give Feedback",
    "Version",
  ]);
  // Restore is red, as a warning.
  await expect(list.getByRole("link", { name: /^Restore from Backup/ })).toHaveClass(/danger/);
  // Bank CSVs are imported from each account, not here.
  await expect(list).not.toContainText("Import transactions");

  // Old Settings links open Manage and show its new address. (First: Chrome
  // closes a dialog a script opens just after another one closed.)
  await page.evaluate(() => (location.hash = "#settings/groups"));
  await expect(page).toHaveURL(/#manage\/groups$/);
  await expect(page.getByRole("region", { name: "Envelope groups" })).toBeVisible();
  // Opened by a link, closing shows the list at #manage.
  await page
    .getByRole("dialog", { name: "Envelopes" })
    .getByRole("button", { name: "Close" })
    .click();
  await expect(page).toHaveURL(/#manage$/);

  // A phone opens each option in a sheet over the list; Close, Escape or
  // Back return to the list.
  await list.getByRole("link", { name: /^Tags/ }).click();
  await expect(page).toHaveURL(/#manage\/tags$/);
  const sheet = page.getByRole("dialog", { name: "Tags" });
  await expect(sheet.getByRole("region", { name: "Tags", exact: true })).toBeVisible();
  await expect(list).toBeAttached();
  await expect(page.locator(".manage-back")).toHaveCount(0);
  await sheet.getByRole("button", { name: "Close" }).click();
  await expect(sheet).toBeHidden();
  await expect(page).toHaveURL(/#manage$/);
  await list.getByRole("link", { name: /^Payees/ }).click();
  await expect(page.getByRole("dialog", { name: "Payees" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Payees" })).toBeHidden();

  await list.getByRole("link", { name: /^Backup/ }).click();
  await expect(page.getByRole("dialog", { name: "Backup" })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("dialog", { name: "Backup" })).toBeHidden();
  await expect(page).toHaveURL(/#manage$/);

  // About opens a page; Version opens nothing.
  await list.getByRole("link", { name: /^About Enough Money/ }).click();
  await expect(page).toHaveURL(/#manage\/about$/);
  await expect(page.getByRole("region", { name: "About Enough Money" })).toContainText(
    /Version \d+\.\d+\.\d+/,
  );
});

test("Manage → Household renames the household; Save and Cancel close its sheet", async ({
  page,
}) => {
  await signInWithHousehold(page);
  await goTo(page, "Manage");
  const household = page.getByRole("link", { name: /^Household/ });
  await expect(household).toContainText("Test Home");
  await household.click();
  await expect(page).toHaveURL(/#manage\/household$/);
  const sheet = page.getByRole("dialog", { name: "Household" });
  const form = sheet.getByRole("form", { name: "Rename household" });
  // The list stays behind the sheet; Escape closes it.
  await expect(page.getByRole("navigation", { name: "Manage options" })).toBeAttached();
  await form.getByLabel("Household name").fill("Nope");
  await form.getByLabel("Household name").press("Escape");
  await expect(sheet).toBeHidden();
  await expect(page).toHaveURL(/#manage$/);
  await expect(household).toContainText("Test Home");

  await household.click();
  await form.getByLabel("Household name").fill("   ");
  await form.getByRole("button", { name: "Save" }).click();
  await expect(form.getByRole("alert")).toHaveText("Household name is required");
  await form.getByLabel("Household name").fill("  The Smiths ");
  await form.getByRole("button", { name: "Save" }).click();
  await expect(sheet).toBeHidden();
  await expect(household).toContainText("The Smiths");

  // Cancel closes it too, and Back after opening it returns to the list.
  await household.click();
  await sheet.getByRole("button", { name: "Cancel" }).click();
  await expect(sheet).toBeHidden();
  await household.click();
  await page.goBack();
  await expect(sheet).toBeHidden();
});

test("assets and manifest are served from /app/", async ({ page }) => {
  await page.goto("./");
  const logo = page.locator(".brand img");
  await expect(logo).toHaveAttribute("src", "/app/icons/icon.svg");
  expect(await logo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);

  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(manifestHref).toBe("/app/manifest.webmanifest");
  const manifest = await (await page.request.get(manifestHref!)).json();
  // The id stays "/" from before v0.43.0, so installs keep their identity.
  expect(manifest).toMatchObject({ start_url: "/app/", scope: "/app/", id: "/" });

  // Every app icon, in the manifest and in <head>, loads from the base path.
  expect(manifest.icons.map((icon: { src: string }) => icon.src)).toEqual([
    "icons/icon-192.png",
    "icons/icon-512.png",
    "icons/icon-maskable-512.png",
    "icons/icon.svg",
  ]);
  expect(manifest.icons.find((i: { purpose: string }) => i.purpose === "maskable")).toBeTruthy();
  const headIcons = await page
    .locator('link[rel="icon"], link[rel="apple-touch-icon"]')
    .evaluateAll((links) => links.map((link) => link.getAttribute("href")!));
  expect(headIcons).toEqual([
    "/app/icons/favicon.svg",
    "/app/icons/favicon-32.png",
    "/app/icons/favicon.ico",
    "/app/icons/apple-touch-icon.png",
  ]);
  for (const href of [
    ...headIcons,
    ...manifest.icons.map((i: { src: string }) => `/app/${i.src}`),
  ]) {
    expect((await page.request.get(href)).status(), href).toBe(200);
  }
});

test("the build puts the landing page at the site root, beside app/", () => {
  // vite preview serves only the app, so this checks the files Cloudflare gets.
  const landing = readFileSync("dist-e2e/index.html", "utf8");
  expect(landing).toContain('<script src="/legacy-redirect.js"></script>');
  expect(landing).toContain('href="/app/"');
  for (const file of ["legacy-redirect.js", "sw.js", "_headers", "app/index.html", "app/sw.js"]) {
    expect(existsSync(`dist-e2e/${file}`), file).toBe(true);
  }
  expect(existsSync("dist-e2e/README.md")).toBe(false);
});
