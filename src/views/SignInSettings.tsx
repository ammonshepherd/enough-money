import { useState, type FormEvent } from "react";
import { useAsyncAction } from "../controllers/useAsyncAction";
import type { Budget } from "../controllers/useBudget";
import { MIN_PASSWORD_LENGTH } from "../models/emailLink";
import { checkNewEmail, checkPasswordChange } from "../models/signInDetails";
import { ErrorMessage } from "./components";

/** Manage → Change password: the current password, then the new one twice. */
export function ChangePassword({ budget, email }: { budget: Budget; email: string }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const save = useAsyncAction(async () =>
    budget.changePassword(current, checkPasswordChange(current, next, confirm)),
  );

  const edit = (set: (value: string) => void) => (value: string) => {
    set(value);
    setDone(false);
    save.clearError();
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if ((await save.run()).ok) {
      setCurrent("");
      setNext("");
      setConfirm("");
      setDone(true);
    }
  };

  return (
    <section className="list-card" aria-labelledby="change-password-title">
      <div className="section-heading">
        <h2 id="change-password-title">Change password</h2>
      </div>
      <form className="form" onSubmit={submit} aria-label="Change password">
        {/* Hidden, so password managers know whose password changes. */}
        <input type="email" autoComplete="username" value={email} readOnly hidden />
        <PasswordField
          label="Current password"
          autoComplete="current-password"
          value={current}
          onChange={edit(setCurrent)}
        />
        <PasswordField
          label="New password"
          autoComplete="new-password"
          value={next}
          onChange={edit(setNext)}
          hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
        />
        <PasswordField
          label="Confirm new password"
          autoComplete="new-password"
          value={confirm}
          onChange={edit(setConfirm)}
        />
        <div className="form-actions">
          <button className="primary-button" type="submit" disabled={save.pending}>
            {save.pending ? "Saving…" : "Change password"}
          </button>
        </div>
        <p className="feedback-status" role="status">
          {done && "Your password was changed. Other devices signed in as you are signed out."}
        </p>
        <ErrorMessage error={save.error} />
      </form>
    </section>
  );
}

/**
 * Manage → Change email: the new email and the current password. Supabase
 * then emails a link to both addresses; the email changes once both are
 * opened, so until then the old one still signs in.
 */
export function ChangeEmail({ budget, email }: { budget: Budget; email: string }) {
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const save = useAsyncAction(async () => {
    const checked = checkNewEmail(email, newEmail);
    await budget.changeEmail(password, checked);
    return checked;
  });

  const edit = (set: (value: string) => void) => (value: string) => {
    set(value);
    setSentTo(null);
    save.clearError();
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const result = await save.run();
    if (result.ok) {
      setNewEmail("");
      setPassword("");
      setSentTo(result.value);
    }
  };

  return (
    <section className="list-card" aria-labelledby="change-email-title">
      <div className="section-heading">
        <h2 id="change-email-title">Change email</h2>
      </div>
      <p className="empty-state">
        You sign in as <strong>{email}</strong>. A new email must not belong to another account. We
        email a link to your current and your new address; your email changes once you have opened
        both.
      </p>
      <form className="form" onSubmit={submit} aria-label="Change email">
        <label className="field">
          New email
          <input
            type="email"
            autoComplete="email"
            required
            value={newEmail}
            onChange={(e) => edit(setNewEmail)(e.target.value)}
          />
        </label>
        <PasswordField
          label="Current password"
          autoComplete="current-password"
          value={password}
          onChange={edit(setPassword)}
        />
        <div className="form-actions">
          <button className="primary-button" type="submit" disabled={save.pending}>
            {save.pending ? "Sending…" : "Change email"}
          </button>
        </div>
        {sentTo && (
          <p className="notice" role="status">
            Check {email} and {sentTo}: open the link in each email to finish. Until then, sign in
            with {email}.
          </p>
        )}
        <ErrorMessage error={save.error} />
      </form>
    </section>
  );
}

function PasswordField({
  label,
  autoComplete,
  value,
  onChange,
  hint,
}: {
  label: string;
  autoComplete: "current-password" | "new-password";
  value: string;
  onChange: (value: string) => void;
  hint?: string;
}) {
  const hintId = `${label.toLowerCase().replace(/\W+/g, "-")}-hint`;
  return (
    <>
      <label className="field">
        {label}
        <input
          type="password"
          autoComplete={autoComplete}
          required
          aria-describedby={hint ? hintId : undefined}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
      {hint && (
        <p id={hintId} className="field-hint">
          {hint}
        </p>
      )}
    </>
  );
}
