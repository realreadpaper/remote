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

function cloneDevice(device: RegisteredDevice): RegisteredDevice {
  return {
    ...device,
    capabilities: [...device.capabilities]
  };
}

export class DeviceRegistry {
  private readonly devices = new Map<string, RegisteredDevice>();

  register(input: RegisterDeviceInput): RegisteredDevice {
    const device: RegisteredDevice = {
      ...input,
      capabilities: [...input.capabilities],
      online: true
    };
    this.devices.set(input.deviceId, device);
    return cloneDevice(device);
  }

  get(deviceId: string): RegisteredDevice | undefined {
    const device = this.devices.get(deviceId);
    return device ? cloneDevice(device) : undefined;
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
    return [...this.devices.values()].map((device) => cloneDevice(device));
  }
}
