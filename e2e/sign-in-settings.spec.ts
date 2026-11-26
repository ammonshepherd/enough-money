import { expect, test, type Page } from "@playwright/test";
import { goTo, openManage, signInWithHousehold } from "./helpers";

// signInWithHousehold signs in with "password123"; the in-memory store then
// checks that as the current password, and treats taken@example.com as an
// email another account uses.

const openOption = (page: Page, name: string) => openManage(page, name);

test("Account Info holds the display name, email and password", async ({ page }) => {
  await signInWithHousehold(page);
  await openOption(page, "Account Info");
  await expect(page).toHaveURL(/#manage\/account$/);
  await expect(
    page.getByRole("dialog", { name: "Account Info" }).getByRole("heading", { level: 2 }),
  ).toHaveText(["Display name", "Change email", "Change password"]);
  // The old Change password and Change email links open it too.
  for (const old of ["password", "email"]) {
    await page.evaluate((hash) => (location.hash = hash), `#manage/${old}`);
    await expect(page.getByRole("form", { name: "Change display name" })).toBeVisible();
  }
});

test("a display name greets the user on Manage", async ({ page }) => {
  await signInWithHousehold(page);
  await goTo(page, "Manage");
  const greeting = page.locator(".manage-greeting");
  await expect(greeting).toHaveText("Hi, test@example.com");

  await openOption(page, "Account Info");
  const form = page.getByRole("form", { name: "Change display name" });
  await form.getByLabel("Display name").fill("  Sam   Smith ");
  await form.getByRole("button", { name: "Save name" }).click();
  await expect(form.getByRole("status")).toHaveText("Your display name was saved.");
  await expect(form.getByLabel("Display name")).toHaveValue("Sam Smith");
  await page
    .getByRole("dialog", { name: "Account Info" })
    .getByRole("button", { name: "Close" })
    .click();
  await expect(greeting).toHaveText("Hi, Sam Smith");

  // Emptied, the greeting uses the email again.
  await openOption(page, "Account Info");
  await form.getByLabel("Display name").fill("");
  await form.getByRole("button", { name: "Save name" }).click();
  await expect(form.getByRole("status")).toHaveText("Your display name was saved.");
  await page
    .getByRole("dialog", { name: "Account Info" })
    .getByRole("button", { name: "Close" })
    .click();
  await expect(greeting).toHaveText("Hi, test@example.com");
});

test("Change password checks the current one and the new one", async ({ page }) => {
  await signInWithHousehold(page);
  await openOption(page, "Account Info");
  const form = page.getByRole("form", { name: "Change password" });
  const save = form.getByRole("button", { name: "Change password" });
  const fill = async (current: string, next: string, confirm = next) => {
    await form.getByLabel("Current password").fill(current);
    await form.getByLabel("New password", { exact: true }).fill(next);
    await form.getByLabel("Confirm new password").fill(confirm);
    await save.click();
  };

  await fill("password123", "a long new password", "a long new passwore");
  await expect(form.getByRole("alert")).toHaveText("The two passwords do not match.");
  await fill("not my password", "a long new password");
  await expect(form.getByRole("alert")).toHaveText("Your current password is not right.");
  await fill("password123", "a long new password");
  await expect(form.getByRole("status")).toContainText("Your password was changed.");
  await expect(form.getByLabel("Current password")).toHaveValue("");

  // The new password is now the current one.
  await fill("password123", "yet another password");
  await expect(form.getByRole("alert")).toHaveText("Your current password is not right.");
  await fill("a long new password", "yet another password");
  await expect(form.getByRole("status")).toContainText("Your password was changed.");
});

test("Change email refuses an email in use and sends links for a new one", async ({ page }) => {
  await signInWithHousehold(page);
  await openOption(page, "Account Info");
  const form = page.getByRole("form", { name: "Change email" });
  const send = async (email: string, password = "password123") => {
    await form.getByLabel("New email").fill(email);
    await form.getByLabel("Current password").fill(password);
    await form.getByRole("button", { name: "Change email" }).click();
  };

  await send("Test@Example.com");
  await expect(form.getByRole("alert")).toHaveText("That is already your email.");
  await send("taken@example.com");
  await expect(form.getByRole("alert")).toHaveText("Another account already uses that email.");
  await send("new@example.com", "wrong password");
  await expect(form.getByRole("alert")).toHaveText("Your current password is not right.");
  await send(" New@Example.com ");
  await expect(form.getByRole("status")).toHaveText(
    "Check test@example.com and new@example.com: open the link in each email to finish. Until then, sign in with test@example.com.",
  );
  // Still signed in as before until the links are opened.
  await page
    .getByRole("dialog", { name: "Account Info" })
    .getByRole("button", { name: "Close" })
    .click();
  await expect(page.locator(".manage-greeting")).toHaveText("Hi, test@example.com");
});

test("a Change email address link says what happened", async ({ page }) => {
  // The first of the two links changes nothing yet.
  await page.goto("./?token_hash=half&type=email_change#manage");
  const banner = page.getByRole("status").filter({ hasText: "Link accepted" });
  await expect(banner).toContainText("also open the link sent to your other address");
  await expect(page).toHaveURL(/\/app\/#manage$/);
  await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
  await banner.getByRole("button", { name: "OK" }).click();
  await expect(banner).toHaveCount(0);

  // The second signs in with the new email, with no password to choose.
  await page.goto("./?token_hash=abc&type=email_change");
  await expect(page.getByRole("status").filter({ hasText: "Your email is now" })).toContainText(
    "Your email is now changed@example.com.",
  );
  await expect(page.getByRole("heading", { level: 1, name: "Your household" })).toBeVisible();
});
