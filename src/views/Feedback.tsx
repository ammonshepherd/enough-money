import type { FormEvent } from "react";
import type { Budget } from "../controllers/useBudget";
import { useFeedback } from "../controllers/useFeedback";
import { ErrorMessage } from "./components";

/** Manage → Send feedback: a message emailed to the app's owner. */
export function Feedback({ budget }: { budget: Budget }) {
  const feedback = useFeedback(budget);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void feedback.submit();
  };

  return (
    <section className="list-card" aria-labelledby="feedback-title">
      <div className="section-heading">
        <h2 id="feedback-title">Give Feedback</h2>
      </div>
      <p className="empty-state">
        Found a problem or have an idea? Your message is emailed to the app’s owner, who can reply
        to your sign-in email. Only what you write here is sent.
      </p>

      <form className="form" onSubmit={submit} aria-label="Feedback">
        <label className="field">
          Message
          <textarea
            value={feedback.message}
            rows={6}
            maxLength={feedback.max}
            onChange={(e) => feedback.edit(e.target.value)}
          />
        </label>
        <div className="form-actions">
          <button
            className="primary-button"
            type="submit"
            disabled={feedback.pending || !feedback.message.trim()}
          >
            {feedback.pending ? "Sending…" : "Send"}
          </button>
        </div>
        <p className="feedback-status" role="status">
          {feedback.sent && "Thanks! Your feedback was sent."}
        </p>
        <ErrorMessage error={feedback.error} />
      </form>
    </section>
  );
}
