import { expect, test } from "@playwright/test";
import {
  addAccount,
  addGroupWithEnvelopes,
  editCell,
  openEnvelope,
  signInWithHousehold,
} from "./helpers";

test.beforeEach(async ({ page }) => {
  page.on("dialog", (dialog) => void dialog.accept()); // confirm() prompts
  await signInWithHousehold(page);
});

const pad = (n: number) => String(n).padStart(2, "0");
/** The last day of the month `ahead` months from now, as YYYY-MM-DD. */
const endOfMonth = (ahead: number) => {
  const now = new Date();
  const last = new Date(now.getFullYear(), now.getMonth() + ahead + 1, 0);
  return `${last.getFullYear()}-${pad(last.getMonth() + 1)}-${pad(last.getDate())}`;
};

test("an envelope goal shows progress and the pace, and is archived once met", async ({ page }) => {
  await addAccount(page, { name: "Checking", balance: "5000" });
  await addAccount(page, { name: "Visa", owed: "0" });
  await addGroupWithEnvelopes(page, "Saving Up", ["Vacation"]);
  await editCell(page, "Vacation", "assigned", "300");

  let sheet = await openEnvelope(page, "Vacation");
  const goal = sheet.getByRole("region", { name: "Goal" });
  await goal.getByRole("button", { name: "Set a goal…" }).click();
  await goal.getByLabel("Goal amount for Vacation").fill("1200");

  // A date before today is refused.
  await goal.getByLabel("Goal date for Vacation").fill("2020-01-31");
  await goal.getByRole("button", { name: "Save goal" }).click();
  await expect(goal).toContainText("Pick a goal date from today on.");

  // Three months, this one included: $900.00 to go is $300.00 a month.
  await goal.getByLabel("Goal date for Vacation").fill(endOfMonth(2));
  await goal.getByRole("button", { name: "Save goal" }).click();
  await expect(goal.locator(".goal-amount")).toHaveText("$1,200.00");
  await expect(goal.locator(".goal-have")).toHaveText("$300.00 saved · 25%");
  await expect(goal.locator(".goal-status")).toHaveText("$900.00 to go");
  await expect(goal.locator(".goal-pace dl > div").first()).toHaveText("a month$300.00");
  await expect(goal.locator(".goal-left")).toContainText("3 months");

  // Editing changes it; Planned and Remaining stay as they were.
  await goal.getByRole("button", { name: "Edit goal" }).click();
  await expect(goal.getByLabel("Goal amount for Vacation")).toHaveValue("1200.00");
  await goal.getByLabel("Goal amount for Vacation").fill("600");
  await goal.getByRole("button", { name: "Save goal" }).click();
  await expect(goal.locator(".goal-status")).toHaveText("$300.00 to go");
  await expect(sheet.locator(".sheet-hero-amount")).toHaveText("$300.00");

  // Reaching it: a full ring, "Goal reached" and Archive goal.
  await sheet.getByLabel("Close").click();
  await editCell(page, "Vacation", "assigned", "600");
  sheet = await openEnvelope(page, "Vacation");
  await expect(goal.locator(".goal-status")).toHaveText("Goal reached");
  await expect(goal.locator(".goal-have")).toHaveText("$600.00 saved · 100%");
  await goal.getByRole("button", { name: "Archive goal" }).click();
  await expect(goal.getByRole("button", { name: "Set a goal…" })).toBeVisible();

  // A card's payment envelope has no goal.
  await sheet.getByLabel("Close").click();
  sheet = await openEnvelope(page, "Visa payment");
  await expect(sheet.getByRole("region", { name: "Goal" })).toHaveCount(0);
});

test("a goal can be removed", async ({ page }) => {
  await addAccount(page, { name: "Checking", balance: "500" });
  await addGroupWithEnvelopes(page, "Saving Up", ["Bike"]);
  const sheet = await openEnvelope(page, "Bike");
  const goal = sheet.getByRole("region", { name: "Goal" });
  await goal.getByRole("button", { name: "Set a goal…" }).click();
  await goal.getByLabel("Goal amount for Bike").fill("400");
  await goal.getByLabel("Goal date for Bike").fill(endOfMonth(0));
  await goal.getByRole("button", { name: "Save goal" }).click();
  await expect(goal.locator(".goal-status")).toHaveText("$400.00 to go");
  await goal.getByRole("button", { name: "Edit goal" }).click();
  await goal.getByRole("button", { name: "Remove goal" }).click();
  await expect(goal.getByRole("button", { name: "Set a goal…" })).toBeVisible();
});
