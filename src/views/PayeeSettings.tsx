import { useState, type FormEvent } from "react";
import { useAsyncAction } from "../controllers/useAsyncAction";
import type { Budget } from "../controllers/useBudget";
import { usePayees, type PayeeRow, type RenamePlan } from "../controllers/usePayees";
import { MAX_PAYEE_NAME } from "../models/payees";
import type { BudgetData } from "../models/types";
import { ErrorMessage } from "./components";

/** How many payees the list shows before "Show more". */
const PAGE = 50;

const transactions = (n: number) => `${n} ${n === 1 ? "transaction" : "transactions"}`;

/** Manage → Payees: the household’s saved payees (the form's suggestions). */
export function PayeeSettings({ budget, data }: { budget: Budget; data: BudgetData }) {
  const page = usePayees(budget, data);
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(PAGE);
  const [editingId, setEditingId] = useState<string | null>(null);
  const remove = useAsyncAction(page.deletePayee);
  const matches = page.filter(query);
  const visible = matches.slice(0, shown);

  return (
    <section className="list-card" aria-labelledby="payees-title">
      <div className="section-heading">
        <h2 id="payees-title">Payees</h2>
        <span className="section-count">{page.payees.length}</span>
      </div>
      <p className="empty-state">
        Payees typed in a transaction are saved here and suggested the next time you type one.
        Renaming a payee renames it on its transactions too; renaming it to another payee’s name
        merges the two. Deleting one only stops suggesting it.
      </p>

      {page.payees.length > 0 && (
        <label className="field">
          Find a payee
          <input
            type="search"
            value={query}
            placeholder="Type part of a name"
            onChange={(e) => {
              setQuery(e.target.value);
              setShown(PAGE);
            }}
          />
        </label>
      )}
      {page.payees.length > 0 && matches.length === 0 && (
        <p className="empty-state">No payee matches “{query.trim()}”.</p>
      )}

      {visible.length > 0 && (
        <ul className="item-list" aria-label="Payees">
          {visible.map((payee) =>
            payee.id === editingId ? (
              <li className="item payee-edit" key={payee.id}>
                <PayeeEditor
                  payee={payee}
                  plan={(name) => page.planRename(payee.id, name)}
                  onSave={(name) => page.renamePayee(payee.id, name)}
                  onDone={() => setEditingId(null)}
                />
              </li>
            ) : (
              <li className="item" key={payee.id}>
                <span className="item-title">{payee.name}</span>
                <span className="tag-actions">
                  <button
                    className="text-button"
                    type="button"
                    aria-label={`Rename payee ${payee.name}`}
                    onClick={() => setEditingId(payee.id)}
                  >
                    Rename
                  </button>
                  <button
                    className="text-button danger"
                    type="button"
                    aria-label={`Delete payee ${payee.name}`}
                    disabled={remove.pending}
                    onClick={() => {
                      const keep =
                        payee.uses > 0 ? ` Its ${transactions(payee.uses)} keep the name.` : "";
                      if (window.confirm(`Stop suggesting “${payee.name}”?${keep}`)) {
                        void remove.run(payee.id);
                      }
                    }}
                  >
                    Delete
                  </button>
                </span>
                <span className="item-detail">
                  {payee.uses === 0 ? "No transactions" : transactions(payee.uses)}
                </span>
              </li>
            ),
          )}
        </ul>
      )}
      {matches.length > shown && (
        <button className="secondary-button" type="button" onClick={() => setShown(shown + PAGE)}>
          Show {Math.min(PAGE, matches.length - shown)} more ({matches.length - shown} left)
        </button>
      )}
      <ErrorMessage error={remove.error} />
    </section>
  );
}

/** Renaming a payee, in place of its row. */
function PayeeEditor({
  payee,
  plan,
  onSave,
  onDone,
}: {
  payee: PayeeRow;
  plan: (name: string) => RenamePlan;
  onSave: (name: string) => Promise<void>;
  onDone: () => void;
}) {
  const [name, setName] = useState(payee.name);
  const save = useAsyncAction(async (typed: string) => {
    const { name: clean, mergeInto } = plan(typed);
    // Nothing to change; a merge not confirmed keeps the editor open.
    if (clean === payee.name) return true;
    if (mergeInto) {
      const all = payee.uses + mergeInto.uses;
      const question = `“${mergeInto.name}” is already a payee. Merge “${payee.name}” into it?${
        all > 0 ? ` ${transactions(all)} will be named “${clean}”.` : ""
      }`;
      if (!window.confirm(question)) return false;
    }
    await onSave(clean);
    return true;
  });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const result = await save.run(name);
    if (result.ok && result.value) onDone();
  };

  return (
    <form className="form" onSubmit={submit} aria-label={`Rename payee ${payee.name}`}>
      <label className="field">
        Name
        <input
          value={name}
          maxLength={MAX_PAYEE_NAME}
          autoFocus
          onChange={(e) => {
            setName(e.target.value);
            save.clearError();
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              onDone();
            }
          }}
        />
      </label>
      {payee.uses > 0 && (
        <p className="empty-state">Also renames it on its {transactions(payee.uses)}.</p>
      )}
      <div className="form-actions">
        <button className="primary-button" type="submit" disabled={save.pending}>
          Save
        </button>
        <button className="secondary-button" type="button" onClick={onDone}>
          Cancel
        </button>
      </div>
      <ErrorMessage error={save.error} />
    </form>
  );
}
