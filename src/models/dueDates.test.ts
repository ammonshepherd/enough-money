import { describe, expect, it } from "vitest";
import {
  checkDueDay,
  DUE_DAY_CHOICES,
  dueDayIn,
  dueLabel,
  isDueDay,
  ordinalDay,
  withDueDay,
} from "./dueDates";
import type { BudgetData } from "./types";

describe("ordinalDay", () => {
  it("adds st, nd, rd and th, with th for the teens", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 30, 31].map(ordinalDay)).toEqual([
      "1st",
      "2nd",
      "3rd",
      "4th",
      "11th",
      "12th",
      "13th",
      "21st",
      "22nd",
      "23rd",
      "30th",
      "31st",
    ]);
  });
});

describe("isDueDay and checkDueDay", () => {
  it("takes whole days from 1 to 31, or none", () => {
    expect(isDueDay(1)).toBe(true);
    expect(isDueDay(31)).toBe(true);
    expect(isDueDay(0)).toBe(false);
    expect(isDueDay(32)).toBe(false);
    expect(isDueDay(1.5)).toBe(false);
    expect(isDueDay("5")).toBe(false);
    expect(checkDueDay(null)).toBeNull();
    expect(checkDueDay(15)).toBe(15);
    expect(() => checkDueDay(0)).toThrow("from 1 to 31");
    expect(() => checkDueDay(32)).toThrow("from 1 to 31");
  });
});

describe("dueDayIn", () => {
  it("falls on the month's last day when the month is shorter", () => {
    expect(dueDayIn(31, "2026-11")).toBe(30);
    expect(dueDayIn(31, "2026-02")).toBe(28);
    expect(dueDayIn(30, "2028-02")).toBe(29);
    expect(dueDayIn(31, "2026-12")).toBe(31);
    expect(dueDayIn(15, "2026-02")).toBe(15);
  });
});

describe("dueLabel", () => {
  it("is null with no due day", () => {
    expect(dueLabel(null, "2026-11", "2026-11-27")).toBeNull();
  });

  it("names the day it falls on this month", () => {
    expect(dueLabel(15, "2026-11", "2026-11-01")).toEqual({ text: "Due 15th", soon: false });
    expect(dueLabel(31, "2026-02", "2026-01-01")?.text).toBe("Due 28th");
  });

  it("is soon from 3 days before through the day, only in the current month", () => {
    expect(dueLabel(15, "2026-11", "2026-11-11")?.soon).toBe(false);
    expect(dueLabel(15, "2026-11", "2026-11-12")?.soon).toBe(true);
    expect(dueLabel(15, "2026-11", "2026-11-15")?.soon).toBe(true);
    expect(dueLabel(15, "2026-11", "2026-11-16")?.soon).toBe(false);
    // Another month is never soon, even on the same day number.
    expect(dueLabel(15, "2026-12", "2026-11-14")?.soon).toBe(false);
    expect(dueLabel(2, "2026-12", "2026-11-30")?.soon).toBe(false);
    // The 31st in November is due on the 30th.
    expect(dueLabel(31, "2026-11", "2026-11-27")?.soon).toBe(true);
  });
});

describe("DUE_DAY_CHOICES", () => {
  it("lists the 1st to the 31st", () => {
    expect(DUE_DAY_CHOICES).toHaveLength(31);
    expect(DUE_DAY_CHOICES[0]).toEqual({ day: 1, label: "1st" });
    expect(DUE_DAY_CHOICES[30]).toEqual({ day: 31, label: "31st" });
  });
});

describe("withDueDay", () => {
  it("changes only that envelope's due day", () => {
    const envelope = (id: string) => ({
      id,
      groupId: "g",
      name: id,
      position: 0,
      cardAccountId: null,
      dueDay: null,
    });
    const data = { envelopes: [envelope("a"), envelope("b")] } as unknown as BudgetData;
    const next = withDueDay(data, "a", 15);
    expect(next.envelopes.map((e) => e.dueDay)).toEqual([15, null]);
    expect(data.envelopes[0]!.dueDay).toBeNull();
  });
});
