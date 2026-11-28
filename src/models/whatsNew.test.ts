import { describe, expect, it } from "vitest";
import { MAX_NOTES, compareVersions, newerNotes } from "./whatsNew";

describe("compareVersions", () => {
  it("compares each part as a number", () => {
    expect(compareVersions("0.10.0", "0.9.9")).toBeGreaterThan(0);
    expect(compareVersions("0.55.1", "0.56.0")).toBeLessThan(0);
    expect(compareVersions("1.0.0", "1.0.0")).toBe(0);
  });
});

describe("newerNotes", () => {
  const file = {
    "0.54.0": "Old.",
    "0.55.0": "Current.",
    "0.55.1": "Patch.",
    "0.56.0": "Feature.",
    "0.57.0": "Next.",
    "0.58.0": "Newest.",
  };

  it("lists only versions newer than the running one, newest first, at most three", () => {
    expect(newerNotes(file, "0.55.0")).toEqual([
      { version: "0.58.0", text: "Newest." },
      { version: "0.57.0", text: "Next." },
      { version: "0.56.0", text: "Feature." },
    ]);
    expect(newerNotes(file, "0.57.0")).toEqual([{ version: "0.58.0", text: "Newest." }]);
    expect(newerNotes(file, "0.58.0")).toEqual([]);
    expect(MAX_NOTES).toBe(3);
  });

  it("skips anything malformed and shows nothing for a bad file", () => {
    expect(newerNotes({ "0.56": "No patch.", "0.57.0": 5, "0.58.0": "  " }, "0.55.0")).toEqual([]);
    expect(newerNotes(null, "0.55.0")).toEqual([]);
    expect(newerNotes(["0.56.0"], "0.55.0")).toEqual([]);
    expect(newerNotes("text", "0.55.0")).toEqual([]);
    expect(newerNotes(file, "dev")).toEqual([]);
  });
});
