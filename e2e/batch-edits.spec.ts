import { expect, test, type Page } from "@playwright/test";
import {
  activityRow,
  addAccount,
  addGroupWithEnvelopes,
  chooseEnvelope,
  editActivityRow,
  goTo,
  openAccount,
  openAddTransaction,
  signInWithHousehold,
} from "./helpers";

async function add(
  page: Page,
  tx: { payee: string; amount: string; date: string; envelope?: string; inflow?: boolean },
) {
  const dialog = await openAddTransaction(page);
  if (tx.inflow) await dialog.getByRole("radio", { name: "Inflow" }).check();
  await dialog.getByLabel("Amount").first().fill(tx.amount);
  await dialog.getByLabel("Payee").fill(tx.payee);
  await dialog.getByLabel("Date").fill(tx.date);
  if (tx.envelope) await chooseEnvelope(dialog.getByLabel("Envelope").first(), tx.envelope);
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog).toBeHidden();
}

const bar = (page: Page) => page.getByRole("toolbar", { name: "Selected transactions" });
const tick = (page: Page, payee: string) =>
  activityRow(page, payee).getByRole("checkbox").first().check();
const batchDialog = (page: Page) =>
  page.getByRole("dialog", { name: "Change ticked transactions" });

test.beforeEach(async ({ page }) => {
  await signInWithHousehold(page);
  await addAccount(page, { name: "Checking", balance: "500", date: "2030-01-01" });
  await addAccount(page, { name: "Savings", balance: "0", date: "2030-01-01" });
  await goTo(page, "Budget");
  await addGroupWithEnvelopes(page, "Everyday", ["Groceries"]);
  await openAccount(page, "Checking");
  await add(page, { payee: "Lunch", amount: "12.00", date: "2030-01-02" });
  await add(page, {
    payee: "Refund",
    amount: "5.00",
    date: "2030-01-03",
    envelope: "Groceries",
    inflow: true,
  });
  await add(page, { payee: "Shop", amount: "5.00", date: "2030-01-04", envelope: "Groceries" });
  await add(page, {
    payee: "To savings",
    amount: "40.00",
    date: "2030-01-05",
    envelope: "Transfer (not spending or income)",
  });
});

test("changes the date of ticked rows, leaving out a transfer", async ({ page }) => {
  await tick(page, "Lunch");
  await tick(page, "To savings");
  await bar(page).getByRole("button", { name: "Change date" }).click();
  const dialog = batchDialog(page);
  await expect(dialog).toContainText("1 ticked row can’t be changed together");
  await expect(dialog).toContainText("Transfer");
  const confirm = dialog.getByRole("button", { name: /^Change \d+ dates?$/ });
  await expect(confirm).toBeDisabled();

  await dialog.getByRole("button", { name: "Untick this row" }).click();
  await expect(activityRow(page, "To savings").getByRole("checkbox")).not.toBeChecked();
  await dialog.getByLabel("New date").fill("2030-01-20");
  await expect(dialog).toContainText("Change date of 1 transaction, −$12.00");
  await dialog.getByRole("button", { name: "Change 1 date" }).click();
  await expect(dialog).toBeHidden();
  await expect(bar(page)).toHaveCount(0);

  await editActivityRow(page, "Lunch");
  await expect(
    page.getByRole("dialog", { name: "Edit transaction" }).getByLabel("Date"),
  ).toHaveValue("2030-01-20");
});

test("moves ticked rows to another account of the same kind", async ({ page }) => {
  await tick(page, "Lunch");
  await tick(page, "Shop");
  await bar(page).getByRole("button", { name: "Move" }).click();
  const dialog = batchDialog(page);
  await expect(dialog.getByLabel("To account")).toHaveValue(/.+/);
  await expect(dialog.getByLabel("To account").locator("option")).toHaveText(["Savings"]);
  await expect(dialog).toContainText("Move 2 transactions, −$17.00 to Savings.");
  await dialog.getByRole("button", { name: "Move 2 transactions" }).click();
  await expect(dialog).toBeHidden();
  await expect(activityRow(page, "Lunch")).toHaveCount(0);

  await openAccount(page, "Savings");
  await expect(activityRow(page, "Lunch")).toBeVisible();
  // Its envelope came with it.
  await expect(activityRow(page, "Shop")).toContainText("Groceries");
});

test("refuses a delete that would leave an envelope short, until it is unticked", async ({
  page,
}) => {
  // Shop spent the refund: deleting the refund alone leaves Groceries short.
  await tick(page, "Refund");
  await bar(page).getByRole("button", { name: "Delete" }).click();
  const dialog = batchDialog(page);
  await expect(dialog).toContainText("Groceries would be $5.00 short in January 2030");
  await expect(dialog.getByRole("button", { name: "Delete 1 transaction" })).toBeDisabled();
  await dialog.getByRole("button", { name: "Untick the 1 row causing this" }).click();
  await expect(dialog).toContainText("No ticked rows left to change.");
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();

  // Deleting the spending with it is fine.
  await tick(page, "Refund");
  await tick(page, "Shop");
  await bar(page).getByRole("button", { name: "Delete" }).click();
  await expect(dialog).toContainText("Delete 2 transactions, $0.00 for good.");
  await dialog.getByRole("button", { name: "Delete 2 transactions" }).click();
  await expect(dialog).toBeHidden();
  await expect(activityRow(page, "Refund")).toHaveCount(0);
  await expect(activityRow(page, "Shop")).toHaveCount(0);
  await expect(activityRow(page, "Lunch")).toBeVisible();
});
