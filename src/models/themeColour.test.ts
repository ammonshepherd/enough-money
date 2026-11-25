import { describe, expect, it } from "vitest";
import type { KeyValueStorage } from "./collapsedGroups";
import {
  channels,
  clashesWithMeaning,
  contrast,
  DEFAULT_BRAND,
  DEVICE_COLOUR_VARS_KEY,
  hexToHsl,
  hexToHsv,
  hsvToHex,
  loadThemeColour,
  luminance,
  normaliseHex,
  PRESETS,
  PURPLE,
  READABLE,
  saveThemeColour,
  themeColourKey,
  themeColours,
  type Hex,
} from "./themeColour";

const channelDiff = (a: string, b: string) => {
  const [x = [], y = []] = [a, b].map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)));
  return Math.max(...x.map((v, i) => Math.abs(v - y[i]!)));
};

describe("colour helpers", () => {
  it("reads typed colours", () => {
    expect(normaliseHex("#ABC")).toBe("#aabbcc");
    expect(normaliseHex(" 4B2A68 ")).toBe("#4b2a68");
    expect(normaliseHex("purple")).toBeNull();
    expect(normaliseHex("#12345")).toBeNull();
  });

  it("converts to and from the picker's hue, saturation and value", () => {
    for (const hex of ["#4b2a68", "#ff0000", "#00ff00", "#123456", "#ffffff", "#000000"] as Hex[]) {
      expect(hsvToHex(hexToHsv(hex))).toBe(hex);
    }
    expect(hexToHsv("#ff0000")).toEqual({ h: 0, s: 1, v: 1 });
    expect(hsvToHex({ h: 240, s: 1, v: 0.5 })).toBe("#000080");
  });

  it("measures contrast as WCAG does", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrast("#4b2a68", "#ffffff")).toBeGreaterThan(READABLE);
    expect(channels("#4b2a68")).toBe("75 42 104");
  });
});

describe("themeColours", () => {
  it("applies nothing for the default purple", () => {
    const purple = themeColours(DEFAULT_BRAND);
    expect(purple.vars).toEqual({ light: {}, dark: {} });
    expect(purple.adjusted).toBe(false);
  });

  it("would rebuild the purple palette from purple (the method is faithful)", () => {
    // A near-purple pick goes through the whole derivation.
    const near = themeColours("#4b2a69");
    for (const theme of ["light", "dark"] as const) {
      for (const [name, value] of Object.entries(PURPLE[theme])) {
        expect([name, channelDiff(near.vars[theme][name]!, value) <= 3]).toEqual([name, true]);
      }
    }
  });

  const picks: Hex[] = [
    ...PRESETS.map((p) => p.hex),
    "#ffff00",
    "#00ff00",
    "#00ffff",
    "#f3d36b",
    "#ffffff",
    "#000000",
    "#808080",
    "#ff69b4",
    "#123456",
  ];

  it.each(picks)("keeps every designed contrast for %s", (pick) => {
    const { vars, brand } = themeColours(pick);
    if (pick === DEFAULT_BRAND) return;
    const light = vars.light;
    // The brand fill takes white text, and reads on its tint.
    expect(contrast(brand, "#ffffff")).toBeGreaterThanOrEqual(READABLE);
    expect(contrast(brand, light["--brand-tint"]!)).toBeGreaterThanOrEqual(READABLE);
    // Text keeps reading on the page in both themes.
    expect(contrast(light["--text"]!, light["--app-background"]!)).toBeGreaterThanOrEqual(7);
    expect(contrast(light["--text-muted"]!, "#ffffff")).toBeGreaterThanOrEqual(READABLE);
    expect(contrast(light["--accent"]!, "#ffffff")).toBeGreaterThanOrEqual(READABLE);
    const dark = vars.dark;
    expect(contrast(dark["--brand"]!, "#ffffff")).toBeGreaterThanOrEqual(READABLE);
    expect(contrast(dark["--brand-text"]!, dark["--surface"]!)).toBeGreaterThanOrEqual(READABLE);
    expect(contrast(dark["--text"]!, dark["--surface"]!)).toBeGreaterThanOrEqual(7);
    // Each recoloured variable is as bright as the purple one it replaces.
    for (const [name, purple] of Object.entries(PURPLE.dark)) {
      expect(Math.abs(luminance(dark[name]!) - luminance(purple))).toBeLessThan(0.01);
    }
  });

  it("keeps the picked colour when it already reads, and darkens it when not", () => {
    const blue = themeColours("#1d4f91");
    expect(blue.brand).toBe("#1d4f91");
    expect(blue.adjusted).toBe(false);
    const yellow = themeColours("#ffd400");
    expect(yellow.adjusted).toBe(true);
    expect(Math.abs(hexToHsl(yellow.brand).h - hexToHsl("#ffd400").h)).toBeLessThan(3);
    expect(contrast(yellow.brand, "#ffffff")).toBeGreaterThanOrEqual(READABLE);
  });

  it("gives the dark set every variable the light set has", () => {
    const { vars } = themeColours("#0e6668");
    for (const name of Object.keys(vars.light)) expect(vars.dark).toHaveProperty(name);
    expect(vars.dark["--shadow-rgb"]!).toBe("0 0 0");
  });

  it("warns for red and green, not for other colours", () => {
    expect(clashesWithMeaning("#b3261e")).toBe(true);
    expect(clashesWithMeaning("#2d6a35")).toBe(true);
    expect(clashesWithMeaning("#1d4f91")).toBe(false);
    expect(clashesWithMeaning("#3c4858")).toBe(false);
    expect(clashesWithMeaning(DEFAULT_BRAND)).toBe(false);
  });
});

describe("remembering the colour", () => {
  const storage = () => {
    const items = new Map<string, string>();
    return {
      items,
      getItem: (k: string) => items.get(k) ?? null,
      setItem: (k: string, v: string) => void items.set(k, v),
    } satisfies KeyValueStorage & { items: Map<string, string> };
  };

  it("is purple when nothing (or nonsense) is saved", () => {
    expect(loadThemeColour(storage(), "u1")).toBe(DEFAULT_BRAND);
    expect(loadThemeColour(null, "u1")).toBe(DEFAULT_BRAND);
    const s = storage();
    s.items.set(themeColourKey("u1"), "not a colour");
    expect(loadThemeColour(s, "u1")).toBe(DEFAULT_BRAND);
  });

  it("keeps each user's colour and the device's variables", () => {
    const s = storage();
    const teal = themeColours("#0e6668");
    saveThemeColour(s, "u1", "#0e6668", teal.vars);
    expect(loadThemeColour(s, "u1")).toBe("#0e6668");
    expect(loadThemeColour(s, "u2")).toBe(DEFAULT_BRAND);
    expect(JSON.parse(s.items.get(DEVICE_COLOUR_VARS_KEY)!)).toEqual(teal.vars);
  });

  it("ignores storage that fails", () => {
    const failing: KeyValueStorage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(loadThemeColour(failing, "u1")).toBe(DEFAULT_BRAND);
    expect(() => saveThemeColour(failing, "u1", "#0e6668", { light: {}, dark: {} })).not.toThrow();
  });
});
