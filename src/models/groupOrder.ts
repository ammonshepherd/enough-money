import type { BudgetData, EnvelopeGroup } from "./types";

/**
 * The order of envelope groups (v0.42.2). The group holding the cards'
 * payment envelopes ("Credit card payments", found by its envelopes so a
 * rename keeps it) always comes first and holds only those envelopes; the
 * others follow in their stored order. Display only: stored positions are
 * left as they are.
 */

/** The group holding the cards' payment envelopes, or null when there is none. */
export function cardGroupId(data: Pick<BudgetData, "envelopes">): string | null {
  return data.envelopes.find((envelope) => envelope.cardAccountId)?.groupId ?? null;
}

/** Every group, the card group first, then by position (and name on a tie). */
export function orderedGroups(data: Pick<BudgetData, "groups" | "envelopes">): EnvelopeGroup[] {
  const cards = cardGroupId(data);
  return [...data.groups].sort(
    (a, b) =>
      Number(b.id === cards) - Number(a.id === cards) ||
      a.position - b.position ||
      a.name.localeCompare(b.name),
  );
}

/** The groups an ordinary envelope can be added to or moved into: all but the card group. */
export function envelopeGroups(data: Pick<BudgetData, "groups" | "envelopes">): EnvelopeGroup[] {
  const cards = cardGroupId(data);
  return orderedGroups(data).filter((group) => group.id !== cards);
}
