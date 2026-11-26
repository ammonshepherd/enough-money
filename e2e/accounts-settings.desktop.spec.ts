import { expect, test, type Page } from "@playwright/test";
import { accountRow, addAccount, goTo, openAccount, signInWithHousehold } from "./helpers";

// Accounts and Settings in the desktop layout (this project runs at 1280×800).

const panel = (page: Page) => page.locator("aside.side-panel");

test("Accounts adds in the panel; an open account edits and imports there", async ({ page }) => {
  await signInWithHousehold(page);
  await goTo(page, "Accounts");
  await expect(panel(page)).toHaveAccessibleName("Add an account");
  await expect(
    page.getByText("No accounts yet. Add your checking account on the right."),
  ).toBeVisible();
  // No + Add account button: the form is already in the panel.
  await expect(page.getByRole("button", { name: "Add account", exact: true })).toHaveCount(1);

  for (const [name, balance] of [
    ["Checking", "250"],
    ["Old Savings", "0"],
  ]) {
    await panel(page).getByLabel("Account name").fill(name);
    await panel(page).getByLabel("Opening balance").fill(balance);
    await panel(page).getByRole("button", { name: "Add account" }).click();
  }
  await expect(accountRow(page, "Checking")).toContainText("$250.00");

  // An open account: the pencil edits it in the panel, not in a sheet, and
  // focus goes back to the pencil afterwards.
  await accountRow(page, "Checking").click();
  const pencil = page.getByRole("button", { name: "Edit Checking" });
  await pencil.click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(panel(page)).toHaveAccessibleName("Edit Checking");
  // The transactions stay in view beside it.
  await expect(page.getByRole("region", { name: "Transactions" })).toBeVisible();
  await panel(page).getByRole("button", { name: "Cancel" }).click();
  await expect(panel(page)).toHaveAccessibleName("To review");
  await expect(pencil).toBeFocused();
  await pencil.click();
  await panel(page).getByLabel("Account name").fill("Everyday Checking");
  await panel(page).getByRole("button", { name: "Save changes" }).click();
  await expect(panel(page)).toHaveAccessibleName("To review");
  await expect(page.getByRole("heading", { level: 2, name: "Everyday Checking" })).toBeVisible();

  // Import CSV opens in the panel too, already in this account.
  await page.getByRole("button", { name: "Import CSV" }).click();
  await expect(panel(page)).toHaveAccessibleName("Import CSV into Everyday Checking");
  await expect(panel(page).getByLabel("Bank CSV file")).toBeVisible();
  await expect(panel(page).getByLabel("Account", { exact: true })).toHaveCount(0);

  // Close account from the panel; it returns to the list, where it is hidden.
  await openAccount(page, "Old Savings");
  await page.getByRole("button", { name: "Edit Old Savings" }).click();
  page.once("dialog", (dialog) => void dialog.accept());
  await panel(page).getByRole("button", { name: "Close account" }).click();
  await expect(page.getByRole("button", { name: "Show closed accounts (1)" })).toBeVisible();
  await expect(panel(page)).toHaveAccessibleName("Add an account");
});

test("Manage keeps its list on the left and opens each option beside it", async ({ page }) => {
  await signInWithHousehold(page);
  await goTo(page, "Manage");
  const list = page.getByRole("navigation", { name: "Manage options" });
  // With nothing chosen, Envelope groups is open beside the list.
  const groups = page.getByRole("region", { name: "Envelope groups" });
  await expect(groups).toBeVisible();
  await expect(list.getByRole("link", { name: /^Envelope groups/ })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await list.getByRole("link", { name: /^Tags/ }).click();
  await expect(page).toHaveURL(/#manage\/tags$/);
  const tags = page.getByRole("region", { name: "Tags", exact: true });
  const [l, t] = await Promise.all([list, tags].map(async (x) => (await x.boundingBox())!));
  // Side by side, the page the wider of the two; no back link on a desktop.
  expect(Math.abs(l!.y - t!.y)).toBeLessThan(40);
  expect(t!.x).toBeGreaterThan(l!.x + l!.width - 1);
  expect(t!.width).toBeGreaterThan(l!.width);
  await expect(list).toBeVisible();
  await expect(page.locator(".back-link")).toHaveCount(0);
});

test("no page menu on a desktop: sort, order and Sign out stay on the page", async ({ page }) => {
  await signInWithHousehold(page);
  await expect(page.getByRole("button", { name: / menu$/ })).toHaveCount(0);
  await addAccount(page, { name: "Checking", balance: "100" });
  await openAccount(page, "Checking");
  const sort = page.getByRole("combobox", { name: "Sort by" });
  const order = page.getByRole("combobox", { name: "Order" });
  await expect(sort).toHaveValue("date");
  await expect(order).toHaveValue("desc");
  // A new sort starts in its own order: Name A–Z.
  await sort.selectOption("name");
  await expect(order).toHaveValue("asc");
  await goTo(page, "Manage");
  await expect(page.getByRole("button", { name: /^Sign out/ })).toBeVisible();
});
