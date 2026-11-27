import { expect, test, type Page } from "@playwright/test";
import { addAccount, editCell, envelope, signInWithHousehold } from "./helpers";

const planStart = (page: Page) => page.getByRole("region", { name: /^No plan for/ });
const planStrip = (page: Page) => page.getByRole("region", { name: "Plan", exact: true });

test("Expected income limits Planned, and a new month can reuse it", async ({ page }) => {
  await signInWithHousehold(page);
  await page.getByRole("link", { name: "adding an account" }).click();
  await addAccount(page, { name: "Checking", balance: "3000", date: "2030-01-01" });

  // The plan file's Income row sets the month's Expected income.
  await page.goto("./#budget/2030-01");
  await expect(planStrip(page)).toHaveCount(0);
  await planStart(page).getByRole("button", { name: "Upload a plan CSV" }).click();
  const upload = page.getByRole("dialog", { name: "Upload a plan for January 2030" });
  await upload.getByLabel("CSV file").setInputFiles({
    name: "plan.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("Income,,2000\nRent,Bills,1200\nFood,Everyday,400"),
  });
  await expect(upload.getByText("Planned after the import: $1,600.00 of $2,000.00")).toBeVisible();
  await upload.getByRole("button", { name: "Import 3 rows" }).click();
  await expect(upload).toBeHidden();
  await expect(planStrip(page)).toContainText("Planned $1,600.00 of $2,000.00");
  await expect(planStrip(page)).toContainText("$400.00 left to plan");

  // Raising a Planned may use only what is left; lowering is always fine.
  await editCell(page, "Food", "planned", "900");
  await expect(envelope(page, "Food").getByRole("alert")).toHaveText(
    "Only $400.00 left to plan in January 2030.",
  );
  await expect(envelope(page, "Food")).toContainText("Planned $400.00");
  await editCell(page, "Food", "planned", "800");
  await expect(planStrip(page)).toContainText("$0.00 left to plan");

  // February: the plan card offers January's Expected income in one tap.
  await page.goto("./#budget/2030-02");
  await planStart(page)
    .getByRole("button", { name: "January 2030’s Expected income $2,000.00" })
    .click();
  await expect(planStrip(page)).toContainText("Planned $0.00 of $2,000.00");
  await planStart(page).getByRole("button", { name: "Copy January 2030’s Planned" }).click();
  await expect(planStrip(page)).toContainText("$0.00 left to plan");

  // Lowering the income below the plan is allowed and shows how far over.
  await planStrip(page).getByRole("button").click();
  const sheet = page.getByRole("dialog", { name: "Expected income for February 2030" });
  await expect(sheet).toContainText("Income so far: $0.00 of $2,000.00 expected");
  await sheet.getByLabel("Expected income for February 2030").fill("1500.00");
  await sheet.getByRole("button", { name: "Save" }).click();
  await expect(sheet).toBeHidden();
  await expect(planStrip(page)).toContainText("Over planned $500.00");

  // Cleared, Planned has no limit again.
  await planStrip(page).getByRole("button").click();
  await sheet.getByRole("button", { name: /^Clear Expected income/ }).click();
  await expect(sheet).toBeHidden();
  await editCell(page, "Rent", "planned", "5000");
  await expect(envelope(page, "Rent")).toContainText("Planned $5,000.00");
  // February opened with no plan, so the strip waits for the month to open again.
  await expect(planStrip(page)).toHaveCount(0);
  await page.getByRole("link", { name: "Next month" }).click();
  await page.getByRole("link", { name: "Previous month" }).click();
  await expect(planStrip(page)).toContainText("Set Expected income");
});
