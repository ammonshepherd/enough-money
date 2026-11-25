// The v0.0.1 SVG icons as components: <BudgetIcon /> renders the drawing.

function Icon({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={path} />
    </svg>
  );
}

export const BudgetIcon = () => (
  <Icon path="M4 6.5h16v13H4zM7 6.5V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.5M8 12h8M8 15.5h5" />
);
export const AccountsIcon = () => <Icon path="M4 7.5h16v12H4zM4 7.5l2-3h12l2 3M4 10h16M8 15h3" />;
export const ActivityIcon = () => <Icon path="M5 5h14v14H5zM8 9h8M8 12h8M8 15h5" />;
/** A gear: the Manage page (its tab and sidebar link). */
export const ManageIcon = () => (
  <Icon path="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm0-5v2m0 13v2M3.5 12h2m13 0h2M5.99 5.99l1.41 1.42m9.2 9.18 1.41 1.42m0-12.02-1.41 1.42m-9.2 9.18-1.41 1.42" />
);
export const InstallIcon = () => (
  <Icon path="M12 3v11m0 0 4-4m-4 4-4-4M5 17v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" />
);
/** Three stacked bars: the page menu in the phone header. */
export const MenuIcon = () => <Icon path="M4 7h16M4 12h16M4 17h16" />;
/** A tick: a menu option that is on. */
export const CheckIcon = () => <Icon path="M5 12.5l4.5 4.5L19 7" />;
export const PlusIcon = () => <Icon path="M12 5v14M5 12h14" />;
export const PencilIcon = () => <Icon path="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />;
/** A bank: roof, four columns, base. The reconciled mark on Accounts. */
export const BankIcon = () => (
  <Icon path="M3 9.5 12 4l9 5.5zM5.5 10.5v7M10 10.5v7M14 10.5v7M18.5 10.5v7M3.5 20h17" />
);
/** A magnifying glass: the search field on an open account. */
export const SearchIcon = () => (
  <Icon path="M17.5 17.5 21 21M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z" />
);
export const ChevronDownIcon = () => <Icon path="M6 9l6 6 6-6" />;
export const ChevronLeftIcon = () => <Icon path="M15 6l-6 6 6 6" />;
/** A full arrow (shaft and head): the info pane's way back to the accounts list. */
export const ArrowLeftIcon = () => <Icon path="M19 12H5M11 5l-7 7 7 7" />;
/** A window with a side column: shows or hides a desktop sidebar. */
export const SidebarIcon = () => <Icon path="M4 5h16v14H4zM9 5v14" />;

/** Six dots in two columns: "drag me". */
export const GripIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    {[6, 12, 18].map((y) => [9, 15].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.6" />))}
  </svg>
);

/**
 * The app icon in miniature (a purple envelope with two green bills), shown
 * on every Budget row. Decorative; one component so per-envelope icons can
 * replace it later.
 */
export const EnvelopeIcon = () => (
  <svg className="envelope-icon" width="22" height="18" viewBox="0 0 22 18" aria-hidden="true">
    <rect
      className="envelope-note-back"
      x="6"
      y="0.5"
      width="11"
      height="9"
      rx="1.2"
      transform="rotate(-8 11 5)"
    />
    <rect
      className="envelope-note-front"
      x="9"
      y="1.5"
      width="10"
      height="8"
      rx="1.2"
      transform="rotate(6 14 5)"
    />
    <rect className="envelope-body" x="1" y="6" width="20" height="11.5" rx="2" />
    <path
      className="envelope-flap"
      d="M1.8 6.8 L11 13 L20.2 6.8"
      fill="none"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
  </svg>
);
/** A payment card: the Credit card payments group bar on Budget. */
export const CardIcon = () => <Icon path="M3 6h18v12H3zM3 10h18M6.5 14.5h4" />;

// Manage's list: one small drawing per option.
/** Stacked folders: envelope groups. */
export const GroupsIcon = () => <Icon path="M3 7h6l2 2h10v10H3zM3 7V5h6l2 2" />;
/** A sheet with rows: an envelope plan CSV. */
export const PlanIcon = () => <Icon path="M6 3h9l4 4v14H6zM15 3v4h4M9 12h7M9 15.5h7M9 19h4" />;
/** A coin with an arrow in: deposits marked Income. */
export const IncomeIcon = () => (
  <Icon path="M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18zM12 7v10M8.5 13.5 12 17l3.5-3.5" />
);
/** A luggage-style label: tags. */
export const TagIcon = () => <Icon path="M3 3h8l10 10-8 8L3 11zM7.5 7.5h.01" />;
/** A person: payees. */
export const PersonIcon = () => (
  <Icon path="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0" />
);
/** A tray with an arrow out: export a backup. */
export const ExportIcon = () => (
  <Icon path="M12 15V3m0 0-4 4m4-4 4 4M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
);
/** Info in a circle: About. */
export const InfoIcon = () => (
  <Icon path="M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18zM12 11v6M12 7.5h.01" />
);
/** A circular arrow: restore a backup. */
export const RestoreIcon = () => <Icon path="M4 4v6h6M4.5 15a8 8 0 1 0 1.9-8.3L4 10" />;
/** A door with an arrow out: sign out. */
export const SignOutIcon = () => <Icon path="M10 4H5v16h5M14 8l4 4-4 4M18 12H9" />;
/** A house: the household's name (Manage → Settings). */
/** A crescent moon: Manage → Appearance (light or dark). */
export const MoonIcon = () => <Icon path="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />;

export const HomeIcon = () => <Icon path="M3.5 11 12 4l8.5 7M6 9.5V20h12V9.5M10 20v-5h4v5" />;
/** A person in a circle: who is signed in (Manage → Settings). */
export const UserIcon = () => (
  <Icon path="M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18zM12 12.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6.5 18a6.5 6.5 0 0 1 11 0" />
);
