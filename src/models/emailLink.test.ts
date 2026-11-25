import { describe, expect, it } from "vitest";
import { UserFacingError } from "./dataStore";
import {
  checkNewPassword,
  loadPasswordNeeded,
  MIN_PASSWORD_LENGTH,
  passwordNeededKey,
  readEmailLink,
  savePasswordNeeded,
  withoutEmailLink,
} from "./emailLink";

describe("readEmailLink", () => {
  it("reads an invite and a recovery link", () => {
    expect(readEmailLink("?token_hash=abc123&type=invite")).toEqual({
      tokenHash: "abc123",
      type: "invite",
    });
    expect(readEmailLink("?type=recovery&token_hash=pkce_xyz")).toEqual({
      tokenHash: "pkce_xyz",
      type: "recovery",
    });
  });

  it("ignores other types, missing parts and no query", () => {
    expect(readEmailLink("?token_hash=abc&type=signup")).toBeNull();
    expect(readEmailLink("?token_hash=abc")).toBeNull();
    expect(readEmailLink("?token_hash=%20&type=invite")).toBeNull();
    expect(readEmailLink("?type=invite")).toBeNull();
    expect(readEmailLink("")).toBeNull();
  });
});

describe("withoutEmailLink", () => {
  it("removes the link and keeps the rest", () => {
    expect(
      withoutEmailLink("https://enoughmoney.app/app/?token_hash=abc&type=invite&x=1#budget"),
    ).toBe("https://enoughmoney.app/app/?x=1#budget");
    expect(withoutEmailLink("https://enoughmoney.app/app/?token_hash=abc&type=recovery")).toBe(
      "https://enoughmoney.app/app/",
    );
  });
});

describe("checkNewPassword", () => {
  const good = "x".repeat(MIN_PASSWORD_LENGTH);

  it("accepts a long enough password typed twice", () => {
    expect(checkNewPassword(good, good)).toBe(good);
  });

  it("rejects a short one", () => {
    const short = good.slice(1);
    expect(() => checkNewPassword(short, short)).toThrow(UserFacingError);
    expect(() => checkNewPassword(short, short)).toThrow("Use at least 12 characters.");
  });

  it("rejects two that differ", () => {
    expect(() => checkNewPassword(good, `${good}!`)).toThrow("The two passwords do not match.");
  });
});

describe("password needed", () => {
  const fake = () => {
    const values = new Map<string, string>();
    return {
      values,
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => void values.set(key, value),
      removeItem: (key: string) => void values.delete(key),
    };
  };

  it("is kept per user and cleared with null", () => {
    const storage = fake();
    savePasswordNeeded(storage, "u1", "invite");
    expect(loadPasswordNeeded(storage, "u1")).toBe("invite");
    expect(loadPasswordNeeded(storage, "u2")).toBeNull();
    savePasswordNeeded(storage, "u1", null);
    expect(loadPasswordNeeded(storage, "u1")).toBeNull();
  });

  it("ignores unknown values and storage failures", () => {
    const storage = fake();
    storage.values.set(passwordNeededKey("u1"), "signup");
    expect(loadPasswordNeeded(storage, "u1")).toBeNull();
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    expect(loadPasswordNeeded(broken, "u1")).toBeNull();
    expect(() => savePasswordNeeded(broken, "u1", "invite")).not.toThrow();
    expect(loadPasswordNeeded(null, "u1")).toBeNull();
  });
});
