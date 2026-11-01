import {
  checkTagNameFree,
  cleanTagDetails,
  nextTagColor,
  sortTags,
  tagUseCounts,
  type TagDetails,
} from "../models/tags";
import type { BudgetData } from "../models/types";
import type { DataStore } from "../models/dataStore";
import type { Budget } from "./useBudget";

/**
 * Adds a tag by name (in the next free colour) inside a store change, then
 * `andThen` with its id; checks the name first, so a clash shows at once.
 */
export async function addNamedTag(
  budget: Budget,
  data: BudgetData,
  name: string,
  andThen?: (store: DataStore, tagId: string) => Promise<unknown>,
): Promise<string> {
  const clean = cleanTagDetails({ name, color: nextTagColor(data.tags) });
  checkTagNameFree(data.tags, clean.name);
  let tagId = "";
  await budget.change(async (store) => {
    tagId = await store.addTag(data.household.id, clean);
    await andThen?.(store, tagId);
  });
  return tagId;
}

/** Settings → Tags: list, add, rename, recolour and delete the household's tags. */
export function useTags(budget: Budget, data: BudgetData) {
  const counts = tagUseCounts(data.transactions);
  return {
    tags: sortTags(data.tags).map((tag) => ({ ...tag, uses: counts.get(tag.id) ?? 0 })),
    /** The colour a new tag starts with. */
    nextColor: nextTagColor(data.tags),

    addTag: async (tag: TagDetails) => {
      const clean = cleanTagDetails(tag);
      checkTagNameFree(data.tags, clean.name);
      await budget.change(async (store) => {
        await store.addTag(data.household.id, clean);
      });
    },

    updateTag: async (tagId: string, tag: TagDetails) => {
      const clean = cleanTagDetails(tag);
      checkTagNameFree(data.tags, clean.name, tagId);
      await budget.change(
        (store) => store.updateTag(tagId, clean),
        (d) => ({ ...d, tags: d.tags.map((t) => (t.id === tagId ? { ...t, ...clean } : t)) }),
      );
    },

    /** Takes the tag off every transaction too. */
    deleteTag: async (tagId: string) => {
      await budget.change((store) => store.deleteTag(tagId));
    },
  };
}
