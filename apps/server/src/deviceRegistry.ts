export type DeviceCapability = "terminal" | "file" | "desktop";

export interface RegisteredDevice {
  deviceId: string;
  deviceName: string;
  capabilities: DeviceCapability[];
  online: boolean;
}

export interface RegisterDeviceInput {
  deviceId: string;
  deviceName: string;
  capabilities: DeviceCapability[];
}

export class DeviceRegistry {
  private readonly devices = new Map<string, RegisteredDevice>();

  register(input: RegisterDeviceInput): RegisteredDevice {
    const device: RegisteredDevice = {
      ...input,
      online: true
    };
    this.devices.set(input.deviceId, device);
    return device;
  }

  get(deviceId: string): RegisteredDevice | undefined {
    return this.devices.get(deviceId);
  }

  markOffline(deviceId: string): void {
    const device = this.devices.get(deviceId);
    if (!device) {
      return;
    }
    this.devices.set(deviceId, {
      ...device,
      online: false
    });
  }

  list(): RegisteredDevice[] {
    return [...this.devices.values()];
  }
}
