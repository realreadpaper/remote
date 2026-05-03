import { useEffect, useMemo, useState } from "react";
import { HomeScreen } from "./src/components/HomeScreen";
import { NewConnectionScreen } from "./src/components/NewConnectionScreen";
import { TerminalScreen } from "./src/components/TerminalScreen";
import {
  buildDevelopmentPreviewConnections,
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
  const pairingTokenStorage = useMemo(() => createSecureStorePairingTokenStorage(), []);
  const [route, setRoute] = useState<AppRoute>({ name: "home" });
  const [devices, setDevices] = useState<PairingTokenRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshDevices = async () => {
    setLoading(true);
    try {
      const stored = await loadPairingTokens(pairingTokenStorage);
      setDevices(stored.length === 0 && shouldUseDevelopmentPreviewConnections() ? buildDevelopmentPreviewConnections() : stored);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshDevices();
  }, [pairingTokenStorage]);

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
      loading={loading}
      onNewConnection={() => setRoute({ name: "new-connection" })}
      onSelectDevice={(device) => setRoute({ name: "terminal", device })}
    />
  );
}
