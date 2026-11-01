import { useState, type FormEvent } from "react";
import { useAsyncAction } from "../../controllers/useAsyncAction";
import type { useAccountView } from "../../controllers/useAccountView";
import { formatSignedCents } from "../../models/money";
import type { Transaction } from "../../models/types";
import { ErrorMessage, Money } from "../components";
import { TagChip } from "../Tags";

type View = ReturnType<typeof useAccountView>;

/**
 * Ticked rows: how many, their total, Mark reconciled / unreconciled, and
 * Tags (adds a tag to every ticked row or takes it off them). The count is
 * always in the page (visually hidden), so screen readers hear it change.
 */
export function SelectionBar({ view }: { view: View }) {
  const reconcile = useAsyncAction(view.setReconciled);
  const [tagsOpen, setTagsOpen] = useState(false);
  const text =
    view.selectedCount > 0
      ? `${view.selectedCount} selected, ${formatSignedCents(view.selectedTotal)}`
      : "";
  return (
    <>
      <p className="visually-hidden" aria-live="polite">
        {text}
      </p>
      {view.selectedCount > 0 && (
        <div className="selection-bar" role="toolbar" aria-label="Selected transactions">
          <p className="selection-summary">
            <span>{view.selectedCount} selected</span>
            <strong>{formatSignedCents(view.selectedTotal)}</strong>
          </p>
          {view.canReconcile && (
            <button
              className="selection-action"
              type="button"
              disabled={reconcile.pending}
              onClick={() => void reconcile.run(true)}
            >
              Mark reconciled
            </button>
          )}
          {view.canUnreconcile && (
            <button
              className="selection-action quiet"
              type="button"
              disabled={reconcile.pending}
              onClick={() => void reconcile.run(false)}
            >
              Mark unreconciled
            </button>
          )}
          <button
            className="selection-action quiet"
            type="button"
            aria-expanded={tagsOpen}
            aria-controls="selection-tags"
            onClick={() => setTagsOpen(!tagsOpen)}
          >
            Tags
          </button>
          <button
            className="selection-clear"
            type="button"
            aria-label="Clear selection"
            onClick={() => {
              reconcile.clearError();
              setTagsOpen(false);
              view.clearSelection();
            }}
          >
            ×
          </button>
          <ErrorMessage error={reconcile.error} />
          {tagsOpen && <SelectionTags view={view} />}
        </div>
      )}
    </>
  );
}

/**
 * The tags of the ticked rows: each one ticked when every row has it (–
 * when some do). Tapping one adds it to every row, or takes it off when
 * all have it. A new tag can be added and put on them at once.
 */
function SelectionTags({ view }: { view: View }) {
  const toggle = useAsyncAction(view.tagSelected);
  const create = useAsyncAction(view.tagSelectedWithNew);
  const [name, setName] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if ((await create.run(name)).ok) setName("");
  };
  return (
    <div className="selection-tags" id="selection-tags">
      {view.selectionTags.length > 0 && (
        <ul aria-label="Tags of the selected transactions">
          {view.selectionTags.map(({ tag, state }) => (
            <li key={tag.id}>
              <button
                type="button"
                className={`selection-tag ${state}`}
                aria-pressed={state === "all" ? true : state === "some" ? "mixed" : false}
                aria-label={`${tag.name}: ${state === "all" ? "on every selected" : state === "some" ? "on some selected" : "on none"}`}
                disabled={toggle.pending}
                onClick={() => void toggle.run(tag.id, state !== "all")}
              >
                <span className="selection-tag-mark" aria-hidden="true">
                  {state === "all" ? "✓" : state === "some" ? "–" : "+"}
                </span>
                <TagChip tag={tag} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form className="selection-tag-new" onSubmit={submit} aria-label="Add a new tag to selected">
        <label className="visually-hidden" htmlFor="selection-tag-name">
          New tag
        </label>
        <input
          id="selection-tag-name"
          value={name}
          placeholder="New tag"
          onChange={(e) => {
            setName(e.target.value);
            create.clearError();
          }}
        />
        <button className="selection-action" type="submit" disabled={create.pending}>
          Add
        </button>
      </form>
      <ErrorMessage error={toggle.error} />
      <ErrorMessage error={create.error} />
    </div>
  );
}

/**
 * Transactions still to review (from any month; in the open account only),
 * with Mark as Income, Apply income rules and Mark all as Income. Null when
 * there is nothing to review.
 */
export function ReviewCard({ view, onEdit }: { view: View; onEdit: (tx: Transaction) => void }) {
  const mark = useAsyncAction(view.markIncome);
  const incomeable = view.toReview.filter((r) => r.canBeIncome);
  if (view.toReview.length === 0) return null;

  return (
    <section className="list-card activity-review" aria-labelledby="review-title">
      <div className="section-heading">
        <h2 id="review-title">To review</h2>
        <span className="section-count">{view.toReview.length}</span>
      </div>
      <p className="empty-state">
        <Money cents={view.toReviewIn} /> in and <Money cents={view.toReviewOut} /> out are not in
        Available to Assign yet. Tap one to give it an envelope or make it a Transfer; mark
        paychecks as Income. <a href="#settings">Income rules</a> can mark paychecks for you.
      </p>
      <ul className="item-list" aria-label="To review">
        {view.toReview.map(({ tx, accountName, canBeIncome }) => (
          <li className="review-item" key={tx.id}>
            <button className="review-row item-button" type="button" onClick={() => onEdit(tx)}>
              <span className="item-title">{tx.payee || "(no payee)"}</span>
              <strong>
                <Money cents={tx.amount} />
              </strong>
              <span className="item-detail">
                {tx.date} · {accountName}
              </span>
            </button>
            {canBeIncome && (
              <button
                className="text-button"
                type="button"
                disabled={mark.pending}
                onClick={() => void mark.run([tx.id])}
              >
                Mark as Income
              </button>
            )}
          </li>
        ))}
      </ul>
      {view.ruleMatches.length > 0 && (
        <button
          className="secondary-button"
          type="button"
          disabled={mark.pending}
          onClick={() => void mark.run(view.ruleMatches)}
        >
          Apply income rules ({view.ruleMatches.length}{" "}
          {view.ruleMatches.length === 1 ? "match" : "matches"})
        </button>
      )}
      {incomeable.length > 1 && (
        <button
          className="secondary-button"
          type="button"
          disabled={mark.pending}
          onClick={() => {
            if (
              window.confirm(
                `Mark all ${incomeable.length} inflows as Income? They will count toward Available to Assign.`,
              )
            ) {
              void mark.run(incomeable.map(({ tx }) => tx.id));
            }
          }}
        >
          Mark all {incomeable.length} inflows as Income
        </button>
      )}
      <ErrorMessage error={mark.error} />
    </section>
  );
}
