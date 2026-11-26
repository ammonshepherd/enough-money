import { useEffect, useState, type FormEvent, type JSX } from "react";
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
  ArrowLeftIcon,
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

/** Manage → Household: the household's name, renamed in a sheet (or beside the list on a desktop). */
function HouseholdPage({ budget, data, onDone }: PageProps & { onDone?: () => void }) {
  const household = useHousehold(budget, data);
  return (
    // In the phone's sheet (onDone) the sheet is its frame, so no card.
    <section className={onDone ? "stack" : "list-card"} aria-labelledby="household-title">
      <div className="section-heading">
        <h2 id="household-title">Household</h2>
      </div>
      <RenameHousehold name={household.name} onSave={household.rename} onDone={onDone} />
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
 * Manage: a greeting, then a list of options, each opening its own page
 * ("#manage/tags"). On a phone the page replaces the list (its back arrow
 * returns to it), except Household, whose sheet opens over the list; on a
 * desktop the list stays on the left and the page opens beside it
 * (Envelopes when none is chosen).
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
  /** The open option, from the URL; null shows the list. */
  section?: ManageSection | null;
}) {
  const signOut = useAsyncAction(onSignOut);
  const shown = section ?? (desktop ? "groups" : null);
  // On a phone Household is a sheet over the list, not a page.
  const renaming = !desktop && shown === "household";
  const option = renaming ? null : (OPTIONS.find((o) => o.section === shown) ?? null);
  const listShown = desktop || !option;
  const pageProps = { budget, data, email, displayName };
  // Back to the list, in place of the sheet's address, so Back does not reopen it.
  const closeHousehold = () => window.location.replace(manageHref());

  // A phone opens a page (or returns to the list) at its top.
  useEffect(() => {
    if (!desktop && !renaming) window.scrollTo(0, 0);
  }, [desktop, section, renaming]);

  return (
    <section className="page-view stack manage-page" aria-labelledby="manage-title">
      <PageMenu label="Manage menu">
        <MenuItem disabled={signOut.pending} onSelect={() => signOut.run()}>
          Sign out
        </MenuItem>
      </PageMenu>
      {listShown && <CardDebt data={data} />}
      {/* For screen readers only (v0.52.0): the greeting heads the page. */}
      <h1 id="manage-title" className="visually-hidden">
        Manage
      </h1>
      {listShown && <p className="manage-greeting">{greeting(displayName, email)}</p>}

      <div className="manage-layout">
        {listShown && (
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
        )}

        {option && (
          <div className="manage-detail">
            {!desktop && (
              <a className="manage-back" href={manageHref()}>
                <ArrowLeftIcon />
                Manage
              </a>
            )}
            {/* key: each page starts fresh (a half-typed form is not carried over). */}
            <option.Page key={option.section} {...pageProps} />
          </div>
        )}
      </div>

      <Sheet
        open={renaming}
        label="Household"
        className="sheet bottom"
        onClose={() => {
          if (renaming) closeHousehold();
        }}
      >
        {() => (
          <div className="household-sheet">
            <span className="sheet-handle" aria-hidden="true" />
            <HouseholdPage {...pageProps} onDone={closeHousehold} />
          </div>
        )}
      </Sheet>
    </section>
  );
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
