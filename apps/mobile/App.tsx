import { useEffect, useMemo, useState } from "react";
import { HomeScreen } from "./src/components/HomeScreen";
import { NewConnectionScreen } from "./src/components/NewConnectionScreen";
import { TerminalScreen } from "./src/components/TerminalScreen";
import { loadMobileRuntimeConfig } from "./src/config/runtimeConfig";
import { DeviceStatusClient, type RegisteredDeviceStatus } from "./src/protocol/deviceStatusClient";
import {
  buildDeviceStatusLookup,
  buildDevelopmentPreviewConnections,
  getOnlineStatusNotice,
  type OnlineStatusState,
  shouldUseDevelopmentPreviewConnections
} from "./src/state/homeConnectionList";
import {
  createSecureStorePairingTokenStorage,
  loadPairingTokens,
  removePairingToken,
  upsertPairingToken,
  type PairingTokenRecord
} from "./src/state/pairingTokenStore";

type AppRoute =
  | { name: "home" }
  | { name: "new-connection" }
  | { name: "terminal"; device: PairingTokenRecord };

export default function App() {
  const runtimeConfig = useMemo(() => loadMobileRuntimeConfig(), []);
  const pairingTokenStorage = useMemo(() => createSecureStorePairingTokenStorage(), []);
  const deviceStatusClient = useMemo(
    () => new DeviceStatusClient({ apiBaseUrl: runtimeConfig.apiBaseUrl, devToken: runtimeConfig.devToken }),
    [runtimeConfig.apiBaseUrl, runtimeConfig.devToken]
  );
  const [route, setRoute] = useState<AppRoute>({ name: "home" });
  const [devices, setDevices] = useState<PairingTokenRecord[]>([]);
  const [deviceStatusesById, setDeviceStatusesById] = useState<Record<string, RegisteredDeviceStatus>>({});
  const [onlineStatusState, setOnlineStatusState] = useState<OnlineStatusState>("ready");
  const [loading, setLoading] = useState(true);

  const refreshDevices = async () => {
    setLoading(true);
    try {
      const stored = await loadPairingTokens(pairingTokenStorage);
      const visibleDevices = stored.length === 0 && shouldUseDevelopmentPreviewConnections() ? buildDevelopmentPreviewConnections() : stored;
      setDevices(visibleDevices);

      try {
        const statuses = await deviceStatusClient.listDevices();
        setDeviceStatusesById(buildDeviceStatusLookup(statuses));
        setOnlineStatusState("ready");
      } catch {
        setDeviceStatusesById({});
        setOnlineStatusState("unavailable");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshDevices();
  }, [pairingTokenStorage, deviceStatusClient]);

  const handlePaired = (record: PairingTokenRecord) => {
    void upsertPairingToken(pairingTokenStorage, record).then(async () => {
      await refreshDevices();
      setRoute({ name: "home" });
    });
  };

  const handleForget = (deviceId: string) => {
    void removePairingToken(pairingTokenStorage, deviceId).then(async () => {
      await refreshDevices();
      setRoute({ name: "home" });
    });
  };

  if (route.name === "new-connection") {
    return <NewConnectionScreen onCancel={() => setRoute({ name: "home" })} onPaired={handlePaired} />;
  }

  if (route.name === "terminal") {
    return (
      <TerminalScreen
        selectedDevice={route.device}
        onBack={() => setRoute({ name: "home" })}
        onForget={handleForget}
      />
    );
  }

  return (
    <HomeScreen
      devices={devices}
      deviceStatusesById={deviceStatusesById}
      loading={loading}
      statusNotice={getOnlineStatusNotice(onlineStatusState, devices.length)}
      onNewConnection={() => setRoute({ name: "new-connection" })}
      onSelectDevice={(device) => setRoute({ name: "terminal", device })}
    />
  );
}
