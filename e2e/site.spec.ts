import { expect, test } from "@playwright/test";
import { watchCsp } from "./cspWatch";

// The home page (/) and the guide (/guide/) sit beside the app (/app/) in
// the same build. The tests' base URL is the app, so these use full paths.

test("the home page shows what is different and links to the app and guide", async ({ page }) => {
  const violations = await watchCsp(page);
  await page.goto("/");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Give every dollar a job");
  await expect(
    page.getByRole("heading", { level: 2, name: /habits that make budgets work/ }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Open the app" }).first()).toHaveAttribute(
    "href",
    "/app/",
  );
  await expect(page.getByRole("link", { name: "Guide", exact: true }).first()).toHaveAttribute(
    "href",
    "/guide/",
  );
  await expectImagesLoad(page);
  expect(await violations()).toEqual([]);
});

test("the guide has a picture for its steps, and every picture loads", async ({ page }) => {
  const violations = await watchCsp(page);
  await page.goto("/guide/");
  await expect(
    page.getByRole("heading", { level: 1, name: "How to use Enough Money" }),
  ).toBeVisible();
  // Every contents link points at a section on the page.
  const targets = await page
    .getByRole("navigation", { name: "Contents" })
    .getByRole("link")
    .evaluateAll((links) => links.map((a) => a.getAttribute("href")!));
  expect(targets.length).toBeGreaterThan(10);
  for (const target of targets) await expect(page.locator(target)).toHaveCount(1);
  await expectImagesLoad(page);
  expect(await violations()).toEqual([]);
});

test("old app links to / go on to the app", async ({ page }) => {
  // The app lived at / until v0.39.0: its pages were in the hash.
  await page.goto("/#settings");
  await expect(page).toHaveURL(/\/app\/#settings$/);
  await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
});

test("only the app is kept for offline use", async ({ page }) => {
  const worker = await (await page.request.get("/sw.js")).text();
  expect(worker).toContain('"app/index.html"');
  expect(worker).not.toMatch(/url:"index\.html"|url:"guide\//);
});

/** Loads every lazy picture and checks none is broken. */
async function expectImagesLoad(page: import("@playwright/test").Page) {
  const broken = await page.evaluate(async () => {
    const images = [...document.images];
    for (const image of images) image.loading = "eager";
    await Promise.all(images.map((image) => image.decode().catch(() => undefined)));
    return images.filter((image) => image.naturalWidth === 0).map((image) => image.src);
  });
  expect(broken).toEqual([]);
}
