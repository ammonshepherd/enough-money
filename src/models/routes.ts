import { isMonth, type Month } from "./month";

/** The app's pages. Hash routing (#budget) works on any static host. */
export const ROUTES = ["budget", "accounts", "manage"] as const;

/** One of the strings in ROUTES: "budget" | "accounts" | "manage". */
export type Route = (typeof ROUTES)[number];

export const ROUTE_TITLES: Record<Route, string> = {
  budget: "Budget",
  accounts: "Accounts",
  manage: "Manage",
};

/** What the Accounts page has open: nothing (the list), "all" accounts, or one account's id. */
export type AccountsView = "all" | string | null;

export interface AppLocation {
  route: Route;
  /**
   * The month from "#budget/2026-10" or "#accounts/all/2026-10", or null to
   * use the month last chosen (else the current month).
   */
  month: Month | null;
  /** On Accounts, what is open (null: the list). Always null on other pages. */
  account: AccountsView;
}

/** Pages that show one month, kept in the URL. */
export const MONTH_ROUTES: readonly Route[] = ["budget", "accounts"];

/**
 * Reads a location hash such as "#Manage", "#budget/2026-10",
 * "#accounts/all/2026-10" or "#accounts/<account id>"; anything unknown means
 * Budget. Old links still work: "#activity" reads as All accounts and
 * "#settings" (Manage's name before v0.46.0) as Manage.
 */
export function parseLocation(hash: string): AppLocation {
  const parts = hash.replace(/^#\/?/, "").split("/");
  const name = (parts[0] ?? "").toLowerCase();
  // The last part may be a month; whatever sits between is the open account.
  const last = parts.length > 1 ? (parts[parts.length - 1] ?? "") : "";
  const month = isMonth(last) ? last : null;
  const middle = parts.slice(1, month ? -1 : undefined).filter(Boolean);

  if (name === "activity") return { route: "accounts", month, account: "all" };
  const route = ROUTES.find((r) => r === (name === "settings" ? "manage" : name)) ?? "budget";
  if (route !== "accounts") {
    return { route, month: MONTH_ROUTES.includes(route) ? month : null, account: null };
  }
  const opened = middle[0] ?? null;
  return { route, month, account: opened?.toLowerCase() === "all" ? "all" : opened };
}

/** The hash a location is shown at: old links (#activity) are rewritten to it. */
export function locationHash({ route, month, account }: AppLocation): string {
  if (route === "accounts") return accountsHref(account, month);
  return month && MONTH_ROUTES.includes(route) ? `#${route}/${month}` : `#${route}`;
}

export function budgetHref(month: Month): string {
  return `#budget/${month}`;
}

/** Accounts with nothing open (null), All accounts ("all") or one account open, with the month. */
export function accountsHref(account: AccountsView, month: Month | null): string {
  const parts = ["accounts", account, month].filter(Boolean);
  return `#${parts.join("/")}`;
}

/** A link to a page: Budget and Accounts carry the month, so it stays the same between them. */
export function routeHref(route: Route, month: Month): string {
  return MONTH_ROUTES.includes(route) ? `#${route}/${month}` : `#${route}`;
}

/**
 * The pages listed on Manage, each at its own address ("#manage/tags").
 * Restore sits apart from Backup, in the danger zone at the bottom.
 */
export const MANAGE_SECTIONS = [
  "appearance",
  "password",
  "email",
  "groups",
  "plan",
  "income-rules",
  "tags",
  "payees",
  "backup",
  "feedback",
  "restore",
] as const;

export type ManageSection = (typeof MANAGE_SECTIONS)[number];

export function manageHref(section?: ManageSection): string {
  return section ? `#manage/${section}` : "#manage";
}

/**
 * The Manage page a hash points at ("#manage/tags"), else null (the list).
 * The old "#settings/groups" points at Envelope groups.
 */
export function manageSection(hash: string): ManageSection | null {
  const match = /^#\/?(?:manage|settings)\/([^/]+)\/?$/i.exec(hash);
  const name = match?.[1]?.toLowerCase();
  return MANAGE_SECTIONS.find((s) => s === name) ?? null;
}

/** An old "#settings…" link's new address ("#settings/groups" → "#manage/groups"), else null. */
export function legacySettingsHash(hash: string): string | null {
  return /^#\/?settings(?=\/|$)/i.test(hash) ? manageHref(manageSection(hash) ?? undefined) : null;
}
