import { expect, test, type Page } from "@playwright/test";
import {
  activityRow,
  addAccount,
  editActivityRow,
  goTo,
  openAccount,
  openAddTransaction,
  signInWithHousehold,
} from "./helpers";

const tagsSection = (page: Page) => page.getByRole("region", { name: "Tags", exact: true });
const tagField = (scope: Page | ReturnType<Page["getByRole"]>) =>
  scope.getByRole("combobox", { name: "Tags" });
const chips = (page: Page, payee: string) => activityRow(page, payee).locator(".tag-chip");

async function add(page: Page, payee: string, amount: string, date: string) {
  const dialog = await openAddTransaction(page);
  await dialog.getByLabel("Amount").first().fill(amount);
  await dialog.getByLabel("Payee").fill(payee);
  await dialog.getByLabel("Date").fill(date);
  return dialog;
}

test.beforeEach(async ({ page }) => {
  page.on("dialog", (dialog) => dialog.accept());
  await signInWithHousehold(page);
  await addAccount(page, { name: "Checking", balance: "1000", date: "2030-01-01" });
});

test("tags are made in Settings, renamed and recoloured", async ({ page }) => {
  await goTo(page, "Settings");
  const section = tagsSection(page);
  await section.getByLabel("New tag").fill("Trip");
  await section.getByRole("button", { name: "Add tag" }).click();
  const list = section.getByRole("list", { name: "Tags" });
  await expect(list).toContainText("Trip");
  await expect(list).toContainText("Not used yet");

  // A name another tag has (ignoring case) is refused.
  await section.getByLabel("New tag").fill("trip");
  await section.getByRole("button", { name: "Add tag" }).click();
  await expect(section.getByRole("alert")).toHaveText("There is already a tag called “Trip”.");

  await section.getByRole("button", { name: "Edit tag Trip" }).click();
  const edit = section.getByRole("form", { name: "Edit tag Trip" });
  await edit.getByLabel("Name").fill("Beach trip");
  await edit.getByRole("radio", { name: "teal" }).check();
  await edit.getByRole("button", { name: "Save" }).click();
  await expect(list.locator(".tag-chip.tag-teal")).toHaveText("Beach trip");
});

test("the form adds, creates and removes tags, and rows show them", async ({ page }) => {
  await openAccount(page, "Checking");
  const dialog = await add(page, "Hotel", "120.00", "2030-01-05");
  const field = tagField(dialog);
  await field.fill("work");
  // No tag yet: offered as a new one.
  await dialog.getByRole("option", { name: "Add tag “work”" }).click();
  await field.fill("Trip");
  await field.press("Enter");
  await expect(dialog.locator(".tag-box .tag-name")).toHaveText(["Trip", "work"]);
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(chips(page, "Hotel")).toHaveText(["Trip", "work"]);

  // Editing: the existing tag is offered; a chip's × takes a tag off.
  await editActivityRow(page, "Hotel");
  const edit = page.getByRole("dialog", { name: "Edit transaction" });
  await edit.getByRole("button", { name: "Remove tag work" }).click();
  await edit.getByRole("button", { name: "Save changes" }).click();
  await expect(edit).toBeHidden();
  await expect(chips(page, "Hotel")).toHaveText(["Trip"]);

  // Both tags exist in Settings, with how often each is used.
  await goTo(page, "Settings");
  const list = tagsSection(page).getByRole("list", { name: "Tags" });
  await expect(list.getByRole("listitem")).toHaveText([/Trip.*1 transaction/, /work.*Not used/]);
});

test("search finds rows by tag; ticked rows are tagged at once; deleting a tag", async ({
  page,
}) => {
  await openAccount(page, "Checking");
  for (const [payee, date] of [
    ["Hotel", "2030-01-05"],
    ["Museum", "2030-01-06"],
    ["Groceries", "2030-01-07"],
  ] as const) {
    const dialog = await add(page, payee, "10.00", date);
    if (payee === "Hotel") {
      await tagField(dialog).fill("Trip");
      await dialog.getByRole("option", { name: "Add tag “Trip”" }).click();
    }
    await dialog.getByRole("button", { name: "Save", exact: true }).click();
    await expect(dialog).toBeHidden();
  }

  // Search: typing a tag offers it; choosing it keeps only its rows.
  const search = page.getByRole("combobox", { name: "Search transactions" });
  await search.fill("Tri");
  await page.getByRole("option", { name: /^Trip/ }).click();
  await expect(page.getByRole("button", { name: "Remove Tag: Trip filter" })).toBeVisible();
  await expect(page.locator(".activity-payee")).toHaveText(["Hotel"]);
  await page.getByRole("button", { name: "Clear search" }).click();

  // Tick Hotel and Museum, then put Trip on both.
  await activityRow(page, "Hotel").getByRole("checkbox").check();
  await activityRow(page, "Museum").getByRole("checkbox").check();
  const bar = page.getByRole("toolbar", { name: "Selected transactions" });
  await bar.getByRole("button", { name: "Tags" }).click();
  const trip = bar.getByRole("button", { name: /^Trip:/ });
  await expect(trip).toHaveAttribute("aria-pressed", "mixed");
  await trip.click();
  await expect(trip).toHaveAttribute("aria-pressed", "true");
  await expect(chips(page, "Museum")).toHaveText(["Trip"]);
  await expect(chips(page, "Groceries")).toHaveCount(0);

  // A new tag from the bar goes on every ticked row.
  await bar.getByRole("textbox", { name: "New tag" }).fill("Paris");
  await bar.getByRole("button", { name: "Add", exact: true }).click();
  await expect(chips(page, "Hotel")).toHaveText(["Paris", "Trip"]);
  await expect(chips(page, "Museum")).toHaveText(["Paris", "Trip"]);

  // Tapping a tag every row has takes it off them all.
  await trip.click();
  await expect(chips(page, "Museum")).toHaveText(["Paris"]);
  await bar.getByRole("button", { name: "Clear selection" }).click();

  // Deleting a tag takes it off its transactions; they stay.
  await goTo(page, "Settings");
  await tagsSection(page).getByRole("button", { name: "Delete tag Paris" }).click();
  await expect(tagsSection(page).getByRole("list", { name: "Tags" })).not.toContainText("Paris");
  await openAccount(page, "Checking");
  await expect(chips(page, "Hotel")).toHaveCount(0);
  await expect(activityRow(page, "Museum")).toBeVisible();
});
