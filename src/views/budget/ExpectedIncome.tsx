import { useState, type FormEvent } from "react";
import { useAsyncAction } from "../../controllers/useAsyncAction";
import type { BudgetPageState as Page } from "../../controllers/useBudgetPage";
import { centsToInput, type Cents } from "../../models/money";
import { AmountInput } from "../AmountInput";
import { ErrorMessage, Money } from "../components";

/**
 * Sets the month's Expected income: typed, or one tap on a suggested amount
 * (last month's Expected income, last month's income, the three-month
 * average). Used in the plan card ("No plan yet") and in the sheet the plan
 * strip opens, where it can also be cleared.
 */
export function ExpectedIncome({
  page,
  onDone,
  inSheet = false,
}: {
  page: Page;
  onDone?: () => void;
  /** In the sheet: income so far, and Clear when one is set. */
  inSheet?: boolean;
}) {
  const { plan, incomeSuggestions: suggested, view } = page;
  const [text, setText] = useState(() =>
    plan.expected === null ? "" : centsToInput(plan.expected),
  );
  const save = useAsyncAction(page.setExpectedIncome);
  const pick = useAsyncAction(page.pickExpectedIncome);
  const error = save.error ?? pick.error;
  const pending = save.pending || pick.pending;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if ((await save.run(text)).ok) onDone?.();
  };
  const choose = async (amount: Cents) => {
    setText(centsToInput(amount));
    if ((await pick.run(amount)).ok) onDone?.();
  };

  // Each suggestion once, in order; an amount two of them share shows once.
  const options: { label: string; amount: Cents }[] = [];
  const offer = (label: string, amount: Cents | null) => {
    if (amount !== null && !options.some((o) => o.amount === amount)) {
      options.push({ label, amount });
    }
  };
  offer(`${page.previousLabel}’s Expected income`, suggested.lastExpected);
  offer(`${page.previousLabel}’s income`, suggested.lastActual);
  offer("3-month average income", suggested.average);

  return (
    <form className="form expected-income" onSubmit={submit} aria-label="Expected income">
      {inSheet && (
        <p className="expected-income-note">
          Income so far: <Money cents={view.income} />
          {plan.expected !== null && (
            <>
              {" "}
              of <Money cents={plan.expected} /> expected
            </>
          )}
          . Planned amounts can add up to no more than the Expected income.
        </p>
      )}
      {options.length > 0 && (
        <div className="expected-income-options" role="group" aria-label="Suggested amounts">
          {options.map((option) => (
            <button
              key={option.label}
              className="secondary-button"
              type="button"
              disabled={pending}
              onClick={() => void choose(option.amount)}
            >
              <span>{option.label}</span> <Money cents={option.amount} />
            </button>
          ))}
        </div>
      )}
      <div className="form-row">
        <label className="field">
          Expected income for {page.monthLabel}
          <AmountInput
            value={text}
            placeholder="0.00"
            onChange={(value) => {
              setText(value);
              save.clearError();
              pick.clearError();
            }}
          />
        </label>
        <button className="primary-button" type="submit" disabled={pending}>
          Save
        </button>
      </div>
      <ErrorMessage error={error} />
      {inSheet && plan.expected !== null && (
        <button
          className="text-button"
          type="button"
          disabled={pending}
          onClick={async () => {
            if ((await save.run("")).ok) onDone?.();
          }}
        >
          Clear Expected income (no limit on Planned)
        </button>
      )}
    </form>
  );
}

/**
 * The plan strip, styled like the Available to Assign banner in the Planned
 * colours: Planned so far against the Expected income and what is left to
 * plan, orange when over. Tapping it opens the Expected income sheet.
 */
export function PlanStrip({ page, onOpen }: { page: Page; onOpen: () => void }) {
  const { plan } = page;
  const over = plan.over > 0;
  return (
    <section className={over ? "plan-strip over" : "plan-strip"} aria-label="Plan">
      <button type="button" aria-haspopup="dialog" onClick={onOpen}>
        <span className="plan-strip-total">
          <span className="plan-strip-label">Planned</span> <Money cents={plan.planned} />
          {plan.expected !== null && (
            <>
              {" "}
              of <Money cents={plan.expected} />
            </>
          )}
        </span>
        <span className="plan-strip-left">
          {plan.left === null ? (
            "Set Expected income"
          ) : over ? (
            <>
              Over planned <Money cents={plan.over} />
            </>
          ) : (
            <>
              <Money cents={plan.left} /> left to plan
            </>
          )}
        </span>
      </button>
    </section>
  );
}
