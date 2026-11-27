/**
 * DataStore backed by Supabase. Row Level Security on every table limits
 * each user to their own household, so these queries need no household filter.
 */
import {
  createClient,
  FunctionsFetchError,
  FunctionsHttpError,
  type PostgrestError,
  type SupabaseClient,
} from "@supabase/supabase-js";
import { validateBackup, withFreshIds, type Backup } from "./backup";
import type { Database, Json } from "./database.types";
import { UserFacingError, type DataStore, type UserSession } from "./dataStore";
import { APP_VERSION } from "./appInfo";
import { EXPIRED_LINK, MIN_PASSWORD_LENGTH } from "./emailLink";
import {
  BAD_EMAIL,
  cleanDisplayName,
  EMAIL_TAKEN,
  SAME_PASSWORD,
  WRONG_PASSWORD,
} from "./signInDetails";
import { cleanFeedback } from "./feedback";
import { fetchAll } from "./fetchAll";
import { checkGoalDetails } from "./goals";
import { cleanPayeeName } from "./payees";
import { asTagColor, cleanTagDetails, duplicateTagMessage } from "./tags";
import { asImportFormat } from "./transactionImport";

type Client = SupabaseClient<Database>;

/** Turns database errors into messages a person can act on. */
function check(error: PostgrestError | null): void {
  if (!error) return;
  if (error.code === "23503") {
    throw new UserFacingError("It is still in use. Move or delete what uses it first.");
  }
  // Our SQL functions raise readable messages with these codes.
  if (["23514", "23505", "P0002", "22023", "42501"].includes(error.code)) {
    throw new UserFacingError(error.message);
  }
  throw new Error(`${error.message} (${error.code})`);
}

function toSession(
  user: { id: string; email?: string; user_metadata?: Record<string, unknown> } | null | undefined,
): UserSession | null {
  if (!user) return null;
  const name = user.user_metadata?.display_name;
  return {
    userId: user.id,
    email: user.email ?? "",
    displayName: typeof name === "string" ? name : "",
  };
}

export function createSupabaseStore(
  url = import.meta.env.VITE_SUPABASE_URL,
  key = import.meta.env.VITE_SUPABASE_ANON_KEY,
): DataStore {
  let client: Client | null = null;
  const db = (): Client => {
    if (!url || !key) {
      throw new UserFacingError(
        "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.",
      );
    }
    // PKCE puts the sign-in code in ?code=, leaving the #route hash alone.
    client ??= createClient<Database>(url, key, { auth: { flowType: "pkce" } });
    return client;
  };

  /** Signs in again with the current password: the check before a change. */
  const confirmPassword = async (password: string) => {
    const { data, error } = await db().auth.getSession();
    if (error) throw error;
    const email = data.session?.user.email;
    if (!email) throw new UserFacingError("Sign in first");
    const signIn = await db().auth.signInWithPassword({ email, password });
    if (!signIn.error) return;
    throw new UserFacingError(
      signIn.error.code === "invalid_credentials" ? WRONG_PASSWORD : signIn.error.message,
    );
  };

  return {
    async getSession() {
      const { data, error } = await db().auth.getSession();
      if (error) throw error;
      return toSession(data.session?.user);
    },

    onSessionChange(callback) {
      const { data } = db().auth.onAuthStateChange((_event, session) =>
        callback(toSession(session?.user)),
      );
      return () => data.subscription.unsubscribe();
    },

    async signIn(email, password) {
      const { error } = await db().auth.signInWithPassword({ email, password });
      if (error) throw new UserFacingError(error.message);
    },

    async signOut() {
      const { error } = await db().auth.signOut();
      if (error) throw error;
    },

    async verifyEmailLink({ tokenHash, type }) {
      const { data, error } = await db().auth.verifyOtp({ token_hash: tokenHash, type });
      if (error) {
        // Supabase gives only "invalid or has expired" (or a rate limit) here.
        throw new UserFacingError(error.status === 429 ? error.message : EXPIRED_LINK);
      }
      // The first of a Change email address email's two links answers with
      // no session (and no user): the email changes after the second.
      if (type === "email_change" && !data.session) return null;
      const session = toSession(data.user);
      if (!session) throw new UserFacingError(EXPIRED_LINK);
      return session;
    },

    async setPassword(password) {
      if (password.length < MIN_PASSWORD_LENGTH) {
        throw new UserFacingError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
      }
      const { error } = await db().auth.updateUser({ password });
      if (error) throw new UserFacingError(error.message);
    },

    async changePassword(currentPassword, newPassword) {
      if (newPassword.length < MIN_PASSWORD_LENGTH) {
        throw new UserFacingError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
      }
      await confirmPassword(currentPassword);
      const { error } = await db().auth.updateUser({ password: newPassword });
      if (error) {
        throw new UserFacingError(error.code === "same_password" ? SAME_PASSWORD : error.message);
      }
      // Anyone signed in elsewhere with the old password is signed out there.
      await db().auth.signOut({ scope: "others" });
    },

    async changeEmail(currentPassword, newEmail) {
      await confirmPassword(currentPassword);
      // Supabase Auth keeps one account per email and refuses one in use.
      // The confirmation emails link to the Site URL (their template).
      const { error } = await db().auth.updateUser({ email: newEmail });
      if (!error) return;
      if (error.code === "email_exists" || error.code === "user_already_exists") {
        throw new UserFacingError(EMAIL_TAKEN);
      }
      if (error.code === "email_address_invalid") throw new UserFacingError(BAD_EMAIL);
      throw new UserFacingError(error.message);
    },

    async setDisplayName(name) {
      // Kept in Supabase Auth's user metadata, which the user may edit
      // themselves: it is only ever shown back to them, as text.
      const { error } = await db().auth.updateUser({
        data: { display_name: cleanDisplayName(name) },
      });
      if (error) throw new UserFacingError(error.message);
    },

    async sendPasswordReset(email) {
      // The email's link goes to the Site URL (its template; see emailLink.ts).
      const { error } = await db().auth.resetPasswordForEmail(email);
      if (error) throw new UserFacingError(error.message);
    },

    async load() {
      const household = await db().from("households").select("id, name").maybeSingle();
      check(household.error);
      if (!household.data) return null;

      // Each query is paged, so each ends its order on a unique key: rows
      // tied on the earlier columns then keep their place between pages.
      const exact = { count: "exact" } as const;
      const [accounts, groups, envelopes, months, transactions, rules, tags, goals, payees] =
        await Promise.all([
          fetchAll(
            (from, to) =>
              db()
                .from("accounts")
                .select("*", exact)
                .order("created_at")
                .order("id")
                .range(from, to),
            check,
          ),
          fetchAll(
            (from, to) =>
              db().from("category_groups").select("*", exact).order("id").range(from, to),
            check,
          ),
          fetchAll(
            (from, to) => db().from("categories").select("*", exact).order("id").range(from, to),
            check,
          ),
          fetchAll(
            (from, to) =>
              db()
                .from("category_months")
                .select("*", exact)
                .order("category_id")
                .order("month")
                .range(from, to),
            check,
          ),
          fetchAll(
            (from, to) =>
              db()
                .from("transactions")
                .select(
                  "*, transaction_allocations(category_id, amount), transaction_tags(tag_id)",
                  exact,
                )
                .order("date", { ascending: false })
                .order("created_at", { ascending: false })
                .order("id", { ascending: false })
                .range(from, to),
            check,
          ),
          fetchAll(
            (from, to) =>
              db()
                .from("income_rules")
                .select("id, pattern, account_id", exact)
                .order("created_at")
                .order("id")
                .range(from, to),
            check,
          ),
          fetchAll(
            (from, to) =>
              db().from("tags").select("id, name, color", exact).order("id").range(from, to),
            check,
          ),
          fetchAll(
            (from, to) =>
              db()
                .from("envelope_goals")
                .select("id, category_id, amount, goal_date, archived_at", exact)
                .order("id")
                .range(from, to),
            check,
          ),
          fetchAll(
            (from, to) => db().from("payees").select("id, name", exact).order("id").range(from, to),
            check,
          ),
        ]);

      return {
        household: household.data,
        incomeRules: rules.map((r) => ({
          id: r.id,
          pattern: r.pattern,
          accountId: r.account_id,
        })),
        accounts: accounts.map((a) => ({
          id: a.id,
          name: a.name,
          type: a.type === "credit_card" ? "credit_card" : "checking",
          openingBalance: a.opening_balance,
          openingDate: a.opening_date,
          onBudget: a.on_budget,
          closedAt: a.closed_at,
          importFormat: asImportFormat(a.import_format),
        })),
        groups: groups.map((g) => ({ id: g.id, name: g.name, position: g.position })),
        envelopes: envelopes.map((c) => ({
          id: c.id,
          groupId: c.group_id,
          name: c.name,
          position: c.position,
          cardAccountId: c.card_account_id,
        })),
        envelopeMonths: months.map((m) => ({
          envelopeId: m.category_id,
          month: m.month,
          assigned: m.assigned,
          released: m.released,
          planned: m.planned,
        })),
        transactions: transactions.map((t) => ({
          id: t.id,
          accountId: t.account_id,
          date: t.date,
          amount: t.amount,
          payee: t.payee,
          memo: t.memo,
          isTransfer: t.is_transfer,
          isIncome: t.is_income,
          transferId: t.transfer_id,
          voided: t.voided,
          allocations: t.transaction_allocations.map((a) => ({
            envelopeId: a.category_id,
            amount: a.amount,
          })),
          importKey: t.import_key,
          reconciled: t.reconciled,
          tagIds: t.transaction_tags.map((x) => x.tag_id),
        })),
        tags: tags.map((g) => ({ id: g.id, name: g.name, color: asTagColor(g.color) })),
        goals: goals.map((g) => ({
          id: g.id,
          envelopeId: g.category_id,
          amount: g.amount,
          date: g.goal_date,
          archivedAt: g.archived_at,
        })),
        payees: payees.map((p) => ({ id: p.id, name: p.name })),
      };
    },

    async createHousehold(name) {
      check((await db().rpc("create_household", { p_name: name })).error);
    },

    async renameHousehold(householdId, name) {
      const { data, error } = await db()
        .from("households")
        .update({ name })
        .eq("id", householdId)
        .select("id");
      check(error);
      if (!data?.length) throw new UserFacingError("Household not found");
    },

    async addAccount(householdId, account) {
      const { error } = await db()
        .from("accounts")
        .insert({
          household_id: householdId,
          name: account.name,
          type: account.type,
          on_budget: account.onBudget ?? true,
          opening_balance: account.openingBalance,
          opening_date: account.openingDate,
        });
      check(error);
    },

    async updateAccount(accountId, account) {
      const { data, error } = await db()
        .from("accounts")
        .update({
          name: account.name,
          opening_balance: account.openingBalance,
          opening_date: account.openingDate,
        })
        .eq("id", accountId)
        .select("id");
      check(error);
      // Row Level Security hides other households' accounts: no row, no update.
      if (!data?.length) throw new UserFacingError("Account not found");
    },

    async closeAccount(accountId) {
      const { error } = await db()
        .from("accounts")
        .update({ closed_at: new Date().toISOString() })
        .eq("id", accountId);
      check(error);
    },

    async addGroup(householdId, name, position) {
      check(
        (await db().from("category_groups").insert({ household_id: householdId, name, position }))
          .error,
      );
    },

    async addEnvelope(householdId, groupId, name, position) {
      const { error } = await db()
        .from("categories")
        .insert({ household_id: householdId, group_id: groupId, name, position });
      check(error);
    },

    async deleteEnvelope(envelopeId) {
      check((await db().from("categories").delete().eq("id", envelopeId)).error);
    },

    async deleteGroup(groupId) {
      check((await db().from("category_groups").delete().eq("id", groupId)).error);
    },

    async renameGroup(groupId, name) {
      const { data, error } = await db()
        .from("category_groups")
        .update({ name })
        .eq("id", groupId)
        .select("id");
      check(error);
      if (!data?.length) throw new UserFacingError("Group not found");
    },

    async renameEnvelope(envelopeId, name) {
      const { data, error } = await db()
        .from("categories")
        .update({ name })
        .eq("id", envelopeId)
        .select("id");
      check(error);
      if (!data?.length) throw new UserFacingError("Envelope not found");
    },

    async moveEnvelope(envelopeId, groupId, position) {
      const { data, error } = await db()
        .from("categories")
        .update({ group_id: groupId, position })
        .eq("id", envelopeId)
        .select("id");
      check(error);
      if (!data?.length) throw new UserFacingError("Envelope not found");
    },

    async reorderGroups(householdId, groupIds) {
      const { error } = await db().rpc("reorder_category_groups", {
        p_household_id: householdId,
        p_group_ids: groupIds,
      });
      check(error);
    },

    async reorderEnvelopes(groupId, envelopeIds) {
      const { error } = await db().rpc("reorder_categories", {
        p_group_id: groupId,
        p_category_ids: envelopeIds,
      });
      check(error);
    },

    async adjustEnvelopeMonth(envelopeId, month, change) {
      const { error } = await db().rpc("adjust_category_month", {
        p_category_id: envelopeId,
        p_month: month,
        p_assigned_delta: change.assigned ?? 0,
        p_released_delta: change.released ?? 0,
      });
      check(error);
    },

    async moveBetweenEnvelopes(fromId, toId, month, amount) {
      const { error } = await db().rpc("move_between_envelopes", {
        p_from_category_id: fromId,
        p_to_category_id: toId,
        p_month: month,
        p_amount: amount,
      });
      check(error);
    },

    async setPlanned(householdId, envelopeId, month, planned) {
      const { error } = await db()
        .from("category_months")
        .upsert(
          { household_id: householdId, category_id: envelopeId, month, planned },
          { onConflict: "category_id,month" },
        );
      check(error);
    },

    async setPlannedAmounts(householdId, month, rows) {
      if (rows.length === 0) return;
      // One upsert is one statement, so every row is saved or none is.
      const { error } = await db()
        .from("category_months")
        .upsert(
          rows.map(({ envelopeId, planned }) => ({
            household_id: householdId,
            category_id: envelopeId,
            month,
            planned,
          })),
          { onConflict: "category_id,month" },
        );
      check(error);
    },

    async importEnvelopePlan(householdId, month, rows) {
      const { error } = await db().rpc("import_envelope_plan", {
        p_household_id: householdId,
        p_month: month,
        p_rows: rows.map(({ group, envelope, planned }) => ({ group, envelope, planned })),
      });
      check(error);
    },

    async saveTransaction(_householdId, input) {
      const { error } = await db().rpc("save_transaction", {
        // The generated types mark SQL arguments as non-null, but p_id
        // accepts null (create).
        p_id: input.id ?? (null as unknown as string),
        p_allocations: input.allocations.map((a) => ({
          category_id: a.envelopeId,
          amount: a.amount,
        })),
        p_account_id: input.accountId,
        p_date: input.date,
        p_amount: input.amount,
        p_payee: input.payee,
        p_memo: input.memo,
        p_is_transfer: false,
        p_is_income: input.isIncome,
        // Omitted (undefined) = keep the transaction's tags.
        p_tag_ids: input.tagIds,
        // Omitted = keep its reconciled mark (not reconciled when new).
        p_reconciled: input.reconciled,
      });
      check(error);
    },

    async setGoal(householdId, envelopeId, goal) {
      const { amount, date } = checkGoalDetails(goal);
      const active = await db()
        .from("envelope_goals")
        .select("id")
        .eq("category_id", envelopeId)
        .is("archived_at", null)
        .maybeSingle();
      check(active.error);
      if (active.data) {
        check(
          (
            await db()
              .from("envelope_goals")
              .update({ amount, goal_date: date })
              .eq("id", active.data.id)
          ).error,
        );
      } else {
        check(
          (
            await db().from("envelope_goals").insert({
              household_id: householdId,
              category_id: envelopeId,
              amount,
              goal_date: date,
            })
          ).error,
        );
      }
    },

    async archiveGoal(goalId) {
      const { data, error } = await db()
        .from("envelope_goals")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", goalId)
        .is("archived_at", null)
        .select("id");
      check(error);
      if (!data?.length) throw new UserFacingError("Goal not found");
    },

    async deleteGoal(goalId) {
      check((await db().from("envelope_goals").delete().eq("id", goalId)).error);
    },

    async addTag(householdId, tag) {
      const { name, color } = cleanTagDetails(tag);
      const { data, error } = await db()
        .from("tags")
        .insert({ household_id: householdId, name, color })
        .select("id")
        .single();
      if (error?.code === "23505") throw new UserFacingError(duplicateTagMessage(name));
      check(error);
      return data!.id;
    },

    async updateTag(tagId, tag) {
      const { name, color } = cleanTagDetails(tag);
      const { data, error } = await db()
        .from("tags")
        .update({ name, color })
        .eq("id", tagId)
        .select("id");
      if (error?.code === "23505") throw new UserFacingError(duplicateTagMessage(name));
      check(error);
      if (!data?.length) throw new UserFacingError("Tag not found");
    },

    async renamePayee(payeeId, name) {
      const { error } = await db().rpc("rename_payee", {
        p_id: payeeId,
        p_name: cleanPayeeName(name),
      });
      check(error);
    },

    async deletePayee(payeeId) {
      check((await db().from("payees").delete().eq("id", payeeId)).error);
    },

    async deleteTag(tagId) {
      check((await db().from("tags").delete().eq("id", tagId)).error);
    },

    async tagTransactions(transactionIds, tagId, on) {
      const { data, error } = await db().rpc("tag_transactions", {
        p_ids: transactionIds,
        p_tag_id: tagId,
        p_on: on,
      });
      check(error);
      return data ?? 0;
    },

    async addIncomeRule(householdId, rule) {
      const { error } = await db()
        .from("income_rules")
        .insert({ household_id: householdId, pattern: rule.pattern, account_id: rule.accountId });
      check(error);
    },

    async deleteIncomeRule(ruleId) {
      check((await db().from("income_rules").delete().eq("id", ruleId)).error);
    },

    async markIncome(transactionIds) {
      const { data, error } = await db().rpc("mark_income", { p_ids: transactionIds });
      check(error);
      return data ?? 0;
    },

    async setReconciled(transactionIds, reconciled) {
      const { data, error } = await db().rpc("set_reconciled", {
        p_ids: transactionIds,
        p_reconciled: reconciled,
      });
      check(error);
      return data ?? 0;
    },

    async saveTransfer(input) {
      const { error } = await db().rpc("save_transfer", {
        // null = a new transfer (the generated types mark it non-null).
        p_transfer_id: input.transferId ?? (null as unknown as string),
        p_legs: input.sides.map((side) => ({
          id: side.id ?? null,
          account_id: side.accountId,
          date: side.date,
          amount: side.amount,
          payee: side.payee,
          memo: side.memo,
          // Left out = keep this side's tags.
          ...(side.tagIds ? { tag_ids: side.tagIds } : {}),
          // Left out = keep this side's reconciled mark.
          ...(side.reconciled === undefined ? {} : { reconciled: side.reconciled }),
        })),
      });
      check(error);
    },

    async importTransactions(accountId, format, rows) {
      const { data, error } = await db().rpc("import_transactions", {
        p_account_id: accountId,
        p_format: format as unknown as Json,
        p_rows: rows.map((r) => ({
          date: r.date,
          amount: r.amount,
          payee: r.payee,
          memo: r.memo,
          import_key: r.importKey,
          is_income: r.isIncome,
          match_id: r.matchId,
        })),
      });
      check(error);
      return data ?? 0;
    },

    async deleteTransaction(transactionId) {
      check((await db().from("transactions").delete().eq("id", transactionId)).error);
    },
    async deleteTransactions(transactionIds) {
      const { data, error } = await db().rpc("delete_transactions", { p_ids: transactionIds });
      check(error);
      return data ?? 0;
    },
    async moveTransactions(transactionIds, accountId) {
      const { data, error } = await db().rpc("move_transactions", {
        p_ids: transactionIds,
        p_account_id: accountId,
      });
      check(error);
      return data ?? 0;
    },
    async redateTransactions(transactionIds, date) {
      const { data, error } = await db().rpc("redate_transactions", {
        p_ids: transactionIds,
        p_date: date,
      });
      check(error);
      return data ?? 0;
    },

    async exportBackup(householdId) {
      const { data, error } = await db().rpc("export_backup", { p_household_id: householdId });
      check(error);
      // Not checked here: saving the data must never be blocked. The file is
      // checked when it is chosen for a restore.
      return { ...(data as unknown as Backup), app_version: APP_VERSION };
    },

    async restoreBackup(householdId, backup) {
      const { error } = await db().rpc("restore_backup", {
        p_household_id: householdId,
        p_backup: withFreshIds(validateBackup(backup)) as unknown as Json,
      });
      check(error);
    },

    async sendFeedback(message) {
      const { error } = await db().functions.invoke("send-feedback", {
        body: { message: cleanFeedback(message) },
      });
      if (!error) return;
      if (error instanceof FunctionsHttpError) {
        // The function answers with { error: "…" }, written for people.
        const body = (await (error.context as Response).json().catch(() => null)) as {
          error?: unknown;
        } | null;
        if (typeof body?.error === "string") throw new UserFacingError(body.error);
      }
      if (error instanceof FunctionsFetchError) {
        throw new UserFacingError(
          "Your feedback couldn't be sent. Check your connection and try again.",
        );
      }
      throw error;
    },
  };
}
