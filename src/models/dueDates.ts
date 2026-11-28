/**
 * Envelope due days (decided in v0.56.0): a day of the month, 1–31, when an
 * envelope's bill is due, repeating every month. Display only, like Planned:
 * it changes no other number. A day past the end of a short month falls on
 * its last day (the 31st is the 30th in November, the 28th or 29th in
 * February).
 */
import { UserFacingError } from "./dataStore";
import type { Month } from "./month";
import type { BudgetData, IsoDate } from "./types";

/** How many days before the due day it is shown as near (and on the day itself). */
export const DUE_SOON_DAYS = 3;

/** True for a whole number from 1 to 31. */
export function isDueDay(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 31;
}

/** Checks a due day to store: null (none) or 1–31. */
export function checkDueDay(value: number | null): number | null {
  if (value === null || isDueDay(value)) return value;
  throw new UserFacingError("A due day is a day of the month from 1 to 31.");
}

/** How many days `month` ("YYYY-MM") has. */
function daysIn(month: Month): number {
  const [year, mon] = month.split("-").map(Number) as [number, number];
  return new Date(year, mon, 0).getDate();
}

/** The day of `month` the envelope is due: the due day, or the month's last day if shorter. */
export function dueDayIn(dueDay: number, month: Month): number {
  return Math.min(dueDay, daysIn(month));
}

/** 1 → "1st", 2 → "2nd", 11 → "11th", 22 → "22nd". */
export function ordinalDay(day: number): string {
  const teen = day % 100 >= 11 && day % 100 <= 13;
  const suffix = teen ? "th" : ({ 1: "st", 2: "nd", 3: "rd" }[day % 10] ?? "th");
  return `${day}${suffix}`;
}

export interface DueLabel {
  /** "Due 15th" (the day it falls on in this month). */
  text: string;
  /** In the current month, from DUE_SOON_DAYS days before the due day through the day itself. */
  soon: boolean;
}

/**
 * What an envelope's row shows for its due day in `month`, seen on `today`;
 * null when it has none.
 */
export function dueLabel(dueDay: number | null, month: Month, today: IsoDate): DueLabel | null {
  if (dueDay === null) return null;
  const day = dueDayIn(dueDay, month);
  const todayDay = Number(today.slice(8, 10));
  const soon =
    today.slice(0, 7) === month && day - todayDay >= 0 && day - todayDay <= DUE_SOON_DAYS;
  return { text: `Due ${ordinalDay(day)}`, soon };
}

/** The choices for the envelope sheet's Due day picker: 1st to 31st. */
export const DUE_DAY_CHOICES: { day: number; label: string }[] = Array.from(
  { length: 31 },
  (_, i) => ({ day: i + 1, label: ordinalDay(i + 1) }),
);

/** The budget with one envelope's due day changed (shown before the store confirms it). */
export function withDueDay(
  data: BudgetData,
  envelopeId: string,
  dueDay: number | null,
): BudgetData {
  return {
    ...data,
    envelopes: data.envelopes.map((e) => (e.id === envelopeId ? { ...e, dueDay } : e)),
  };
}
