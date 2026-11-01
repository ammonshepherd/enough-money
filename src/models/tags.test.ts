import { describe, expect, it } from "vitest";
import { UserFacingError } from "./dataStore";
import {
  asTagColor,
  checkTagNameFree,
  cleanTagDetails,
  cleanTagName,
  exactTag,
  matchTags,
  nextTagColor,
  tagUseCounts,
  tagsOf,
  toggleTag,
  type Tag,
} from "./tags";
import type { Transaction } from "./types";

const tags: Tag[] = [
  { id: "w", name: "work", color: "grey" },
  { id: "t", name: "Trip 2026", color: "blue" },
  { id: "g", name: "Gift", color: "pink" },
];

describe("tag names", () => {
  it("trims and squeezes spaces, and refuses empty or long names", () => {
    expect(cleanTagName("  Trip   2026 ")).toBe("Trip 2026");
    expect(() => cleanTagName("   ")).toThrow(UserFacingError);
    expect(() => cleanTagName("x".repeat(31))).toThrow("at most 30");
    expect(cleanTagName("x".repeat(30))).toHaveLength(30);
  });

  it("refuses an unknown colour", () => {
    expect(cleanTagDetails({ name: " A ", color: "red" })).toEqual({ name: "A", color: "red" });
    expect(() => cleanTagDetails({ name: "A", color: "mauve" as "red" })).toThrow("colour");
    expect(asTagColor("mauve")).toBe("grey");
    expect(asTagColor("teal")).toBe("teal");
  });

  it("refuses a name another tag has, ignoring case and spaces", () => {
    expect(() => checkTagNameFree(tags, "TRIP  2026")).toThrow("already a tag called “Trip 2026”");
    expect(() => checkTagNameFree(tags, "Trip 2026", "t")).not.toThrow();
    expect(() => checkTagNameFree(tags, "Trips")).not.toThrow();
  });
});

describe("nextTagColor", () => {
  it("picks an unused colour, grey last, then takes turns", () => {
    expect(nextTagColor([])).toBe("red");
    expect(nextTagColor(tags)).toBe("red");
    const all = ["red", "orange", "yellow", "green", "teal", "blue", "purple", "pink"].map(
      (color, n) => ({ id: `${n}`, name: `${n}`, color }) as Tag,
    );
    expect(nextTagColor(all)).toBe("grey");
    expect(nextTagColor([...all, { id: "g", name: "g", color: "grey" }])).toBe("red");
  });
});

describe("choosing tags", () => {
  it("matches typed text anywhere in the name, alphabetically, minus chosen ones", () => {
    expect(matchTags(tags, "").map((t) => t.name)).toEqual(["Gift", "Trip 2026", "work"]);
    expect(matchTags(tags, "I").map((t) => t.id)).toEqual(["g", "t"]);
    expect(matchTags(tags, "i", ["g"]).map((t) => t.id)).toEqual(["t"]);
    expect(exactTag(tags, " gift ")?.id).toBe("g");
    expect(exactTag(tags, "gif")).toBeUndefined();
  });

  it("adds or removes one tag", () => {
    expect(toggleTag(["w"], "t")).toEqual(["w", "t"]);
    expect(toggleTag(["w", "t"], "w")).toEqual(["t"]);
  });

  it("lists a transaction's tags alphabetically, skipping deleted ones", () => {
    expect(tagsOf({ tagIds: ["w", "gone", "g"] }, tags).map((t) => t.name)).toEqual([
      "Gift",
      "work",
    ]);
  });

  it("counts how many transactions use each tag", () => {
    const txs = [{ tagIds: ["w", "t"] }, { tagIds: ["w"] }, { tagIds: [] }] as Transaction[];
    expect(Object.fromEntries(tagUseCounts(txs))).toEqual({ w: 2, t: 1 });
  });
});
