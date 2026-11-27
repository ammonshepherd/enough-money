/**
 * Links in Supabase Auth's emails (v0.50.0). The Invite user and Reset
 * password emails link to the app as `?token_hash=…&type=invite|recovery`
 * (their templates are set in the Supabase dashboard; see docs/SPEC.md).
 * The app removes the token from the address bar and, only once the
 * person taps the page's button (v0.54.3; mail scanners open links in a
 * real browser and used it up first), exchanges it for a session and asks
 * for a new password before anything else.
 *
 * The Change email address email (v0.51.0) links the same way with
 * `type=email_change`. It sets no password: Supabase sends one link to the
 * old address and one to the new, and the email changes once both are
 * opened (`verifyEmailLink` returns null after the first).
 *
 * Whether someone still has to set that password is kept in localStorage,
 * one key per user, so a reload does not skip the step.
 */
import type { KeyValueStorage } from "./collapsedGroups";
import { UserFacingError } from "./dataStore";

export type EmailLinkType = "invite" | "recovery" | "email_change";

/** The links after which a password has to be chosen. */
export type PasswordLinkType = Exclude<EmailLinkType, "email_change">;

export interface EmailLink {
  tokenHash: string;
  type: EmailLinkType;
}

const TYPES: readonly string[] = ["invite", "recovery", "email_change"] satisfies EmailLinkType[];
const PASSWORD_TYPES: readonly string[] = ["invite", "recovery"] satisfies PasswordLinkType[];

/** Whether following this link means choosing a password next. */
export const needsPassword = (type: EmailLinkType): type is PasswordLinkType =>
  PASSWORD_TYPES.includes(type);

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

/** What the page asks before a link's token is used (EmailLinkPage). */
export function emailLinkPrompt(type: EmailLinkType): {
  eyebrow: string;
  title: string;
  text: string;
  button: string;
} {
  switch (type) {
    case "invite":
      return {
        eyebrow: "Welcome",
        title: "You're invited",
        text: "Accept your invite to choose a password and start budgeting.",
        button: "Accept invite",
      };
    case "recovery":
      return {
        eyebrow: "Forgot password",
        title: "Reset your password",
        text: "Continue to choose a new password.",
        button: "Continue",
      };
    case "email_change":
      return {
        eyebrow: "Change email",
        title: "Confirm your email",
        text: "Confirm to go on changing your email address.",
        button: "Confirm",
      };
  }
}

/** Shown when a link cannot be used (Supabase says only that it is invalid or expired). */
export const EXPIRED_LINK =
  "This link has expired or was already used. Ask for a new invite, or use Forgot password below.";

/** After the first of a Change email address email's two links. */
export const EMAIL_CHANGE_HALF_DONE =
  "Link accepted. To finish changing your email, also open the link sent to your other address.";

/** After the second: the email is changed. */
export const emailChanged = (email: string) =>
  `Your email is now ${email}. Use it the next time you sign in.`;

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
): PasswordLinkType | null {
  try {
    const value = storage?.getItem(passwordNeededKey(userId));
    return value && PASSWORD_TYPES.includes(value) ? (value as PasswordLinkType) : null;
  } catch {
    return null;
  }
}

/** Remembers (a type) or forgets (null) that this user has to set a password. */
export function savePasswordNeeded(
  storage: (KeyValueStorage & Pick<Storage, "removeItem">) | null,
  userId: string,
  type: PasswordLinkType | null,
): void {
  try {
    if (type) storage?.setItem(passwordNeededKey(userId), type);
    else storage?.removeItem(passwordNeededKey(userId));
  } catch {
    // Storage may be full or blocked; the step is then skipped after a reload.
  }
}
