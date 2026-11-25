import { useState, type FormEvent } from "react";
import { useAsyncAction } from "../controllers/useAsyncAction";
import { checkNewPassword, MIN_PASSWORD_LENGTH, type EmailLinkType } from "../models/emailLink";
import { ErrorMessage } from "./components";

/**
 * Shown after an Invite user or Reset password link signs someone in, before
 * anything else: they choose the password they will sign in with from now on.
 */
export function SetPasswordPage({
  kind,
  email,
  onSave,
  onSignOut,
}: {
  kind: EmailLinkType;
  email: string;
  onSave: (password: string) => Promise<void>;
  onSignOut: () => Promise<void>;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const save = useAsyncAction(async () => onSave(checkNewPassword(password, confirm)));
  const signOut = useAsyncAction(onSignOut);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await save.run();
  };

  return (
    <section className="page-view stack" aria-labelledby="set-password-title">
      <header className="page-heading">
        <p className="eyebrow">{kind === "invite" ? "Welcome" : "Forgot password"}</p>
        <h1 id="set-password-title">
          {kind === "invite" ? "Choose a password" : "Choose a new password"}
        </h1>
        <p>
          {kind === "invite"
            ? "You will sign in with your email and this password from now on."
            : "Use it the next time you sign in."}
        </p>
      </header>

      <form className="list-card form" onSubmit={submit}>
        <label className="field">
          Email
          {/* Read only, and named "username" so password managers save the pair. */}
          <input type="email" autoComplete="username" value={email} readOnly />
        </label>
        <label className="field">
          New password
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            aria-describedby="password-rule"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <p id="password-rule" className="field-hint">
          At least {MIN_PASSWORD_LENGTH} characters.
        </p>
        <label className="field">
          Confirm new password
          <input
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </label>
        <button className="primary-button" type="submit" disabled={save.pending}>
          Save password
        </button>
        <ErrorMessage error={save.error} />
      </form>

      <p>
        <button
          className="text-button"
          type="button"
          disabled={signOut.pending}
          onClick={() => signOut.run()}
        >
          Sign out
        </button>
      </p>
      <ErrorMessage error={signOut.error} />
    </section>
  );
}
