import { useEffect, useState, type FormEvent, type JSX } from "react";
import { useAsyncAction } from "../../controllers/useAsyncAction";
import type { Budget } from "../../controllers/useBudget";
import { useHousehold } from "../../controllers/useHousehold";
import { APP_VERSION } from "../../models/appInfo";
import { manageHref, type ManageSection } from "../../models/routes";
import type { BudgetData } from "../../models/types";
import { BackupExport, BackupRestore } from "../Backup";
import { CardDebt } from "../CardDebt";
import { ErrorMessage } from "../components";
import { EnvelopeGroups } from "../EnvelopeGroups";
import { EnvelopePlanImport } from "../EnvelopePlanImport";
import { IncomeRules } from "../IncomeRules";
import {
  ArrowLeftIcon,
  ExportIcon,
  GroupsIcon,
  IncomeIcon,
  InfoIcon,
  ManageIcon,
  PencilIcon,
  PersonIcon,
  PlanIcon,
  RestoreIcon,
  SignOutIcon,
  TagIcon,
} from "../icons";
import { MenuItem, PageMenu } from "../PageMenu";
import { PayeeSettings } from "../PayeeSettings";
import { TagSettings } from "../TagSettings";

interface Option {
  section: ManageSection;
  title: string;
  /** One short line under the title: what the page does. */
  description: string;
  Icon: () => JSX.Element;
  /** The option's page. */
  Page: (props: { budget: Budget; data: BudgetData }) => JSX.Element;
}

/** Manage's list, in its groups. Restore sits apart, in the danger zone. */
const GROUPS: { title: string; options: Option[] }[] = [
  {
    title: "Budget",
    options: [
      {
        section: "groups",
        title: "Envelope groups",
        description: "Add, rename and order groups and envelopes",
        Icon: GroupsIcon,
        Page: EnvelopeGroups,
      },
      {
        section: "plan",
        title: "Import envelope plan",
        description: "Upload Planned amounts for a month",
        Icon: PlanIcon,
        Page: EnvelopePlanImport,
      },
    ],
  },
  {
    title: "Transactions",
    options: [
      {
        section: "income-rules",
        title: "Income rules",
        description: "Mark matching deposits as Income",
        Icon: IncomeIcon,
        Page: IncomeRules,
      },
      {
        section: "tags",
        title: "Tags",
        description: "Labels for your transactions",
        Icon: TagIcon,
        Page: TagSettings,
      },
      {
        section: "payees",
        title: "Payees",
        description: "Names suggested when you add a transaction",
        Icon: PersonIcon,
        Page: PayeeSettings,
      },
    ],
  },
  {
    title: "Household",
    options: [
      {
        section: "backup",
        title: "Backup",
        description: "Save all your data to a file",
        Icon: ExportIcon,
        Page: BackupExport,
      },
    ],
  },
];

const RESTORE: Option = {
  section: "restore",
  title: "Restore from a backup",
  description: "Load a backup file into an empty household",
  Icon: RestoreIcon,
  Page: BackupRestore,
};

const OPTIONS = [...GROUPS.flatMap((g) => g.options), RESTORE];

/**
 * Manage: a list of options, each opening its own page ("#manage/tags").
 * On a phone the page replaces the list (its back arrow returns to it); on
 * a desktop the list stays on the left and the page opens beside it
 * (Envelope groups when none is chosen).
 */
export function ManagePage({
  budget,
  data,
  email,
  onSignOut,
  desktop = false,
  section = null,
}: {
  budget: Budget;
  data: BudgetData;
  email: string;
  onSignOut: () => Promise<void>;
  desktop?: boolean;
  /** The open option, from the URL; null shows the list. */
  section?: ManageSection | null;
}) {
  const signOut = useAsyncAction(onSignOut);
  const shown = section ?? (desktop ? "groups" : null);
  const option = OPTIONS.find((o) => o.section === shown) ?? null;
  const listShown = desktop || !option;

  // A phone opens a page (or returns to the list) at its top.
  useEffect(() => {
    if (!desktop) window.scrollTo(0, 0);
  }, [desktop, section]);

  return (
    <section className="page-view stack manage-page" aria-labelledby="manage-title">
      <PageMenu label="Manage menu">
        <MenuItem disabled={signOut.pending} onSelect={() => signOut.run()}>
          Sign out
        </MenuItem>
      </PageMenu>
      {listShown && <CardDebt data={data} />}
      <header className={listShown ? "page-heading" : "visually-hidden"}>
        <h1 id="manage-title">Manage</h1>
        {listShown && <p>Set up your budget and look after your household’s data.</p>}
      </header>

      <div className="manage-layout">
        {listShown && (
          <nav className="manage-list" aria-label="Manage options">
            <Household budget={budget} data={data} email={email} />
            {GROUPS.map((group) => (
              <OptionGroup
                key={group.title}
                title={group.title}
                options={group.options}
                shown={shown}
              >
                {group.title === "Household" && (
                  <li className="manage-row manage-info">
                    <span className="settings-row-icon" aria-hidden="true">
                      <InfoIcon />
                    </span>
                    <span className="settings-row-copy">
                      <strong>About Enough Money</strong>
                      <small>Version {APP_VERSION}</small>
                    </span>
                  </li>
                )}
              </OptionGroup>
            ))}
            <OptionGroup title="Danger zone" options={[RESTORE]} shown={shown} danger>
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
                    <strong>Sign out</strong>
                    <small>Leave Enough Money on this device</small>
                  </span>
                </button>
              </li>
            </OptionGroup>
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
            <option.Page key={option.section} budget={budget} data={data} />
          </div>
        )}
      </div>
    </section>
  );
}

function OptionGroup({
  title,
  options,
  shown,
  danger = false,
  children,
}: {
  title: string;
  options: Option[];
  shown: ManageSection | null;
  danger?: boolean;
  children?: JSX.Element | false;
}) {
  const id = `manage-group-${title.toLowerCase().replace(/\W+/g, "-")}`;
  return (
    <section className={danger ? "manage-group danger" : "manage-group"} aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      <ul>
        {options.map(({ section, title: name, description, Icon }) => (
          <li key={section}>
            <a
              className="manage-row"
              href={manageHref(section)}
              aria-current={section === shown ? "page" : undefined}
            >
              <span className="settings-row-icon" aria-hidden="true">
                <Icon />
              </span>
              <span className="settings-row-copy">
                <strong>{name}</strong>
                <small>{description}</small>
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

/** The household's name and who is signed in; its pencil renames the household in place. */
function Household({ budget, data, email }: { budget: Budget; data: BudgetData; email: string }) {
  const household = useHousehold(budget, data);
  const [editing, setEditing] = useState(false);

  return (
    <div className="manage-household">
      <span className="settings-row-icon" aria-hidden="true">
        <ManageIcon />
      </span>
      {editing ? (
        <RenameHousehold
          name={household.name}
          onSave={household.rename}
          onDone={() => setEditing(false)}
        />
      ) : (
        <>
          <span className="settings-row-copy">
            <strong>{household.name}</strong>
            <small>Signed in as {email}</small>
          </span>
          <button
            className="pane-icon-button"
            type="button"
            aria-label="Rename household"
            title="Rename household"
            onClick={() => setEditing(true)}
          >
            <PencilIcon />
          </button>
        </>
      )}
    </div>
  );
}

function RenameHousehold({
  name: current,
  onSave,
  onDone,
}: {
  name: string;
  onSave: (name: string) => Promise<void>;
  onDone: () => void;
}) {
  const [name, setName] = useState(current);
  const save = useAsyncAction(onSave);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if ((await save.run(name)).ok) onDone();
  };

  return (
    <form className="form" onSubmit={submit} aria-label="Rename household">
      <label className="field">
        Household name
        <input
          value={name}
          maxLength={100}
          autoFocus
          onChange={(e) => {
            setName(e.target.value);
            save.clearError();
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              onDone();
            }
          }}
        />
      </label>
      <div className="form-actions">
        <button className="primary-button" type="submit" disabled={save.pending}>
          Save
        </button>
        <button className="secondary-button" type="button" onClick={onDone}>
          Cancel
        </button>
      </div>
      <ErrorMessage error={save.error} />
    </form>
  );
}
