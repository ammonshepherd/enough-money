import { describe, expect, it } from "vitest";
import {
  availableToAssign,
  canAssign,
  checkSpend,
  givable,
  goalProgress,
  laterReserve,
  laterReleaseCuts,
  computeEnvelopeHistory,
  computeEnvelopeMonth,
  envelopeAsOf,
  canMoveIn,
  envelopeLeft,
  groupLeft,
  isMonth,
  movableFrom,
  overAssigned,
  spentFromAmounts,
  buildBudgetMonth,
  incomeSuggestions,
  monthPlanView,
  planLeft,
  plannedRaiseAllowed,
  type EnvelopeMonthInput,
  type EnvelopeRow,
} from "./budgetMath";
import type { BudgetData, Transaction } from "./types";

describe("computeEnvelopeMonth", () => {
  it("computes Remaining = Assigned + Released − Spent", () => {
    const m = computeEnvelopeMonth(
      { month: "2026-10", assigned: 50_000, released: 2_000, spent: 30_000 },
      10_000,
    );
    expect(m.remaining).toBe(22_000);
    expect(m.shortfall).toBe(0);
  });

  it("moves released money out of Saved without changing envelope money", () => {
    const before = computeEnvelopeMonth(
      { month: "2026-10", assigned: 0, released: 0, spent: 0 },
      10_000,
    );
    const after = computeEnvelopeMonth(
      { month: "2026-10", assigned: 0, released: 4_000, spent: 0 },
      10_000,
    );
    expect(after.saved).toBe(6_000);
    expect(after.remaining).toBe(4_000);
    expect(after.envelopeMoney).toBe(before.envelopeMoney);
  });

  it("computes Saved(M+1) = Saved(M) − Released(M) + Remaining(M)", () => {
    const m = computeEnvelopeMonth(
      { month: "2026-10", assigned: 50_000, released: 2_000, spent: 30_000 },
      10_000,
    );
    expect(m.savedNext).toBe(10_000 - 2_000 + 22_000);
    expect(m.envelopeMoney).toBe(m.saved + m.remaining);
  });

  it("reports an overspend as a shortfall instead of hiding it", () => {
    const m = computeEnvelopeMonth(
      { month: "2026-10", assigned: 10_000, released: 0, spent: 12_500 },
      0,
    );
    expect(m.remaining).toBe(-2_500);
    expect(m.shortfall).toBe(2_500);
  });

  it("reports releasing more than is Saved as a negative Saved instead of throwing", () => {
    const m = computeEnvelopeMonth({ month: "2026-10", assigned: 0, released: 101, spent: 0 }, 100);
    expect(m.saved).toBe(-1);
    expect(m.envelopeMoney).toBe(100);
  });

  it("rejects a negative release", () => {
    expect(() =>
      computeEnvelopeMonth({ month: "2026-10", assigned: 0, released: -1, spent: 0 }, 100),
    ).toThrow(RangeError);
  });

  it("rejects amounts that are not whole cents", () => {
    expect(() =>
      computeEnvelopeMonth({ month: "2026-10", assigned: 10.5, released: 0, spent: 0 }, 0),
    ).toThrow(TypeError);
  });
});

describe("computeEnvelopeHistory", () => {
  const groceries: EnvelopeMonthInput[] = [
    // Deliberately out of order: the function sorts by month.
    { month: "2026-10", assigned: 40_000, released: 5_000, spent: 45_000 },
    { month: "2026-08", assigned: 40_000, released: 0, spent: 35_000 },
    { month: "2026-09", assigned: 40_000, released: 0, spent: 38_000 },
  ];

  it("accumulates leftover Remaining into Saved every month", () => {
    const [aug, sep, oct] = computeEnvelopeHistory(groceries);
    expect(aug).toMatchObject({ savedAtStart: 0, remaining: 5_000, savedNext: 5_000 });
    expect(sep).toMatchObject({ savedAtStart: 5_000, remaining: 2_000, savedNext: 7_000 });
    expect(oct).toMatchObject({
      savedAtStart: 7_000,
      saved: 2_000,
      remaining: 0,
      envelopeMoney: 2_000,
      savedNext: 2_000,
    });
  });

  it("keeps envelope money equal to everything assigned minus everything spent", () => {
    const history = computeEnvelopeHistory(groceries);
    const assigned = groceries.reduce((sum, g) => sum + g.assigned, 0);
    const spent = groceries.reduce((sum, g) => sum + g.spent, 0);
    expect(history.at(-1)?.envelopeMoney).toBe(assigned - spent);
  });

  it("rejects duplicate and malformed months", () => {
    const row = { assigned: 0, released: 0, spent: 0 };
    expect(() =>
      computeEnvelopeHistory([
        { month: "2026-10", ...row },
        { month: "2026-10", ...row },
      ]),
    ).toThrow(/more than once/);
    expect(() => computeEnvelopeHistory([{ month: "2026-13", ...row }])).toThrow(/YYYY-MM/);
  });
});

describe("envelopeAsOf", () => {
  const history = computeEnvelopeHistory([
    { month: "2026-08", assigned: 10_000, released: 0, spent: 4_000 },
    { month: "2026-10", assigned: 1_000, released: 0, spent: 0 },
  ]);

  it("returns the month's own row when there is one", () => {
    expect(envelopeAsOf(history, "2026-10")).toBe(history[1]);
  });

  it("carries Saved forward through a month with no activity", () => {
    expect(envelopeAsOf(history, "2026-09")).toMatchObject({
      savedAtStart: 6_000,
      remaining: 0,
      envelopeMoney: 6_000,
    });
  });

  it("starts empty before the first month and stays put after the last", () => {
    expect(envelopeAsOf(history, "2026-01").envelopeMoney).toBe(0);
    expect(envelopeAsOf(history, "2027-01").savedAtStart).toBe(7_000);
  });
});

describe("availableToAssign", () => {
  it("is opening balances + income − assigned", () => {
    expect(
      availableToAssign({ openingBalances: 100_000, income: 300_000, assigned: 250_000 }),
    ).toBe(150_000);
  });

  it("equals budget account balances minus envelope money, plus spending to review", () => {
    // Two envelopes over two months, plus one purchase still to review.
    const rent = computeEnvelopeHistory([
      { month: "2026-09", assigned: 120_000, released: 0, spent: 120_000 },
      { month: "2026-10", assigned: 120_000, released: 0, spent: 120_000 },
    ]);
    const fun = computeEnvelopeHistory([
      { month: "2026-09", assigned: 10_000, released: 0, spent: 3_000 },
      { month: "2026-10", assigned: 5_000, released: 7_000, spent: 9_000 },
    ]);
    const opening = 50_000;
    const income = 400_000;
    const uncategorized = 1_500;
    const categorizedSpent = 120_000 + 120_000 + 3_000 + 9_000;
    const accountBalance = opening + income - categorizedSpent - uncategorized;
    const envelopeMoney =
      envelopeAsOf(rent, "2026-10").envelopeMoney + envelopeAsOf(fun, "2026-10").envelopeMoney;

    const available = availableToAssign({
      openingBalances: opening,
      income,
      assigned: 120_000 + 120_000 + 10_000 + 5_000,
    });
    expect(available).toBe(accountBalance - envelopeMoney + uncategorized);
  });
});

describe("overAssigned and canAssign", () => {
  it("is zero unless Available to Assign is negative", () => {
    expect(overAssigned(500)).toBe(0);
    expect(overAssigned(0)).toBe(0);
    expect(overAssigned(-750)).toBe(750);
  });

  it("blocks assigning more than is available", () => {
    expect(canAssign(1_000, 1_000)).toBe(true);
    expect(canAssign(1_000, 1_001)).toBe(false);
    expect(canAssign(-50, 1)).toBe(false);
  });
});

describe("spentFromAmounts", () => {
  it("turns signed outflows and refunds into a positive Spent", () => {
    expect(spentFromAmounts([-4_000, -1_250, 500])).toBe(4_750);
  });

  it("is zero for no transactions", () => {
    expect(spentFromAmounts([])).toBe(0);
  });
});

describe("checkSpend", () => {
  const current = computeEnvelopeMonth(
    { month: "2026-10", assigned: 5_000, released: 0, spent: 3_000 },
    4_000,
  );

  it("needs no cover when Remaining stays at or above zero", () => {
    expect(checkSpend(current, 2_000)).toEqual({
      remainingAfter: 0,
      shortfall: 0,
      fromSaved: 0,
      stillShort: 0,
      heldBy: null,
    });
  });

  it("covers a shortfall from this envelope's Saved first", () => {
    expect(checkSpend(current, 5_000)).toEqual({
      remainingAfter: -3_000,
      shortfall: 3_000,
      fromSaved: 3_000,
      stillShort: 0,
      heldBy: null,
    });
  });

  it("leaves the rest for another envelope or Available to Assign", () => {
    expect(checkSpend(current, 9_000)).toMatchObject({
      shortfall: 7_000,
      fromSaved: 4_000,
      stillShort: 3_000,
    });
  });

  it("keeps enough over for Saved a later month already released", () => {
    // $20 left this month; November already released $15 of the $20 it carries.
    const later = { month: "2026-11", saved: 500 };
    // Spending $10 fits this month but leaves November $5 short of what it released.
    expect(checkSpend(current, 1_000, later)).toEqual({
      remainingAfter: 1_000,
      shortfall: 500,
      fromSaved: 0,
      stillShort: 500,
      heldBy: "2026-11",
    });
    // Releasing this month's Saved cannot make up for it: that part stays in stillShort.
    expect(checkSpend(current, 5_000, later)).toMatchObject({
      shortfall: 7_500,
      fromSaved: 3_000,
      stillShort: 4_500,
      heldBy: "2026-11",
    });
    // When this month's own shortfall is the larger one, nothing is held for later.
    expect(checkSpend(current, 9_000, { month: "2026-11", saved: 6_000 })).toMatchObject({
      fromSaved: 4_000,
      stillShort: 3_000,
      heldBy: null,
    });
  });
});

describe("laterReserve and givable", () => {
  const history = computeEnvelopeHistory([
    { month: "2026-10", assigned: 5_000, released: 0, spent: 3_000 },
    { month: "2026-11", assigned: 1_000, released: 1_500, spent: 2_500 },
    { month: "2026-12", assigned: 0, released: 0, spent: 0 },
  ]);

  it("is the smallest Saved after releases of any later month", () => {
    // October leaves $20; November releases $15 of it, so $5 is held there.
    expect(laterReserve(history, "2026-10")).toEqual({ month: "2026-11", saved: 500 });
    expect(laterReserve(history, "2026-12")).toBeNull();
  });

  it("lets a month give no more than what is left and what later months can lose", () => {
    expect(givable({ remaining: 2_000, later: { month: "2026-11", saved: 500 } })).toBe(500);
    expect(givable({ remaining: 2_000, later: null })).toBe(2_000);
    expect(givable({ remaining: 2_000, later: { month: "2026-11", saved: -100 } })).toBe(0);
    expect(givable({ remaining: -300, later: null })).toBe(0);
  });
});

describe("isMonth", () => {
  it("accepts YYYY-MM only", () => {
    expect(isMonth("2026-10")).toBe(true);
    expect(isMonth("2026-00")).toBe(false);
    expect(isMonth("2026-1")).toBe(false);
  });
});

describe("envelopeLeft and groupLeft", () => {
  const row = (id: string, money: Partial<EnvelopeRow>): EnvelopeRow => ({
    ...computeEnvelopeMonth({ month: "2026-10", assigned: 0, released: 0, spent: 0 }, 0),
    id,
    name: id,
    planned: 0,
    overPlan: false,
    inUse: true,
    card: null,
    later: null,
    ...money,
  });
  const card = {
    accountId: "c",
    open: true,
    owed: 9_000,
    uncovered: 1_000,
    extraPaid: { month: 0, yearToDate: 0 },
  };

  it("shows Remaining, or Saved + Remaining for a card's payment envelope", () => {
    expect(envelopeLeft(row("food", { remaining: 2_500, envelopeMoney: 4_000 }))).toBe(2_500);
    expect(envelopeLeft(row("pay", { remaining: 2_500, envelopeMoney: 8_000, card }))).toBe(8_000);
  });

  it("moves out no more than is left, and nothing from a card's envelope", () => {
    expect(movableFrom(row("food", { assigned: 10_000, remaining: 4_000 }))).toBe(4_000);
    // $10 assigned + $50 released from Saved: all $60 can move.
    expect(movableFrom(row("gift", { assigned: 1_000, remaining: 6_000 }))).toBe(6_000);
    expect(movableFrom(row("short", { assigned: 1_000, remaining: -500 }))).toBe(0);
    expect(movableFrom(row("pay", { assigned: 5_000, remaining: 5_000, card }))).toBe(0);
  });

  it("lets refunded money move out, even taking Assigned below $0.00", () => {
    const month = (assigned: number, released: number, spent: number, saved = 0) =>
      computeEnvelopeMonth({ month: "2026-10", assigned, released, spent }, saved);
    // Reimbursements beyond the month's spending: −$85 assigned, $107.72 refunded.
    const reimbursed = month(-8_500, 0, -10_772);
    expect(reimbursed.remaining).toBe(2_272);
    expect(movableFrom(row("reimbursed", reimbursed))).toBe(2_272);
    // Only refunds, nothing assigned: all of them can move.
    expect(movableFrom(row("refund", month(0, 0, -3_000)))).toBe(3_000);
    // Refunds plus money released from Saved: both can move.
    expect(movableFrom(row("mixed", month(0, 5_000, -1_000, 5_000)))).toBe(6_000);
    // Only money released from Saved (a new month, nothing assigned yet).
    const released = month(0, 4_000, 1_500, 4_000);
    expect(released.remaining).toBe(2_500);
    expect(movableFrom(row("released", released))).toBe(2_500);
    // Spending that refunds only partly cancel leaves nothing refunded.
    expect(movableFrom(row("partial", month(2_000, 0, 500)))).toBe(1_500);
  });

  it("allows moves only in this month and later", () => {
    expect(canMoveIn("2026-10", "2026-10")).toBe(true);
    expect(canMoveIn("2026-11", "2026-10")).toBe(true);
    expect(canMoveIn("2026-09", "2026-10")).toBe(false);
    expect(canMoveIn("2025-12", "2026-01")).toBe(false);
  });

  it("adds up what each row of a group shows", () => {
    const envelopes = [
      row("food", { remaining: 2_500, envelopeMoney: 4_000 }),
      row("fun", { remaining: 0, envelopeMoney: 1_000 }),
      row("pay", { remaining: 500, envelopeMoney: 8_000, card }),
    ];
    expect(groupLeft({ id: "g", name: "G", cards: false, envelopes })).toBe(10_500);
    expect(groupLeft({ id: "e", name: "Empty", cards: false, envelopes: [] })).toBe(0);
  });
});

describe("laterReleaseCuts", () => {
  /** October leaves $100 over; November releases it and spends `novSpent`. */
  const history = (novSpent: number, decReleased = 0) =>
    computeEnvelopeHistory([
      { month: "2026-10", assigned: 10_000, released: 0, spent: 0 },
      { month: "2026-11", assigned: 0, released: 10_000, spent: novSpent },
      { month: "2026-12", assigned: 0, released: decReleased, spent: 0 },
    ]);

  it("releases less in the later month that has the money unspent", () => {
    expect(laterReleaseCuts(history(0), "2026-10", 6_000)).toEqual([
      { month: "2026-11", amount: 6_000 },
    ]);
  });

  it("is null when the later month already spent what it released", () => {
    expect(laterReleaseCuts(history(5_000), "2026-10", 6_000)).toBeNull();
    expect(laterReleaseCuts(history(4_000), "2026-10", 6_000)).toEqual([
      { month: "2026-11", amount: 6_000 },
    ]);
  });

  it("cuts only what each later month is short of", () => {
    // November keeps $40 in Saved; December releases what November left over.
    const h = computeEnvelopeHistory([
      { month: "2026-10", assigned: 10_000, released: 0, spent: 0 },
      { month: "2026-11", assigned: 0, released: 6_000, spent: 0 },
      { month: "2026-12", assigned: 0, released: 10_000, spent: 0 },
    ]);
    expect(laterReleaseCuts(h, "2026-10", 5_000)).toEqual([
      { month: "2026-11", amount: 1_000 },
      { month: "2026-12", amount: 5_000 },
    ]);
  });

  it("is null when no later month needs it", () => {
    expect(laterReleaseCuts(history(0), "2026-11", 6_000)).toBeNull();
    expect(laterReleaseCuts(history(0), "2026-12", 6_000)).toBeNull();
  });
});

describe("goalProgress", () => {
  const goal = { amount: 120_000, date: "2027-03-31" };

  it("spreads what is left over the months, weeks and days to the goal date", () => {
    const p = goalProgress(goal, 20_000, "2026-11-19");
    expect(p).toMatchObject({ status: "open", goal: 120_000, have: 20_000, left: 100_000 });
    expect(p.fraction).toBeCloseTo(1 / 6);
    // November (this month) through March; Nov 19 through Mar 31; 133 days in sevens.
    expect([p.months, p.days, p.weeks]).toEqual([5, 133, 19]);
    // Rounded up to the cent, so assigning them reaches the goal.
    expect([p.perMonth, p.perWeek, p.perDay]).toEqual([20_000, 5_264, 752]);
  });

  it("is met once the envelope money reaches the goal, whatever the date", () => {
    for (const today of ["2026-11-19", "2027-05-01"]) {
      expect(goalProgress(goal, 130_000, today)).toMatchObject({
        status: "met",
        left: 0,
        fraction: 1,
        perMonth: 0,
        perWeek: 0,
        perDay: 0,
      });
    }
  });

  it("is past once the date has gone by unmet, with nothing per period", () => {
    expect(goalProgress(goal, 50_000, "2027-04-01")).toMatchObject({
      status: "past",
      left: 70_000,
      days: 0,
      perMonth: 0,
      perDay: 0,
    });
  });

  it("asks for all of it on the goal date itself", () => {
    expect(goalProgress(goal, 100_000, "2027-03-31")).toMatchObject({
      status: "open",
      months: 1,
      weeks: 1,
      days: 1,
      perMonth: 20_000,
      perWeek: 20_000,
      perDay: 20_000,
    });
  });

  it("counts a short envelope as holding nothing", () => {
    expect(goalProgress(goal, -500, "2026-11-19")).toMatchObject({ have: 0, left: 120_000 });
  });
});

describe("Expected income and the plan (v0.55.0)", () => {
  const data = (over: Partial<BudgetData> = {}): BudgetData => ({
    household: { id: "h", name: "Home" },
    incomeRules: [],
    tags: [],
    goals: [],
    payees: [],
    accounts: [
      {
        id: "chk",
        name: "Checking",
        type: "checking",
        openingBalance: 0,
        openingDate: "2026-01-01",
        onBudget: true,
        closedAt: null,
        importFormat: null,
      },
      {
        id: "visa",
        name: "Visa",
        type: "credit_card",
        openingBalance: 0,
        openingDate: "2026-01-01",
        onBudget: true,
        closedAt: null,
        importFormat: null,
      },
    ],
    groups: [
      { id: "cards", name: "Credit card payments", position: 0 },
      { id: "bills", name: "Bills", position: 1 },
    ],
    envelopes: [
      {
        id: "pay",
        groupId: "cards",
        name: "Visa",
        position: 0,
        cardAccountId: "visa",
        dueDay: null,
      },
      {
        id: "rent",
        groupId: "bills",
        name: "Rent",
        position: 0,
        cardAccountId: null,
        dueDay: null,
      },
      {
        id: "food",
        groupId: "bills",
        name: "Food",
        position: 1,
        cardAccountId: null,
        dueDay: null,
      },
    ],
    monthPlans: [{ month: "2026-11", expectedIncome: 300_000 }],
    envelopeMonths: [
      { envelopeId: "rent", month: "2026-11", assigned: 0, released: 0, planned: 150_000 },
      { envelopeId: "food", month: "2026-11", assigned: 0, released: 0, planned: 50_000 },
      // Left out of the plan: card purchases are planned in their own envelopes.
      { envelopeId: "pay", month: "2026-11", assigned: 0, released: 0, planned: 90_000 },
    ],
    transactions: [],
    ...over,
  });
  const income = (id: string, date: string, amount: number, accountId = "chk"): Transaction => ({
    id,
    accountId,
    date,
    amount,
    payee: "Pay",
    memo: "",
    isTransfer: false,
    isIncome: true,
    transferId: null,
    voided: false,
    allocations: [],
    importKey: null,
    reconciled: false,
    tagIds: [],
  });

  it("leaves Expected income − Σ Planned to plan, card payment envelopes left out", () => {
    expect(buildBudgetMonth(data(), "2026-11").plan).toEqual({
      expected: 300_000,
      planned: 200_000,
      left: 100_000,
      over: 0,
    });
  });

  it("shows how far a plan is over, and sets no limit without Expected income", () => {
    expect(monthPlanView(150_000, 200_000)).toEqual({
      expected: 150_000,
      planned: 200_000,
      left: -50_000,
      over: 50_000,
    });
    expect(buildBudgetMonth(data(), "2026-12").plan).toEqual({
      expected: null,
      planned: 0,
      left: null,
      over: 0,
    });
    expect(planLeft(null, 5_000)).toBeNull();
  });

  it("does not carry what is left to plan into the next month", () => {
    const next = data({
      monthPlans: [
        { month: "2026-11", expectedIncome: 300_000 },
        { month: "2026-12", expectedIncome: 10_000 },
      ],
    });
    expect(buildBudgetMonth(next, "2026-12").plan.left).toBe(10_000);
  });

  it("allows raising a Planned only within what is left; lowering always", () => {
    const plan = monthPlanView(300_000, 200_000);
    expect(plannedRaiseAllowed(plan, 50_000, 150_000)).toBe(true);
    expect(plannedRaiseAllowed(plan, 50_000, 150_001)).toBe(false);
    expect(plannedRaiseAllowed(plan, 50_000, 0)).toBe(true);
    const over = monthPlanView(100_000, 200_000);
    expect(plannedRaiseAllowed(over, 50_000, 50_001)).toBe(false);
    expect(plannedRaiseAllowed(over, 50_000, 40_000)).toBe(true);
    expect(plannedRaiseAllowed(over, 0, 999_999, true)).toBe(true);
    expect(plannedRaiseAllowed(monthPlanView(null, 200_000), 0, 999_999)).toBe(true);
  });

  it("changes no other number", () => {
    const without = buildBudgetMonth(data({ monthPlans: [] }), "2026-11");
    const withPlan = buildBudgetMonth(data(), "2026-11");
    expect({ ...withPlan, plan: null }).toEqual({ ...without, plan: null });
  });

  it("suggests last month's Expected, last month's income and a three-month average", () => {
    const suggestions = incomeSuggestions(
      data({
        transactions: [
          income("t1", "2026-11-03", 280_000),
          income("t2", "2026-10-03", 260_000),
          income("t3", "2026-09-03", 250_001),
          income("t4", "2026-08-03", 999_999), // four months back: not counted
          income("t5", "2026-11-09", 50_000, "visa"), // never Income on a card
        ],
      }),
      "2026-12",
    );
    expect(suggestions).toEqual({
      lastExpected: 300_000,
      lastActual: 280_000,
      average: 263_334,
    });
    expect(incomeSuggestions(data(), "2026-06")).toEqual({
      lastExpected: null,
      lastActual: null,
      average: null,
    });
  });
});
