import { useState, type FormEvent } from "react";
import { useAsyncAction } from "../../controllers/useAsyncAction";
import type { useAccountView } from "../../controllers/useAccountView";
import type { BatchAction } from "../../models/batchEdits";
import { formatCents, formatSignedCents } from "../../models/money";
import { formatMonth, formatShortDay } from "../../models/month";
import { ErrorMessage } from "../components";

type Batch = NonNullable<ReturnType<typeof useAccountView>["batch"]>;
export type BatchKind = BatchAction["kind"];

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * Confirms Delete, Move or Change date for the ticked rows (batchEdits.ts).
 * Rows the action cannot take (transfers, splits, and so on) are listed with
 * the reason, and so is anything it would leave short; each list offers to
 * untick the rows behind it. Confirming is possible once nothing is listed.
 */
export function BatchDialog({
  batch,
  kind,
  firstDate,
  onClose,
}: {
  batch: Batch;
  kind: BatchKind;
  /** The new date to start from (the first ticked row's). */
  firstDate: string;
  onClose: () => void;
}) {
  const [date, setDate] = useState(firstDate);
  const [accountId, setAccountId] = useState(batch.moveTargets[0]?.id ?? "");
  const action: BatchAction | null =
    kind === "delete"
      ? { kind }
      : kind === "move"
        ? accountId
          ? { kind, accountId }
          : null
        : date
          ? { kind, date }
          : null;
  const plan = action ? batch.plan(action) : null;
  const save = useAsyncAction(async () => {
    if (action) await batch.run(action);
  });
  const blocked = !plan || plan.excluded.length > 0 || plan.shortfalls.length > 0;
  const count = plan?.ready.length ?? 0;

  const heading =
    kind === "delete"
      ? "Delete transactions"
      : kind === "move"
        ? "Move to another account"
        : "Change the date";
  const verb = kind === "delete" ? "Delete" : kind === "move" ? "Move" : "Change date of";

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (blocked || count === 0) return;
    if ((await save.run()).ok) onClose();
  };

  return (
    <form className="form batch-dialog" onSubmit={submit}>
      <h2>{heading}</h2>
      {kind === "move" && (
        <label className="field">
          To account
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {batch.moveTargets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {kind === "redate" && (
        <label className="field field-date">
          New date
          <input type="date" value={date} required onChange={(e) => setDate(e.target.value)} />
        </label>
      )}

      {plan && plan.excluded.length > 0 && (
        <section className="batch-warning" aria-labelledby="batch-excluded">
          <h3 id="batch-excluded">
            {plural(plan.excluded.length, "ticked row")} can’t be changed together
          </h3>
          <p>Change {plan.excluded.length === 1 ? "it" : "them"} one at a time instead.</p>
          <ul>
            {plan.excluded.map(({ tx, reason }) => (
              <li key={tx.id}>
                <span>
                  {tx.payee || "(no payee)"} · {formatShortDay(tx.date)}
                </span>
                <strong>{formatSignedCents(tx.amount)}</strong>
                <em>{reason}</em>
              </li>
            ))}
          </ul>
          <button
            className="secondary-button"
            type="button"
            onClick={() => batch.untick(plan.excluded.map(({ tx }) => tx.id))}
          >
            Untick {plan.excluded.length === 1 ? "this row" : `these ${plan.excluded.length} rows`}
          </button>
        </section>
      )}

      {plan?.shortfalls.map((s) => (
        <section
          className="batch-warning"
          key={`${s.name}|${s.month}`}
          aria-label={`${s.name} would be short`}
        >
          <h3>
            {s.name === "Available to Assign"
              ? `This would leave you Over Assigned by ${formatCents(s.short)} in ${formatMonth(s.month)}`
              : `${s.name} would be ${formatCents(s.short)} short in ${formatMonth(s.month)}`}
          </h3>
          {s.transactionIds.length > 0 ? (
            <button
              className="secondary-button"
              type="button"
              onClick={() => batch.untick(s.transactionIds)}
            >
              Untick the {plural(s.transactionIds.length, "row")} causing this
            </button>
          ) : (
            <p>Assign more first, or change these rows one at a time.</p>
          )}
        </section>
      ))}

      {plan && !blocked && count > 0 && (
        <p className="batch-summary">
          {verb} {plural(count, "transaction")}, {formatSignedCents(plan.total)}
          {kind === "delete" && " for good."}
          {kind === "move" &&
            ` to ${batch.moveTargets.find((a) => a.id === accountId)?.name ?? "the account"}.`}
          {kind === "redate" && ` to ${formatShortDay(date)}.`}
        </p>
      )}
      {plan && !blocked && plan.imported > 0 && (
        <p className="notice">
          {count === 1
            ? "It came"
            : plan.imported === count
              ? "They came"
              : `${plan.imported} of them came`}{" "}
          from a bank file. The next import covering{" "}
          {plan.imported === 1 ? "its date" : "their dates"} will add{" "}
          {plan.imported === 1 ? "it" : "them"} again.
        </p>
      )}
      {plan && count === 0 && plan.excluded.length === 0 && (
        <p className="empty-state">No ticked rows left to change.</p>
      )}

      <ErrorMessage error={save.error} />
      <button
        className={`primary-button${kind === "delete" ? " danger" : ""}`}
        type="submit"
        disabled={blocked || count === 0 || save.pending}
      >
        {kind === "delete"
          ? `Delete ${plural(count, "transaction")}`
          : kind === "move"
            ? `Move ${plural(count, "transaction")}`
            : `Change ${plural(count, "date")}`}
      </button>
      <button className="secondary-button" type="button" onClick={onClose}>
        Cancel
      </button>
    </form>
  );
}
