import { expect, test, type Page } from "@playwright/test";
import {
  addAccount,
  addGroupWithEnvelopes,
  addTransaction,
  available,
  editCell,
  envelope,
  goTo,
  openEnvelope,
  pickerChoices,
  signInWithHousehold,
  chooseEnvelope,
  editActivityRow,
  openActivityMonth,
  openAddTransaction,
} from "./helpers";

test.beforeEach(async ({ page }) => {
  page.on("dialog", (dialog) => void dialog.accept()); // confirm() prompts
  await signInWithHousehold(page);
});

const iso = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const newAccount = (page: Page, name: string, opening: string, card = false) =>
  addAccount(page, card ? { name, owed: opening } : { name, balance: opening });

test("the sheet shows what is left, the plan and the month's transactions", async ({ page }) => {
  await newAccount(page, "Checking", "1000");
  await addGroupWithEnvelopes(page, "Weekly Basics", ["Groceries"]);
  await editCell(page, "Groceries", "assigned", "300");
  await editCell(page, "Groceries", "planned", "300");
  await addTransaction(page, { amount: "120", payee: "Market", envelope: "Groceries" });
  await goTo(page, "Budget");

  const sheet = await openEnvelope(page, "Groceries");
  await expect(sheet.locator(".sheet-eyebrow")).toHaveText("Weekly Basics");
  await expect(sheet.getByRole("heading", { name: "Groceries" })).toBeVisible();
  await expect(sheet.locator(".sheet-hero-amount")).toHaveText("$180.00");
  // Money flow: the amounts that add up to Remaining.
  const flow = sheet.getByRole("region", { name: "Money flow this month" });
  await expect(flow.locator(".money-flow-line")).toHaveText([
    "Assigned & moved+$300.00",
    "Spent−$120.00",
    "Remaining$180.00",
  ]);
  await expect(sheet.locator(".plan-line")).toHaveText(
    "Spent −$120.00 of $300.00 planned$180.00 under",
  );
  const activity = sheet.getByRole("region", { name: "Groceries transactions" });
  await expect(activity.getByRole("listitem")).toHaveCount(1);
  await expect(activity.getByRole("listitem")).toContainText("Market");
  await expect(activity.getByRole("listitem")).toContainText("-$120.00");

  // Planned edits here too: Enter saves, and the page behind updates.
  const planned = sheet.getByLabel("Planned amount for Groceries");
  await expect(planned).toHaveValue("300.00");
  await planned.fill("100");
  await planned.press("Enter");
  await expect(sheet.locator(".plan-line")).toHaveText(
    "Spent −$120.00 of $100.00 planned$20.00 over",
  );
  await expect(sheet.locator(".plan-line")).toHaveClass(/over/);

  // Escape undoes the typing without closing the sheet.
  await planned.fill("5.00");
  await planned.press("Escape");
  await expect(planned).toHaveValue("100.00");
  await expect(sheet).toBeVisible();

  // Assigned opens the number pad over the sheet, checked as on the row:
  // refused, the pad says why, and cancelling keeps the amount.
  const assigned = sheet.getByRole("button", { name: /^Edit assigned amount for Groceries/ });
  const pad = page.getByRole("dialog", { name: "Assigned for Groceries" });
  const press = async (...keys: string[]) => {
    for (const key of keys) await pad.getByRole("button", { name: key, exact: true }).click();
  };
  await assigned.click();
  await press("5", "0", "0", "0", "0", "0", "Assign");
  await expect(pad.getByRole("alert")).toHaveText("Only $700.00 available to assign.");
  await pad.getByRole("button", { name: "Cancel" }).click();
  await expect(pad).toBeHidden();
  await expect(assigned).toContainText("$300.00");
  await expect(sheet).toBeVisible();
  // + adds to what is there; the equation shows in the field as it is typed.
  await assigned.click();
  await press("Plus", "5", "0", "0", "0");
  await expect(assigned).toContainText("300.00 + 50.00");
  await expect(pad).toContainText("= $350.00");
  await press("Assign");
  await expect(pad).toBeHidden();
  await expect(sheet.locator(".sheet-hero-amount")).toHaveText("$230.00");

  await sheet.getByRole("button", { name: "Close" }).click();
  await expect(sheet).toBeHidden();
  await expect(envelope(page, "Groceries").locator(".envelope-remaining")).toHaveText("$230.00");
  await expect(available(page)).toContainText("$650.00");
});

test("tapping a transaction in the sheet opens it to edit, over the sheet", async ({ page }) => {
  await newAccount(page, "Checking", "1000");
  await addGroupWithEnvelopes(page, "Everyday", ["Groceries", "Fun"]);
  await editCell(page, "Groceries", "assigned", "300");
  await editCell(page, "Fun", "assigned", "100");
  await addTransaction(page, { amount: "120", payee: "Market", envelope: "Groceries" });
  await addTransaction(page, { amount: "15", payee: "Bakery", envelope: "Groceries" });
  await goTo(page, "Budget");

  const sheet = await openEnvelope(page, "Groceries");
  const activity = sheet.getByRole("region", { name: "Groceries transactions" });
  const edit = page.getByRole("dialog", { name: "Edit transaction" });

  // Edit the amount: the sheet behind updates and stays open.
  await activity.getByRole("button", { name: /^Edit Market, -\$120\.00, / }).click();
  await expect(edit.getByLabel("Payee")).toHaveValue("Market");
  await edit.getByLabel("Amount").fill("100");
  await edit.getByRole("button", { name: "Save changes" }).click();
  await expect(edit).toBeHidden();
  await expect(sheet).toBeVisible();
  await expect(activity.getByRole("listitem").filter({ hasText: "Market" })).toContainText(
    "-$100.00",
  );
  await expect(sheet.locator(".sheet-hero-amount")).toHaveText("$185.00");

  // Escape closes only the edit dialog.
  await activity.getByRole("button", { name: /^Edit Market/ }).click();
  await expect(edit).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(edit).toBeHidden();
  await expect(sheet).toBeVisible();

  // Moving it to another envelope takes it off this list.
  await activity.getByRole("button", { name: /^Edit Market/ }).click();
  await chooseEnvelope(edit.getByLabel("Envelope"), "Fun");
  // Fun has only $100: exactly enough, so no cover prompt.
  await edit.getByRole("button", { name: "Save changes" }).click();
  await expect(edit).toBeHidden();
  await expect(activity.getByRole("listitem")).toHaveCount(1);
  await expect(sheet.locator(".sheet-hero-amount")).toHaveText("$285.00");

  // Deleting from the dialog removes it too.
  await activity.getByRole("button", { name: /^Edit Bakery/ }).click();
  await edit.getByRole("button", { name: "Delete transaction" }).click();
  await expect(edit).toBeHidden();
  await expect(activity).toContainText("No transactions in this envelope this month.");
  await expect(sheet.locator(".sheet-hero-amount")).toHaveText("$300.00");
});

test("spending a month's leftover that next month already released asks to cover it", async ({
  page,
}) => {
  await newAccount(page, "Checking", "1000");
  await addGroupWithEnvelopes(page, "Often", ["Gifts"]);
  await editCell(page, "Gifts", "assigned", "50");

  // Next month releases the whole $50 that this month leaves over.
  await page.getByRole("link", { name: "Next month" }).click();
  const sheet = await openEnvelope(page, "Gifts");
  const saved = sheet.getByRole("region", { name: "Saved" });
  await saved.getByRole("button", { name: "Move some into Remaining…" }).click();
  await saved.getByLabel("Amount to move into Remaining").fill("50");
  await saved.getByRole("button", { name: "Move", exact: true }).click();
  await expect(sheet.locator(".sheet-hero-amount")).toHaveText("$50.00");
  await sheet.getByRole("button", { name: "Close" }).click();
  await page.getByRole("link", { name: "Previous month" }).click();

  // $20 fits this month's $50, but that $50 is already spoken for next month.
  await addTransaction(page, { amount: "20", payee: "Card shop", envelope: "Gifts" });
  const cover = page.getByRole("alertdialog");
  await expect(cover).toContainText("Gifts would be $20.00 short");
  await expect(cover).toContainText(
    /has already released, from Saved, the money Gifts leaves over/,
  );
  // Next month hasn't spent it, so releasing less there is offered first.
  await expect(cover).toContainText(/It hasn’t spent it, so .* can release less instead/);
  // Available to Assign comes first; releasing less next month is offered after it.
  await expect(cover.getByLabel(/cover .* from/i)).toHaveValue("Available to Assign");
  const choices = await pickerChoices(cover.getByLabel(/cover .* from/i));
  await expect(choices.nth(1)).toContainText("Release less in ");
  await choices.nth(1).click();
  await expect(cover.getByLabel(/cover .* from/i)).toHaveValue(/^Release less in /);
  await chooseEnvelope(cover.getByLabel(/cover .* from/i), "Available to Assign");
  await cover.getByRole("button", { name: "Cover and save" }).click();

  // Next month's Saved stays at $0.00 rather than going negative.
  await goTo(page, "Budget");
  await page.getByRole("link", { name: "Next month" }).click();
  await expect(envelope(page, "Gifts")).toContainText("Saved $0.00");
});

test("the cover prompt uses Available to Assign before Saved", async ({ page }) => {
  const opened = new Date();
  opened.setDate(1);
  opened.setMonth(opened.getMonth() - 1);
  await addAccount(page, { name: "Checking", balance: "1000", date: iso(opened) });
  await goTo(page, "Budget");
  await addGroupWithEnvelopes(page, "Often", ["Gifts"]);
  // Last month's $50 is Saved this month (transactions are added today).
  await page.getByRole("link", { name: "Previous month" }).click();
  await editCell(page, "Gifts", "assigned", "50");
  await page.getByRole("link", { name: "Next month" }).click();
  await expect(envelope(page, "Gifts")).toContainText("Saved $50.00");
  await expect(available(page)).toContainText("$950.00");

  // Available to Assign has enough: it is chosen, and Saved is left alone.
  await addTransaction(page, { amount: "30", payee: "Card shop", envelope: "Gifts" });
  let cover = page.getByRole("alertdialog");
  await expect(cover).toContainText("Gifts would be $30.00 short");
  await expect(cover).not.toContainText("Release $30.00");
  await expect(cover.getByLabel("Cover $30.00 from")).toHaveValue("Available to Assign");
  await cover.getByRole("button", { name: "Cover and save" }).click();
  await expect(cover).toBeHidden();
  await goTo(page, "Budget");
  await expect(envelope(page, "Gifts")).toContainText("Saved $50.00");
  await expect(available(page)).toContainText("$920.00");

  // Saved is still there to choose instead.
  await addTransaction(page, { amount: "20", payee: "Wrapping", envelope: "Gifts" });
  cover = page.getByRole("alertdialog");
  await chooseEnvelope(cover.getByLabel("Cover $20.00 from"), "Release from Saved");
  await cover.getByRole("button", { name: "Cover and save" }).click();
  await expect(cover).toBeHidden();
  await goTo(page, "Budget");
  await expect(envelope(page, "Gifts")).toContainText("Saved $30.00");
  await expect(available(page)).toContainText("$920.00");
});

test("moving next month's spending into this month can release less next month", async ({
  page,
}) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  const today = new Date();
  const next = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const thisMonthDay = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-01`;
  const nextMonth = `${next.getFullYear()}-${pad(next.getMonth() + 1)}`;

  await newAccount(page, "Checking", "1000");
  await addGroupWithEnvelopes(page, "Often", ["Gifts"]);
  await editCell(page, "Gifts", "assigned", "50");

  // Next month releases this month's $50 and spends it.
  await page.getByRole("link", { name: "Next month" }).click();
  const sheet = await openEnvelope(page, "Gifts");
  const saved = sheet.getByRole("region", { name: "Saved" });
  await saved.getByRole("button", { name: "Move some into Remaining…" }).click();
  await saved.getByLabel("Amount to move into Remaining").fill("50");
  await saved.getByRole("button", { name: "Move", exact: true }).click();
  await sheet.getByRole("button", { name: "Close" }).click();
  const dialog = await openAddTransaction(page);
  await dialog.getByLabel("Amount").first().fill("50");
  await dialog.getByLabel("Payee").fill("Card shop");
  await dialog.getByLabel("Date").fill(`${nextMonth}-02`);
  await chooseEnvelope(dialog.getByLabel("Envelope").first(), "Gifts");
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog).toBeHidden();

  // It belonged to this month: moving it back asks next month to release less.
  await openActivityMonth(page, nextMonth);
  await editActivityRow(page, "Card shop");
  const form = page.getByRole("form", { name: "Edit transaction" });
  await form.getByLabel("Date").fill(thisMonthDay);
  await form.getByRole("button", { name: "Save changes" }).click();
  const cover = page.getByRole("alertdialog");
  await expect(cover).toContainText("Gifts would be $50.00 short");
  // Available to Assign comes first; releasing less next month is offered after it.
  await expect(cover.getByLabel(/cover .* from/i)).toHaveValue("Available to Assign");
  const choices = await pickerChoices(cover.getByLabel(/cover .* from/i));
  await expect(choices.nth(1)).toContainText("Release less in ");
  await choices.nth(1).click();
  await expect(cover.getByLabel(/cover .* from/i)).toHaveValue(/^Release less in /);
  await cover.getByRole("button", { name: "Cover and save" }).click();
  await expect(cover).toBeHidden();

  // Next month (Budget opens in the month Accounts showed): nothing released,
  // nothing spent, nothing negative.
  await goTo(page, "Budget");
  const later = await openEnvelope(page, "Gifts");
  await expect(later.locator(".sheet-hero-amount")).toHaveText("$0.00");
  await expect(later.getByRole("region", { name: "Money flow this month" })).not.toContainText(
    "Released",
  );
  await later.getByRole("button", { name: "Close" }).click();
  await expect(envelope(page, "Gifts")).toContainText("Saved $0.00");
  // This month now spends the $50 it assigned.
  await page.getByRole("link", { name: "Previous month" }).click();
  const before = await openEnvelope(page, "Gifts");
  await expect(before.locator(".sheet-hero-amount")).toHaveText("$0.00");
});

test("Saved can be moved into Remaining from the sheet", async ({ page }) => {
  await newAccount(page, "Checking", "1000");
  await addGroupWithEnvelopes(page, "Often", ["Gifts"]);
  await editCell(page, "Gifts", "assigned", "50");

  // Nothing saved yet: a quiet panel, nothing to move.
  let sheet = await openEnvelope(page, "Gifts");
  const saved = sheet.getByRole("region", { name: "Saved" });
  await expect(saved).toContainText("Nothing saved yet");
  await expect(saved.getByRole("button", { name: "Move some into Remaining…" })).toHaveCount(0);
  await sheet.getByRole("button", { name: "Close" }).click();

  // Next month the $50 is Saved.
  await page.getByRole("link", { name: "Next month" }).click();
  sheet = await openEnvelope(page, "Gifts");
  await expect(saved).toHaveClass(/^saved-panel$/);
  await expect(saved.locator(".saved-panel-amount")).toHaveText("$50.00");
  await expect(saved.locator('svg[aria-hidden="true"]')).toHaveCount(2);
  await saved.getByRole("button", { name: "Move some into Remaining…" }).click();
  const amount = saved.getByLabel("Amount to move into Remaining");
  await amount.fill("60");
  await saved.getByRole("button", { name: "Move", exact: true }).click();
  await expect(saved.getByRole("alert")).toHaveText("Only $50.00 is saved.");
  await amount.fill("20");
  await saved.getByRole("button", { name: "Move", exact: true }).click();
  await expect(saved.locator(".saved-panel-amount")).toHaveText("$30.00");
  await expect(sheet.locator(".sheet-hero-amount")).toHaveText("$20.00");
  await expect(
    sheet.getByRole("region", { name: "Money flow this month" }).locator(".money-flow-line"),
  ).toHaveText([
    "Assigned & moved$0.00",
    "Released from Saved+$20.00",
    "Spent$0.00",
    "Remaining$20.00",
  ]);
  // Nothing planned this month.
  await expect(sheet.locator(".plan-line")).toHaveText("Spent $0.00 · nothing planned this month");
  // Moving Saved does not change Available to Assign.
  await expect(available(page)).toContainText("$950.00");
});

test("an envelope is deleted from its sheet", async ({ page }) => {
  await newAccount(page, "Checking", "100");
  await addGroupWithEnvelopes(page, "Everyday", ["Old", "Keep"]);
  const sheet = await openEnvelope(page, "Old");
  await sheet.getByRole("button", { name: "Delete envelope" }).click();
  await expect(sheet).toBeHidden();
  await expect(envelope(page, "Old")).toHaveCount(0);
  await expect(envelope(page, "Keep")).toBeVisible();
});

test("a card's payment envelope sheet shows what can be paid and takes assigning", async ({
  page,
}) => {
  await newAccount(page, "Checking", "1000");
  await newAccount(page, "Visa", "200", true);
  await goTo(page, "Budget");
  const sheet = await openEnvelope(page, "Visa payment");
  await expect(sheet.locator(".sheet-hero-label")).toHaveText("Available to pay");
  await expect(sheet.locator(".sheet-hero-parts")).toHaveText([
    "Owed $200.00 · Remaining debt $200.00",
    "Extra paid $0.00 this month · $0.00 this year",
  ]);
  await expect(sheet.getByRole("button", { name: "Delete envelope" })).toHaveCount(0);
  await sheet.getByLabel("Assign (negative to take back)").fill("150");
  await sheet.getByRole("button", { name: "Assign", exact: true }).click();
  await expect(sheet.locator(".sheet-hero-amount")).toHaveText("$150.00");
  await expect(sheet.locator(".sheet-hero-parts")).toHaveText([
    "Owed $200.00 · Remaining debt $50.00",
    "Extra paid $0.00 this month · $0.00 this year",
  ]);
});
