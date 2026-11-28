import { describe, expect, it } from "vitest";
import { activeGoal, checkGoalDetails, checkGoalEnvelope } from "./goals";

describe("activeGoal", () => {
  it("finds the envelope's goal that is not archived", () => {
    const goals = [
      { id: "old", envelopeId: "e", amount: 1, date: "2026-01-31", archivedAt: "2026-02-01" },
      { id: "new", envelopeId: "e", amount: 2, date: "2027-01-31", archivedAt: null },
      { id: "other", envelopeId: "f", amount: 3, date: "2027-01-31", archivedAt: null },
    ];
    expect(activeGoal(goals, "e")?.id).toBe("new");
    expect(activeGoal(goals.slice(0, 1), "e")).toBeNull();
  });
});

describe("checkGoalDetails", () => {
  it("needs an amount above zero and a date from today on", () => {
    expect(checkGoalDetails({ amount: 500, date: "2026-11-19" }, "2026-11-19")).toEqual({
      amount: 500,
      date: "2026-11-19",
    });
    expect(() => checkGoalDetails({ amount: 0, date: "2027-01-01" })).toThrow("above $0.00");
    expect(() => checkGoalDetails({ amount: 1.5, date: "2027-01-01" })).toThrow("above $0.00");
    expect(() => checkGoalDetails({ amount: 500, date: "" })).toThrow("Pick the date");
    expect(() => checkGoalDetails({ amount: 500, date: "2026-11-18" }, "2026-11-19")).toThrow(
      "from today on",
    );
    // Without today (the stores), any date: goals pass their dates in time.
    expect(() => checkGoalDetails({ amount: 500, date: "2020-01-01" })).not.toThrow();
  });
});

describe("checkGoalEnvelope", () => {
  const envelopes = [
    { id: "e", groupId: "g", name: "Trip", position: 0, cardAccountId: null, dueDay: null },
    {
      id: "p",
      groupId: "c",
      name: "Visa payment",
      position: 0,
      cardAccountId: "visa",
      dueDay: null,
    },
  ];
  it("refuses a card's payment envelope or a missing one", () => {
    expect(() => checkGoalEnvelope(envelopes, "e")).not.toThrow();
    expect(() => checkGoalEnvelope(envelopes, "p")).toThrow("cannot have a goal");
    expect(() => checkGoalEnvelope(envelopes, "x")).toThrow("not found");
  });
});
