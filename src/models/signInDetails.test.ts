import { describe, expect, it } from "vitest";
import { UserFacingError } from "./dataStore";
import {
  BAD_EMAIL,
  checkNewEmail,
  checkPasswordChange,
  cleanDisplayName,
  greeting,
  normalizeEmail,
  SAME_EMAIL,
  SAME_PASSWORD,
} from "./signInDetails";

describe("checkPasswordChange", () => {
  const good = "a long new password";

  it("returns the new password when all three fields are right", () => {
    expect(checkPasswordChange("old password", good, good)).toBe(good);
  });

  it("needs the current password", () => {
    expect(() => checkPasswordChange("", good, good)).toThrow("Enter your current password.");
  });

  it("checks the new one like a first password (length, typed twice)", () => {
    expect(() => checkPasswordChange("old", "short", "short")).toThrow(
      "Use at least 12 characters.",
    );
    expect(() => checkPasswordChange("old", good, `${good}!`)).toThrow(
      "The two passwords do not match.",
    );
  });

  it("refuses the same password again", () => {
    expect(() => checkPasswordChange(good, good, good)).toThrow(SAME_PASSWORD);
  });
});

describe("checkNewEmail", () => {
  it("returns the email trimmed and in lower case", () => {
    expect(checkNewEmail("me@example.com", "  New.Me@Example.COM ")).toBe("new.me@example.com");
    expect(normalizeEmail(" A@B.C ")).toBe("a@b.c");
  });

  it("refuses the current email, in any case", () => {
    expect(() => checkNewEmail("Me@Example.com", " me@example.COM")).toThrow(SAME_EMAIL);
  });

  it("refuses what is not shaped like an email", () => {
    for (const text of ["", "me", "me@", "@example.com", "me@example", "me @example.com"]) {
      expect(() => checkNewEmail("me@example.com", text)).toThrow(UserFacingError);
      expect(() => checkNewEmail("me@example.com", text)).toThrow(BAD_EMAIL);
    }
  });
});

describe("display name", () => {
  it("is trimmed with single spaces, empty allowed, at most 50 characters", () => {
    expect(cleanDisplayName("  Sam \t  Smith ")).toBe("Sam Smith");
    expect(cleanDisplayName("   ")).toBe("");
    expect(cleanDisplayName("x".repeat(50))).toHaveLength(50);
    expect(() => cleanDisplayName("x".repeat(51))).toThrow(UserFacingError);
  });

  it("greets by the display name, else the email", () => {
    expect(greeting("Sam", "sam@example.com")).toBe("Hi, Sam");
    expect(greeting("", "sam@example.com")).toBe("Hi, sam@example.com");
  });
});
