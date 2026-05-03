import { describe, expect, it, vi } from "vitest";
import { DeviceStatusClient } from "../src/protocol/deviceStatusClient";

describe("DeviceStatusClient", () => {
  it("loads registered device online status from the server", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        devices: [
          {
            deviceId: "macbook-pro",
            deviceName: "He MacBook Pro",
            capabilities: ["terminal"],
            online: true,
            lastSeenAt: "2026-05-03T11:58:00.000Z"
          }
        ]
      })
    })) as unknown as typeof fetch;

    const client = new DeviceStatusClient({
      apiBaseUrl: "http://127.0.0.1:8787/",
      fetchImpl: fetchMock
    });

    await expect(client.listDevices()).resolves.toEqual([
      {
        deviceId: "macbook-pro",
        deviceName: "He MacBook Pro",
        capabilities: ["terminal"],
        online: true,
        lastSeenAt: "2026-05-03T11:58:00.000Z"
      }
    ]);
    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:8787/devices");
  });

  it("adds authorization when a dev token is configured", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ devices: [] })
    })) as unknown as typeof fetch;

    const client = new DeviceStatusClient({
      apiBaseUrl: "http://127.0.0.1:8787",
      devToken: "dev-token",
      fetchImpl: fetchMock
    });

    await client.listDevices();

    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:8787/devices", {
      headers: { Authorization: "Bearer dev-token" }
    });
  });

  it("rejects invalid device status responses", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ devices: [{ deviceId: "macbook-pro", online: "yes" }] })
    })) as unknown as typeof fetch;

    const client = new DeviceStatusClient({
      apiBaseUrl: "http://127.0.0.1:8787",
      fetchImpl: fetchMock
    });

    await expect(client.listDevices()).rejects.toThrow("Invalid devices response.");
  });
});
