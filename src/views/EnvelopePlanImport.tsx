import { useState } from "react";
import { useAsyncAction } from "../controllers/useAsyncAction";
import type { Budget } from "../controllers/useBudget";
import { useEnvelopePlanImport } from "../controllers/useEnvelopePlanImport";
import type { PlanPreview, PlanPreviewRow } from "../models/envelopePlan";
import type { Month } from "../models/month";
import type { BudgetData } from "../models/types";
import { ErrorMessage, Money } from "./components";

/**
 * Upload a CSV of envelopes and Planned amounts for one month: a Manage
 * card where the month is chosen, or (with `month`) the Budget page's sheet
 * for that month, which `onDone` closes after an import.
 */
export function EnvelopePlanImport({
  budget,
  data,
  month,
  onDone,
}: {
  budget: Budget;
  data: BudgetData;
  month?: Month;
  onDone?: () => void;
}) {
  const plan = useEnvelopePlanImport(budget, data, month);
  const save = useAsyncAction(plan.importPlan);
  // Changing the key empties the file input after an import or a clear.
  const [inputKey, setInputKey] = useState(0);
  const { preview } = plan;
  // The Income row is imported too.
  const count = preview ? preview.rows.length + (preview.expectedIncome === null ? 0 : 1) : 0;

  const reset = () => {
    plan.clear();
    save.clearError();
    setInputKey((k) => k + 1);
  };

  return (
    <section className="list-card" aria-labelledby="plan-import-title">
      <div className="section-heading">
        <h2 id="plan-import-title">Import envelope plan</h2>
      </div>
      <p className="empty-state">
        Upload a CSV with the columns <strong>category, group, planned amount</strong>. Missing
        groups and envelopes are created, and each envelope’s Planned is set for{" "}
        {month ? plan.monthLabel : "the month you choose"}. Envelopes not in the file keep their
        Planned. A row named <strong>Income</strong> with no group sets the month’s Expected income.
      </p>
      <pre className="csv-example" aria-label="Example CSV">
        {
          "category,group,planned amount\nIncome,,4200.00\nRent,Bills,1200.00\nGroceries,Everyday,450\n"
        }
      </pre>

      <div className="form">
        {!month && (
          <label className="field">
            Month
            <input
              type="month"
              value={plan.month}
              required
              onChange={(event) => plan.chooseMonth(event.target.value)}
            />
          </label>
        )}
        <label className="field">
          CSV file
          <input
            key={inputKey}
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => {
              save.clearError();
              void plan.chooseFile(event.target.files?.[0] ?? null);
            }}
          />
        </label>
      </div>

      <ErrorMessage error={plan.error} />

      {plan.done && (
        <p className="notice" role="status">
          Imported {plan.done.count} {plan.done.count === 1 ? "envelope" : "envelopes"}
          {plan.done.income && " and the Expected income"} for {plan.done.monthLabel}.{" "}
          <a href={plan.done.href}>Open that budget</a>
        </p>
      )}

      {preview && (
        <div className="stack">
          <p role="status">
            {preview.rows.length} {preview.rows.length === 1 ? "row" : "rows"} ready for{" "}
            {plan.monthLabel}: {preview.newGroups} new{" "}
            {preview.newGroups === 1 ? "group" : "groups"}, {preview.newEnvelopes} new{" "}
            {preview.newEnvelopes === 1 ? "envelope" : "envelopes"}.
            {preview.invalid.length > 0 &&
              ` ${preview.invalid.length} invalid ${preview.invalid.length === 1 ? "row" : "rows"} will be skipped.`}
          </p>
          <PlanTotal preview={preview} />

          {preview.invalid.length > 0 && (
            <ul className="item-list" aria-label="Invalid rows">
              {preview.invalid.map((row) => (
                <li className="item" key={row.line}>
                  <span className="item-title error-text">Line {row.line}</span>
                  <span className="item-detail">{row.message}</span>
                </li>
              ))}
            </ul>
          )}

          {preview.rows.length > 0 && (
            <ul className="item-list" aria-label="Rows to import">
              {preview.rows.map((row) => (
                <li className="item" key={row.line}>
                  <span className="item-title">{row.envelope}</span>
                  <strong>
                    <Money cents={row.planned} />
                  </strong>
                  <span className="item-detail">
                    {row.group} · <RowChange row={row} />
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="button-row">
            <button
              className="primary-button"
              type="button"
              disabled={save.pending || count === 0}
              onClick={async () => {
                if (!(await save.run()).ok) return;
                setInputKey((k) => k + 1);
                onDone?.();
              }}
            >
              Import {count} {count === 1 ? "row" : "rows"}
            </button>
            <button className="secondary-button" type="button" onClick={reset}>
              Cancel
            </button>
          </div>
          <ErrorMessage error={save.error} />
        </div>
      )}
    </section>
  );
}

/** The plan's total after the import, against the Expected income (the file's or the month's). */
function PlanTotal({ preview }: { preview: PlanPreview }) {
  const { plan, expectedIncome } = preview;
  return (
    <p className={plan.over > 0 ? "plan-total over" : "plan-total"}>
      {expectedIncome !== null && (
        <>
          Expected income <Money cents={expectedIncome} />.{" "}
        </>
      )}
      Planned after the import: <Money cents={plan.planned} />
      {plan.expected !== null && (
        <>
          {" "}
          of <Money cents={plan.expected} />
          {plan.over > 0 ? (
            <>
              , over planned by <Money cents={plan.over} />
            </>
          ) : (
            <>
              , <Money cents={plan.left ?? 0} /> left to plan
            </>
          )}
        </>
      )}
      .
    </p>
  );
}

function RowChange({ row }: { row: PlanPreviewRow }) {
  if (row.newGroup) return <>new group and envelope</>;
  if (row.newEnvelope) return <>new envelope</>;
  if (row.previousPlanned === row.planned) return <>no change</>;
  return (
    <>
      Planned was <Money cents={row.previousPlanned ?? 0} />
    </>
  );
}
