import { describe, expect, it } from "vitest";
import { batchChange, batchExclusion, importedCount, moveTargets } from "./batchEdits";
import type { Account, Transaction } from "./types";

const account = (id: string, extra: Partial<Account> = {}): Account => ({
  id,
  name: id,
  type: "checking",
  openingBalance: 0,
  openingDate: "2026-10-01",
  onBudget: true,
  closedAt: null,
  importFormat: null,
  ...extra,
});
const accounts = [
  account("Checking"),
  account("Savings", { openingDate: "2026-10-10" }),
  account("Old", { closedAt: "2026-10-02T00:00:00Z" }),
  account("Visa", { type: "credit_card" }),
  account("Brokerage", { onBudget: false }),
];
const tx = (extra: Partial<Transaction> = {}): Transaction => ({
  id: "t",
  accountId: "Checking",
  date: "2026-10-05",
  amount: -1_000,
  payee: "",
  memo: "",
  isTransfer: false,
  isIncome: false,
  transferId: null,
  voided: false,
  allocations: [],
  importKey: null,
  reconciled: false,
  tagIds: [],
  ...extra,
});
const data = { accounts };

describe("batchExclusion", () => {
  it("leaves out transfers and splits for every action", () => {
    const split = tx({
      allocations: [
        { envelopeId: "a", amount: -400 },
        { envelopeId: "b", amount: -600 },
      ],
    });
    for (const action of [
      { kind: "delete" } as const,
      { kind: "redate", date: "2026-10-06" } as const,
      { kind: "move", accountId: "Savings" } as const,
    ]) {
      expect(batchExclusion(data, tx({ isTransfer: true }), action)).toBe("Transfer");
      expect(batchExclusion(data, split, action)).toBe("Split");
    }
    expect(batchExclusion(data, tx({ importKey: "k" }), { kind: "delete" })).toBeNull();
  });

  it("moves only typed-in rows dated after the target opened", () => {
    const move = { kind: "move", accountId: "Savings" } as const;
    expect(batchExclusion(data, tx({ importKey: "k" }), move)).toBe("Imported from the bank");
    expect(batchExclusion(data, tx(), move)).toBe("Before Savings opened");
    expect(batchExclusion(data, tx({ date: "2026-10-10" }), move)).toBeNull();
  });

  it("never dates a row before its account opened", () => {
    expect(batchExclusion(data, tx(), { kind: "redate", date: "2026-09-30" })).toBe(
      "Before Checking opened",
    );
    expect(batchExclusion(data, tx(), { kind: "redate", date: "2026-10-01" })).toBeNull();
  });
});

describe("moveTargets", () => {
  it("offers other open accounts of the same kind", () => {
    expect(moveTargets(data, accounts[0]!).map((a) => a.id)).toEqual(["Savings"]);
    expect(moveTargets(data, accounts[3]!)).toEqual([]);
    expect(moveTargets(data, accounts[4]!)).toEqual([]);
  });
});

describe("batchChange and importedCount", () => {
  it("describes each change", () => {
    const t = tx({ importKey: "k" });
    expect(batchChange(t, { kind: "delete" })).toEqual({ before: t, after: null });
    expect(batchChange(t, { kind: "move", accountId: "Savings" }).after?.accountId).toBe("Savings");
    expect(batchChange(t, { kind: "redate", date: "2026-10-09" }).after?.date).toBe("2026-10-09");
    expect(importedCount([t, tx()])).toBe(1);
  });
});
