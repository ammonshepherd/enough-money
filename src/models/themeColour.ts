/**
 * Theme colours (display only): one colour in place of the brand purple.
 *
 * Every colour variable that carries the purple (the brand family, the
 * purple-tinged surfaces, lines and text) is recoloured from the designed
 * purple palette in styles/01-tokens.css: its hue turns by as much as the
 * picked colour's differs from purple, its saturation scales with the picked colour's, and its
 * lightness is solved so its luminance (how bright it looks) stays what the
 * designer chose. So every contrast in the palette holds for any hue; HSL
 * lightness alone would make greens and yellows far too bright.
 *
 * The brand colour itself is the picked colour, darkened only as far as
 * white text on it and it on its tint need to read (WCAG AA, 4.5:1). Light
 * and dark get their own sets. The default purple applies nothing: the CSS
 * already is that palette. Meaning colours (income, spend, card, tags...)
 * never change. Choices are kept per device and user, like light or dark.
 */
import type { KeyValueStorage } from "./collapsedGroups";
import type { Theme } from "./theme";

export type Hex = `#${string}`;
export interface Rgb {
  r: number;
  g: number;
  b: number;
}
export interface Hsl {
  h: number; // degrees, 0–360
  s: number; // 0–1
  l: number; // 0–1
}

export const DEFAULT_BRAND: Hex = "#4b2a68";

/** The ready-made colours (Purple is the default). */
export const PRESETS: { name: string; hex: Hex }[] = [
  { name: "Purple", hex: DEFAULT_BRAND },
  { name: "Blue", hex: "#1d4f91" },
  { name: "Teal", hex: "#0e6668" },
  { name: "Green", hex: "#2d6a35" },
  { name: "Rose", hex: "#9c2459" },
  { name: "Orange", hex: "#a3471c" },
  { name: "Slate", hex: "#3c4858" },
];

/** WCAG AA for normal text. */
export const READABLE = 4.5;

// ---- Colour conversions -------------------------------------------------

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

/** "#rrggbb" (or "#rgb") to channels 0–255; null when it is not a colour. */
export function parseHex(text: string): Rgb | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(text.trim());
  const digits = m?.[1];
  if (!digits) return null;
  const h = digits.length === 3 ? [...digits].map((c) => c + c).join("") : digits;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

/** A typed hex colour, tidied to "#rrggbb", or null. */
export function normaliseHex(text: string): Hex | null {
  const rgb = parseHex(text);
  return rgb ? rgbToHex(rgb) : null;
}

export function rgbToHex({ r, g, b }: Rgb): Hex {
  const part = (v: number) =>
    Math.round(clamp(v, 0, 255))
      .toString(16)
      .padStart(2, "0");
  return `#${part(r)}${part(g)}${part(b)}`;
}

export function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const [R, G, B] = [r / 255, g / 255, b / 255];
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === R) h = ((G - B) / d) % 6;
  else if (max === G) h = (B - R) / d + 2;
  else h = (R - G) / d + 4;
  return { h: (h * 60 + 360) % 360, s, l };
}

export function hslToRgb({ h, s, l }: Hsl): Rgb {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return 255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)));
  };
  return { r: f(0), g: f(8), b: f(4) };
}

/** Hue (degrees), saturation and value (0–1): what the colour picker's square and slider show. */
export interface Hsv {
  h: number;
  s: number;
  v: number;
}

export function hexToHsv(hex: string): Hsv {
  const { r, g, b } = parseHex(hex) ?? { r: 0, g: 0, b: 0 };
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const { h } = rgbToHsl({ r, g, b });
  return { h, s: max === 0 ? 0 : (max - min) / max, v: max };
}

export function hsvToHex({ h, s, v }: Hsv): Hex {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return 255 * (v - v * s * Math.max(0, Math.min(k, 4 - k, 1)));
  };
  return rgbToHex({ r: f(5), g: f(3), b: f(1) });
}

export const hexToHsl = (hex: string) => rgbToHsl(parseHex(hex)!);
export const hslToHex = (hsl: Hsl) => rgbToHex(hslToRgb(hsl));

/** "r g b" channels, as the CSS's rgb(var(--brand-rgb) / 0.1) wants them. */
export function channels(hex: string): string {
  const { r, g, b } = parseHex(hex)!;
  return `${r} ${g} ${b}`;
}

// ---- Luminance and contrast (WCAG 2) -----------------------------------

/** Relative luminance, 0 (black) to 1 (white). */
export function luminance(hex: string): number {
  const { r, g, b } = parseHex(hex)!;
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Contrast ratio between two colours, 1 to 21. */
export function contrast(a: string, b: string): number {
  const [la, lb] = [luminance(a), luminance(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** The colour with this hue and saturation whose luminance is closest to `target`. */
export function withLuminance(h: number, s: number, target: number): Hex {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (luminance(hslToHex({ h, s, l: mid })) < target) lo = mid;
    else hi = mid;
  }
  return hslToHex({ h, s, l: (lo + hi) / 2 });
}

// ---- The designed purple palette (must match 01-tokens.css; a test checks) ----

/** The variables theme colours recolour, with their purple values, per theme. */
export const PURPLE: Record<Theme, Record<string, Hex>> = {
  light: {
    "--browser-bar": "#4b2a68",
    "--page-background": "#ece7f2",
    "--app-background": "#faf8fc",
    "--surface-muted": "#f2ecf7",
    "--surface-sunken": "#f6f3fa",
    "--border": "#e3dbe9",
    "--border-strong": "#d6cde2",
    "--row-line": "#f0ebf5",
    "--row-hover": "#fbf9fd",
    "--row-selected": "#f6f1fb",
    "--row-checked": "#f1e9f9",
    "--grey-cell": "#efeef1",
    "--grey-label": "#5e5866",
    "--text": "#281a35",
    "--text-soft": "#4b4256",
    "--text-muted": "#74677e",
    "--ink": "#1e1a24",
    "--ink-2": "#3a3342",
    "--muted": "#6a6175",
    "--muted-zero": "#9a90a6",
    "--brand": "#4b2a68",
    "--brand-hover": "#633b82",
    "--brand-hover-strong": "#5d3780",
    "--brand-light": "#eee5f7",
    "--brand-light-hover": "#e6daf3",
    "--brand-tint": "#f3eef8",
    "--brand-tint-hover": "#f3edf9",
    "--brand-line": "#e4dcee",
    "--brand-outline": "#cdb8e6",
    "--accent": "#8051a2",
    "--on-brand-muted": "#e3d6f2",
    "--saved-quiet": "#6e5a85",
    "--saved-glow": "#e6d8f5",
    "--sparkle-lilac": "#b48be0",
    "--envelope-body": "#4b2a68",
    "--envelope-flap": "#b48be0",
  },
  dark: {
    "--browser-bar": "#16121b",
    "--page-background": "#0f0c13",
    "--app-background": "#16121b",
    "--surface": "#1f1926",
    "--surface-muted": "#282030",
    "--surface-sunken": "#1a1520",
    "--border": "#3a3144",
    "--border-strong": "#4b405a",
    "--row-line": "#2b2433",
    "--row-hover": "#251e2d",
    "--row-selected": "#2d2438",
    "--row-checked": "#33284a",
    "--grey-cell": "#2a2630",
    "--grey-label": "#bdb5c6",
    "--text": "#efe9f6",
    "--text-soft": "#d6cde0",
    "--text-muted": "#ab9fb8",
    "--ink": "#f4f0f8",
    "--ink-2": "#ddd5e6",
    "--muted": "#aea4ba",
    "--muted-zero": "#7b7088",
    "--brand": "#5b3a7e",
    "--brand-text": "#cbaef0",
    "--brand-hover": "#6d4794",
    "--brand-hover-strong": "#6a4590",
    "--brand-light": "#33274a",
    "--brand-light-hover": "#3d2f57",
    "--brand-tint": "#271f31",
    "--brand-tint-hover": "#2e2539",
    "--brand-line": "#3d3150",
    "--brand-outline": "#6f5890",
    "--accent": "#8f62b3",
    "--accent-text": "#c9a4ea",
    "--saved-quiet": "#b9a6d0",
    "--saved-glow": "#4a3466",
    "--envelope-body": "#6a4592",
  },
};

/** Light variables whose brightness follows the picked colour's (the fills). */
const FOLLOWS_BRAND = new Set([
  "--brand",
  "--brand-hover",
  "--brand-hover-strong",
  "--envelope-body",
  "--browser-bar",
]);

// ---- Deriving a palette ----------------------------------------------------

export interface ThemeColours {
  /** Variables to set for each theme (none for the default purple). */
  vars: Record<Theme, Record<string, string>>;
  /** The brand colour used in light (the picked one, darkened if needed). */
  brand: Hex;
  /** True when the picked colour was darkened so text on it reads. */
  adjusted: boolean;
  /** True for a red or green colour, which the app also uses for money out and in. */
  clashes: boolean;
}

/** Red or green enough to be mistaken for money out or in. */
export function clashesWithMeaning(hex: string): boolean {
  const { h, s } = hexToHsl(hex);
  if (s < 0.25) return false;
  return h >= 345 || h <= 20 || (h >= 85 && h <= 165);
}

/** The whole palette for a picked colour. */
export function themeColours(picked: Hex): ThemeColours {
  const seed = hexToHsl(picked);
  const base = hexToHsl(DEFAULT_BRAND);
  const isDefault = picked.toLowerCase() === DEFAULT_BRAND;
  // Never more colourful than the purple design: vivid picks would make the
  // pale tints garish. Only the brand itself is as vivid as the pick.
  const sScale = clamp(seed.s / base.s, 0, 1);
  const recolour = (purple: Hex, lum = luminance(purple)): Hex => {
    const p = hexToHsl(purple);
    // Each colour keeps its own small hue offset from the brand's.
    return withLuminance((p.h - base.h + seed.h + 360) % 360, clamp(p.s * sScale), lum);
  };

  // Light: the brand is the picked colour, darkened until white text on it
  // and it on its own tint both read.
  const tint = recolour(PURPLE.light["--brand-tint"] ?? DEFAULT_BRAND);
  let brand = rgbToHex(hslToRgb(seed));
  let adjusted = false;
  while (contrast(brand, "#ffffff") < READABLE || contrast(brand, tint) < READABLE) {
    const hsl = hexToHsl(brand);
    if (hsl.l <= 0.02) break;
    brand = hslToHex({ ...hsl, l: hsl.l - 0.01 });
    adjusted = true;
  }

  if (isDefault) {
    return { vars: { light: {}, dark: {} }, brand: DEFAULT_BRAND, adjusted: false, clashes: false };
  }

  // Fills keep their designed brightness relative to the brand.
  const brandRatio = luminance(brand) / luminance(DEFAULT_BRAND);
  const light: Record<string, string> = {};
  for (const [name, purple] of Object.entries(PURPLE.light)) {
    light[name] =
      name === "--brand"
        ? brand
        : FOLLOWS_BRAND.has(name)
          ? recolour(purple, clamp(luminance(purple) * brandRatio))
          : recolour(purple);
  }
  light["--brand-rgb"] = channels(brand);
  light["--shadow-rgb"] = channels(brand);
  light["--ink-rgb"] = channels(light["--text"] ?? "#000000");

  // Dark starts from light's set (variables dark leaves alone, like the
  // sparkles, keep their recoloured light value), since a set on the page
  // overrides the CSS for every variable it names.
  const dark: Record<string, string> = { ...light };
  for (const [name, purple] of Object.entries(PURPLE.dark)) dark[name] = recolour(purple);
  dark["--brand-rgb"] = channels(dark["--brand-text"] ?? "#ffffff");
  dark["--shadow-rgb"] = "0 0 0";
  dark["--ink-rgb"] = "0 0 0";

  return { vars: { light, dark }, brand, adjusted, clashes: clashesWithMeaning(brand) };
}

// ---- Remembering the choice --------------------------------------------------

export const themeColourKey = (userId: string) => `bb.theme.colour.${userId}`;
/**
 * The variables of the last colour used on this device, as JSON
 * ({ light: {...}, dark: {...} }), which public/theme-boot.js applies
 * before the first paint.
 */
export const DEVICE_COLOUR_VARS_KEY = "bb.theme.colourVars";

/** This user's colour on this device; the default purple when none. */
export function loadThemeColour(storage: KeyValueStorage | null, userId: string): Hex {
  try {
    return normaliseHex(storage?.getItem(themeColourKey(userId)) ?? "") ?? DEFAULT_BRAND;
  } catch {
    return DEFAULT_BRAND;
  }
}

/** Remembers the colour for this user, and its variables for theme-boot.js. */
export function saveThemeColour(
  storage: KeyValueStorage | null,
  userId: string,
  colour: Hex,
  vars: ThemeColours["vars"],
): void {
  try {
    storage?.setItem(themeColourKey(userId), colour);
    storage?.setItem(DEVICE_COLOUR_VARS_KEY, JSON.stringify(vars));
  } catch {
    // Not remembered; the colour still applies until the page reloads.
  }
}
