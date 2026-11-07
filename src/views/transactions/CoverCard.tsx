import { useState } from "react";
import { useAsyncAction } from "../../controllers/useAsyncAction";
import {
  type CoverChoice,
  type CoverPlan,
  type TransactionEntryState as Entry,
} from "../../controllers/useTransactionEntry";
import { formatCents } from "../../models/money";
import { formatMonth } from "../../models/month";
import { ErrorMessage, Money } from "../components";
import { EnvelopePicker } from "../EnvelopePicker";

/** The CoverChoices "Cover from" options stand for, besides envelopes. */
const AVAILABLE = "available";
const SAVED = "saved";
/** The option that releases less in later months (plan.releaseCuts). */
const RELEASE_LESS = "release-less";

/** Month names joined for a sentence: "November", "November and December". */
const monthList = (months: string[]) =>
  months.length < 2 ? months.join("") : `${months.slice(0, -1).join(", ")} and ${months.at(-1)}`;

/**
 * The cover prompt: the transaction would leave its envelope short. When
 * Available to Assign has enough, it is the first choice and Saved is left
 * alone; otherwise release Saved, then move from another envelope or
 * Available to Assign.
 */
export function CoverCard({
  entry,
  plan,
  onNext,
  onDone,
  onBack,
}: {
  entry: Entry;
  plan: CoverPlan;
  /** A split with another short envelope: show its prompt. */
  onNext: (plan: CoverPlan) => void;
  onDone: () => void;
  onBack: () => void;
}) {
  const cuts = plan.releaseCuts;
  const cutMonths = monthList((cuts ?? []).map((cut) => formatMonth(cut.month)));
  const availableFirst = plan.availableCoversAll || plan.canUseAvailable;
  const [choice, setChoice] = useState<CoverChoice>(() =>
    availableFirst
      ? AVAILABLE
      : plan.stillShort === 0
        ? null
        : cuts
          ? { releaseCuts: cuts }
          : plan.sources[0]
            ? { fromEnvelopeId: plan.sources[0].id }
            : null,
  );
  const cover = useAsyncAction(entry.coverAndSave);
  const noWayToCover =
    plan.stillShort > 0 && !cuts && plan.sources.length === 0 && !plan.canUseAvailable;
  // Available to Assign covering it all, or Saved alone: one choice covers the whole shortfall.
  const coversAll = (choice === AVAILABLE && plan.availableCoversAll) || choice === SAVED;
  const releasesSaved = plan.fromSaved > 0 && !coversAll;
  const showPicker = (plan.stillShort > 0 && !noWayToCover) || plan.availableCoversAll;
  const pickerValue =
    choice === AVAILABLE || choice === SAVED
      ? choice
      : choice && "releaseCuts" in choice
        ? RELEASE_LESS
        : (choice?.fromEnvelopeId ?? "");
  const availableOption = {
    value: AVAILABLE,
    label: "Available to Assign",
    detail: `${formatCents(plan.available)} free`,
    disabled: !availableFirst,
  };
  const options = [
    ...(availableFirst ? [availableOption] : []),
    // Saved alone covers it: offered as the other choice to Available to Assign.
    ...(plan.stillShort === 0 && plan.fromSaved > 0
      ? [
          {
            value: SAVED,
            label: "Release from Saved",
            detail: formatCents(plan.fromSaved),
          },
        ]
      : []),
    ...(cuts
      ? [
          {
            value: RELEASE_LESS,
            // No detail: a long label would run under it (the line above explains).
            label: `Release less in ${cutMonths}`,
          },
        ]
      : []),
    ...plan.sources.map((source) => ({
      value: source.id,
      label: source.name,
      detail: `has ${formatCents(source.remaining)}`,
    })),
    ...(availableFirst ? [] : [availableOption]),
  ];
  const step = plan.covered.length + 1;
  const steps = step + plan.moreShort;

  return (
    <section className="cover-card" aria-labelledby="cover-title" role="alertdialog">
      {steps > 1 && (
        <p className="cover-step">
          Envelope {step} of {steps} to cover
        </p>
      )}
      <h3 id="cover-title">
        {plan.envelopeName} would be <Money cents={plan.shortfall} /> short in{" "}
        {formatMonth(plan.month)}
      </h3>
      {plan.heldBy && (
        <p className="empty-state">
          {formatMonth(plan.heldBy)} has already released, from Saved, the money {plan.envelopeName}{" "}
          leaves over in {formatMonth(plan.month)}.
          {cuts && ` It hasn’t spent it, so ${cutMonths} can release less instead.`}
        </p>
      )}
      <p className="empty-state">Envelopes can’t go negative. Cover the difference:</p>
      <ol>
        {releasesSaved && (
          <li>
            Release <Money cents={plan.fromSaved} /> from {plan.envelopeName}’s Saved.
          </li>
        )}
        {showPicker && (
          <li>
            <EnvelopePicker
              label={`${releasesSaved ? "Then cover" : "Cover"} ${formatCents(
                coversAll ? plan.shortfall : plan.stillShort,
              )} from`}
              value={pickerValue}
              options={options}
              onChange={(value) =>
                setChoice(
                  value === AVAILABLE || value === SAVED
                    ? value
                    : value === RELEASE_LESS && cuts
                      ? { releaseCuts: cuts }
                      : { fromEnvelopeId: value },
                )
              }
            />
          </li>
        )}
      </ol>
      {noWayToCover &&
        (plan.isCardPayment ? (
          // Saving a payment as Uncategorized would hide the cash it spent.
          <p className="error-message">
            There isn’t enough money to cover this payment yet. Assign more to {plan.envelopeName}{" "}
            or add income first, then record the payment.
          </p>
        ) : (
          <p className="error-message">
            There isn’t enough money to cover this. Go back and save it as Uncategorized, or add
            income first.
          </p>
        ))}
      <div className="button-row">
        <button
          className="primary-button"
          type="button"
          disabled={cover.pending || noWayToCover}
          onClick={async () => {
            const result = await cover.run(plan, choice);
            if (!result.ok) return;
            if (result.value.kind === "cover") onNext(result.value.plan);
            else onDone();
          }}
        >
          {plan.moreShort > 0 ? "Cover and continue" : "Cover and save"}
        </button>
        <button className="secondary-button" type="button" onClick={onBack}>
          Back
        </button>
      </div>
      <ErrorMessage error={cover.error} />
    </section>
  );
}
