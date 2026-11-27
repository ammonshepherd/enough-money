/**
 * Changing several ticked transactions at once in an open account
 * (decided in v0.54.0): Delete, Move to another account and Change date.
 * Only basic transactions take part. A ticked row that is not basic for the
 * action is never skipped quietly: the confirmation lists it with its reason
 * and offers to untick it. The same rules are checked again by the stores
 * (SQL functions delete_transactions, move_transactions and
 * redate_transactions, and memoryStore.ts), where a row that breaks one
 * fails the whole batch.
 *
 * What a batch would leave short (an envelope below $0.00, or Over
 * Assigned) is budget math: batchShortfalls in budgetMath.ts.
 */
import type { BatchChange } from "./budgetMath";
import type { Account, BudgetData, IsoDate, Transaction } from "./types";

export type BatchAction =
  { kind: "delete" } | { kind: "move"; accountId: string } | { kind: "redate"; date: IsoDate };

/** At most this many transactions in one batch (as the SQL functions check). */
export const MAX_BATCH = 2000;

/** The stores' refusals (the SQL functions raise the same words). */
export const BATCH_MESSAGES = {
  tooMany: "Change at most 2000 transactions at once",
  notFound: "A ticked transaction has changed or is gone. Tick them again.",
  notBasic: "Transfers and splits are changed one at a time",
  closed: "Transactions in a closed account cannot be changed",
  moveTarget: "Move to another open account of the same kind",
  imported: "Only transactions typed in (not imported) can move to another account",
  beforeOpening: "A transaction cannot be dated before its account opened",
} as const;

/** Why a ticked transaction cannot take part; null when it can. */
export function batchExclusion(
  data: Pick<BudgetData, "accounts">,
  tx: Transaction,
  action: BatchAction,
): string | null {
  if (tx.isTransfer) return "Transfer";
  if (tx.allocations.length > 1) return "Split";
  if (action.kind === "move") {
    if (tx.importKey !== null) return "Imported from the bank";
    const target = data.accounts.find((a) => a.id === action.accountId);
    if (target && tx.date < target.openingDate) return `Before ${target.name} opened`;
  }
  if (action.kind === "redate") {
    const account = data.accounts.find((a) => a.id === tx.accountId);
    if (account && action.date < account.openingDate) return `Before ${account.name} opened`;
  }
  return null;
}

/**
 * Accounts ticked rows can move to from `account`: open ones of the same
 * kind (checking, card or tracking), since moving between kinds would change
 * what a transaction means.
 */
export function moveTargets(data: Pick<BudgetData, "accounts">, account: Account): Account[] {
  return data.accounts
    .filter(
      (a) =>
        a.id !== account.id &&
        !a.closedAt &&
        a.type === account.type &&
        a.onBudget === account.onBudget,
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** The transaction as the action leaves it: moved, redated, or null when deleted. */
export function batchChange(tx: Transaction, action: BatchAction): BatchChange {
  if (action.kind === "delete") return { before: tx, after: null };
  if (action.kind === "move") return { before: tx, after: { ...tx, accountId: action.accountId } };
  return { before: tx, after: { ...tx, date: action.date } };
}

/** Deleted imported rows: their import key goes too, so the next bank file can add them again. */
export function importedCount(transactions: readonly Transaction[]): number {
  return transactions.filter((tx) => tx.importKey !== null).length;
}
