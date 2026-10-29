import { describe, expect, it } from "vitest";
import { appRedirect } from "./appRedirect";

describe("appRedirect", () => {
  it("stays on the home page for a normal visit", () => {
    expect(appRedirect({ hash: "", standalone: false })).toBeNull();
    expect(appRedirect({ hash: "#", standalone: false })).toBeNull();
  });

  it("sends old app links to the app, keeping the page", () => {
    expect(appRedirect({ hash: "#budget/2026-10", standalone: false })).toBe(
      "/app/#budget/2026-10",
    );
    expect(appRedirect({ hash: "#accounts/all", standalone: true })).toBe("/app/#accounts/all");
  });

  it("sends an installed copy opened at / to the app", () => {
    expect(appRedirect({ hash: "", standalone: true })).toBe("/app/");
  });
});
