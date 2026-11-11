import { describe, expect, it } from "vitest";
import { cardGroupId, envelopeGroups, orderedGroups } from "./groupOrder";

const group = (id: string, position: number, name = id) => ({ id, name, position });
const envelope = (id: string, groupId: string, cardAccountId: string | null = null) =>
  ({ id, groupId, cardAccountId }) as never;

describe("group order", () => {
  const groups = [group("bills", 0), group("cards", 2, "Credit card payments"), group("fun", 1)];

  it("puts the card group first, then the rest by position", () => {
    const envelopes = [envelope("rent", "bills"), envelope("visa", "cards", "visa-account")];
    expect(cardGroupId({ envelopes })).toBe("cards");
    expect(orderedGroups({ groups, envelopes }).map((g) => g.id)).toEqual([
      "cards",
      "bills",
      "fun",
    ]);
    expect(envelopeGroups({ groups, envelopes }).map((g) => g.id)).toEqual(["bills", "fun"]);
  });

  it("keeps the stored order when there is no card", () => {
    const envelopes = [envelope("rent", "bills")];
    expect(cardGroupId({ envelopes })).toBeNull();
    expect(orderedGroups({ groups, envelopes }).map((g) => g.id)).toEqual([
      "bills",
      "fun",
      "cards",
    ]);
    expect(envelopeGroups({ groups, envelopes })).toHaveLength(3);
  });

  it("breaks a position tie by name", () => {
    const tied = [group("b", 0, "Bills"), group("a", 0, "Auto")];
    expect(orderedGroups({ groups: tied, envelopes: [] }).map((g) => g.id)).toEqual(["a", "b"]);
  });
});
