/** Where the app lives since v0.39.0 (the home page took its place at /). */
export const APP_PATH = "/app/";

/**
 * Where a visit to the home page should go instead, or null to stay.
 * Goes to the app when it was opened as an installed app (home screen icon
 * from before v0.39.0) or when the URL carries an app page in its hash
 * (an old link or bookmark such as "/#budget/2026-10"). The hash is kept.
 */
export function appRedirect({
  hash,
  standalone,
}: {
  hash: string;
  standalone: boolean;
}): string | null {
  const page = hash.replace(/^#/, "");
  if (page) return `${APP_PATH}#${page}`;
  return standalone ? APP_PATH : null;
}
