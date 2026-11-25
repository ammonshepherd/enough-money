import { describe, expect, it } from "vitest";
import type { KeyValueStorage } from "./collapsedGroups";
import {
  DEVICE_THEME_KEY,
  loadThemeChoice,
  resolveTheme,
  saveThemeChoice,
  themeKey,
} from "./theme";

function fakeStorage(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial));
  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
  } satisfies KeyValueStorage & { items: Map<string, string> };
}

const throwing: KeyValueStorage = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("blocked");
  },
};

describe("theme choice", () => {
  it("matches the system when nothing is saved", () => {
    expect(loadThemeChoice(fakeStorage(), "u1")).toBe("system");
    expect(loadThemeChoice(null, "u1")).toBe("system");
    expect(loadThemeChoice(throwing, "u1")).toBe("system");
  });

  it("remembers each user's choice and the device's last", () => {
    const storage = fakeStorage();
    saveThemeChoice(storage, "u1", "dark");
    expect(loadThemeChoice(storage, "u1")).toBe("dark");
    expect(storage.items.get(themeKey("u1"))).toBe("dark");
    expect(storage.items.get(DEVICE_THEME_KEY)).toBe("dark");

    saveThemeChoice(storage, "u2", "light");
    expect(loadThemeChoice(storage, "u1")).toBe("dark");
    expect(loadThemeChoice(storage, "u2")).toBe("light");
    expect(storage.items.get(DEVICE_THEME_KEY)).toBe("light");
  });

  it("falls back to the device's last choice for a user with none", () => {
    expect(loadThemeChoice(fakeStorage({ [DEVICE_THEME_KEY]: "dark" }), "u3")).toBe("dark");
  });

  it("ignores unknown values", () => {
    const storage = fakeStorage({ [themeKey("u1")]: "purple", [DEVICE_THEME_KEY]: "dim" });
    expect(loadThemeChoice(storage, "u1")).toBe("system");
  });

  it("ignores storage that fails", () => {
    expect(() => saveThemeChoice(throwing, "u1", "dark")).not.toThrow();
  });
});

describe("resolveTheme", () => {
  it("follows the device for Match system", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });

  it("keeps an explicit choice whatever the device", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });
});
