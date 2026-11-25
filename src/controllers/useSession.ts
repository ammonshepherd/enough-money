import { useEffect, useState } from "react";
import type { DataStore, UserSession } from "../models/dataStore";
import { messageOf } from "./errors";

export type SessionState =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "signedOut" }
  | { status: "signedIn"; session: UserSession };

const fromSession = (session: UserSession | null): SessionState =>
  session ? { status: "signedIn", session } : { status: "signedOut" };

/** Who is signed in, kept up to date as they sign in and out. */
export function useSession(store: DataStore): SessionState {
  const [state, setState] = useState<SessionState>({ status: "loading" });

  useEffect(() => {
    let active = true;
    // A change reported while the first answer is on its way (an email link
    // signing in) is newer than that answer, so the answer is then dropped.
    let changed = false;
    store.getSession().then(
      (session) => active && !changed && setState(fromSession(session)),
      (error: unknown) =>
        active && !changed && setState({ status: "error", error: messageOf(error) }),
    );
    try {
      const unsubscribe = store.onSessionChange((session) => {
        changed = true;
        setState(fromSession(session));
      });
      return () => {
        active = false;
        unsubscribe();
      };
    } catch {
      // getSession above reports the same configuration error.
      return () => {
        active = false;
      };
    }
  }, [store]);

  return state;
}
