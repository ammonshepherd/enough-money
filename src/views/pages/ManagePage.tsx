import { useState, type FormEvent, type JSX } from "react";
import { useAsyncAction } from "../../controllers/useAsyncAction";
import type { Budget } from "../../controllers/useBudget";
import { useHousehold } from "../../controllers/useHousehold";
import { APP_VERSION } from "../../models/appInfo";
import { manageHref, type ManageSection } from "../../models/routes";
import { greeting } from "../../models/signInDetails";
import type { BudgetData } from "../../models/types";
import { About } from "../About";
import { AppearanceSettings } from "../AppearanceSettings";
import { BackupExport, BackupRestore } from "../Backup";
import { CardDebt } from "../CardDebt";
import { ErrorMessage, Sheet } from "../components";
import { EnvelopeGroups } from "../EnvelopeGroups";
import { EnvelopePlanImport } from "../EnvelopePlanImport";
import { Feedback } from "../Feedback";
import { IncomeRules } from "../IncomeRules";
import {
  ExportIcon,
  GroupsIcon,
  HomeIcon,
  IncomeIcon,
  InfoIcon,
  MessageIcon,
  MoonIcon,
  PersonIcon,
  PlanIcon,
  RestoreIcon,
  SignOutIcon,
  TagIcon,
  UserIcon,
  VersionIcon,
} from "../icons";
import { MenuItem, PageMenu } from "../PageMenu";
import { PayeeSettings } from "../PayeeSettings";
import { AccountInfo } from "../SignInSettings";
import { TagSettings } from "../TagSettings";

interface PageProps {
  budget: Budget;
  data: BudgetData;
  email: string;
  displayName: string;
  /** On a phone, closes the option's sheet (pages that finish, like Household, call it). */
  closeSheet?: () => void;
}

interface Option {
  section: ManageSection;
  title: string;
  /** One short line under the title: what the page does. */
  description: string;
  Icon: () => JSX.Element;
  /** The option's page. */
  Page: (props: PageProps) => JSX.Element;
  /** Red, as a warning (Restore from Backup). */
  danger?: boolean;
}

/** Manage → Household: the household's name. In a phone's sheet, Save and Cancel close it. */
function HouseholdPage({ budget, data, closeSheet }: PageProps) {
  const household = useHousehold(budget, data);
  return (
    <section className="list-card" aria-labelledby="household-title">
      <div className="section-heading">
        <h2 id="household-title">Household</h2>
      </div>
      <RenameHousehold name={household.name} onSave={household.rename} onDone={closeSheet} />
    </section>
  );
}

const ACCOUNT: Option = {
  section: "account",
  title: "Account Info",
  description: "Your display name, email and password",
  Icon: UserIcon,
  Page: AccountInfo,
};

/**
 * Manage's list, in its groups (v0.52.0). Household's description is its
 * name, and Settings ends with Sign out and Information with the version
 * (rows that open no page).
 */
const GROUPS: { title: string; options: Option[] }[] = [
  {
    title: "Settings",
    options: [
      {
        section: "appearance",
        title: "Appearance",
        description: "Light, dark or match this device",
        Icon: MoonIcon,
        Page: AppearanceSettings,
      },
      ACCOUNT,
      {
        section: "household",
        title: "Household",
        description: "Household name",
        Icon: HomeIcon,
        Page: HouseholdPage,
      },
    ],
  },
  {
    title: "Budget",
    options: [
      {
        section: "groups",
        title: "Envelopes",
        description: "Add, rename and order groups and envelopes",
        Icon: GroupsIcon,
        Page: EnvelopeGroups,
      },
      {
        section: "plan",
        title: "Import Envelope Plan",
        description: "Upload Planned amounts for a month",
        Icon: PlanIcon,
        Page: EnvelopePlanImport,
      },
      {
        section: "backup",
        title: "Backup",
        description: "Save all your data to a file",
        Icon: ExportIcon,
        Page: BackupExport,
      },
      {
        section: "restore",
        title: "Restore from Backup",
        description: "Load a backup file into an empty household",
        Icon: RestoreIcon,
        Page: BackupRestore,
        danger: true,
      },
    ],
  },
  {
    title: "Transactions",
    options: [
      {
        section: "payees",
        title: "Payees",
        description: "Names suggested when you add a transaction",
        Icon: PersonIcon,
        Page: PayeeSettings,
      },
      {
        section: "tags",
        title: "Tags",
        description: "Labels for your transactions",
        Icon: TagIcon,
        Page: TagSettings,
      },
      {
        section: "income-rules",
        title: "Income Rules",
        description: "Mark matching deposits as Income",
        Icon: IncomeIcon,
        Page: IncomeRules,
      },
    ],
  },
  {
    title: "Information",
    options: [
      {
        section: "about",
        title: "About Enough Money",
        description: "What the app is for",
        Icon: InfoIcon,
        Page: About,
      },
      {
        // Also the "Give Feedback" link that ends every page.
        section: "feedback",
        title: "Give Feedback",
        description: "Report a problem or suggest an idea",
        Icon: MessageIcon,
        Page: Feedback,
      },
    ],
  },
];

const OPTIONS = GROUPS.flatMap((g) => g.options);

/**
 * Manage: a greeting, then a list of options, each at its own address
 * ("#manage/tags"). On a phone an option opens in a bottom sheet over the
 * list (v0.52.0); on a desktop the list stays on the left and the option
 * opens beside it (Envelopes when none is chosen).
 */
export function ManagePage({
  budget,
  data,
  email,
  displayName,
  onSignOut,
  desktop = false,
  section = null,
}: {
  budget: Budget;
  data: BudgetData;
  email: string;
  displayName: string;
  onSignOut: () => Promise<void>;
  desktop?: boolean;
  /** The open option, from the URL; null shows only the list. */
  section?: ManageSection | null;
}) {
  const signOut = useAsyncAction(onSignOut);
  const shown = section ?? (desktop ? "groups" : null);
  const option = OPTIONS.find((o) => o.section === shown) ?? null;
  const pageProps = { budget, data, email, displayName };

  // Whether the open sheet was opened from the list here: closing it then
  // goes Back (so Back does not reopen it). Opened by a link from elsewhere
  // (Give Feedback, Edit groups), closing it replaces its address with the
  // list's instead.
  const [fromList, setFromList] = useState(false);
  const [lastSection, setLastSection] = useState(section);
  if (section !== lastSection) {
    // Updating state while rendering is React's way to follow a prop.
    setLastSection(section);
    setFromList(lastSection === null && section !== null);
  }
  const closeSheet = () => {
    if (fromList) window.history.back();
    else window.location.replace(manageHref());
  };

  return (
    <section className="page-view stack manage-page" aria-labelledby="manage-title">
      <PageMenu label="Manage menu">
        <MenuItem disabled={signOut.pending} onSelect={() => signOut.run()}>
          Sign out
        </MenuItem>
      </PageMenu>
      <CardDebt data={data} />
      {/* For screen readers only (v0.52.0): the greeting heads the page. */}
      <h1 id="manage-title" className="visually-hidden">
        Manage
      </h1>
      <p className="manage-greeting">{greeting(displayName, email)}</p>

      <div className="manage-layout">
        <nav className="manage-list" aria-label="Manage options">
          {GROUPS.map((group) => (
            <OptionGroup
              key={group.title}
              title={group.title}
              options={group.options}
              shown={shown}
              household={data.household.name}
            >
              {group.title === "Settings" ? (
                <li>
                  <button
                    className="manage-row"
                    type="button"
                    disabled={signOut.pending}
                    onClick={() => signOut.run()}
                  >
                    <span className="settings-row-icon" aria-hidden="true">
                      <SignOutIcon />
                    </span>
                    <span className="settings-row-copy">
                      <strong>Sign Out</strong>
                      <small>Leave Enough Money on this device</small>
                    </span>
                  </button>
                </li>
              ) : group.title === "Information" ? (
                <li className="manage-row manage-version">
                  <span className="settings-row-icon" aria-hidden="true">
                    <VersionIcon />
                  </span>
                  <span className="settings-row-copy">
                    <strong>Version</strong>
                    <small>{APP_VERSION}</small>
                  </span>
                </li>
              ) : undefined}
            </OptionGroup>
          ))}
          <ErrorMessage error={signOut.error} />
        </nav>

        {desktop && option && (
          <div className="manage-detail">
            {/* key: each page starts fresh (a half-typed form is not carried over). */}
            <option.Page key={option.section} {...pageProps} />
          </div>
        )}
      </div>

      {!desktop && (
        <Sheet
          open={option !== null}
          label={option?.title ?? "Manage"}
          className="sheet bottom manage-sheet"
          onClose={() => {
            if (option) closeSheet();
          }}
        >
          {() => (
            <div className="manage-sheet-body">
              <div className="sheet-handle" aria-hidden="true" />
              <header className="sheet-header">
                <span className="sheet-eyebrow">Manage</span>
                <button
                  className="sheet-close"
                  type="button"
                  aria-label="Close"
                  onClick={closeSheet}
                >
                  ×
                </button>
              </header>
              <SheetPage
                key={option!.section}
                option={option!}
                {...pageProps}
                closeSheet={closeSheet}
              />
            </div>
          )}
        </Sheet>
      )}
    </section>
  );
}

/** An option's page in the phone's sheet. */
function SheetPage({ option, ...props }: PageProps & { option: Option }) {
  return <option.Page {...props} />;
}

function OptionGroup({
  title,
  options,
  shown,
  household,
  children,
}: {
  title: string;
  options: Option[];
  shown: ManageSection | null;
  /** The household's name, shown as Household's description. */
  household: string;
  /** Rows after the options (Sign Out, Version). */
  children?: JSX.Element;
}) {
  const id = `manage-group-${title.toLowerCase().replace(/\W+/g, "-")}`;
  return (
    <section className="manage-group" aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      <ul>
        {options.map(({ section, title: name, description, Icon, danger }) => (
          <li key={section}>
            <a
              className={danger ? "manage-row danger" : "manage-row"}
              href={manageHref(section)}
              aria-current={section === shown ? "page" : undefined}
            >
              <span className="settings-row-icon" aria-hidden="true">
                <Icon />
              </span>
              <span className="settings-row-copy">
                <strong>{name}</strong>
                <small>{section === "household" ? household : description}</small>
              </span>
              <span className="settings-row-chevron" aria-hidden="true">
                ›
              </span>
            </a>
          </li>
        ))}
        {children}
      </ul>
    </section>
  );
}

/**
 * The household's name in a form. In the phone's sheet, saving or Cancel
 * closes it (`onDone`); beside the desktop list, saving says so and Cancel
 * puts the name back.
 */
function RenameHousehold({
  name: current,
  onSave,
  onDone,
}: {
  name: string;
  onSave: (name: string) => Promise<void>;
  onDone?: () => void;
}) {
  const [name, setName] = useState(current);
  const [saved, setSaved] = useState(false);
  const save = useAsyncAction(onSave);
  const cancel = () => {
    if (onDone) onDone();
    else {
      setName(current);
      setSaved(false);
      save.clearError();
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!(await save.run(name)).ok) return;
    if (onDone) onDone();
    else setSaved(true);
  };

  return (
    <form className="form" onSubmit={submit} aria-label="Rename household">
      <label className="field">
        Household name
        <input
          value={name}
          maxLength={100}
          data-autofocus
          onChange={(e) => {
            setName(e.target.value);
            setSaved(false);
            save.clearError();
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape" && !onDone) {
              e.preventDefault();
              cancel();
            }
          }}
        />
      </label>
      <div className="form-actions">
        <button className="primary-button" type="submit" disabled={save.pending}>
          Save
        </button>
        <button className="secondary-button" type="button" onClick={cancel}>
          Cancel
        </button>
      </div>
      <p className="feedback-status" role="status">
        {saved && "The household’s name was saved."}
      </p>
      <ErrorMessage error={save.error} />
    </form>
  );
}
