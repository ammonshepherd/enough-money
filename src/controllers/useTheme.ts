import { createContext, useContext, useEffect, useState } from "react";
import { browserStorage } from "../models/collapsedGroups";
import {
  loadThemeChoice,
  resolveTheme,
  saveThemeChoice,
  SYSTEM_DARK_QUERY,
  type Theme,
  type ThemeChoice,
} from "../models/theme";

const systemDark = () =>
  typeof window.matchMedia === "function" && window.matchMedia(SYSTEM_DARK_QUERY).matches;

/**
 * Applies the signed-in user's light or dark choice to the page and keeps
 * "Match system" following the device. The theme is `data-theme` on <html>
 * (styles/01-tokens.css), and the phone's browser bar takes the theme's
 * --browser-bar colour.
 */
export function useTheme(userId: string) {
  const [choice, setChoice] = useState<ThemeChoice>(() =>
    loadThemeChoice(browserStorage(), userId),
  );
  const [dark, setDark] = useState(systemDark);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia(SYSTEM_DARK_QUERY);
    const onChange = () => setDark(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const theme: Theme = resolveTheme(choice, dark);
  useEffect(() => applyTheme(theme), [theme]);

  return {
    choice,
    theme,
    choose: (next: ThemeChoice) => {
      setChoice(next);
      saveThemeChoice(browserStorage(), userId, next);
    },
  };
}

/** Sets the page's theme and the browser bar to match it. */
function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  const bar = getComputedStyle(root).getPropertyValue("--browser-bar").trim();
  const meta = document.querySelector('meta[name="theme-color"]');
  if (bar && meta) meta.setAttribute("content", bar);
}

export type ThemeControl = ReturnType<typeof useTheme>;

/** The theme control, for Manage → Appearance (provided by the signed-in app). */
export const ThemeContext = createContext<ThemeControl | null>(null);

export function useThemeControl(): ThemeControl {
  const control = useContext(ThemeContext);
  if (!control) throw new Error("useThemeControl needs a ThemeContext provider");
  return control;
}
