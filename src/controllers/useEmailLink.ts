import { useCallback, useEffect, useState } from "react";
import type { DataStore, UserSession } from "../models/dataStore";
import {
  loadPasswordNeeded,
  readEmailLink,
  savePasswordNeeded,
  withoutEmailLink,
  type EmailLink,
  type EmailLinkType,
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
// exchanged once even though React's StrictMode runs effects twice.
let taken: EmailLink | null | undefined;
let verifying: Promise<UserSession> | null = null;

function takeEmailLink(): EmailLink | null {
  if (taken === undefined) {
    taken = readEmailLink(window.location.search);
    if (taken) window.history.replaceState(null, "", withoutEmailLink(window.location.href));
  }
  return taken;
}

export type EmailLinkState =
  { status: "none" } | { status: "checking" } | { status: "failed"; error: string };

/**
 * The Invite user and Reset password emails' links (see models/emailLink.ts):
 * signs in with the link's token, then reports, for whoever is signed in,
 * whether they still have to set a password.
 */
export function useEmailLink(store: DataStore, userId: string | null) {
  const [link] = useState(takeEmailLink);
  const [state, setState] = useState<EmailLinkState>(
    link ? { status: "checking" } : { status: "none" },
  );
  // Bumped to re-read localStorage after the password is set.
  const [, setSaved] = useState(0);

  useEffect(() => {
    if (!link) return;
    let active = true;
    verifying ??= store.verifyEmailLink(link).then((session) => {
      savePasswordNeeded(storage(), session.userId, link.type);
      return session;
    });
    verifying.then(
      () => active && setState({ status: "none" }),
      (error: unknown) => active && setState({ status: "failed", error: messageOf(error) }),
    );
    return () => {
      active = false;
    };
  }, [store, link]);

  /** Which link the signed-in user followed and still has to set a password for. */
  const passwordNeeded: EmailLinkType | null =
    userId && state.status !== "checking" ? loadPasswordNeeded(storage(), userId) : null;

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

  return { state, passwordNeeded, setPassword, signIn };
}
