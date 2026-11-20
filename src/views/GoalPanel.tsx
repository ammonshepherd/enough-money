import { useState, type FormEvent } from "react";
import { useAsyncAction } from "../controllers/useAsyncAction";
import type { GoalProgress } from "../models/budgetMath";
import { centsToInput } from "../models/money";
import { formatLongDay, todayIso } from "../models/month";
import type { EnvelopeGoal } from "../models/types";
import { AmountInput } from "./AmountInput";
import { ErrorMessage, Money } from "./components";

type Goal = EnvelopeGoal & { progress: GoalProgress };

/**
 * The envelope sheet's goal: progress as a ring (the envelope's money,
 * Saved + Remaining, against the goal) and what is still to assign per month,
 * week and day to reach it by its date. Display only, like Planned.
 * Met: a full ring, "Goal reached" and Archive goal. Past its date: how much
 * short. Without a goal: "Set a goal…".
 */
export function GoalPanel({
  envelopeName,
  goal,
  onSave,
  onArchive,
  onDelete,
}: {
  envelopeName: string;
  goal: Goal | null;
  onSave: (amount: string, date: string) => Promise<void>;
  onArchive: (goalId: string) => Promise<void>;
  onDelete: (goalId: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const archive = useAsyncAction(onArchive);
  const remove = useAsyncAction(onDelete);

  if (editing || !goal) {
    if (!editing) {
      return (
        <section className="goal-panel empty" aria-label="Goal">
          <button className="goal-set" type="button" onClick={() => setEditing(true)}>
            Set a goal…
          </button>
        </section>
      );
    }
    return (
      <section className="goal-panel" aria-label="Goal">
        <GoalForm
          envelopeName={envelopeName}
          goal={goal}
          onSave={async (amount, date) => {
            await onSave(amount, date);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
          onDelete={
            goal
              ? async () => {
                  if ((await remove.run(goal.id)).ok) setEditing(false);
                }
              : null
          }
          deleting={remove.pending}
        />
        <ErrorMessage error={remove.error} />
      </section>
    );
  }

  const { progress: p } = goal;
  const percent = Math.floor(p.fraction * 100);
  return (
    <section className={`goal-panel ${p.status}`} aria-label="Goal">
      <div className="goal-summary">
        <GoalRing fraction={p.fraction} met={p.status === "met"} />
        <div className="goal-text">
          <span className="goal-label">Goal</span>
          <strong className="goal-amount">
            <Money cents={p.goal} />
          </strong>
          <span className="goal-date">by {formatLongDay(goal.date)}</span>
          <span className="goal-have">
            <Money cents={p.have} /> saved · {percent}%
          </span>
        </div>
      </div>

      {p.status === "met" && <p className="goal-status">Goal reached</p>}
      {p.status === "past" && (
        <p className="goal-status">
          <Money cents={p.left} /> short, date passed
        </p>
      )}
      {p.status === "open" && (
        <div className="goal-pace">
          <p className="goal-status">
            <Money cents={p.left} /> to go
          </p>
          <dl>
            <div>
              <dt>a month</dt>
              <dd>
                <Money cents={p.perMonth} />
              </dd>
            </div>
            <div>
              <dt>a week</dt>
              <dd>
                <Money cents={p.perWeek} />
              </dd>
            </div>
            <div>
              <dt>a day</dt>
              <dd>
                <Money cents={p.perDay} />
              </dd>
            </div>
          </dl>
          <p className="goal-left">
            {count(p.months, "month")} · {count(p.weeks, "week")} · {count(p.days, "day")} left
          </p>
        </div>
      )}

      <div className="goal-actions">
        {p.status === "met" && (
          <button
            className="goal-archive"
            type="button"
            disabled={archive.pending}
            onClick={() => void archive.run(goal.id)}
          >
            Archive goal
          </button>
        )}
        <button className="text-button" type="button" onClick={() => setEditing(true)}>
          Edit goal
        </button>
      </div>
      <ErrorMessage error={archive.error} />
    </section>
  );
}

const count = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** A ring filled to `fraction` (0 to 1); decorative, the numbers are in text beside it. */
function GoalRing({ fraction, met }: { fraction: number; met: boolean }) {
  const r = 26;
  const length = 2 * Math.PI * r;
  return (
    <svg className="goal-ring" width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
      <circle className="goal-ring-track" cx="32" cy="32" r={r} fill="none" strokeWidth="8" />
      <circle
        className={met ? "goal-ring-fill met" : "goal-ring-fill"}
        cx="32"
        cy="32"
        r={r}
        fill="none"
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={`${length * fraction} ${length}`}
        transform="rotate(-90 32 32)"
      />
      {met && (
        <path
          className="goal-ring-tick"
          d="M22 33l7 7 13-15"
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

function GoalForm({
  envelopeName,
  goal,
  onSave,
  onCancel,
  onDelete,
  deleting,
}: {
  envelopeName: string;
  goal: Goal | null;
  onSave: (amount: string, date: string) => Promise<void>;
  onCancel: () => void;
  onDelete: (() => Promise<void>) | null;
  deleting: boolean;
}) {
  const [amount, setAmount] = useState(goal ? centsToInput(goal.amount) : "");
  const [date, setDate] = useState(goal?.date ?? "");
  const save = useAsyncAction(onSave);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void save.run(amount, date);
  };

  return (
    <form className="form goal-form" noValidate onSubmit={submit}>
      <h3>{goal ? "Edit goal" : "Set a goal"}</h3>
      <label className="field">
        Goal amount
        <AmountInput
          aria-label={`Goal amount for ${envelopeName}`}
          value={amount}
          placeholder="0.00"
          onChange={(text) => {
            setAmount(text);
            save.clearError();
          }}
        />
      </label>
      <label className="field">
        Reach it by
        <input
          type="date"
          aria-label={`Goal date for ${envelopeName}`}
          value={date}
          min={todayIso()}
          onChange={(event) => {
            setDate(event.target.value);
            save.clearError();
          }}
        />
      </label>
      <ErrorMessage error={save.error} />
      <div className="goal-actions">
        <button className="primary-button" type="submit" disabled={save.pending}>
          Save goal
        </button>
        <button className="text-button" type="button" onClick={onCancel}>
          Cancel
        </button>
        {onDelete && (
          <button
            className="text-button danger"
            type="button"
            disabled={deleting}
            onClick={() => {
              if (window.confirm(`Remove the goal for ${envelopeName}?`)) void onDelete();
            }}
          >
            Remove goal
          </button>
        )}
      </div>
    </form>
  );
}
