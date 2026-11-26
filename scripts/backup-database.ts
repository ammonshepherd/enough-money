/**
 * Backs up the production database before a merge: for each household, the
 * same JSON file that Manage → Backup makes (the `export_backup` SQL
 * function), saved in .backups/ (ignored by git) with the start of the
 * household's id in its name (v0.51.1; one household before). Only the files
 * of the 5 newest runs are kept.
 *
 * It runs on the database through the Supabase CLI's login (`supabase
 * login`), with no browser, app password or database password. Each export
 * acts as the household's owner (else a member) for that one statement,
 * because export_backup only exports for a member of the household. The CLI stays
 * linked to the test project: `--remote=<ref>` applies to this command only.
 * Supabase CLI 3 asks before any statement on a hosted project, and cannot
 * ask when an agent runs it; its `--read-only` mode may not call
 * export_backup. The statement below only reads, so `--yes` answers for it.
 *
 * Restore: Manage → Restore from a backup in an empty household, choosing
 * that household's file.
 * Run: npm run backup
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const PRODUCTION_REF = "lkaurrcarzzkbqdwqfge";
const KEEP = 5;
const root = join(import.meta.dirname, "..");
const dir = join(root, ".backups");

// Every household and the member to export it as (its owner when it has one).
const HOUSEHOLDS_SQL = `
select distinct on (m.household_id) m.household_id::text as id, m.user_id::text as user_id
from public.household_members m
order by m.household_id, m.role = 'owner' desc`;

// One statement per household: set_config makes the member the one asking
// for just this statement, then export_backup runs as them. (Several
// households in one statement would not reliably export each as its own
// member: Postgres may set every claim before running any export.)
const exportSql = (householdId: string, userId: string) => `
select public.export_backup(s.household_id) as backup
from (
  select '${householdId}'::uuid as household_id,
         set_config('request.jwt.claims',
                    json_build_object('sub', '${userId}', 'role', 'authenticated')::text,
                    true) as claims
) s`;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function query<Row>(sql: string): Row[] {
  const out = execFileSync(
    "npx",
    [
      "supabase",
      "db",
      "query",
      `--remote=${PRODUCTION_REF}`,
      "--yes",
      "--output-format",
      "json",
      sql,
    ],
    { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 100_000_000 },
  );
  const result = JSON.parse(out) as { rows?: Row[]; error?: { message?: string } };
  if (result.error) throw new Error(`The query failed: ${result.error.message ?? "unknown"}`);
  return result.rows ?? [];
}

/** Each household's backup, keyed by the household's id. */
function exportBackups(): Map<string, Record<string, unknown>> {
  const households = query<{ id: string; user_id: string }>(HOUSEHOLDS_SQL);
  if (households.length === 0) throw new Error("There is no household to back up.");
  const backups = new Map<string, Record<string, unknown>>();
  for (const { id, user_id } of households) {
    // Both come from the database, but are checked before going into SQL.
    if (!UUID.test(id) || !UUID.test(user_id)) throw new Error(`Unexpected id ${id}`);
    const backup = query<{ backup: Record<string, unknown> | null }>(exportSql(id, user_id))[0]
      ?.backup;
    if (!backup) throw new Error(`The export of household ${id} returned nothing.`);
    backups.set(id, backup);
  }
  return backups;
}

const pad = (n: number) => String(n).padStart(2, "0");
const now = new Date();
const stamp =
  `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
  `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

const { version } = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
  version: string;
};
mkdirSync(dir, { recursive: true });
// Every household is exported before any file is written, so a failure
// leaves no partial run behind.
const backups = exportBackups();
for (const [id, data] of backups) {
  // Like the app's export: the database's JSON plus the app version.
  const backup = { ...data, app_version: version };
  // The id's first part tells households apart (names stay out of file names).
  const name = `enough-money-backup-${stamp}-${id.slice(0, 8)}.json`;
  writeFileSync(join(dir, name), `${JSON.stringify(backup, null, 2)}\n`);
  // Counts only: the file holds the household's data.
  const counts = Object.entries(backup)
    .flatMap(([key, value]) => (Array.isArray(value) ? [`${value.length} ${key}`] : []))
    .join(", ");
  console.log(`Backed up to .backups/${name}: ${counts}`);
}

// Keep the files of the 5 newest runs. A file's run is the date and time in
// its name, which sorts oldest first; files from before the rename (v0.37.0)
// start with budget-buddy and sort first too.
const BACKUP_FILE = /^(?:enough-money|budget-buddy)-backup-(\d{4}-\d{2}-\d{2}-\d{6}).*\.json$/;
const files = readdirSync(dir).flatMap((f) => {
  const run = BACKUP_FILE.exec(f)?.[1];
  return run ? [{ f, run: `${f.startsWith("budget") ? 0 : 1}${run}` }] : [];
});
const kept = new Set([...new Set(files.map((x) => x.run))].sort().reverse().slice(0, KEEP));
for (const { f, run } of files) {
  if (kept.has(run)) continue;
  rmSync(join(dir, f));
  console.log(`Deleted old backup ${f}`);
}
