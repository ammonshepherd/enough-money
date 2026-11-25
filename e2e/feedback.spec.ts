import { expect, test, type Page } from "@playwright/test";
import { goTo, signInWithHousehold } from "./helpers";

const footerLink = (page: Page) =>
  page.locator(".page-footer").getByRole("link", { name: "Give Feedback", exact: true });
const feedbackForm = (page: Page) => page.getByRole("form", { name: "Feedback" });

test("every page ends with a Give Feedback link to the form, also listed on Manage", async ({
  page,
}) => {
  await signInWithHousehold(page);
  for (const name of ["Budget", "Accounts", "Manage"] as const) {
    await goTo(page, name);
    await expect(footerLink(page)).toBeVisible();
  }
  // Manage lists it too.
  await page
    .getByRole("navigation", { name: "Manage options" })
    .getByRole("link", { name: /^Give Feedback/ })
    .click();
  await expect(page).toHaveURL(/#manage\/feedback$/);
  await expect(feedbackForm(page)).toBeVisible();

  await goTo(page, "Budget");
  await footerLink(page).click();
  await expect(page).toHaveURL(/#manage\/feedback$/);
  await expect(feedbackForm(page)).toBeVisible();
  await expect(footerLink(page)).toHaveAttribute("aria-current", "page");
});

// The UI tests use the in-memory store, which checks the message like the
// send-feedback function but sends no email.
test("Give Feedback sends the message and clears the form", async ({ page }) => {
  await signInWithHousehold(page);
  await footerLink(page).click();

  const form = feedbackForm(page);
  const message = form.getByLabel("Message");
  const send = form.getByRole("button", { name: "Send" });

  // Nothing to send until something is written.
  await expect(send).toBeDisabled();
  await message.fill("   ");
  await expect(send).toBeDisabled();

  await message.fill("The Budget page could show last month's Spent.");
  await send.click();
  await expect(form.getByRole("status")).toHaveText("Thanks! Your feedback was sent.");
  await expect(message).toHaveValue("");

  // Writing again clears the thanks.
  await message.fill("One more idea");
  await expect(form.getByRole("status")).toHaveText("");
});

test("Give Feedback stops at 5,000 characters", async ({ page }) => {
  await signInWithHousehold(page);
  await footerLink(page).click();
  const message = feedbackForm(page).getByLabel("Message");
  await message.fill("a".repeat(5005));
  await expect(message).toHaveValue("a".repeat(5000));
});
