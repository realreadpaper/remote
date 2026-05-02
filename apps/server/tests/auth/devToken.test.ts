import { describe, expect, it } from "vitest";
import { getProvidedDevToken, validateDevToken } from "../../src/auth/devToken.js";

describe("dev token guard", () => {
  it("allows missing token when guard is disabled", () => {
    expect(validateDevToken({ requireDevToken: false, devToken: null }, null)).toBe(true);
  });

  it("reads token from query string", () => {
    expect(getProvidedDevToken({ url: "/ws/agent?token=secret", headers: {} })).toBe("secret");
  });

  it("reads token from Authorization Bearer header", () => {
    expect(
      getProvidedDevToken({
        url: "/ws/mobile",
        headers: { authorization: "Bearer secret" }
      })
    ).toBe("secret");
  });

  it("accepts a matching token when guard is enabled", () => {
    expect(validateDevToken({ requireDevToken: true, devToken: "secret" }, "secret")).toBe(true);
  });

  it("rejects a missing token when guard is enabled", () => {
    expect(validateDevToken({ requireDevToken: true, devToken: "secret" }, null)).toBe(false);
  });

  it("rejects a wrong token when guard is enabled", () => {
    expect(validateDevToken({ requireDevToken: true, devToken: "secret" }, "wrong")).toBe(false);
  });
});
