import { useAsyncAction } from "../../controllers/useAsyncAction";
import type { BudgetPageState as Page } from "../../controllers/useBudgetPage";
import { ErrorMessage } from "../components";
import { ExpectedIncome } from "./ExpectedIncome";

/**
 * Shown when the month opens with no plan (every Planned at $0.00): first
 * the month's Expected income, then start Planned from last month's Planned
 * or Spent, or from a plan CSV. Copy buttons appear only when last month has
 * something to copy. Nothing here must be filled in: the card can be ignored.
 */
export function PlanStart({ page, onUpload }: { page: Page; onUpload: () => void }) {
  const copy = useAsyncAction(page.copyPlan);
  const start = page.planStart!;
  return (
    <section className="plan-start" aria-labelledby="plan-start-title">
      <h2 id="plan-start-title">No plan for {page.monthLabel} yet</h2>
      <p>1. Set the income you expect this month. Planned amounts can add up to no more than it.</p>
      <ExpectedIncome page={page} />
      <p>2. Fill in Planned for every envelope at once, then adjust it here.</p>
      <div className="plan-start-actions">
        {start.planned.length > 0 && (
          <button
            className="secondary-button"
            type="button"
            disabled={copy.pending}
            onClick={() => void copy.run("planned")}
          >
            Copy {start.previousLabel}’s Planned
          </button>
        )}
        {start.spent.length > 0 && (
          <button
            className="secondary-button"
            type="button"
            disabled={copy.pending}
            onClick={() => void copy.run("spent")}
          >
            Copy {start.previousLabel}’s Spent
          </button>
        )}
        <button className="secondary-button" type="button" onClick={onUpload}>
          Upload a plan CSV
        </button>
      </div>
      <ErrorMessage error={copy.error} />
    </section>
  );
}
