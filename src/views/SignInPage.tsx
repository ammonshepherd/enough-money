import { useState, type FormEvent } from "react";
import { useAsyncAction } from "../controllers/useAsyncAction";
import { ErrorMessage } from "./components";

/**
 * Sign in, or ask for a Reset password email. There is no sign-up form:
 * the owner invites each person from Supabase (public sign-up is off), and
 * the invite's link leads to SetPasswordPage.
 */
export function SignInPage({
  onSignIn,
  onSendReset,
  linkError = null,
}: {
  onSignIn: (email: string, password: string) => Promise<void>;
  onSendReset: (email: string) => Promise<void>;
  /** Why an email's link could not be used, when one was just followed. */
  linkError?: string | null;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [forgot, setForgot] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const signIn = useAsyncAction(onSignIn);
  const sendReset = useAsyncAction(onSendReset);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!forgot) {
      await signIn.run(email.trim(), password);
      return;
    }
    const to = email.trim();
    if ((await sendReset.run(to)).ok) setSentTo(to);
  };
  const switchTo = (next: boolean) => {
    setForgot(next);
    setSentTo(null);
    signIn.clearError();
    sendReset.clearError();
  };

  return (
    <section className="page-view stack" aria-labelledby="sign-in-title">
      <header className="page-heading">
        <p className="eyebrow">Welcome</p>
        <h1 id="sign-in-title">{forgot ? "Reset password" : "Sign in"}</h1>
        <p>
          {forgot
            ? "We will email you a link to choose a new password."
            : "Your budget is private to your household."}
        </p>
      </header>

      {linkError && !forgot && <ErrorMessage error={linkError} />}

      <form className="list-card form" onSubmit={submit}>
        <label className="field">
          Email
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        {!forgot && (
          <label className="field">
            Password
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
        )}
        {forgot ? (
          <button className="primary-button" type="submit" disabled={sendReset.pending}>
            Email me a link
          </button>
        ) : (
          <button className="primary-button" type="submit" disabled={signIn.pending}>
            Sign in
          </button>
        )}
        <ErrorMessage error={forgot ? sendReset.error : signIn.error} />
        {forgot && sentTo && (
          <p className="notice" role="status">
            If {sentTo} has an account, a link to reset its password is on its way. It works once;
            check your spam folder if it does not arrive.
          </p>
        )}
      </form>

      <p>
        <button className="text-button" type="button" onClick={() => switchTo(!forgot)}>
          {forgot ? "Back to sign in" : "Forgot password?"}
        </button>
      </p>
    </section>
  );
}
