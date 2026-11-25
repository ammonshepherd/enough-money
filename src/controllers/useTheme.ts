import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { browserStorage } from "../models/collapsedGroups";
import {
  loadThemeChoice,
  resolveTheme,
  saveThemeChoice,
  SYSTEM_DARK_QUERY,
  type Theme,
  type ThemeChoice,
} from "../models/theme";
import {
  loadThemeColour,
  saveThemeColour,
  themeColours,
  type Hex,
  type ThemeColours,
} from "../models/themeColour";

const systemDark = () =>
  typeof window.matchMedia === "function" && window.matchMedia(SYSTEM_DARK_QUERY).matches;

/**
 * Applies the signed-in user's light or dark choice and theme colour to the
 * page, and keeps "Match system" following the device. The theme is
 * `data-theme` on <html> (styles/01-tokens.css); a theme colour sets the
 * recoloured variables on <html> for that theme; the phone's browser bar
 * takes the theme's --browser-bar colour.
 */
export function useTheme(userId: string) {
  const [choice, setChoice] = useState<ThemeChoice>(() =>
    loadThemeChoice(browserStorage(), userId),
  );
  const [colour, setColour] = useState<Hex>(() => loadThemeColour(browserStorage(), userId));
  const [dark, setDark] = useState(systemDark);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia(SYSTEM_DARK_QUERY);
    const onChange = () => setDark(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const theme: Theme = resolveTheme(choice, dark);
  const colours = useMemo(() => themeColours(colour), [colour]);
  useEffect(() => applyTheme(theme, colours), [theme, colours]);

  return {
    choice,
    theme,
    colour,
    colours,
    choose: (next: ThemeChoice) => {
      setChoice(next);
      saveThemeChoice(browserStorage(), userId, next);
    },
    chooseColour: (next: Hex) => {
      setColour(next);
      saveThemeColour(browserStorage(), userId, next, themeColours(next).vars);
    },
  };
}

/** Sets the page's theme, its colour variables and the browser bar to match. */
function applyTheme(theme: Theme, colours: ThemeColours) {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  // Clear the last colour's variables (theme-boot.js's included), then set this one's.
  for (const name of [...root.style]) if (name.startsWith("--")) root.style.removeProperty(name);
  for (const [name, value] of Object.entries(colours.vars[theme])) {
    root.style.setProperty(name, value);
  }
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
