import { describe, expect, it } from "vitest";
import { UserFacingError } from "./dataStore";
import { cleanFeedback, MAX_FEEDBACK } from "./feedback";

describe("cleanFeedback", () => {
  it("trims the message", () => {
    expect(cleanFeedback("  Love the goals ring \n")).toBe("Love the goals ring");
  });

  it("rejects an empty message", () => {
    expect(() => cleanFeedback(" \n ")).toThrow(UserFacingError);
  });

  it("accepts exactly the limit and rejects one more", () => {
    expect(cleanFeedback("a".repeat(MAX_FEEDBACK))).toHaveLength(MAX_FEEDBACK);
    expect(() => cleanFeedback("a".repeat(MAX_FEEDBACK + 1))).toThrow(
      "Keep it under 5,000 characters.",
    );
  });
});
