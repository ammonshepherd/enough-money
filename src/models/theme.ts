/**
 * Light or dark: the user's choice and the theme it gives. Like the layout
 * preferences, a per-device choice in localStorage (never in Supabase), one
 * key per user. The device also keeps the last choice used, which
 * `public/theme-boot.js` reads before the first paint (no user is known
 * yet), so a dark device never flashes light. Any storage failure or
 * unknown value means "system".
 */
import type { KeyValueStorage } from "./collapsedGroups";

export const THEME_CHOICES = ["system", "light", "dark"] as const;
export type ThemeChoice = (typeof THEME_CHOICES)[number];
export type Theme = "light" | "dark";

/** What each choice is called in Manage → Appearance. */
export const THEME_CHOICE_LABELS: Record<ThemeChoice, string> = {
  system: "Match system",
  light: "Light",
  dark: "Dark",
};

export const themeKey = (userId: string) => `bb.theme.mode.${userId}`;
/** The last choice on this device, whoever made it. theme-boot.js reads this key. */
export const DEVICE_THEME_KEY = "bb.theme.device";

/** The media query for a device set to dark. */
export const SYSTEM_DARK_QUERY = "(prefers-color-scheme: dark)";

const isChoice = (value: unknown): value is ThemeChoice =>
  THEME_CHOICES.includes(value as ThemeChoice);

/** This user's choice on this device; the device's last choice when they have none. */
export function loadThemeChoice(storage: KeyValueStorage | null, userId: string): ThemeChoice {
  try {
    const own = storage?.getItem(themeKey(userId));
    if (isChoice(own)) return own;
    const device = storage?.getItem(DEVICE_THEME_KEY);
    return isChoice(device) ? device : "system";
  } catch {
    return "system";
  }
}

/** Remembers the choice for this user and as the device's last. Failures are ignored. */
export function saveThemeChoice(
  storage: KeyValueStorage | null,
  userId: string,
  choice: ThemeChoice,
): void {
  try {
    storage?.setItem(themeKey(userId), choice);
    storage?.setItem(DEVICE_THEME_KEY, choice);
  } catch {
    // Not remembered; the choice still applies until the page reloads.
  }
}

/** The theme a choice gives, given whether the device is set to dark. */
export function resolveTheme(choice: ThemeChoice, systemDark: boolean): Theme {
  if (choice === "system") return systemDark ? "dark" : "light";
  return choice;
}
