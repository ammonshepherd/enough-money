import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  activityRow,
  addAccount,
  openAccount,
  openAddTransaction,
  signInWithHousehold,
  openManage,
} from "./helpers";

const payeesSection = (page: Page) => page.getByRole("region", { name: "Payees", exact: true });
const suggestions = (dialog: Locator) => dialog.getByRole("listbox", { name: "Suggestions" });

/** Adds an Uncategorized outflow in the open account. */
async function add(page: Page, payee: string, amount: string) {
  const dialog = await openAddTransaction(page);
  await dialog.getByLabel("Amount").first().fill(amount);
  await dialog.getByLabel("Payee").fill(payee);
  await dialog.getByLabel("Date").fill("2030-01-05");
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog).toBeHidden();
}

test.beforeEach(async ({ page }) => {
  page.on("dialog", (dialog) => dialog.accept());
  await signInWithHousehold(page);
  await addAccount(page, { name: "Checking", balance: "1000", date: "2030-01-01" });
  await openAccount(page, "Checking");
});

test("typed payees are saved and suggested while typing", async ({ page }) => {
  await add(page, "Corner Market", "12.00");
  await add(page, "Farmers Market", "8.00");
  await add(page, "Farmers Market", "9.00");
  await add(page, "Hardware Store", "30.00");

  const dialog = await openAddTransaction(page);
  const payee = dialog.getByRole("combobox", { name: "Payee" });
  await payee.fill("mark");
  // Names containing the text; the more used one first.
  await expect(suggestions(dialog).getByRole("option")).toHaveText([
    "Farmers Market",
    "Corner Market",
  ]);
  await suggestions(dialog).getByRole("option", { name: "Corner Market" }).click();
  await expect(payee).toHaveValue("Corner Market");
  await expect(suggestions(dialog)).toBeHidden();

  // The keyboard picks one too; Escape closes the list, not the dialog.
  await payee.fill("hard");
  await payee.press("ArrowDown");
  await payee.press("Enter");
  await expect(payee).toHaveValue("Hardware Store");
  await payee.fill("far");
  await expect(suggestions(dialog)).toBeVisible();
  await payee.press("Escape");
  await expect(suggestions(dialog)).toBeHidden();
  await expect(dialog).toBeVisible();

  // Free text still works; Enter with nothing highlighted saves the form.
  await dialog.getByLabel("Amount").first().fill("5.00");
  await dialog.getByLabel("Date").fill("2030-01-06");
  await payee.fill("Bakery");
  await payee.press("Enter");
  await expect(dialog).toBeHidden();
  await expect(activityRow(page, "Bakery")).toBeVisible();

  await openManage(page, "Payees");
  await expect(
    payeesSection(page).getByRole("list", { name: "Payees" }).getByRole("listitem"),
  ).toHaveText([
    /Bakery.*1 transaction/,
    /Corner Market.*1 transaction/,
    /Farmers Market.*2 transactions/,
    /Hardware Store.*1 transaction/,
  ]);
});

test("Manage renames, merges and deletes payees", async ({ page }) => {
  await add(page, "Cornr Market", "12.00");
  await add(page, "Corner Market", "8.00");
  await add(page, "Gym", "40.00");

  await openManage(page, "Payees");
  const section = payeesSection(page);
  const list = section.getByRole("list", { name: "Payees" });

  // Renaming renames the payee's transactions too.
  await section.getByRole("button", { name: "Rename payee Gym" }).click();
  let edit = section.getByRole("form", { name: "Rename payee Gym" });
  await expect(edit).toContainText("Also renames it on its 1 transaction.");
  await edit.getByLabel("Name").fill("Fitness Club");
  await edit.getByRole("button", { name: "Save" }).click();
  await expect(list).toContainText("Fitness Club");
  await expect(list).not.toContainText("Gym");

  // Renaming to another payee's name (any case) merges the two.
  await section.getByRole("button", { name: "Rename payee Cornr Market" }).click();
  edit = section.getByRole("form", { name: "Rename payee Cornr Market" });
  await edit.getByLabel("Name").fill("corner market");
  await edit.getByRole("button", { name: "Save" }).click();
  await expect(list.getByRole("listitem")).toHaveText([
    /corner market.*2 transactions/,
    /Fitness Club.*1 transaction/,
  ]);

  // Deleting only stops suggesting it: the transaction keeps its payee.
  await section.getByRole("button", { name: "Delete payee Fitness Club" }).click();
  await expect(list.getByRole("listitem")).toHaveText([/corner market/]);

  await openAccount(page, "Checking");
  await expect(activityRow(page, "Fitness Club")).toBeVisible();
  await expect(activityRow(page, "corner market")).toHaveCount(2);
});
