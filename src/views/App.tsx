import { Fragment, useState, type JSX, type ReactNode } from "react";
import { useAppUpdate } from "../controllers/useAppUpdate";
import { useBudget } from "../controllers/useBudget";
import { useHashRoute } from "../controllers/useHashRoute";
import { useInstallPrompt } from "../controllers/useInstallPrompt";
import { useEmailLink } from "../controllers/useEmailLink";
import { useDesktop, useSidebar } from "../controllers/useLayout";
import { useSession } from "../controllers/useSession";
import { ThemeContext, useTheme } from "../controllers/useTheme";
import { sidebarAccounts } from "../models/accounts";
import { formatCents } from "../models/money";
import { APP_VERSION } from "../models/appInfo";
import type { UserSession } from "../models/dataStore";
import type { BudgetData } from "../models/types";
import { currentMonth, type Month } from "../models/month";
import {
  accountsHref,
  ROUTE_TITLES,
  ROUTES,
  routeHref,
  manageHref,
  manageSection,
  type AccountsView,
  type Route,
} from "../models/routes";
import { store } from "../models/store";
import { CreateHouseholdPage } from "./CreateHouseholdPage";
import { ErrorMessage } from "./components";
import { AccountsIcon, BudgetIcon, ChevronLeftIcon, InstallIcon, ManageIcon } from "./icons";
import { AccountsPage } from "./pages/AccountsPage";
import { BudgetPage } from "./pages/BudgetPage";
import { ManagePage } from "./pages/ManagePage";
import { SetPasswordPage } from "./SetPasswordPage";
import { SignInPage } from "./SignInPage";
import { MenuSlotProvider } from "./PageMenu";
import { AddTransactionButton } from "./TransactionEntry";
import { UpdateBanner } from "./UpdateBanner";

/** Pages with the Add transaction button. */
const QUICK_ADD: Route[] = ["budget", "accounts"];

const NAV_ICONS: Record<Route, () => JSX.Element> = {
  budget: BudgetIcon,
  accounts: AccountsIcon,
  manage: ManageIcon,
};

type Install = (() => Promise<void>) | null;

/**
 * The app frame: header, then sign-in, household setup, or the budget itself.
 * Signed in on a wide window (desktop), a sidebar takes the header's place.
 * On a phone the header's top right holds the page's menu (see PageMenu);
 * the version is on Manage.
 */
export function App() {
  const session = useSession(store);
  const emailLink = useEmailLink(
    store,
    session.status === "signedIn" ? session.session.userId : null,
  );
  const { install } = useInstallPrompt();
  const update = useAppUpdate();
  // The budget itself shows only once the email link (if any) is dealt with.
  const inBudget =
    session.status === "signedIn" &&
    emailLink.state.status !== "checking" &&
    !emailLink.passwordNeeded;
  const desktop = useDesktop() && inBudget;
  // The header's spot for the page menu (a state, so pages re-render once it exists).
  const [menuSlot, setMenuSlot] = useState<HTMLElement | null>(null);

  return (
    <MenuSlotProvider value={menuSlot}>
      <div className={desktop ? "app-shell desktop" : "app-shell"}>
        {update.ready && <UpdateBanner onRefresh={update.refresh} onDismiss={update.dismiss} />}
        {emailLink.state.status === "confirmed" && (
          // After a Change email address link, signed in or not.
          <div className="update-banner" role="status">
            <p>{emailLink.state.message}</p>
            <div className="update-banner-actions">
              <button className="update-refresh" type="button" onClick={emailLink.dismiss}>
                OK
              </button>
            </div>
          </div>
        )}
        {!desktop && (
          <header className="app-header">
            <Brand />
            <div className="header-actions">
              {install && (
                <button
                  className="icon-button"
                  type="button"
                  aria-label="Install Enough Money"
                  onClick={install}
                >
                  <InstallIcon />
                </button>
              )}
              <div className="page-menu-slot" ref={setMenuSlot} />
            </div>
          </header>
        )}

        {emailLink.state.status === "checking" ? (
          <Message text="Checking your link..." />
        ) : (
          session.status === "loading" && <Message text="Loading Enough Money..." />
        )}
        {session.status === "error" && <Message error={session.error} />}
        {session.status === "signedOut" && emailLink.state.status !== "checking" && (
          <main className="page-content">
            <SignInPage
              onSignIn={emailLink.signIn}
              onSendReset={store.sendPasswordReset}
              linkError={emailLink.state.status === "failed" ? emailLink.state.error : null}
            />
          </main>
        )}
        {session.status === "signedIn" && emailLink.passwordNeeded && (
          // Before anything else, someone who came by an email's link sets a password.
          <main className="page-content">
            <SetPasswordPage
              kind={emailLink.passwordNeeded}
              email={session.session.email}
              onSave={emailLink.setPassword}
              onSignOut={store.signOut}
            />
          </main>
        )}
        {inBudget && session.status === "signedIn" && (
          // key: a different user gets a fresh budget, never the previous one's.
          <SignedInApp
            key={session.session.userId}
            session={session.session}
            desktop={desktop}
            install={install}
          />
        )}
      </div>
    </MenuSlotProvider>
  );
}

function Brand() {
  return (
    <a className="brand" href="#budget" aria-label="Enough Money home">
      <img src={`${import.meta.env.BASE_URL}icons/icon.svg`} alt="" width="36" height="36" />
      <span>Enough Money</span>
    </a>
  );
}

function SignedInApp({
  session,
  desktop,
  install,
}: {
  session: UserSession;
  desktop: boolean;
  install: Install;
}) {
  const budget = useBudget(store);
  const location = useHashRoute();
  const theme = useTheme(session.userId);
  const { state } = budget;
  // The month last shown on Budget or Accounts, so moving between pages keeps
  // it. (Updating state while rendering is React's way to follow a prop.)
  const [lastMonth, setLastMonth] = useState<Month | null>(null);
  if (location.month && location.month !== lastMonth) setLastMonth(location.month);
  const month = location.month ?? lastMonth ?? currentMonth();
  const data = state.status === "ready" ? state.data : null;
  /** What Accounts has open: All accounts, an account, or nothing (also on other pages). */
  const opened = location.route === "accounts" ? location.account : null;
  const manageOpen = location.route === "manage" ? manageSection(window.location.hash) : null;
  const feedbackOpen = manageOpen === "feedback";

  // The Add transaction button: round and floating on a phone. Not on
  // Manage. On a desktop it heads the panel on the right (each page's own).
  const add =
    !desktop && data && QUICK_ADD.includes(location.route) ? (
      <AddTransactionButton
        budget={budget}
        data={data}
        accountId={opened === "all" ? null : opened}
      />
    ) : null;
  const nav = (
    <Navigation
      route={location.route}
      month={month}
      desktop={desktop}
      userId={session.userId}
      data={data}
      opened={opened}
    >
      {desktop && (
        <SidebarFoot
          install={install}
          household={data?.household.name ?? null}
          email={session.email}
        />
      )}
    </Navigation>
  );
  const frame = (content: JSX.Element) => (
    <ThemeContext.Provider value={theme}>
      {desktop && nav}
      <main className="page-content" aria-live="polite">
        {content}
        {/* Every page ends with it once there is a budget (the form is a Manage page). */}
        {data && (
          <footer className="page-footer">
            <a href={manageHref("feedback")} aria-current={feedbackOpen ? "page" : undefined}>
              Give Feedback
            </a>
          </footer>
        )}
      </main>
      {add}
      {/* The bottom bar only once there is a budget to move around in. */}
      {!desktop && data && nav}
    </ThemeContext.Provider>
  );

  if (state.status === "loading") {
    return frame(<p className="loading-message">Loading your budget...</p>);
  }
  if (state.status === "error") return frame(<ErrorMessage error={state.error} />);
  if (!data) return frame(<CreateHouseholdPage onCreate={budget.createHousehold} />);

  const pages: Record<Route, JSX.Element> = {
    // key: each month starts fresh (unused envelopes hidden, rows closed).
    budget: (
      <BudgetPage
        key={month}
        budget={budget}
        data={data}
        month={month}
        userId={session.userId}
        desktop={desktop}
      />
    ),
    accounts: (
      <AccountsPage
        budget={budget}
        data={data}
        month={month}
        open={opened}
        userId={session.userId}
        desktop={desktop}
      />
    ),
    manage: (
      <ManagePage
        budget={budget}
        data={data}
        email={session.email}
        onSignOut={store.signOut}
        desktop={desktop}
        section={manageOpen}
      />
    ),
  };

  return frame(pages[location.route]);
}

/**
 * The pages: a bottom bar on a phone; on a desktop, a sidebar on the left
 * (brand, pages, then `children` at the bottom) that collapses to icons.
 * On a desktop, Accounts lists every open account under it.
 */
function Navigation({
  route,
  month,
  desktop,
  userId,
  data,
  opened,
  children,
}: {
  route: Route;
  month: Month;
  desktop: boolean;
  userId: string;
  /** Desktop only: the accounts listed under Accounts (none before there is a budget), and which one is open. */
  data: BudgetData | null;
  opened: AccountsView;
  /** Desktop only: the sidebar's foot. */
  children?: ReactNode;
}) {
  const sidebar = useSidebar("nav", userId);
  const links = ROUTES.map((name) => {
    const NavIcon = NAV_ICONS[name];
    const active = name === route;
    const link = (
      <a
        href={routeHref(name, month)}
        className={active ? "active" : undefined}
        aria-current={active ? "page" : undefined}
        title={desktop && sidebar.collapsed ? ROUTE_TITLES[name] : undefined}
      >
        <NavIcon />
        <span className="nav-label">{ROUTE_TITLES[name]}</span>
      </a>
    );
    return (
      <Fragment key={name}>
        {link}
        {desktop && name === "accounts" && data && (
          <SidebarAccounts data={data} opened={opened} month={month} />
        )}
      </Fragment>
    );
  });

  if (!desktop) {
    return (
      <nav className="bottom-nav" aria-label="Primary navigation">
        {links}
      </nav>
    );
  }
  return (
    <aside className={sidebar.collapsed ? "sidebar collapsed" : "sidebar"} aria-label="Sidebar">
      <div className="sidebar-brand">
        <Brand />
        <span className="app-version" aria-label="Application version">
          v{APP_VERSION}
        </span>
      </div>
      <nav className="sidebar-nav" aria-label="Primary navigation">
        {links}
      </nav>
      {children}
      <button
        className="sidebar-toggle"
        type="button"
        aria-expanded={!sidebar.collapsed}
        aria-label={sidebar.collapsed ? "Expand sidebar" : "Collapse sidebar"}
        title={sidebar.collapsed ? "Expand sidebar" : "Collapse sidebar"}
        onClick={sidebar.toggle}
      >
        <ChevronLeftIcon />
        <span className="nav-label">Collapse</span>
      </button>
    </aside>
  );
}

/**
 * The desktop sidebar's sub-menu under Accounts: All accounts and the open
 * budget accounts, then a gap and the tracking accounts, each with its
 * balance. Hidden while the sidebar shows icons only.
 */
function SidebarAccounts({
  data,
  opened,
  month,
}: {
  data: BudgetData;
  opened: AccountsView;
  month: Month;
}) {
  const { budget, tracking } = sidebarAccounts(data);
  if (budget.length + tracking.length === 0) return null;
  const item = (view: "all" | string, label: string, balance?: number) => {
    const active = opened === view;
    const shown = balance === undefined ? null : formatCents(balance);
    return (
      <li key={view}>
        <a
          href={accountsHref(view, month)}
          className={active ? "active" : undefined}
          aria-current={active ? "true" : undefined}
          title={shown ? `${label}: ${shown}` : label}
          aria-label={shown ? `${label}, balance ${shown}` : undefined}
        >
          <span className="sidebar-account-name">{label}</span>
          {shown && (
            <span
              className={
                balance! < 0 ? "sidebar-account-balance negative" : "sidebar-account-balance"
              }
            >
              {shown}
            </span>
          )}
        </a>
      </li>
    );
  };
  return (
    <div className="sidebar-accounts">
      <ul aria-label="Budget accounts">
        {item("all", "All accounts")}
        {budget.map((a) => item(a.id, a.name, a.balance))}
      </ul>
      {tracking.length > 0 && (
        <ul className="sidebar-tracking" aria-label="Tracking accounts">
          {tracking.map((a) => item(a.id, a.name, a.balance))}
        </ul>
      )}
    </div>
  );
}

/** The bottom of the desktop sidebar: Install (when offered) and who is signed in. */
function SidebarFoot({
  install,
  household,
  email,
}: {
  install: Install;
  household: string | null;
  email: string;
}) {
  return (
    <div className="sidebar-foot">
      {install && (
        <button
          className="sidebar-install"
          type="button"
          aria-label="Install Enough Money"
          title="Install Enough Money"
          onClick={install}
        >
          <InstallIcon />
          <span className="nav-label">Install app</span>
        </button>
      )}
      <p className="sidebar-household nav-label">
        {household && <strong>{household}</strong>}
        <span>{email}</span>
      </p>
    </div>
  );
}

function Message({ text, error }: { text?: string; error?: string }) {
  return (
    <main className="page-content">
      {text && <p className="loading-message">{text}</p>}
      <ErrorMessage error={error ?? null} />
    </main>
  );
}
