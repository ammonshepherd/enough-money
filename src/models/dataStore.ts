/**
 * The contract between controllers and wherever data lives. Controllers only
 * use this interface, so the real Supabase store and the in-memory store used
 * by UI tests are interchangeable ("dependency injection").
 */
import type { Backup } from "./backup";
import type { EmailLink } from "./emailLink";
import type { EnvelopePlanRow, PlannedAmount } from "./envelopePlan";
import type { GoalDetails } from "./goals";
import type { Cents } from "./money";
import type { Month } from "./month";
import type { ImportedTransaction, ImportFormat } from "./transactionImport";
import type { NewIncomeRule } from "./incomeRules";
import type { TagDetails } from "./tags";
import type { TransferInput } from "./transfers";
import type { AccountType, Allocation, BudgetData, IsoDate } from "./types";

export interface UserSession {
  userId: string;
  email: string;
  /** The name the user chose (Manage → Account Info), "" when none. */
  displayName: string;
}

/** The account details that can be edited after it is added. */
export interface AccountDetails {
  name: string;
  openingBalance: Cents;
  openingDate: IsoDate;
}

/** The type (and whether it is a tracking account) is chosen once, when the account is added. */
export interface NewAccount extends AccountDetails {
  type: AccountType;
  /**
   * False for a tracking account: off budget and standalone (no envelopes,
   * Income or transfers). Only a checking-type account can be off budget.
   * Defaults to true.
   */
  onBudget?: boolean;
}

export interface TransactionInput {
  /** Omit to create; set to update. */
  id?: string;
  accountId: string;
  date: IsoDate;
  amount: Cents;
  payee: string;
  memo: string;
  /** An inflow to Available to Assign (needs no allocations and a positive amount). */
  isIncome: boolean;
  /**
   * One line per envelope, each with the transaction's sign, summing to the
   * amount (several = a split; see splits.ts). Empty = Uncategorized.
   * Transfers are saved with saveTransfer.
   */
  allocations: Allocation[];
  /** Its tags, replacing those it had. Omit to keep them (none for a new one). */
  tagIds?: string[];
  /**
   * Whether it is marked reconciled with the bank (only a mark: no budget
   * math). Omit to keep the mark (not reconciled for a new one).
   */
  reconciled?: boolean;
}

export interface DataStore {
  getSession(): Promise<UserSession | null>;
  /** Calls back on sign-in and sign-out; returns an unsubscribe function. */
  onSessionChange(callback: (session: UserSession | null) => void): () => void;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  /**
   * Signs in with the token from an Invite user, Reset password or Change
   * email address email (see emailLink.ts) and returns who it signed in.
   * Null only for the first of a Change email address email's two links,
   * which changes nothing yet.
   */
  verifyEmailLink(link: EmailLink): Promise<UserSession | null>;
  /** Sets the signed-in user's password (at least MIN_PASSWORD_LENGTH characters). */
  setPassword(password: string): Promise<void>;
  /**
   * Manage → Account Info → Change password: checks the current password (WRONG_PASSWORD
   * in signInDetails.ts), then sets the new one.
   */
  changePassword(currentPassword: string, newPassword: string): Promise<void>;
  /**
   * Manage → Account Info → Change email: checks the current password, then asks Supabase
   * Auth to email a confirmation link to the old and the new address. The
   * email changes once both are opened. EMAIL_TAKEN when another account
   * already uses it.
   */
  changeEmail(currentPassword: string, newEmail: string): Promise<void>;
  /**
   * Manage → Account Info: sets the signed-in user's display name (kept with
   * their sign-in, not the household; "" removes it). Session listeners hear
   * the change. The name is checked by cleanDisplayName.
   */
  setDisplayName(name: string): Promise<void>;
  /** Emails a Reset password link. Says nothing about whether the account exists. */
  sendPasswordReset(email: string): Promise<void>;

  /** The signed-in user's whole budget, or null if they have no household yet. */
  load(): Promise<BudgetData | null>;
  createHousehold(name: string): Promise<void>;
  /** Renames the household (1–100 characters once trimmed; Manage → the household's pencil). */
  renameHousehold(householdId: string, name: string): Promise<void>;

  addAccount(householdId: string, account: NewAccount): Promise<void>;
  /** Changes an account's name, opening balance and opening date. */
  updateAccount(accountId: string, account: AccountDetails): Promise<void>;
  closeAccount(accountId: string): Promise<void>;

  addGroup(householdId: string, name: string, position: number): Promise<void>;
  addEnvelope(householdId: string, groupId: string, name: string, position: number): Promise<void>;
  deleteEnvelope(envelopeId: string): Promise<void>;
  deleteGroup(groupId: string): Promise<void>;
  renameGroup(groupId: string, name: string): Promise<void>;
  /** A card's payment envelope cannot be renamed: it is named after its card. */
  renameEnvelope(envelopeId: string, name: string): Promise<void>;
  /**
   * Moves an envelope to another group, at `position` there. A card's payment
   * envelope stays in its group.
   */
  moveEnvelope(envelopeId: string, groupId: string, position: number): Promise<void>;
  /** Saves a new order. The list names every group of the household once, top first. */
  reorderGroups(householdId: string, groupIds: string[]): Promise<void>;
  /** Saves a new order. The list names every envelope of the group once, top first. */
  reorderEnvelopes(groupId: string, envelopeIds: string[]): Promise<void>;

  /** Adds to (not replaces) an envelope's Assigned and Released for a month. */
  adjustEnvelopeMonth(
    envelopeId: string,
    month: Month,
    change: { assigned?: Cents; released?: Cents },
  ): Promise<void>;
  moveBetweenEnvelopes(fromId: string, toId: string, month: Month, amount: Cents): Promise<void>;
  setPlanned(householdId: string, envelopeId: string, month: Month, planned: Cents): Promise<void>;
  /** All or nothing: sets Planned for several envelopes in one month. */
  setPlannedAmounts(householdId: string, month: Month, rows: PlannedAmount[]): Promise<void>;
  /**
   * All or nothing: creates the groups and envelopes a plan names that do not
   * exist yet (matching names ignoring case) and sets each one's Planned for
   * the month.
   */
  importEnvelopePlan(householdId: string, month: Month, rows: EnvelopePlanRow[]): Promise<void>;

  /**
   * Sets an envelope's goal: changes its active goal, or adds one when it has
   * none. Never on a card's payment envelope. Display only: no budget math.
   */
  setGoal(householdId: string, envelopeId: string, goal: GoalDetails): Promise<void>;
  /** Archives a goal: it is kept but no longer shown, and the envelope can have a new one. */
  archiveGoal(goalId: string): Promise<void>;
  /** Removes a goal for good. */
  deleteGoal(goalId: string): Promise<void>;

  /**
   * Adds or updates a transaction. A new one's payee, or a changed payee,
   * joins the saved payees (see payees.ts).
   */
  saveTransaction(householdId: string, input: TransactionInput): Promise<void>;
  /**
   * Saves both sides of a transfer at once. Sides with an id update that
   * transaction (e.g. link an imported bank row); others are added. When
   * editing, a side the transfer no longer has is released: deleted if it
   * was typed in, kept as an Uncategorized row if it was imported.
   */
  saveTransfer(input: TransferInput): Promise<void>;
  /**
   * Marks Uncategorized inflows as Income in one step; anything else in the
   * list is left alone. Resolves to how many were marked.
   */
  markIncome(transactionIds: string[]): Promise<number>;
  /**
   * Marks transactions reconciled with the bank (or not) in one step.
   * Resolves to how many changed.
   */
  setReconciled(transactionIds: string[], reconciled: boolean): Promise<number>;

  /** Adds a tag (name unique ignoring case); resolves to its id. */
  addTag(householdId: string, tag: TagDetails): Promise<string>;
  /** Renames a tag or changes its colour. */
  updateTag(tagId: string, tag: TagDetails): Promise<void>;
  /** Deletes a tag and takes it off every transaction. */
  deleteTag(tagId: string): Promise<void>;
  /**
   * Adds a tag to (`on`) or takes it off several transactions in one step.
   * Transactions already in that state, or already at the most tags, are
   * left alone. Resolves to how many changed.
   */
  tagTransactions(transactionIds: string[], tagId: string, on: boolean): Promise<number>;

  /**
   * Renames a saved payee and every transaction with its name (ignoring
   * case). A name another payee has already merges the two into one.
   */
  renamePayee(payeeId: string, name: string): Promise<void>;
  /** Takes a payee off the saved list; its transactions keep their payee. */
  deletePayee(payeeId: string): Promise<void>;

  addIncomeRule(householdId: string, rule: NewIncomeRule): Promise<void>;
  deleteIncomeRule(ruleId: string): Promise<void>;
  /**
   * All or nothing: adds imported rows to an open account as Uncategorized,
   * skipping any whose import key the account already has, matches rows with
   * a `matchId` to that typed-in transaction (it takes the import key and
   * keeps the rest), and saves the column mapping on the account. A match
   * that no longer fits (edited, deleted or matched meanwhile) fails the
   * whole import. Resolves to how many rows were added or matched.
   */
  importTransactions(
    accountId: string,
    format: ImportFormat,
    rows: ImportedTransaction[],
  ): Promise<number>;
  deleteTransaction(transactionId: string): Promise<void>;
  /**
   * The ticked-rows actions (batchEdits.ts), each all or nothing, resolving
   * to how many changed. Only basic transactions: in an open account, not a
   * transfer and not a split; a list naming any other (or one not found)
   * changes nothing. Imported rows can be deleted (their import key goes).
   */
  deleteTransactions(transactionIds: string[]): Promise<number>;
  /**
   * Moves typed-in transactions (no import key) to another open account of
   * the same kind, never dated before it opened. Envelopes and Income stay.
   */
  moveTransactions(transactionIds: string[], accountId: string): Promise<number>;
  /** Gives transactions a new date, never before their account opened. */
  redateTransactions(transactionIds: string[], date: IsoDate): Promise<number>;

  /** Everything in the household, read as one consistent snapshot (see backup.ts). */
  exportBackup(householdId: string): Promise<Backup>;
  /**
   * All or nothing: loads a backup into the household, which must hold no
   * budget data yet, and renames the household to the backup's name. Every
   * row gets a fresh id. Rejects a file that breaks any database rule.
   */
  restoreBackup(householdId: string, backup: Backup): Promise<void>;

  /**
   * Emails the message to the owner (Manage → Send feedback), through the
   * send-feedback Edge Function. Only the text is sent; replies go to the
   * signed-in user's email.
   */
  sendFeedback(message: string): Promise<void>;
}

/** An error whose message is safe and useful to show the user. */
export class UserFacingError extends Error {}
