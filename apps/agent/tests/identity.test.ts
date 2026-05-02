import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  getDefaultIdentityPath,
  loadOrCreateDeviceIdentity,
  type DeviceIdentity
} from "../src/identity.js";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "remote-agent-identity-"));
  tempDirs.push(tempDir);
  return tempDir;
}

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

describe("Agent device identity", () => {
  it("creates and saves an identity on first load", () => {
    const identityPath = path.join(makeTempDir(), "identity.json");

    const identity = loadOrCreateDeviceIdentity({
      identityPath,
      now: () => new Date("2026-05-03T00:00:00.000Z"),
      randomUUID: () => "device-uuid"
    });

    expect(identity).toMatchObject({
      version: 1,
      deviceId: "device-uuid",
      createdAt: "2026-05-03T00:00:00.000Z"
    });
    expect(identity.publicKey).toContain("BEGIN PUBLIC KEY");
    expect(identity.privateKey).toContain("BEGIN PRIVATE KEY");

    const saved = JSON.parse(readFileSync(identityPath, "utf8")) as DeviceIdentity;
    expect(saved).toEqual(identity);
  });

  it("returns the same identity on later loads", () => {
    const identityPath = path.join(makeTempDir(), "identity.json");
    const firstIdentity = loadOrCreateDeviceIdentity({
      identityPath,
      now: () => new Date("2026-05-03T00:00:00.000Z"),
      randomUUID: () => "device-uuid"
    });

    const secondIdentity = loadOrCreateDeviceIdentity({
      identityPath,
      now: () => new Date("2027-01-01T00:00:00.000Z"),
      randomUUID: () => "different-device-uuid"
    });

    expect(secondIdentity).toEqual(firstIdentity);
  });

  it("rejects corrupted identity JSON", () => {
    const identityPath = path.join(makeTempDir(), "identity.json");
    writeFileSync(identityPath, "{", "utf8");

    expect(() => loadOrCreateDeviceIdentity({ identityPath })).toThrow("Agent identity file is invalid");
  });

  it("rejects identity files missing required fields", () => {
    const identityPath = path.join(makeTempDir(), "identity.json");
    writeFileSync(
      identityPath,
      JSON.stringify({
        version: 1,
        deviceId: "device-uuid",
        publicKey: "public-key",
        createdAt: "2026-05-03T00:00:00.000Z"
      }),
      "utf8"
    );

    expect(() => loadOrCreateDeviceIdentity({ identityPath })).toThrow("Agent identity file is invalid");
  });

  it("uses the agent identity file under the user's home directory by default", () => {
    expect(getDefaultIdentityPath("/Users/alice")).toBe(
      "/Users/alice/.remote-terminal-agent/identity.json"
    );
  });
});
