import { existsSync, readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

// vite preview serves only the app, so these check the landing page's built
// files (what Cloudflare serves at https://enoughmoney.app/).
const landing = () => readFileSync("dist-e2e/index.html", "utf8");

test("the landing page keeps to the Content Security Policy", () => {
  const html = landing();
  // Only external scripts and the one stylesheet: inline code would be blocked.
  expect(html).not.toMatch(/<script(?![^>]*\ssrc=)[^>]*>/);
  expect(html).not.toMatch(/<style[\s>]/);
  expect(html).not.toMatch(/\sstyle="/);
  // Everything it loads comes from this site.
  expect(html).not.toMatch(/(src|href)="(https?:)?\/\//);
  // The old-link redirect still runs first.
  expect(html.indexOf("<script")).toBe(html.indexOf('<script src="/legacy-redirect.js">'));
});

test("every picture and link on the landing page points at a built file or a section", () => {
  const html = landing();
  const images = [...html.matchAll(/<img[^>]*\ssrc="([^"]+)"/g)].map((m) => m[1]!);
  expect(images.length).toBeGreaterThan(10);
  for (const src of images) expect(existsSync(`dist-e2e${src}`), src).toBe(true);
  // Every picture says what it shows, apart from the decorative logo.
  const alts = [...html.matchAll(/<img[^>]*\salt="([^"]*)"/g)].map((m) => m[1]!);
  expect(alts.filter((alt) => alt === "")).toHaveLength(1);
  for (const id of [...html.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]!)) {
    expect(html, `#${id}`).toContain(`id="${id}"`);
  }
});

test("the landing page's own section links are not sent to the app", () => {
  // legacy-redirect.js forwards old app links (/#budget) but must leave these.
  const redirect = readFileSync("dist-e2e/legacy-redirect.js", "utf8");
  for (const id of [...landing().matchAll(/href="#([^"]+)"/g)].map((m) => m[1]!)) {
    expect(redirect, `#${id}`).toContain(`"#${id}"`);
  }
});
