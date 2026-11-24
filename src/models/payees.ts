/**
 * Saved payees: the household's list of payee names, offered as suggestions
 * while typing a payee in the transaction form. A transaction keeps its
 * payee as text; the list only remembers names. A payee typed in the form
 * joins the list (the database does it as the transaction is saved; see
 * `remembersPayee`); imported bank descriptions and transfers do not.
 * Renaming a payee renames it on its transactions too; deleting one only
 * takes it off the list. Payees change no budget math.
 */
import { UserFacingError } from "./dataStore";
import type { Transaction } from "./types";

export interface Payee {
  id: string;
  name: string;
}

/** Same as a transaction's payee. */
export const MAX_PAYEE_NAME = 200;

/** How many suggestions the form shows at most. */
export const MAX_PAYEE_SUGGESTIONS = 8;

/** Names are compared ignoring case and spaces at the ends. */
export const payeeKey = (name: string) => name.trim().toLocaleLowerCase();

/** The name as it will be saved; throws a message to show when it cannot be. */
export function cleanPayeeName(name: string): string {
  const clean = name.trim();
  if (!clean) throw new UserFacingError("Give the payee a name.");
  if (clean.length > MAX_PAYEE_NAME) {
    throw new UserFacingError(`A payee name is at most ${MAX_PAYEE_NAME} characters.`);
  }
  return clean;
}

/**
 * Whether saving a transaction adds its payee to the list (the database's
 * `remember_payee` trigger): a typed transaction (`previous` undefined, not
 * imported) or one whose payee changed, never a transfer or a blank payee.
 */
export function remembersPayee(
  tx: Pick<Transaction, "payee" | "isTransfer">,
  previous: Pick<Transaction, "payee"> | undefined,
  imported = false,
): boolean {
  if (tx.isTransfer || tx.payee.trim() === "") return false;
  return previous === undefined ? !imported : previous.payee !== tx.payee;
}

/** The payee with this name (ignoring case), if any; `exceptId` is skipped. */
export const findPayee = (payees: Payee[], name: string, exceptId?: string): Payee | undefined =>
  payees.find((p) => p.id !== exceptId && payeeKey(p.name) === payeeKey(name));

/** Alphabetical, ignoring case. */
export const sortPayees = <T extends Payee>(payees: T[]): T[] =>
  [...payees].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

/** How many transactions carry each payee name (by `payeeKey`). */
export function payeeUseCounts(transactions: Pick<Transaction, "payee">[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const tx of transactions) {
    const key = payeeKey(tx.payee);
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/**
 * The payees to suggest for what is typed: names containing it (ignoring
 * case), those starting with it first, then the most used, then A–Z. None
 * until something is typed, and none that is exactly what is typed (there
 * is nothing left to pick).
 */
export function suggestPayees(
  payees: Payee[],
  counts: Map<string, number>,
  typed: string,
  limit = MAX_PAYEE_SUGGESTIONS,
): Payee[] {
  const query = payeeKey(typed);
  if (!query) return [];
  const exact = typed.trim();
  return payees
    .filter((p) => p.name !== exact && payeeKey(p.name).includes(query))
    .map((p) => ({
      payee: p,
      starts: payeeKey(p.name).startsWith(query),
      uses: counts.get(payeeKey(p.name)) ?? 0,
    }))
    .sort(
      (a, b) =>
        Number(b.starts) - Number(a.starts) ||
        b.uses - a.uses ||
        a.payee.name.localeCompare(b.payee.name, undefined, { sensitivity: "base" }),
    )
    .slice(0, limit)
    .map((s) => s.payee);
}
