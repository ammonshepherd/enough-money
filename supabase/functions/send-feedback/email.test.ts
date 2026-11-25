import { describe, expect, it } from "vitest";
import { MAX_FEEDBACK as APP_MAX } from "../../../src/models/feedback";
import {
  allowedOrigin,
  birdEmail,
  birdHost,
  FeedbackError,
  MAX_FEEDBACK,
  readMessage,
} from "./email";

describe("readMessage", () => {
  it("returns the trimmed message", () => {
    expect(readMessage({ message: "  The Budget page is slow \n" })).toBe(
      "The Budget page is slow",
    );
  });

  it.each([null, "text", {}, { message: 5 }, { message: "   " }])("rejects %j", (body) => {
    expect(() => readMessage(body)).toThrow(FeedbackError);
  });

  it("accepts exactly the limit and rejects one more", () => {
    expect(readMessage({ message: "a".repeat(MAX_FEEDBACK) })).toHaveLength(MAX_FEEDBACK);
    expect(() => readMessage({ message: "a".repeat(MAX_FEEDBACK + 1) })).toThrow(/5,000/);
  });

  it("has the same limit as the app", () => {
    expect(MAX_FEEDBACK).toBe(APP_MAX);
  });
});

describe("birdHost", () => {
  it("follows the key's region", () => {
    expect(birdHost("bk_eu1_abc")).toBe("https://eu1.platform.bird.com");
    expect(birdHost("bk_us1_abc")).toBe("https://us1.platform.bird.com");
  });

  it("defaults to us1", () => {
    expect(birdHost("something-else")).toBe("https://us1.platform.bird.com");
  });
});

describe("birdEmail", () => {
  const email = birdEmail({
    from: "Enough Money <feedback@enoughmoney.app>",
    to: "owner@mail.test",
    userEmail: "user@mail.test",
    message: "Line one\nSubject: not a header",
    sentAt: new Date("2026-11-25T12:00:00Z"),
  });

  it("sends plain text with a fixed subject and the user as Reply-To", () => {
    expect(email).toMatchObject({
      from: "Enough Money <feedback@enoughmoney.app>",
      to: ["owner@mail.test"],
      subject: "Enough Money feedback",
      reply_to: ["user@mail.test"],
      category: "transactional",
    });
    expect(email).not.toHaveProperty("html");
  });

  it("puts the message, sender and time in the body", () => {
    expect(email.text).toBe(
      "Line one\nSubject: not a header\n\n--\nFrom: user@mail.test\nSent: 2026-11-25T12:00:00.000Z\n",
    );
  });
});

describe("allowedOrigin", () => {
  it.each([
    "https://enoughmoney.app",
    "http://localhost:5173",
    "http://127.0.0.1:4173",
    "http://localhost",
  ])("allows %s", (origin) => {
    expect(allowedOrigin(origin)).toBe(origin);
  });

  it.each([
    null,
    "https://evil.test",
    "https://enoughmoney.app.evil.test",
    "http://localhost.evil",
  ])("refuses %s", (origin) => {
    expect(allowedOrigin(origin)).toBeNull();
  });
});
