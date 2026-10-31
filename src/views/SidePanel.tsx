import type { ReactNode } from "react";
import { PlusIcon, SidebarIcon } from "./icons";

/**
 * The desktop layout's right-hand panel (Budget, Accounts): it
 * sits beside the page's list and collapses to a thin rail with one button
 * that opens it again. Whether it is collapsed is the page's to keep
 * (useSidebar("panel", …)), so choosing something can open it.
 * With `onAdd`, an Add transaction button heads the panel (a round + on
 * the rail); the page then shows the form in the panel. It hides while
 * `adding`, as the form is already open.
 */
export function SidePanel({
  label,
  collapsed,
  onToggle,
  onAdd,
  adding = false,
  children,
}: {
  /** What the panel holds, for screen readers ("Envelope details"). */
  label: string;
  collapsed: boolean;
  onToggle: () => void;
  onAdd?: () => void;
  adding?: boolean;
  children: ReactNode;
}) {
  const showAdd = onAdd && !(adding && !collapsed);
  return (
    <aside className={collapsed ? "side-panel collapsed" : "side-panel"} aria-label={label}>
      <button
        className="side-panel-toggle"
        type="button"
        aria-expanded={!collapsed}
        aria-label={collapsed ? "Show panel" : "Hide panel"}
        title={collapsed ? "Show panel" : "Hide panel"}
        onClick={onToggle}
      >
        <SidebarIcon />
      </button>
      {collapsed ? (
        showAdd && (
          <button
            className="panel-add round"
            type="button"
            aria-label="Add transaction"
            title="Add transaction"
            onClick={onAdd}
          >
            <PlusIcon />
          </button>
        )
      ) : (
        <div className="side-panel-body">
          {showAdd && (
            <button className="panel-add" type="button" onClick={onAdd}>
              <PlusIcon />
              Add transaction
            </button>
          )}
          {children}
        </div>
      )}
    </aside>
  );
}
