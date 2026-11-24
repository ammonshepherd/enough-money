import type { BudgetData } from "../models/types";
import { requireName } from "./input";
import type { Budget } from "./useBudget";

/** Manage → the household's name, renamed with its pencil. */
export function useHousehold(budget: Budget, data: BudgetData) {
  return {
    name: data.household.name,

    rename: async (name: string) => {
      const householdName = requireName(name, "Household name");
      await budget.change(
        (store) => store.renameHousehold(data.household.id, householdName),
        (d) => ({ ...d, household: { ...d.household, name: householdName } }),
      );
    },
  };
}
