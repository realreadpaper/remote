import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { buildConnectionListItems } from "../state/homeConnectionList";
import type { RegisteredDeviceStatus } from "../protocol/deviceStatusClient";
import type { PairingTokenRecord } from "../state/pairingTokenStore";
import { mobileShellTheme } from "./mobileShellTheme";

export interface HomeScreenProps {
  devices: PairingTokenRecord[];
  deviceStatusesById?: Record<string, RegisteredDeviceStatus>;
  loading: boolean;
  statusNotice?: string | null;
  onNewConnection: () => void;
  onSelectDevice: (device: PairingTokenRecord) => void;
}

export function HomeScreen({ devices, deviceStatusesById, loading, statusNotice, onNewConnection, onSelectDevice }: HomeScreenProps) {
  const connectionItems = buildConnectionListItems(devices, { deviceStatusesById });

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
        {statusNotice ? (
          <View style={styles.noticePanel}>
            <Text style={styles.noticeText}>{statusNotice}</Text>
          </View>
        ) : null}

        {devices.length === 0 ? (
          <View style={styles.emptyPanel}>
            <Text style={styles.emptyTitle}>No connections</Text>
            <Text style={styles.emptyText}>Pair a Mac once. Saved connections appear here for one-tap terminal access.</Text>
            <Pressable accessibilityRole="button" onPress={onNewConnection} style={({ pressed }) => [styles.emptyButton, pressed && styles.primaryButtonPressed]}>
              <Text style={styles.primaryButtonText}>New Connection</Text>
            </Pressable>
          </View>
        ) : (
          connectionItems.map((item) => (
            <Pressable
              accessibilityRole="button"
              key={item.record.deviceId}
              onPress={() => onSelectDevice(item.record)}
              style={({ pressed }) => [styles.connectionCard, pressed && styles.connectionCardPressed]}
            >
              <View style={styles.connectionTopRow}>
                <View style={styles.deviceMeta}>
                  <Text numberOfLines={1} style={styles.deviceName}>{item.title}</Text>
                  <Text numberOfLines={1} style={styles.deviceDetail}>{item.subtitle}</Text>
                </View>
                <View
                  style={[
                    styles.statusPill,
                    item.statusTone === "expired" && styles.statusPillExpired,
                    item.statusTone === "offline" && styles.statusPillOffline
                  ]}
                >
                  <Text
                    style={[
                      styles.statusPillText,
                      item.statusTone === "expired" && styles.statusPillTextExpired,
                      item.statusTone === "offline" && styles.statusPillTextOffline
                    ]}
                  >
                    {item.statusLabel}
                  </Text>
                </View>
              </View>
              <View style={styles.connectionBottomRow}>
                <Text style={styles.connectionHint}>Terminal</Text>
                <Text style={styles.connectText}>Open</Text>
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
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
  noticePanel: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: layout.panelRadius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.panelBorder,
    backgroundColor: colors.warningSurface
  },
  noticeText: {
    color: colors.warning,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18
  },
  connectionCard: {
    minHeight: 112,
    padding: 14,
    borderRadius: layout.panelRadius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.panelBorder,
    backgroundColor: colors.panel,
    justifyContent: "space-between",
    gap: 12
  },
  connectionCardPressed: {
    backgroundColor: colors.panelMuted
  },
  connectionTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12
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
  statusPill: {
    minHeight: 28,
    paddingHorizontal: 10,
    borderRadius: layout.panelRadius,
    backgroundColor: "#eef8f0",
    alignItems: "center",
    justifyContent: "center"
  },
  statusPillOffline: {
    backgroundColor: colors.panelMuted
  },
  statusPillExpired: {
    backgroundColor: colors.dangerSurface
  },
  statusPillText: {
    color: colors.online,
    fontSize: 12,
    fontWeight: "700"
  },
  statusPillTextExpired: {
    color: colors.danger
  },
  statusPillTextOffline: {
    color: colors.offline
  },
  connectionBottomRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.panelBorder,
    paddingTop: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  connectionHint: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "600"
  },
  connectText: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: "700"
  }
});
