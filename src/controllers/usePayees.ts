import { useMemo } from "react";
import {
  cleanPayeeName,
  findPayee,
  payeeKey,
  payeeUseCounts,
  sortPayees,
  type Payee,
} from "../models/payees";
import type { BudgetData } from "../models/types";
import type { Budget } from "./useBudget";

/** A saved payee with how many transactions carry its name. */
export interface PayeeRow extends Payee {
  uses: number;
}

/** What renaming a payee would do, so the page can ask first when it merges. */
export interface RenamePlan {
  name: string;
  /** The other payee that already has the name (ignoring case): the two merge. */
  mergeInto: PayeeRow | null;
}

/** Settings → Payees: the household's saved payees, renamed, merged and deleted. */
export function usePayees(budget: Budget, data: BudgetData) {
  const rows = useMemo(() => {
    const counts = payeeUseCounts(data.transactions);
    return sortPayees(data.payees).map((p): PayeeRow => ({
      ...p,
      uses: counts.get(payeeKey(p.name)) ?? 0,
    }));
  }, [data]);

  return {
    payees: rows,

    /** Payees whose name contains the typed text (ignoring case); all when blank. */
    filter: (typed: string): PayeeRow[] => {
      const query = payeeKey(typed);
      return query ? rows.filter((p) => payeeKey(p.name).includes(query)) : rows;
    },

    /** Checks the new name; throws a message to show when it cannot be used. */
    planRename: (payeeId: string, name: string): RenamePlan => {
      const clean = cleanPayeeName(name);
      const other = findPayee(rows, clean, payeeId) as PayeeRow | undefined;
      return { name: clean, mergeInto: other ?? null };
    },

    /** Renames it on its transactions too; a name in use merges the two payees. */
    renamePayee: async (payeeId: string, name: string) => {
      const clean = cleanPayeeName(name);
      await budget.change(
        (store) => store.renamePayee(payeeId, clean),
        (d) =>
          findPayee(d.payees, clean, payeeId)
            ? d
            : { ...d, payees: d.payees.map((p) => (p.id === payeeId ? { ...p, name: clean } : p)) },
      );
    },

    /** Takes it off the list only: its transactions keep their payee. */
    deletePayee: async (payeeId: string) => {
      await budget.change(
        (store) => store.deletePayee(payeeId),
        (d) => ({ ...d, payees: d.payees.filter((p) => p.id !== payeeId) }),
      );
    },
  };
}
