import { describe, expect, it } from "vitest";
import {
  accountsHref,
  budgetHref,
  locationHash,
  parseLocation,
  routeHref,
  legacySettingsHash,
  manageHref,
  manageSection,
} from "./routes";

describe("parseLocation", () => {
  it("reads known routes regardless of case or a leading slash", () => {
    expect(parseLocation("#accounts")).toEqual({ route: "accounts", month: null, account: null });
    expect(parseLocation("#/Manage")).toEqual({ route: "manage", month: null, account: null });
  });

  it("reads the Budget month and ignores invalid ones", () => {
    expect(parseLocation(budgetHref("2026-10"))).toEqual({
      route: "budget",
      month: "2026-10",
      account: null,
    });
    expect(parseLocation("#budget/2026-13")).toEqual({
      route: "budget",
      month: null,
      account: null,
    });
    expect(parseLocation("#manage/2026-10").month).toBeNull();
  });

  it("reads what Accounts has open, with or without the month", () => {
    expect(parseLocation("#accounts/2026-10")).toEqual({
      route: "accounts",
      month: "2026-10",
      account: null,
    });
    expect(parseLocation("#accounts/all/2026-10")).toEqual({
      route: "accounts",
      month: "2026-10",
      account: "all",
    });
    expect(parseLocation("#Accounts/ALL")).toMatchObject({ account: "all", month: null });
    const id = "5f0c7c1e-2b9a-4f43-9a51-0d0e7b1f9a10";
    expect(parseLocation(`#accounts/${id}/2026-10`)).toEqual({
      route: "accounts",
      month: "2026-10",
      account: id,
    });
    expect(parseLocation(`#accounts/${id}`)).toMatchObject({ account: id, month: null });
  });

  it("reads the old Activity page as All accounts", () => {
    expect(parseLocation("#activity")).toEqual({ route: "accounts", month: null, account: "all" });
    expect(parseLocation("#activity/2026-10")).toEqual({
      route: "accounts",
      month: "2026-10",
      account: "all",
    });
  });

  it("falls back to Budget", () => {
    expect(parseLocation("")).toEqual({ route: "budget", month: null, account: null });
    expect(parseLocation("#nope")).toEqual({ route: "budget", month: null, account: null });
  });
});

describe("links", () => {
  it("link Budget and Accounts with the month, Manage without", () => {
    expect(routeHref("accounts", "2026-10")).toBe("#accounts/2026-10");
    expect(routeHref("budget", "2026-10")).toBe("#budget/2026-10");
    expect(routeHref("manage", "2026-10")).toBe("#manage");
  });

  it("link to what Accounts has open", () => {
    expect(accountsHref(null, "2026-10")).toBe("#accounts/2026-10");
    expect(accountsHref("all", "2026-10")).toBe("#accounts/all/2026-10");
    expect(accountsHref("abc", null)).toBe("#accounts/abc");
  });

  it("rewrite the old Activity link to All accounts", () => {
    expect(locationHash(parseLocation("#activity/2026-10"))).toBe("#accounts/all/2026-10");
    expect(locationHash(parseLocation("#activity"))).toBe("#accounts/all");
    expect(locationHash(parseLocation("#budget/2026-10"))).toBe("#budget/2026-10");
  });
});

describe("Manage pages", () => {
  it("link to each page on Manage", () => {
    expect(manageHref()).toBe("#manage");
    expect(manageHref("tags")).toBe("#manage/tags");
    expect(parseLocation(manageHref("groups"))).toEqual({
      route: "manage",
      month: null,
      account: null,
    });
    expect(manageSection("#manage/income-rules")).toBe("income-rules");
    expect(manageSection("#Manage/Tags/")).toBe("tags");
    expect(manageSection("#manage")).toBeNull();
    expect(manageSection("#manage/nope")).toBeNull();
    expect(manageSection("#budget/groups")).toBeNull();
    expect(manageSection("#manage/account")).toBe("account");
    expect(manageSection("#manage/household")).toBe("household");
    expect(manageSection("#manage/about")).toBe("about");
  });

  it("open Account Info from the old Change password and Change email links", () => {
    expect(manageSection("#manage/password")).toBe("account");
    expect(manageSection("#manage/email")).toBe("account");
  });

  it("read old Settings links as Manage and rewrite them", () => {
    expect(parseLocation("#settings")).toEqual({ route: "manage", month: null, account: null });
    expect(manageSection("#settings/groups")).toBe("groups");
    expect(legacySettingsHash("#settings")).toBe("#manage");
    expect(legacySettingsHash("#/Settings/groups")).toBe("#manage/groups");
    expect(legacySettingsHash("#settings/nope")).toBe("#manage");
    expect(legacySettingsHash("#manage/groups")).toBeNull();
    expect(legacySettingsHash("#settingsx")).toBeNull();
  });
});
