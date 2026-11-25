import { expect, test } from "@playwright/test";

// The in-memory store signs in an invited user for any token but "expired".

test("an invite link asks for a password, then for a household", async ({ page }) => {
  await page.goto("./?token_hash=abc123&type=invite#budget");
  await expect(page.getByRole("heading", { level: 1, name: "Choose a password" })).toBeVisible();
  // The token leaves the address bar at once; the route stays.
  await expect(page).toHaveURL(/\/app\/#budget$/);
  await expect(page.getByLabel("Email")).toHaveValue("invited@example.com");

  const save = page.getByRole("button", { name: "Save password" });
  await page.getByLabel("New password", { exact: true }).fill("short");
  await page.getByLabel("Confirm new password").fill("short");
  await save.click();
  // The browser's own minimum-length check stops it first; skip it to see ours.
  await page.locator("form").evaluate((form) => form.setAttribute("novalidate", ""));
  await save.click();
  await expect(page.getByRole("alert")).toHaveText("Use at least 12 characters.");

  await page.getByLabel("New password", { exact: true }).fill("a long password");
  await page.getByLabel("Confirm new password").fill("a long passwore");
  await save.click();
  await expect(page.getByRole("alert")).toHaveText("The two passwords do not match.");

  await page.getByLabel("Confirm new password").fill("a long password");
  await save.click();
  await expect(page.getByRole("heading", { level: 1, name: "Your household" })).toBeVisible();
  await page.getByLabel("Household name").fill("New Home");
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Budget" })).toBeVisible();
});

test("a reset link asks for a new password; signing out leaves it", async ({ page }) => {
  await page.goto("./?token_hash=abc123&type=recovery");
  await expect(
    page.getByRole("heading", { level: 1, name: "Choose a new password" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
});

test("a used or expired link says so on the sign-in page", async ({ page }) => {
  await page.goto("./?token_hash=expired&type=invite");
  await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("This link has expired or was already used");
  await expect(page).toHaveURL(/\/app\/$/);
});

test("Forgot password emails a link and goes back to sign in", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Forgot password?" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Reset password" })).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toHaveCount(0);
  await page.getByLabel("Email").fill("someone@example.com");
  await page.getByRole("button", { name: "Email me a link" }).click();
  await expect(page.getByRole("status")).toContainText(
    "If someone@example.com has an account, a link to reset its password is on its way.",
  );
  await page.getByRole("button", { name: "Back to sign in" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
});
