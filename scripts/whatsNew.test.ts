// Every release has a short "what's new" note for the new version banner
// (src/models/whatsNew.ts); this keeps public/whats-new.json complete and short.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MAX_NOTE_LENGTH, isVersion } from "../src/models/whatsNew.ts";

const read = (path: string): unknown =>
  JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));

describe("public/whats-new.json", () => {
  const notes = read("../public/whats-new.json") as Record<string, unknown>;
  const { version } = read("../package.json") as { version: string };

  it("has a note for the version in package.json", () => {
    expect(typeof notes[version], `add a note for ${version} to public/whats-new.json`).toBe(
      "string",
    );
  });

  it("holds only short notes keyed by version", () => {
    for (const [key, text] of Object.entries(notes)) {
      expect(isVersion(key), key).toBe(true);
      expect(typeof text, key).toBe("string");
      expect((text as string).trim(), key).not.toBe("");
      expect((text as string).length, key).toBeLessThanOrEqual(MAX_NOTE_LENGTH);
    }
  });
});
