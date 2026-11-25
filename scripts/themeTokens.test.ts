// The theme colour maths (src/models/themeColour.ts) starts from the purple
// palette it lists; this keeps that list the same as styles/01-tokens.css.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PURPLE } from "../src/models/themeColour.ts";

const css = readFileSync(new URL("../src/styles/01-tokens.css", import.meta.url), "utf8");

/** The CSS variables one block of 01-tokens.css sets. */
function tokens(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  const block = css.slice(start, css.indexOf("\n}", start));
  return Object.fromEntries(
    [...block.matchAll(/^\s+(--[\w-]+):\s*([^;]+);/gm)].map((m) => [m[1], m[2]?.trim()]),
  );
}

describe("the purple palette in themeColour.ts", () => {
  it.each(["light", "dark"] as const)("matches 01-tokens.css (%s)", (theme) => {
    const set = tokens(theme === "light" ? ":root" : ':root[data-theme="dark"]');
    for (const [name, value] of Object.entries(PURPLE[theme])) {
      expect([name, set[name]]).toEqual([name, value]);
    }
  });
});
