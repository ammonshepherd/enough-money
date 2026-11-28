import { expect, test } from "@playwright/test";
import {
  addAccount,
  addGroupWithEnvelopes,
  choosePageMenu,
  envelope,
  openEnvelope,
  signInWithHousehold,
} from "./helpers";

test("an envelope's due day shows on its row, amber when near, and can be cleared", async ({
  page,
}) => {
  // 12 November 2026: the 15th is 3 days away, so soon; the 31st falls on the 30th.
  await page.clock.setFixedTime(new Date(2026, 10, 12, 10, 0, 0));
  await signInWithHousehold(page);
  await addAccount(page, { name: "Checking", balance: "2000", date: "2026-10-01" });
  await addAccount(page, { name: "Visa", owed: "0", date: "2026-10-01" });
  await addGroupWithEnvelopes(page, "Bills", ["Rent", "Phone"]);

  let sheet = await openEnvelope(page, "Rent");
  await sheet.getByLabel("Due day for Rent").selectOption({ label: "15th of each month" });
  await expect(envelope(page, "Rent").locator(".due-chip")).toHaveText("Due 15th (soon)");
  await sheet.getByRole("button", { name: "Close" }).click();

  sheet = await openEnvelope(page, "Phone");
  await sheet.getByLabel("Due day for Phone").selectOption({ label: "31st of each month" });
  await sheet.getByRole("button", { name: "Close" }).click();
  await expect(envelope(page, "Phone").locator(".due-chip")).toHaveText("Due 30th");
  await expect(envelope(page, "Phone").locator(".due-chip")).not.toHaveClass(/soon/);

  // A card's payment envelope can have one too.
  sheet = await openEnvelope(page, "Visa payment");
  await sheet.getByLabel("Due day for Visa payment").selectOption({ label: "1st of each month" });
  await sheet.getByRole("button", { name: "Close" }).click();
  await expect(envelope(page, "Visa payment").locator(".due-chip")).toHaveText("Due 1st");

  // Compact rows keep it on line 1.
  await choosePageMenu(page, "Compact rows");
  await expect(envelope(page, "Rent").locator(".due-chip")).toBeVisible();
  await choosePageMenu(page, "Compact rows");

  // Another month is never soon, and the 31st is the 31st in December.
  await page.getByRole("link", { name: "Next month" }).click();
  await expect(envelope(page, "Rent").locator(".due-chip")).toHaveText("Due 15th");
  await expect(envelope(page, "Phone").locator(".due-chip")).toHaveText("Due 31st");

  // A collapsed group's bar does not show it.
  await page.getByRole("button", { name: /^Bills/ }).click();
  await expect(envelope(page, "Rent")).toBeHidden();
  await expect(page.locator(".due-chip", { hasText: "15th" })).toBeHidden();
  await expect(page.getByRole("button", { name: /^Bills/ })).not.toContainText("Due");
  await page.getByRole("button", { name: /^Bills/ }).click();

  // None clears it.
  sheet = await openEnvelope(page, "Rent");
  await expect(sheet.getByLabel("Due day for Rent")).toHaveValue("15");
  await sheet.getByLabel("Due day for Rent").selectOption({ label: "None" });
  await sheet.getByRole("button", { name: "Close" }).click();
  await expect(envelope(page, "Rent").locator(".due-chip")).toHaveCount(0);
});
