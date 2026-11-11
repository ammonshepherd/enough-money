import { expect, test } from "@playwright/test";
import {
  editAccount,
  addGroupWithEnvelopes,
  openAccount,
  openEnvelope,
  available,
  envelope,
  editCell,
  goTo,
  openAddTransaction,
  signInWithHousehold,
  chooseEnvelope,
  addAccount,
  accountRow,
  pickerChoices,
} from "./helpers";

test("a credit card account owes money and gets a payment envelope", async ({ page }) => {
  await signInWithHousehold(page);
  await addAccount(page, { name: "Checking", balance: "1000" });

  // Choosing Credit card asks for the amount owed instead of a balance.
  await addAccount(page, { name: "Visa", owed: "200" });
  const visa = accountRow(page, "Visa");
  await expect(visa).toContainText("-$200.00");
  // Cards are listed under their own group.
  await expect(
    page.getByRole("region", { name: "Credit cards" }).getByRole("link", { name: /^Open Visa/ }),
  ).toBeVisible();

  // What the card owes does not lower Available to Assign; it shows as Uncovered.
  await goTo(page, "Budget");
  await expect(available(page)).toContainText("$1,000.00");
  // What the cards owe shows at the top of every page.
  await expect(page.locator(".card-debt")).toHaveText("Credit card debt$200.00");
  await goTo(page, "Settings");
  await expect(page.locator(".card-debt")).toContainText("$200.00");
  await goTo(page, "Budget");
  const payment = envelope(page, "Visa payment");
  await expect(page.getByRole("region", { name: "Credit card payments" })).toContainText(
    "Visa payment",
  );
  // Available to pay shows once: the amount on the right.
  await expect(payment.locator(".envelope-left")).toHaveText("$0.00 available to pay");
  await expect(payment).not.toContainText("Available to pay");
  await expect(payment).toContainText("Remaining debt $200.00");
  await expect(payment).not.toContainText("Assigned");

  // A purchase on the card, entered from the Budget page.
  const dialog = await openAddTransaction(page);
  await dialog.getByLabel("Account").selectOption({ label: "Visa" });
  await dialog.getByLabel("Amount").fill("30");
  await dialog.getByLabel("Payee").fill("Gas");
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog).toBeHidden();
  // Uncategorized card spending waits for review: only what is owed changes.
  await expect(available(page)).toContainText("$1,000.00");
  await expect(payment.locator(".envelope-remaining")).toHaveText("$0.00");
  await expect(payment).toContainText("Remaining debt $230.00");

  // Editing keeps the type and shows the amount owed.
  await goTo(page, "Accounts");
  await expect(visa).toContainText("-$230.00");
  const edit = await editAccount(page, "Visa");
  await expect(edit.getByRole("radiogroup", { name: "Account type" })).toHaveCount(0);
  await expect(edit.getByLabel("Amount owed on the opening date")).toHaveValue("200.00");
  await edit.getByLabel("Amount owed on the opening date").fill("250");
  await edit.getByRole("button", { name: "Save changes" }).click();
  // A card's pane shows Extra Paid in place of the opening balance, what is
  // owed (positive) on top, and the reconciled figure as Current Balance.
  // flows into the current balance, signed like it.
  await expect(page.locator(".account-figure").filter({ hasText: "Opening Balance" })).toHaveCount(
    0,
  );
  await expect(page.locator(".account-figure").filter({ hasText: "Extra Paid" })).toContainText(
    "$0.00",
  );
  await expect(page.locator(".account-figure").filter({ hasText: "Total Owed" })).toContainText(
    "$280.00",
  );
  await expect(page.locator(".account-figure").filter({ hasText: "Total Owed" })).not.toContainText(
    "-",
  );
  await expect(page.locator(".account-figure dt")).toHaveText([
    "Money In",
    "Money Out",
    "Total Owed",
    "Extra Paid",
    "Month Start",
    "Current Balance",
  ]);

  // Renaming the card renames its payment envelope.
  const rename = await editAccount(page, "Visa");
  await rename.getByLabel("Account name").fill("Visa Gold");
  await rename.getByRole("button", { name: "Save changes" }).click();
  await goTo(page, "Budget");
  await expect(envelope(page, "Visa Gold payment")).toContainText("Remaining debt $280.00");
});

test("pay a card from checking, covering what the payment envelope lacks", async ({ page }) => {
  await signInWithHousehold(page);
  await addAccount(page, { name: "Checking", balance: "1000" });

  await addGroupWithEnvelopes(page, "Everyday", ["Groceries"]);
  await editCell(page, "Groceries", "assigned", "100");

  await goTo(page, "Accounts");
  await addAccount(page, { name: "Visa", owed: "200" });
  await expect(accountRow(page, "Visa")).toContainText("-$200.00");

  // A $40 grocery purchase on the card moves $40 into Visa payment.
  await goTo(page, "Budget");
  let dialog = await openAddTransaction(page);
  // The payment envelope fills itself, so it is not an envelope choice.
  const choices = await pickerChoices(dialog.getByLabel("Envelope"));
  await expect(choices.filter({ hasText: "Groceries" })).toHaveCount(1);
  await expect(choices.filter({ hasText: "Visa payment" })).toHaveCount(0);
  await dialog.getByLabel("Envelope").press("Escape");
  await dialog.getByLabel("Account").selectOption({ label: "Visa" });
  await dialog.getByLabel("Amount").fill("40");
  await dialog.getByLabel("Payee").fill("Market");
  await chooseEnvelope(dialog.getByLabel("Envelope"), "Groceries");
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog).toBeHidden();
  const payment = envelope(page, "Visa payment");
  await expect(payment.locator(".envelope-remaining")).toHaveText("$40.00");
  await expect(envelope(page, "Groceries").locator(".envelope-remaining")).toHaveText("$60.00");
  await expect(available(page)).toContainText("$900.00");

  // Pay $140 from checking: one entry, a Transfer to the Visa.
  dialog = await openAddTransaction(page);
  await dialog.getByLabel("Amount").fill("140");
  await dialog.getByLabel("Payee").fill("Visa payment");
  await chooseEnvelope(dialog.getByLabel("Envelope"), "Transfer (not spending or income)");
  await expect(dialog.getByLabel("To account")).toHaveValue(/.+/);
  await expect(dialog.getByRole("note")).toHaveText("Also adds the matching inflow in Visa.");
  await dialog.getByRole("button", { name: "Save", exact: true }).click();

  // Visa payment holds only $40, so the other $100 must be covered.
  const cover = dialog.getByRole("alertdialog");
  await expect(cover).toContainText("Visa payment would be $100.00 short");
  await chooseEnvelope(cover.getByLabel(/cover .* from/i), "Available to Assign");
  await cover.getByRole("button", { name: "Cover and save" }).click();
  await expect(dialog).toBeHidden();

  await expect(available(page)).toContainText("$800.00");
  await expect(payment.locator(".envelope-remaining")).toHaveText("$0.00");
  // Available to pay shows once: the amount on the right.
  await expect(payment.locator(".envelope-left")).toHaveText("$0.00 available to pay");
  await expect(payment).not.toContainText("Available to pay");
  await expect(payment).toContainText("Remaining debt $100.00");
  await goTo(page, "Accounts");
  await expect(accountRow(page, "Visa")).toContainText("-$100.00");
  await expect(accountRow(page, "Checking")).toContainText("$860.00");

  // $40 of the payment was for the card's own charges; the other $100 paid
  // down older debt: that is Extra paid, on the card's pane for this month
  // only, and in its payment envelope's sheet.
  await openAccount(page, "Visa");
  const extra = page.locator(".account-figure").filter({ hasText: "Extra Paid" });
  await expect(extra).toContainText("$100.00");
  await page.getByRole("link", { name: "Previous month" }).click();
  await expect(extra).toContainText("$0.00");
  // The month is shared with Budget: back to this month first.
  await page.getByRole("link", { name: "Next month" }).click();
  await expect(extra).toContainText("$100.00");
  await goTo(page, "Budget");
  const sheet = await openEnvelope(page, "Visa payment");
  await expect(sheet).toContainText("Extra paid $100.00 this month · $100.00 this year");
});

test("a payment nothing can cover is not suggested as Uncategorized", async ({ page }) => {
  await signInWithHousehold(page);
  await addAccount(page, { name: "Checking" });
  await addAccount(page, { name: "Visa", owed: "300" });

  // Checking holds $0, so nothing can cover an extra $300 payment.
  const dialog = await openAddTransaction(page);
  await dialog.getByLabel("Amount").fill("300");
  await chooseEnvelope(dialog.getByLabel("Envelope"), "Transfer (not spending or income)");
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  const cover = dialog.getByRole("alertdialog");
  await expect(cover).toContainText(
    "There isn’t enough money to cover this payment yet. Assign more to Visa payment or add income first",
  );
  await expect(cover).not.toContainText("Uncategorized");
  await expect(cover.getByRole("button", { name: "Cover and save" })).toBeDisabled();
});

test("the card payments group is pinned first and holds only card envelopes", async ({ page }) => {
  await signInWithHousehold(page);
  await addGroupWithEnvelopes(page, "Bills", ["Rent"]);
  await addAccount(page, { name: "Visa", owed: "50" });

  // On Budget it comes first, though it was made last, and has no +.
  await goTo(page, "Budget");
  const sections = page.locator("section.budget-group");
  await expect(sections.first()).toHaveAttribute("aria-label", "Credit card payments");
  const cards = page.getByRole("region", { name: "Credit card payments" });
  await expect(cards.getByRole("button", { name: /^Add envelope to/ })).toHaveCount(0);

  // In Settings it is pinned above the groups that can be dragged.
  await goTo(page, "Settings");
  const groups = page.getByRole("region", { name: "Envelope groups" });
  await expect(groups.getByRole("list", { name: "Pinned group" })).toContainText(
    "Credit card payments",
  );
  await expect(groups.getByRole("button", { name: "Move Credit card payments" })).toHaveCount(0);
  const sortable = groups.getByRole("list", { name: "Envelope groups" });
  await expect(sortable).toContainText("Bills");
  await expect(sortable).not.toContainText("Credit card payments");

  // An ordinary envelope cannot move into it.
  await goTo(page, "Budget");
  const sheet = await openEnvelope(page, "Rent");
  await expect(sheet.getByLabel("Group for Rent").locator("option")).toHaveText(["Bills"]);
});
