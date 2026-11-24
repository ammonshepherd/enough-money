import { describe, expect, it } from "vitest";
import { UserFacingError } from "./dataStore";
import {
  MAX_PAYEE_NAME,
  cleanPayeeName,
  findPayee,
  payeeUseCounts,
  remembersPayee,
  sortPayees,
  suggestPayees,
} from "./payees";

const payees = [
  { id: "1", name: "Costco" },
  { id: "2", name: "Corner Café" },
  { id: "3", name: "Bank of Co-op" },
  { id: "4", name: "Target" },
];

describe("cleanPayeeName", () => {
  it("trims and checks the length", () => {
    expect(cleanPayeeName("  Costco ")).toBe("Costco");
    expect(() => cleanPayeeName("   ")).toThrow(UserFacingError);
    expect(() => cleanPayeeName("x".repeat(MAX_PAYEE_NAME + 1))).toThrow(/at most 200/);
    expect(cleanPayeeName("x".repeat(MAX_PAYEE_NAME))).toHaveLength(MAX_PAYEE_NAME);
  });
});

describe("remembersPayee", () => {
  const tx = (payee: string, isTransfer = false) => ({ payee, isTransfer });
  it("remembers a new typed transaction's payee", () => {
    expect(remembersPayee(tx("Costco"), undefined)).toBe(true);
  });
  it("skips imported rows, transfers and blank payees", () => {
    expect(remembersPayee(tx("POS COSTCO #12"), undefined, true)).toBe(false);
    expect(remembersPayee(tx("Savings", true), undefined)).toBe(false);
    expect(remembersPayee(tx("  "), undefined)).toBe(false);
  });
  it("remembers an edited payee only when it changed", () => {
    expect(remembersPayee(tx("Costco"), { payee: "Costco" })).toBe(false);
    expect(remembersPayee(tx("Costco"), { payee: "POS COSTCO #12" })).toBe(true);
  });
});

describe("findPayee and sortPayees", () => {
  it("finds a name ignoring case and outer spaces", () => {
    expect(findPayee(payees, " costco ")?.id).toBe("1");
    expect(findPayee(payees, "costco", "1")).toBeUndefined();
  });
  it("sorts A–Z ignoring case", () => {
    expect(sortPayees(payees).map((p) => p.name)).toEqual([
      "Bank of Co-op",
      "Corner Café",
      "Costco",
      "Target",
    ]);
  });
});

describe("payeeUseCounts", () => {
  it("counts transactions per name, ignoring case and blanks", () => {
    const counts = payeeUseCounts([
      { payee: "Costco" },
      { payee: "costco " },
      { payee: "" },
      { payee: "Target" },
    ]);
    expect(counts.get("costco")).toBe(2);
    expect(counts.get("target")).toBe(1);
    expect(counts.has("")).toBe(false);
  });
});

describe("suggestPayees", () => {
  const counts = new Map([
    ["corner café", 5],
    ["costco", 1],
  ]);

  it("suggests nothing until something is typed", () => {
    expect(suggestPayees(payees, counts, "  ")).toEqual([]);
  });

  it("puts names starting with the text first, then the most used", () => {
    expect(suggestPayees(payees, counts, "co").map((p) => p.name)).toEqual([
      "Corner Café",
      "Costco",
      "Bank of Co-op",
    ]);
  });

  it("matches inside a name, ignoring case", () => {
    expect(suggestPayees(payees, counts, "GET").map((p) => p.name)).toEqual(["Target"]);
  });

  it("leaves out the name exactly as typed", () => {
    expect(suggestPayees(payees, counts, "Costco")).toEqual([]);
    expect(suggestPayees(payees, counts, "costco").map((p) => p.name)).toEqual(["Costco"]);
  });

  it("shows at most the limit", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ id: `${i}`, name: `Shop ${i}` }));
    expect(suggestPayees(many, new Map(), "shop")).toHaveLength(8);
    expect(suggestPayees(many, new Map(), "shop", 3)).toHaveLength(3);
  });
});
