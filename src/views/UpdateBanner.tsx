import type { WhatsNewNote } from "../models/whatsNew";

/**
 * Offers the newer version of the app once it has downloaded, with what's
 * new in it when the notes could be fetched. Refresh reloads into it; Later
 * hides the offer (it comes back on the next check).
 */
export function UpdateBanner({
  notes,
  onRefresh,
  onDismiss,
}: {
  notes: WhatsNewNote[];
  onRefresh: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="update-banner" role="status">
      <p>A new version of Enough Money is available.</p>
      {notes.length > 0 && (
        <ul className="update-notes" aria-label="What's new">
          {notes.map((note) => (
            <li key={note.version}>{note.text}</li>
          ))}
        </ul>
      )}
      <div className="update-banner-actions">
        <button className="update-later" type="button" onClick={onDismiss}>
          Later
        </button>
        <button className="update-refresh" type="button" onClick={onRefresh}>
          Refresh
        </button>
      </div>
    </div>
  );
}
