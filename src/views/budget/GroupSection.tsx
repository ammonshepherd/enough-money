import { useRef, useState } from "react";
import type { BudgetPageState as Page } from "../../controllers/useBudgetPage";
import { Money, SingleFieldForm } from "../components";
import { CardIcon, ChevronDownIcon } from "../icons";
import { EnvelopeItem } from "./EnvelopeItem";

type Group = Page["groups"][number];

/**
 * A group: a bar whose name collapses or expands its envelopes (collapsed, it
 * shows how many and their total left) and a + to add an envelope.
 */
export function GroupSection({
  group,
  page,
  collapsed,
  onToggle,
  onExpand,
  onOpen,
  onMove,
  desktop,
  selectedId,
}: {
  group: Group;
  page: Page;
  collapsed: boolean;
  onToggle: () => void;
  onExpand: () => void;
  onOpen: (envelopeId: string) => void;
  /** Opens the move dialog for an envelope (its left amount was tapped). */
  onMove: (envelopeId: string) => void;
  desktop: boolean;
  /** The envelope shown in the desktop panel. */
  selectedId: string | null;
}) {
  const [adding, setAdding] = useState(false);
  const rows = useRef<HTMLDivElement>(null);
  const rowsId = `group-rows-${group.id}`;
  const count = group.envelopes.length;
  // The group holding the cards' payment envelopes is framed apart (v0.42.2):
  // those envelopes work differently. Found by its envelopes, not its name.
  const cards = group.envelopes.some((envelope) => envelope.card);

  const toggle = () => {
    // A Planned or Assigned field open in this group saves before it is hidden.
    const active = document.activeElement;
    if (active instanceof HTMLElement && rows.current?.contains(active)) active.blur();
    onToggle();
  };

  return (
    <section
      className={["budget-group", cards && "card-group", collapsed && "collapsed"]
        .filter(Boolean)
        .join(" ")}
      aria-label={group.name}
    >
      <div className="group-heading">
        <h2>
          <button
            className="group-toggle"
            type="button"
            aria-expanded={!collapsed}
            aria-controls={rowsId}
            onClick={toggle}
          >
            <ChevronDownIcon />
            {cards && <CardIcon />}
            <span className="group-name">{group.name}</span>
            {collapsed && (
              <span className="group-summary">
                {count} {count === 1 ? "envelope" : "envelopes"}
              </span>
            )}
          </button>
        </h2>
        {collapsed && (
          <span className="group-total">
            <Money cents={group.left} />
            <span className="visually-hidden"> remaining</span>
          </span>
        )}
        <button
          className="add-envelope-button"
          type="button"
          aria-label={adding ? `Stop adding to ${group.name}` : `Add envelope to ${group.name}`}
          aria-expanded={adding}
          onClick={() => {
            // Opens the group too, so the new envelope shows up.
            if (!adding) onExpand();
            setAdding((open) => !open);
          }}
        >
          {adding ? "×" : "+"}
        </button>
      </div>
      {adding && (
        <div className="group-add">
          <SingleFieldForm
            label="New envelope"
            button="Add envelope"
            inputMode="text"
            onSubmit={(name) => page.addEnvelope(group.id, name)}
          />
        </div>
      )}
      <div id={rowsId} ref={rows} hidden={collapsed}>
        {count > 0 ? (
          <ul className="envelope-list">
            {group.envelopes.map((envelope) => (
              <li key={envelope.id}>
                <EnvelopeItem
                  envelope={envelope}
                  page={page}
                  onOpen={() => onOpen(envelope.id)}
                  onMove={() => onMove(envelope.id)}
                  desktop={desktop}
                  selected={envelope.id === selectedId}
                />
              </li>
            ))}
          </ul>
        ) : (
          !adding && <p className="empty-state group-empty">No envelopes yet. Tap + to add one.</p>
        )}
      </div>
    </section>
  );
}
