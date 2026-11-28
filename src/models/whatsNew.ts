/**
 * The "what's new" lines on the new version banner. `public/whats-new.json`
 * maps each version to one short sentence. The banner runs in the old
 * version, which cannot know what the new one says about itself, so it
 * fetches that file from the server when a new version is waiting (the
 * service worker does not keep .json files, so the fetch always reaches
 * the new deploy).
 */

/** Where the built app serves the notes (next to index.html). */
export const WHATS_NEW_FILE = "whats-new.json";

/** At most this many versions are listed, newest first. */
export const MAX_NOTES = 3;

/** The longest a note may be, so the banner stays small on a phone. */
export const MAX_NOTE_LENGTH = 140;

const VERSION = /^\d+\.\d+\.\d+$/;

export function isVersion(text: string): boolean {
  return VERSION.test(text);
}

/** Negative when `a` is older than `b`, positive when newer, 0 when equal. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export interface WhatsNewNote {
  version: string;
  text: string;
}

/**
 * The notes for versions newer than `current`, newest first, at most
 * `MAX_NOTES`. Anything malformed in the file is skipped, never shown, so a
 * bad file only leaves the banner as it was without notes.
 */
export function newerNotes(file: unknown, current: string): WhatsNewNote[] {
  if (typeof file !== "object" || file === null || Array.isArray(file)) return [];
  if (!isVersion(current)) return [];
  return Object.entries(file as Record<string, unknown>)
    .filter(
      (entry): entry is [string, string] =>
        isVersion(entry[0]) && typeof entry[1] === "string" && entry[1].trim() !== "",
    )
    .filter(([version]) => compareVersions(version, current) > 0)
    .sort(([a], [b]) => compareVersions(b, a))
    .slice(0, MAX_NOTES)
    .map(([version, text]) => ({ version, text: text.trim() }));
}
