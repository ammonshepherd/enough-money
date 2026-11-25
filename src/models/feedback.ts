/**
 * Manage → Send feedback: a message emailed to the owner by the
 * send-feedback Edge Function (supabase/functions/send-feedback). Only the
 * text the user typed is sent: no budget data and no app details.
 */
import { UserFacingError } from "./dataStore";

/** Longest message accepted, in characters (the function checks the same). */
export const MAX_FEEDBACK = 5000;

/** The message to send, trimmed. Throws a UserFacingError when it is empty or too long. */
export function cleanFeedback(message: string): string {
  const text = message.trim();
  if (!text) throw new UserFacingError("Write a message first.");
  if (text.length > MAX_FEEDBACK) {
    throw new UserFacingError(`Keep it under ${MAX_FEEDBACK.toLocaleString("en-US")} characters.`);
  }
  return text;
}
