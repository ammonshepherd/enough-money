import { emailLinkPrompt, type EmailLinkType } from "../models/emailLink";

/**
 * Shown when an email's link opens the app (v0.54.3): its one-time token is
 * used only once this button is tapped. Mail scanners open links in a real
 * browser but tap nothing, so they no longer use the token up first.
 */
export function EmailLinkPage({
  type,
  onAccept,
  onDismiss,
}: {
  type: EmailLinkType;
  onAccept: () => void;
  onDismiss: () => void;
}) {
  const prompt = emailLinkPrompt(type);
  return (
    <section className="page-view stack" aria-labelledby="email-link-title">
      <header className="page-heading">
        <p className="eyebrow">{prompt.eyebrow}</p>
        <h1 id="email-link-title">{prompt.title}</h1>
        <p>{prompt.text}</p>
      </header>
      <div className="list-card form">
        <button className="primary-button" type="button" onClick={onAccept}>
          {prompt.button}
        </button>
      </div>
      <p>
        <button className="text-button" type="button" onClick={onDismiss}>
          Not now
        </button>
      </p>
    </section>
  );
}
