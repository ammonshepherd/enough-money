import { useAsyncAction } from "../../controllers/useAsyncAction";
import { DUE_DAY_CHOICES, type DueLabel } from "../../models/dueDates";
import { ErrorMessage } from "../components";

/**
 * "Due 15th" on line 1 of an envelope's row (Compact rows too). Amber from
 * 3 days before through the due day in the current month; screen readers
 * hear "soon".
 */
export function DueChip({ due }: { due: DueLabel | null }) {
  if (!due) return null;
  return (
    <span className={due.soon ? "due-chip soon" : "due-chip"}>
      {due.text}
      {due.soon && <span className="visually-hidden"> (soon)</span>}
    </span>
  );
}

/**
 * The envelope sheet's Due day: a day of the month, 1st to 31st, every
 * month, or none. Saved as soon as it is picked. Display only.
 */
export function DueDayField({
  envelopeName,
  dueDay,
  onSave,
}: {
  envelopeName: string;
  dueDay: number | null;
  onSave: (dueDay: number | null) => Promise<void>;
}) {
  const save = useAsyncAction(onSave);
  return (
    <div className="due-day-field">
      <label className="sheet-field">
        <span className="sheet-field-label">Due day</span>
        <select
          className="sheet-field-value"
          aria-label={`Due day for ${envelopeName}`}
          value={dueDay ?? ""}
          disabled={save.pending}
          onChange={(event) =>
            void save.run(event.target.value === "" ? null : Number(event.target.value))
          }
        >
          <option value="">None</option>
          {DUE_DAY_CHOICES.map((choice) => (
            <option key={choice.day} value={choice.day}>
              {choice.label} of each month
            </option>
          ))}
        </select>
      </label>
      <ErrorMessage error={save.error} />
    </div>
  );
}
