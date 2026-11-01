/**
 * Transaction tags: the household's own labels (a name and a colour). Any
 * transaction can carry several; each side of a transfer keeps its own.
 * Tags are only for showing and searching: they change no budget math.
 */
import { UserFacingError } from "./dataStore";
import type { Transaction } from "./types";

/** The colours a tag can have. The database checks the same list. */
export const TAG_COLORS = [
  "grey",
  "red",
  "orange",
  "yellow",
  "green",
  "teal",
  "blue",
  "purple",
  "pink",
] as const;
export type TagColor = (typeof TAG_COLORS)[number];

export interface Tag {
  id: string;
  name: string;
  color: TagColor;
}

export interface TagDetails {
  name: string;
  color: TagColor;
}

export const MAX_TAG_NAME = 30;
export const MAX_TAGS_PER_TRANSACTION = 20;

export const asTagColor = (value: string): TagColor =>
  (TAG_COLORS as readonly string[]).includes(value) ? (value as TagColor) : "grey";

/** Names are compared ignoring case and extra spaces. */
export const tagKey = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();

/** The name as it will be saved; throws a message to show when it cannot be. */
export function cleanTagName(name: string): string {
  const clean = name.trim().replace(/\s+/g, " ");
  if (!clean) throw new UserFacingError("Give the tag a name.");
  if (clean.length > MAX_TAG_NAME) {
    throw new UserFacingError(`A tag name is at most ${MAX_TAG_NAME} characters.`);
  }
  return clean;
}

/** The details as they will be saved: a clean name and a known colour. */
export function cleanTagDetails(tag: TagDetails): TagDetails {
  const name = cleanTagName(tag.name);
  if (!(TAG_COLORS as readonly string[]).includes(tag.color)) {
    throw new UserFacingError("Pick one of the tag colours.");
  }
  return { name, color: tag.color };
}

export const duplicateTagMessage = (name: string) => `There is already a tag called “${name}”.`;

/** Throws when another tag (not `exceptId`) already has this name. */
export function checkTagNameFree(tags: Tag[], name: string, exceptId?: string): void {
  const taken = tags.find((t) => t.id !== exceptId && tagKey(t.name) === tagKey(name));
  if (taken) throw new UserFacingError(duplicateTagMessage(taken.name));
}

/** Alphabetical, ignoring case. */
export const sortTags = (tags: Tag[]): Tag[] =>
  [...tags].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

/** A transaction's tags, alphabetical. Ids of deleted tags are skipped. */
export function tagsOf(tx: Pick<Transaction, "tagIds">, tags: Tag[]): Tag[] {
  return sortTags(tags.filter((t) => tx.tagIds.includes(t.id)));
}

/** Tags whose name contains the typed text, minus those already chosen. */
export function matchTags(tags: Tag[], query: string, chosen: string[] = []): Tag[] {
  const q = tagKey(query);
  return sortTags(tags.filter((t) => !chosen.includes(t.id) && tagKey(t.name).includes(q)));
}

/** The tag with exactly this name (ignoring case), if any. */
export const exactTag = (tags: Tag[], query: string): Tag | undefined =>
  tags.find((t) => tagKey(t.name) === tagKey(query));

/** A colour for a new tag: the first not in use yet (grey last), else in turn. */
export function nextTagColor(tags: Tag[]): TagColor {
  const order = [...TAG_COLORS.slice(1), "grey" as const];
  const used = new Set(tags.map((t) => t.color));
  return order.find((c) => !used.has(c)) ?? order[tags.length % order.length]!;
}

/** How many transactions carry each tag (for Settings). */
export function tagUseCounts(transactions: Transaction[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const tx of transactions) {
    for (const id of tx.tagIds) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

/** Adds or removes one tag on a list of ids, as the form's picker does. */
export function toggleTag(tagIds: string[], tagId: string): string[] {
  return tagIds.includes(tagId) ? tagIds.filter((id) => id !== tagId) : [...tagIds, tagId];
}
