/**
 * Changing the signed-in user's password, email (v0.51.0) or display name
 * (v0.52.0), all on Manage → Account Info. Password and email changes ask
 * for the current password first, so an unlocked phone left lying around is
 * not enough to take over the account.
 *
 * A new email is checked here for shape and for being a change; whether
 * another account already uses it is checked by Supabase Auth, which keeps
 * one account per email (the store turns its answer into EMAIL_TAKEN).
 */
import { UserFacingError } from "./dataStore";
import { checkNewPassword } from "./emailLink";

export const WRONG_PASSWORD = "Your current password is not right.";
export const EMAIL_TAKEN = "Another account already uses that email.";
export const SAME_PASSWORD = "Choose a password different from your current one.";
export const SAME_EMAIL = "That is already your email.";
export const BAD_EMAIL = "Enter an email address, like name@example.com.";

/** Checks the three password fields; throws a readable error, else returns the new password. */
export function checkPasswordChange(current: string, next: string, confirm: string): string {
  if (!current) throw new UserFacingError("Enter your current password.");
  const password = checkNewPassword(next, confirm);
  if (password === current) throw new UserFacingError(SAME_PASSWORD);
  return password;
}

/** An email as Supabase Auth keeps it: trimmed and lower case. */
export function normalizeEmail(text: string): string {
  return text.trim().toLowerCase();
}

/**
 * Checks a new email against the current one; throws a readable error, else
 * returns it normalized. Only the shape is checked (one @, a dot after it).
 */
export function checkNewEmail(current: string, text: string): string {
  const email = normalizeEmail(text);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new UserFacingError(BAD_EMAIL);
  if (email === normalizeEmail(current)) throw new UserFacingError(SAME_EMAIL);
  return email;
}

/** The longest display name (Manage → Account Info). */
export const MAX_DISPLAY_NAME = 50;

/**
 * A display name as kept: trimmed, with runs of spaces made one. "" removes
 * it (the greeting then uses the email). Throws when it is too long.
 */
export function cleanDisplayName(text: string): string {
  const name = text.trim().replace(/\s+/g, " ");
  if (name.length > MAX_DISPLAY_NAME) {
    throw new UserFacingError(`Use at most ${MAX_DISPLAY_NAME} characters.`);
  }
  return name;
}

/** Manage's greeting: the display name, else the email. */
export function greeting(displayName: string, email: string): string {
  return `Hi, ${displayName || email}`;
}
