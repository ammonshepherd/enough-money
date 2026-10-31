import { useEffect, useRef, useState } from "react";
import type { Budget } from "../controllers/useBudget";
import {
  blankTransactionForm,
  useEnvelopeRemaining,
  useTransactionEntry,
  type CoverPlan,
  type TransactionForm,
} from "../controllers/useTransactionEntry";
import type { BudgetData } from "../models/types";
import { Sheet } from "./components";
import { PlusIcon } from "./icons";
import { CoverCard } from "./transactions/CoverCard";
import { TransactionEditor } from "./transactions/TransactionEditor";

/**
 * The transaction form, then the cover prompt if its envelope would go
 * negative. Shown in TransactionDialog, for adding and for editing.
 */
export function TransactionEntry({
  budget,
  data,
  initial,
  heading,
  onDone,
  onCancel,
  onDelete,
}: {
  budget: Budget;
  data: BudgetData;
  initial: TransactionForm;
  heading: string;
  onDone: () => void;
  onCancel: () => void;
  /** Set when editing: shows a Delete button. */
  onDelete?: () => Promise<void>;
}) {
  const entry = useTransactionEntry(budget, data);
  const [form, setForm] = useState(initial);
  const [plan, setPlan] = useState<CoverPlan | null>(null);
  const remaining = useEnvelopeRemaining(data, form.date);

  if (entry.openAccounts.length === 0) {
    return (
      <p className="notice">
        <a href="#accounts" onClick={onCancel}>
          Add an account
        </a>{" "}
        before entering transactions.
      </p>
    );
  }
  return plan ? (
    <CoverCard
      // A new card per short envelope, so its choice starts fresh.
      key={plan.envelopeId}
      entry={entry}
      plan={plan}
      onNext={setPlan}
      onDone={onDone}
      onBack={() => setPlan(null)}
    />
  ) : (
    <TransactionEditor
      entry={entry}
      heading={heading}
      form={form}
      setForm={setForm}
      remaining={remaining}
      onSaved={onDone}
      onNeedsCover={setPlan}
      onCancel={onCancel}
      onDelete={onDelete}
    />
  );
}

/**
 * A modal dialog holding TransactionEntry. `open` is controlled by the
 * caller; Escape, Cancel, saving and deleting all call onClose.
 */
export function TransactionDialog({
  budget,
  data,
  open,
  heading,
  initial,
  onClose,
  onDelete,
}: {
  budget: Budget;
  data: BudgetData;
  open: boolean;
  heading: string;
  initial: () => TransactionForm;
  onClose: () => void;
  onDelete?: () => Promise<void>;
}) {
  return (
    <Sheet open={open} label={heading} onClose={onClose}>
      {() => (
        <TransactionEntry
          budget={budget}
          data={data}
          initial={initial()}
          heading={heading}
          onDone={onClose}
          onCancel={onClose}
          onDelete={
            onDelete &&
            (async () => {
              await onDelete();
              onClose();
            })
          }
        />
      )}
    </Sheet>
  );
}

/**
 * The round + button in the bottom-right corner (Budget and Accounts, on a
 * phone). It opens the transaction form in a modal dialog, starting in the
 * account open on Accounts; its Account picker offers every open account.
 * On a desktop, Add transaction sits in the panel on the right instead
 * (SidePanel's onAdd, then PanelAddTransaction).
 */
export function AddTransactionButton({
  budget,
  data,
  accountId = null,
}: {
  budget: Budget;
  data: BudgetData;
  /** The account open on Accounts: a new transaction starts in it. */
  accountId?: string | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        className="fab"
        type="button"
        aria-label="Add transaction"
        title="Add transaction"
        onClick={() => setOpen(true)}
      >
        <PlusIcon />
      </button>
      <TransactionDialog
        budget={budget}
        data={data}
        open={open}
        heading="Add a transaction"
        initial={() => blankTransactionForm(data, accountId)}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

/**
 * Adding a transaction in the desktop panel on the right: the form, starting
 * in the open account (any open account can be picked). Saving, Cancel and
 * Escape close it; Payee has the focus to start.
 */
export function PanelAddTransaction({
  budget,
  data,
  accountId,
  onClose,
}: {
  budget: Budget;
  data: BudgetData;
  /** The account open on Accounts; null elsewhere. */
  accountId: string | null;
  onClose: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [initial] = useState(() => blankTransactionForm(data, accountId));

  useEffect(() => {
    box.current?.querySelector<HTMLInputElement>(".field-payee input")?.focus();
  }, []);

  return (
    <div
      ref={box}
      className="panel-edit"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
        }
      }}
    >
      <TransactionEntry
        budget={budget}
        data={data}
        initial={initial}
        heading="Add a transaction"
        onDone={onClose}
        onCancel={onClose}
      />
    </div>
  );
}
