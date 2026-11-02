# Proposal: reconciling an account against a bank statement

Status: **chosen as the next step for reconciling, not built.** Written
2026-11-01 against v0.39.0. The owner picked this option (and the choices
below) when discussing how to mark "October is done and matches the bank".

Today `transactions.reconciled` is only a mark (decided in v0.27.0): ticked
rows on Accounts can be marked reconciled, and the info pane shows a
"Reconciled $X" balance, but nothing checks it against the bank.

## What it does

Per account (statements end on different days, so this is not by calendar
month):

1. Start from the account's info pane ("Reconcile…").
2. Enter the statement's end date and ending balance (for a card, the
   amount owed, as the account form takes it).
3. The app shows the reconciled balance as of that date (opening balance
   plus reconciled transactions on or before it), the statement balance and
   the difference. Ticking rows to mark them reconciled updates the
   difference as you go.
4. **Finish** is offered only when the difference is exactly $0.00. It saves
   a statement record: account, end date, ending balance, when, and who.
5. The info pane then shows "Matched the bank at $X on ⟨date⟩" (the latest
   statement record).

## Decided by the owner (2026-11-01)

- **Statement dates vary by account.** Each reconciliation takes its own
  end date (a card statement closing on the 15th, say).
- **Warn, don't lock.** Editing, deleting or un-reconciling a transaction
  covered by a finished statement asks first ("This was reconciled with the
  statement of Oct 31. Change it anyway?"), then allows it.
- **Finish needs a $0.00 difference.** No adjustment transaction: the
  missing or wrong row has to be found.
- **Every account can be reconciled:** checking, credit cards and tracking
  accounts.

## Still to decide

- What happens to a statement record when a later edit breaks it (after the
  warning): mark it "no longer matches" on the info pane, or drop it?
- Whether a statement record can be deleted or redone, and whether only the
  latest one can be.
- Whether the warning covers bulk actions on ticked rows and CSV import
  matching (a bank row matched to a typed transaction that is reconciled).
- Phone and desktop layouts for the reconcile screen (a sheet on a phone,
  the right panel on a desktop, like the account edit form).

## What building it touches

- A new table (say `account_statements`: account, end date, balance,
  created at/by) with household RLS, a SQL function to finish (checks the
  difference is $0.00 in the database too), `database.types.ts`.
- The memory store and `storeRules.shared.ts` (same rules).
- Backup: `export_backup`, `restore_backup`, the `Backup` types and
  `validateBackup` (and the format version).
- No budget math changes: like the reconciled mark, statements change no
  envelope or Available to Assign number.

## Later, building on it

Closing a budget month ("October is done"): offered once nothing in October
is to review and every account has a statement through October 31; it would
warn before changes to that month's transactions, Assigned or Released.
Not chosen yet.
