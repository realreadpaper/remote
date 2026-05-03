import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import type { PairingTokenRecord } from "../state/pairingTokenStore";
import { mobileShellTheme } from "./mobileShellTheme";

export interface HomeScreenProps {
  devices: PairingTokenRecord[];
  loading: boolean;
  onNewConnection: () => void;
  onSelectDevice: (device: PairingTokenRecord) => void;
}

export function HomeScreen({ devices, loading, onNewConnection, onSelectDevice }: HomeScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Remote</Text>
          <Text style={styles.subtitle}>{loading ? "Loading connections" : `${devices.length} saved connection${devices.length === 1 ? "" : "s"}`}</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={onNewConnection} style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}>
          <Text style={styles.primaryButtonText}>New</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {devices.length === 0 ? (
          <View style={styles.emptyPanel}>
            <Text style={styles.emptyTitle}>No connections</Text>
            <Text style={styles.emptyText}>Pair a Mac once, then it will appear here for one-tap terminal access.</Text>
            <Pressable accessibilityRole="button" onPress={onNewConnection} style={({ pressed }) => [styles.emptyButton, pressed && styles.primaryButtonPressed]}>
              <Text style={styles.primaryButtonText}>New Connection</Text>
            </Pressable>
          </View>
        ) : (
          devices.map((device) => (
            <Pressable
              accessibilityRole="button"
              key={device.deviceId}
              onPress={() => onSelectDevice(device)}
              style={({ pressed }) => [styles.deviceRow, pressed && styles.deviceRowPressed]}
            >
              <View style={styles.deviceMeta}>
                <Text numberOfLines={1} style={styles.deviceName}>{device.deviceId}</Text>
                <Text numberOfLines={1} style={styles.deviceDetail}>Expires {formatShortDate(device.expiresAt)}</Text>
              </View>
              <Text style={styles.connectText}>Connect</Text>
            </Pressable>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function formatShortDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const colors = mobileShellTheme.colors;
const layout = mobileShellTheme.layout;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.appBackground
  },
  header: {
    paddingHorizontal: layout.horizontalPadding,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.panelBorder,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  title: {
    color: colors.textPrimary,
    fontSize: 34,
    fontWeight: "700",
    letterSpacing: 0
  },
  subtitle: {
    marginTop: 4,
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "500"
  },
  primaryButton: {
    minHeight: 42,
    minWidth: 74,
    paddingHorizontal: 14,
    borderRadius: layout.panelRadius,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center"
  },
  primaryButtonPressed: {
    backgroundColor: colors.accentPressed
  },
  primaryButtonText: {
    color: colors.accentText,
    fontSize: 15,
    fontWeight: "700"
  },
  content: {
    flexGrow: 1,
    padding: layout.horizontalPadding,
    gap: 10
  },
  emptyPanel: {
    minHeight: 220,
    padding: 18,
    borderRadius: layout.panelRadius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.panelBorder,
    backgroundColor: colors.panel,
    justifyContent: "center",
    gap: 10
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: "700"
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 21
  },
  emptyButton: {
    marginTop: 8,
    minHeight: 44,
    borderRadius: layout.panelRadius,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center"
  },
  deviceRow: {
    minHeight: 76,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: layout.panelRadius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.panelBorder,
    backgroundColor: colors.panel,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  deviceRowPressed: {
    backgroundColor: colors.panelMuted
  },
  deviceMeta: {
    flex: 1,
    minWidth: 0
  },
  deviceName: {
    color: colors.textPrimary,
    fontSize: 19,
    fontWeight: "700"
  },
  deviceDetail: {
    marginTop: 5,
    color: colors.textMuted,
    fontSize: 13
  },
  connectText: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: "700"
  }
});
