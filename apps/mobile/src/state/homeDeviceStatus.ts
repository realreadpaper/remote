import { loadMobileRuntimeConfig } from "../config/runtimeConfig";
import { DeviceStatusClient } from "../protocol/deviceStatusClient";

type RuntimeEnv = Record<string, string | undefined>;

export function createOptionalHomeDeviceStatusClient(env: RuntimeEnv = process.env): DeviceStatusClient | null {
  try {
    const runtimeConfig = loadMobileRuntimeConfig(env);
    return new DeviceStatusClient({
      apiBaseUrl: runtimeConfig.apiBaseUrl,
      devToken: runtimeConfig.devToken
    });
  } catch {
    return null;
  }
}
