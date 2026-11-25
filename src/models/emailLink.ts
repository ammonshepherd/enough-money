/**
 * Links in Supabase Auth's emails (v0.50.0). The Invite user and Reset
 * password emails link to the app as `?token_hash=…&type=invite|recovery`
 * (their templates are set in the Supabase dashboard; see docs/SPEC.md).
 * The app exchanges the token for a session, removes it from the address
 * bar, and asks for a new password before anything else.
 *
 * Whether someone still has to set that password is kept in localStorage,
 * one key per user, so a reload does not skip the step.
 */
import type { KeyValueStorage } from "./collapsedGroups";
import { UserFacingError } from "./dataStore";

export type EmailLinkType = "invite" | "recovery";

export interface EmailLink {
  tokenHash: string;
  type: EmailLinkType;
}

const TYPES: readonly string[] = ["invite", "recovery"] satisfies EmailLinkType[];

/** The link in a URL's query string (`location.search`), or null when there is none. */
export function readEmailLink(search: string): EmailLink | null {
  const params = new URLSearchParams(search);
  const tokenHash = params.get("token_hash")?.trim();
  const type = params.get("type");
  if (!tokenHash || !type || !TYPES.includes(type)) return null;
  return { tokenHash, type: type as EmailLinkType };
}

/** The URL without the link's parameters, keeping any others and the #route. */
export function withoutEmailLink(url: string): string {
  const next = new URL(url);
  next.searchParams.delete("token_hash");
  next.searchParams.delete("type");
  return next.href;
}

/** Shown when a link cannot be used (Supabase says only that it is invalid or expired). */
export const EXPIRED_LINK =
  "This link has expired or was already used. Ask for a new invite, or use Forgot password below.";

/** The shortest password allowed (Supabase Auth's minimum is set to the same). */
export const MIN_PASSWORD_LENGTH = 12;

/** Checks a new password and its confirmation; throws a readable error, else returns it. */
export function checkNewPassword(password: string, confirm: string): string {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new UserFacingError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
  if (password !== confirm) throw new UserFacingError("The two passwords do not match.");
  return password;
}

export const passwordNeededKey = (userId: string) => `bb.auth.passwordNeeded.${userId}`;

/** Which link this user followed and still has to set a password for, or null. */
export function loadPasswordNeeded(
  storage: KeyValueStorage | null,
  userId: string,
): EmailLinkType | null {
  try {
    const value = storage?.getItem(passwordNeededKey(userId));
    return value && TYPES.includes(value) ? (value as EmailLinkType) : null;
  } catch {
    return null;
  }
}

/** Remembers (a type) or forgets (null) that this user has to set a password. */
export function savePasswordNeeded(
  storage: (KeyValueStorage & Pick<Storage, "removeItem">) | null,
  userId: string,
  type: EmailLinkType | null,
): void {
  try {
    if (type) storage?.setItem(passwordNeededKey(userId), type);
    else storage?.removeItem(passwordNeededKey(userId));
  } catch {
    // Storage may be full or blocked; the step is then skipped after a reload.
  }
}
