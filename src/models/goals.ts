/**
 * Envelope goals: an amount to have in an envelope (Saved + Remaining) by a
 * date. Display only, like Planned: a goal changes no other number. Each
 * envelope has at most one active goal; once met it can be archived (kept,
 * no longer shown) and a new one set. A card's payment envelope never has
 * one. How an envelope stands against its goal is `goalProgress` in
 * budgetMath.ts.
 */
import { UserFacingError } from "./dataStore";
import type { Cents } from "./money";
import type { Envelope, EnvelopeGoal, IsoDate } from "./types";

/** What is typed when a goal is set or changed. */
export interface GoalDetails {
  amount: Cents;
  date: IsoDate;
}

/** Largest amount the database accepts (its check on envelope_goals). */
export const MAX_GOAL = 999_999_999_999;

const DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/** The envelope's goal that is not archived, if any. */
export function activeGoal(goals: readonly EnvelopeGoal[], envelopeId: string) {
  return goals.find((g) => g.envelopeId === envelopeId && g.archivedAt === null) ?? null;
}

export const CARD_GOAL = "A card's payment envelope cannot have a goal";

/**
 * Throws a message to show when the goal cannot be saved as typed. With
 * `today`, the date may not be earlier (the app's check; the database takes
 * any date, since every goal date passes in time).
 */
export function checkGoalDetails(goal: GoalDetails, today?: IsoDate): GoalDetails {
  if (!Number.isSafeInteger(goal.amount) || goal.amount <= 0) {
    throw new UserFacingError("A goal needs an amount above $0.00.");
  }
  if (goal.amount > MAX_GOAL) throw new UserFacingError("That goal amount is too large.");
  if (!DATE.test(goal.date)) throw new UserFacingError("Pick the date to reach the goal by.");
  if (today !== undefined && goal.date < today)
    throw new UserFacingError("Pick a goal date from today on.");
  return { amount: goal.amount, date: goal.date };
}

/** Throws when the envelope cannot have a goal (missing, or a card's payment envelope). */
export function checkGoalEnvelope(envelopes: readonly Envelope[], envelopeId: string): void {
  const envelope = envelopes.find((e) => e.id === envelopeId);
  if (!envelope) throw new UserFacingError("Envelope not found");
  if (envelope.cardAccountId !== null) throw new UserFacingError(CARD_GOAL);
}
