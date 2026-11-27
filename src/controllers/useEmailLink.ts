import { useCallback, useEffect, useRef, useState } from "react";
import type { DataStore, UserSession } from "../models/dataStore";
import {
  EMAIL_CHANGE_HALF_DONE,
  emailChanged,
  loadPasswordNeeded,
  needsPassword,
  readEmailLink,
  savePasswordNeeded,
  withoutEmailLink,
  type EmailLink,
  type PasswordLinkType,
} from "../models/emailLink";
import { messageOf } from "./errors";

/** localStorage, or null where it cannot be reached. */
function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

// Read once per page load: the link is taken out of the address bar at once
// (so it is not bookmarked, shared or reused on reload), and the token is
// exchanged at most once (a second tap or StrictMode reuses the first try).
let taken: EmailLink | null | undefined;
let verifying: Promise<UserSession | null> | null = null;

function takeEmailLink(): EmailLink | null {
  if (taken === undefined) {
    taken = readEmailLink(window.location.search);
    if (taken) window.history.replaceState(null, "", withoutEmailLink(window.location.href));
  }
  return taken;
}

export type EmailLinkState =
  | { status: "none" }
  /**
   * A link was followed and waits for a tap before its token is used
   * (v0.54.3): mail scanners (Gmail's among them) open links in a real
   * browser, and used on page load the one-time token went to them.
   */
  | { status: "waiting"; type: EmailLink["type"] }
  | { status: "checking" }
  | { status: "failed"; error: string }
  /** A Change email address link worked: what to tell them. */
  | { status: "confirmed"; message: string };

/**
 * The Invite user, Reset password and Change email address emails' links
 * (see models/emailLink.ts): once the person taps to go on (`accept`), signs
 * in with the link's token, then reports, for whoever is signed in, whether
 * they still have to set a password.
 */
export function useEmailLink(store: DataStore, userId: string | null) {
  const [link] = useState(takeEmailLink);
  const [state, setState] = useState<EmailLinkState>(
    link ? { status: "waiting", type: link.type } : { status: "none" },
  );
  // Bumped to re-read localStorage after the password is set.
  const [, setSaved] = useState(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  /** Uses the link's token: only ever after a tap, never on page load. */
  const accept = useCallback(() => {
    if (!link) return;
    setState({ status: "checking" });
    verifying ??= store.verifyEmailLink(link).then((session) => {
      if (session && needsPassword(link.type)) {
        savePasswordNeeded(storage(), session.userId, link.type);
      }
      return session;
    });
    verifying.then(
      (session) => {
        if (!mounted.current) return;
        if (link.type !== "email_change") setState({ status: "none" });
        else {
          const message = session ? emailChanged(session.email) : EMAIL_CHANGE_HALF_DONE;
          setState({ status: "confirmed", message });
        }
      },
      (error: unknown) =>
        mounted.current && setState({ status: "failed", error: messageOf(error) }),
    );
  }, [store, link]);

  /** Which link the signed-in user followed and still has to set a password for. */
  const passwordNeeded: PasswordLinkType | null =
    userId && state.status !== "checking" && state.status !== "waiting"
      ? loadPasswordNeeded(storage(), userId)
      : null;

  const setPassword = useCallback(
    async (password: string) => {
      await store.setPassword(password);
      if (userId) savePasswordNeeded(storage(), userId, null);
      setSaved((n) => n + 1);
    },
    [store, userId],
  );

  /** Signing in with a password means they have one: no new password needed. */
  const signIn = useCallback(
    async (email: string, password: string) => {
      await store.signIn(email, password);
      const session = await store.getSession();
      if (session) savePasswordNeeded(storage(), session.userId, null);
      setState({ status: "none" });
    },
    [store],
  );

  /** Hides the Change email address link's message, or leaves a link unused ("Not now"). */
  const dismiss = useCallback(() => setState({ status: "none" }), []);

  return { state, passwordNeeded, accept, setPassword, signIn, dismiss };
}
