/**
 * Changing the signed-in user's password or email (Manage → Settings,
 * v0.51.0). Both ask for the current password first, so an unlocked phone
 * left lying around is not enough to take over the account.
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
