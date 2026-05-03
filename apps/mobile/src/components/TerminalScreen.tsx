import { useEffect, useMemo, useRef, useState } from "react";
import {
  AppState,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { loadMobileRuntimeConfig, shouldAutoConnectTerminal } from "../config/runtimeConfig";
import { PairingClient } from "../protocol/pairingClient";
import { SessionClient } from "../protocol/sessionClient";
import type { PairingTokenRecord } from "../state/pairingTokenStore";
import { createTerminalState } from "../state/terminalStore";
import { getConnectionStatusLabel, mobileShellTheme } from "./mobileShellTheme";
import { terminalShortcutPayloads } from "./terminalShortcuts";

export interface TerminalScreenProps {
  selectedDevice: PairingTokenRecord;
  onBack: () => void;
  onForget: (deviceId: string) => void;
}

export function TerminalScreen({ selectedDevice, onBack, onForget }: TerminalScreenProps) {
  const runtimeConfig = useMemo(() => loadMobileRuntimeConfig(), []);
  const terminalState = useMemo(() => createTerminalState(), []);
  const [snapshot, setSnapshot] = useState(() => terminalState.getSnapshot());
  const [connecting, setConnecting] = useState(false);
  const [appActive, setAppActive] = useState(true);
  const [manualReconnectVisible, setManualReconnectVisible] = useState(false);
  const clientRef = useRef<SessionClient | undefined>(undefined);
  const autoConnectAttemptedRef = useRef(false);
  const autoReconnectAttemptedRef = useRef(false);
  const appActiveRef = useRef(true);
  const scrollRef = useRef<ScrollView | null>(null);

  const refreshSnapshot = () => {
    setSnapshot(terminalState.getSnapshot());
  };

  const appendLocalLine = (message: string) => {
    terminalState.appendOutput(`[local] ${message}\n`);
    refreshSnapshot();
  };

  const closeCurrentClient = () => {
    clientRef.current?.close();
    clientRef.current = undefined;
    setManualReconnectVisible(false);
    autoReconnectAttemptedRef.current = false;
  };

  const reconnectRetainedClient = (client: SessionClient, reason: string) => {
    if (clientRef.current !== client) {
      return;
    }

    if (!client.hasRetainedSession()) {
      setManualReconnectVisible(false);
      return;
    }

    setConnecting(true);
    setManualReconnectVisible(false);
    terminalState.setConnectionError(reason);
    try {
      client.connect();
    } catch (error) {
      setConnecting(false);
      setManualReconnectVisible(true);
      const message = error instanceof Error ? error.message : "Reconnect failed.";
      terminalState.setConnectionError(message);
      terminalState.appendOutput(`[local] ${message}\n`);
    }
    refreshSnapshot();
  };

  const handleManualReconnect = () => {
    const client = clientRef.current;
    if (client?.hasRetainedSession()) {
      autoReconnectAttemptedRef.current = true;
      reconnectRetainedClient(client, "Reconnecting.");
      return;
    }

    handleConnect();
  };

  useEffect(() => {
    return () => {
      closeCurrentClient();
    };
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      const active = nextState === "active";
      appActiveRef.current = active;
      setAppActive(active);

      if (!active) {
        return;
      }

      const client = clientRef.current;
      if (client && client.hasRetainedSession() && !client.isSocketOpen() && !snapshot.connected && !connecting) {
        reconnectRetainedClient(client, "App resumed. Reconnecting.");
      }
    });

    return () => {
      subscription.remove();
    };
  }, [connecting, snapshot.connected]);

  const handleForgetPairing = async () => {
    try {
      const client = new PairingClient({
        apiBaseUrl: runtimeConfig.apiBaseUrl,
        devToken: runtimeConfig.devToken
      });
      await client.revokeSessionToken({
        deviceId: selectedDevice.deviceId,
        sessionToken: selectedDevice.sessionToken
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Session token revoke failed.";
      appendLocalLine(`Session token revoke failed: ${reason}`);
    }

    closeCurrentClient();
    terminalState.setConnected(false);
    setConnecting(false);
    onForget(selectedDevice.deviceId);
  };

  const openTerminalSession = () => {
    if (snapshot.connected || connecting) {
      return;
    }

    setConnecting(true);
    try {
      closeCurrentClient();
      let smokeCommandSent = false;
      const client = new SessionClient({
        url: runtimeConfig.sessionUrl,
        deviceId: selectedDevice.deviceId,
        sessionToken: selectedDevice.sessionToken,
        onMessage(message) {
          if (clientRef.current !== client) {
            return;
          }

          if (message.type === "session.opened") {
            terminalState.setConnected(true);
            setConnecting(false);
            setManualReconnectVisible(false);
            autoReconnectAttemptedRef.current = false;
            if (runtimeConfig.smokeCommand && !smokeCommandSent) {
              smokeCommandSent = true;
              const command = runtimeConfig.smokeCommand.endsWith("\n")
                ? runtimeConfig.smokeCommand
                : `${runtimeConfig.smokeCommand}\n`;
              client.sendTerminalInput(command);
            }
          }

          if (message.type === "terminal.output") {
            terminalState.appendOutput(message.data);
          }

          if (message.type === "session.error") {
            terminalState.appendOutput(`[server] ${message.message}\n`);
            terminalState.setConnectionError(message.message);
            terminalState.setConnected(false);
            setConnecting(false);
            if (client.hasRetainedSession()) {
              setManualReconnectVisible(true);
            } else {
              closeCurrentClient();
            }
          }

          if (message.type === "terminal.exit") {
            terminalState.appendOutput(
              `[server] terminal exited${message.exitCode === null ? "" : ` with code ${message.exitCode}`}\n`
            );
            terminalState.setConnected(false);
            setConnecting(false);
            closeCurrentClient();
          }

          refreshSnapshot();
        },
        onDisconnect(reason) {
          if (clientRef.current !== client) {
            return;
          }

          terminalState.setConnected(false);
          setConnecting(false);
          terminalState.setConnectionError(reason);
          terminalState.appendOutput(`[local] ${reason}\n`);
          if (
            appActiveRef.current &&
            client.hasRetainedSession() &&
            !autoReconnectAttemptedRef.current
          ) {
            autoReconnectAttemptedRef.current = true;
            terminalState.appendOutput("[local] Reconnecting once.\n");
            reconnectRetainedClient(client, "Connection dropped. Reconnecting.");
            return;
          }

          setManualReconnectVisible(client.hasRetainedSession());
          refreshSnapshot();
        },
        onConnectionIssue(issue) {
          if (clientRef.current !== client) {
            return;
          }

          terminalState.setConnectionError(issue.message);
          refreshSnapshot();
        }
      });

      clientRef.current = client;
      client.connect();
    } catch (error) {
      closeCurrentClient();
      terminalState.setConnected(false);
      setConnecting(false);
      const reason = error instanceof Error ? error.message : "Unable to connect.";
      terminalState.setConnectionError(reason);
      appendLocalLine(reason);
    }
  };

  const handleConnect = () => {
    openTerminalSession();
  };

  useEffect(() => {
    if (
      !shouldAutoConnectTerminal({
        autoConnect: runtimeConfig.autoConnect,
        autoPairingCode: runtimeConfig.autoPairingCode,
        autoConnectAttempted: autoConnectAttemptedRef.current,
        sessionToken: selectedDevice.sessionToken
      })
    ) {
      return;
    }

    autoConnectAttemptedRef.current = true;
    handleConnect();
  }, [runtimeConfig.autoConnect, runtimeConfig.autoPairingCode, selectedDevice.sessionToken]);

  const handleInputChange = (input: string) => {
    terminalState.setInput(input);
    refreshSnapshot();
  };

  const handleSend = () => {
    if (!appActive) {
      appendLocalLine("App is paused in the background.");
      return;
    }

    if (!snapshot.connected) {
      appendLocalLine("Connect before sending a command.");
      return;
    }

    const command = snapshot.input.endsWith("\n") ? snapshot.input : `${snapshot.input}\n`;
    if (command.trim().length === 0) {
      return;
    }

    try {
      if (!clientRef.current) {
        terminalState.setConnected(false);
        setConnecting(false);
        appendLocalLine("No active session client.");
        return;
      }

      clientRef.current.sendTerminalInput(command);
      terminalState.submitInput();
      refreshSnapshot();
    } catch (error) {
      terminalState.setConnected(false);
      setConnecting(false);
      appendLocalLine(error instanceof Error ? error.message : "Command was not sent.");
    }
  };

  const sendRawInput = (payload: string) => {
    if (!appActive) {
      appendLocalLine("App is paused in the background.");
      return;
    }

    if (!snapshot.connected) {
      appendLocalLine("Connect before sending terminal shortcuts.");
      return;
    }

    try {
      if (!clientRef.current) {
        terminalState.setConnected(false);
        setConnecting(false);
        terminalState.setConnectionError("No active session client.");
        appendLocalLine("No active session client.");
        return;
      }

      clientRef.current.sendTerminalInput(payload);
    } catch (error) {
      terminalState.setConnected(false);
      setConnecting(false);
      const reason = error instanceof Error ? error.message : "Shortcut was not sent.";
      terminalState.setConnectionError(reason);
      appendLocalLine(reason);
    }
  };

  const sendSignal = (signal: "SIGINT" | "EOF") => {
    if (!appActive) {
      appendLocalLine("App is paused in the background.");
      return;
    }

    if (!snapshot.connected) {
      appendLocalLine("Connect before sending terminal shortcuts.");
      return;
    }

    try {
      if (!clientRef.current) {
        terminalState.setConnected(false);
        setConnecting(false);
        terminalState.setConnectionError("No active session client.");
        appendLocalLine("No active session client.");
        return;
      }

      clientRef.current.sendTerminalSignal(signal);
    } catch (error) {
      terminalState.setConnected(false);
      setConnecting(false);
      const reason = error instanceof Error ? error.message : "Shortcut was not sent.";
      terminalState.setConnectionError(reason);
      appendLocalLine(reason);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.screen}
      >
        <View style={styles.header}>
          <View style={styles.titleGroup}>
            <Pressable accessibilityRole="button" onPress={onBack} style={styles.backButton}>
              <Text style={styles.backButtonText}>Connections</Text>
            </Pressable>
            <Text style={styles.title}>Terminal</Text>
            <View style={styles.statusRow}>
              <View
                style={[
                  styles.statusDot,
                  snapshot.connected ? styles.statusOnline : connecting ? styles.statusConnecting : styles.statusOffline
                ]}
              />
              <Text style={styles.statusText}>
                {getConnectionStatusLabel({
                  connected: snapshot.connected,
                  connecting,
                  deviceId: selectedDevice.deviceId
                })}
              </Text>
            </View>
            <Text numberOfLines={1} style={styles.configText}>
              {selectedDevice.deviceId} · {runtimeConfig.displaySessionUrl}
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={snapshot.connected || connecting}
            onPress={handleConnect}
            style={({ pressed }) => [
              styles.connectButton,
              snapshot.connected && styles.connectButtonConnected,
              connecting && styles.connectButtonConnecting,
              pressed && !snapshot.connected && !connecting && styles.connectButtonPressed
            ]}
          >
            <Text
              style={[
                styles.connectButtonText,
                snapshot.connected && styles.connectButtonTextConnected,
                connecting && styles.connectButtonTextConnecting
              ]}
            >
              {snapshot.connected ? "Online" : connecting ? "..." : "Connect"}
            </Text>
          </Pressable>
        </View>

        {snapshot.connectionError ? (
          <View style={styles.errorBanner}>
            <Text numberOfLines={2} style={styles.errorText}>
              {snapshot.connectionError}
            </Text>
            {manualReconnectVisible ? (
              <Pressable
                accessibilityRole="button"
                onPress={handleManualReconnect}
                style={({ pressed }) => [styles.reconnectButton, pressed && styles.reconnectButtonPressed]}
              >
                <Text style={styles.reconnectButtonText}>Reconnect</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <View style={styles.pairingPanel}>
          <View style={styles.pairedCompactRow}>
            <View style={styles.pairedDeviceMeta}>
              <Text style={styles.pairingTitle}>Mac</Text>
              <Text numberOfLines={1} style={styles.pairedDeviceText}>
                {selectedDevice.deviceId} · Ready
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={handleForgetPairing}
              style={({ pressed }) => [styles.forgetButton, pressed && styles.forgetButtonPressed]}
            >
              <Text style={styles.forgetButtonText}>Forget</Text>
            </Pressable>
          </View>
        </View>

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.outputContent}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          style={styles.outputPanel}
        >
          {snapshot.output.length === 0 ? (
            <Text style={styles.emptyText}>No output yet.</Text>
          ) : (
            <Text selectable style={styles.outputText}>
              {snapshot.output}
            </Text>
          )}
        </ScrollView>

        <ScrollView
          horizontal
          keyboardShouldPersistTaps="handled"
          showsHorizontalScrollIndicator={false}
          style={styles.shortcutRail}
          contentContainerStyle={styles.shortcutContent}
        >
          {terminalShortcutPayloads.map((shortcut) => (
            <Pressable
              accessibilityLabel={`Send ${shortcut.label}`}
              accessibilityRole="button"
              key={shortcut.label}
              onPress={() => (shortcut.type === "signal" ? sendSignal(shortcut.signal) : sendRawInput(shortcut.payload))}
              style={({ pressed }) => [styles.shortcutButton, pressed && styles.shortcutButtonPressed]}
            >
              <Text style={styles.shortcutText}>{shortcut.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.inputRow}>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={handleInputChange}
            onSubmitEditing={handleSend}
            placeholder="输入命令，例如 pwd"
            placeholderTextColor={colors.textMuted}
            returnKeyType="send"
            style={styles.input}
            value={snapshot.input}
          />
          <Pressable
            accessibilityRole="button"
            onPress={handleSend}
            style={({ pressed }) => [styles.sendButton, pressed && styles.sendButtonPressed]}
          >
            <Text style={styles.sendButtonText}>Run</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const colors = mobileShellTheme.colors;
const layout = mobileShellTheme.layout;
const terminalFont = Platform.select(mobileShellTheme.fonts.terminal);

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.appBackground
  },
  screen: {
    flex: 1,
    backgroundColor: colors.appBackground
  },
  header: {
    minHeight: layout.headerMinHeight,
    paddingHorizontal: layout.horizontalPadding,
    paddingTop: 10,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.panelBorder,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    backgroundColor: colors.appBackground
  },
  titleGroup: {
    flex: 1,
    minWidth: 0
  },
  backButton: {
    alignSelf: "flex-start",
    minHeight: 24,
    justifyContent: "center"
  },
  backButtonText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "600"
  },
  title: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: 0
  },
  statusRow: {
    marginTop: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  statusOnline: {
    backgroundColor: colors.online
  },
  statusOffline: {
    backgroundColor: colors.offline
  },
  statusConnecting: {
    backgroundColor: colors.connecting
  },
  statusText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
    fontFamily: terminalFont
  },
  configText: {
    marginTop: 3,
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 14,
    fontFamily: terminalFont
  },
  connectButton: {
    minWidth: 88,
    minHeight: 38,
    paddingHorizontal: 14,
    borderRadius: layout.panelRadius,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center"
  },
  connectButtonPressed: {
    backgroundColor: colors.accentPressed
  },
  connectButtonConnected: {
    borderColor: colors.online,
    backgroundColor: colors.appBackground
  },
  connectButtonConnecting: {
    borderColor: colors.connecting,
    backgroundColor: colors.warningSurface
  },
  connectButtonText: {
    color: colors.accentText,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0
  },
  connectButtonTextConnected: {
    color: colors.online
  },
  connectButtonTextConnecting: {
    color: colors.warning
  },
  outputPanel: {
    flex: 1,
    marginHorizontal: layout.horizontalPadding,
    marginTop: layout.sectionGap,
    borderRadius: layout.terminalRadius,
    borderWidth: 1,
    borderColor: colors.terminalBorder,
    backgroundColor: colors.terminalBackground
  },
  errorBanner: {
    minHeight: 36,
    marginHorizontal: layout.horizontalPadding,
    marginTop: layout.sectionGap,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: layout.panelRadius,
    borderColor: "#f0d8b8",
    backgroundColor: colors.warningSurface,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  errorText: {
    flex: 1,
    minWidth: 0,
    color: colors.warning,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: terminalFont
  },
  reconnectButton: {
    minHeight: 30,
    minWidth: 84,
    borderRadius: layout.panelRadius,
    borderWidth: 1,
    borderColor: colors.warning,
    backgroundColor: colors.panel,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10
  },
  reconnectButtonPressed: {
    backgroundColor: "#f7e4cb"
  },
  reconnectButtonText: {
    color: colors.warning,
    fontSize: 12,
    fontWeight: "800"
  },
  pairingPanel: {
    marginHorizontal: layout.horizontalPadding,
    marginTop: layout.sectionGap,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: layout.panelRadius,
    borderColor: colors.panelBorder,
    backgroundColor: colors.panel,
    gap: 7
  },
  pairingTitle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "700"
  },
  pairedCompactRow: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  pairedDeviceMeta: {
    flex: 1,
    minWidth: 0,
    gap: 2
  },
  pairedDeviceText: {
    flex: 1,
    minWidth: 0,
    color: colors.online,
    fontSize: 12,
    fontWeight: "700",
    fontFamily: terminalFont
  },
  forgetButton: {
    minHeight: 28,
    minWidth: 62,
    borderRadius: layout.panelRadius,
    borderWidth: 1,
    borderColor: "#e3b9ad",
    backgroundColor: colors.dangerSurface,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10
  },
  forgetButtonPressed: {
    backgroundColor: "#f7ded7"
  },
  forgetButtonText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "800"
  },
  outputContent: {
    flexGrow: 1,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  outputText: {
    color: colors.terminalText,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: terminalFont
  },
  emptyText: {
    color: colors.terminalMuted,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: terminalFont
  },
  shortcutRail: {
    maxHeight: 44,
    marginHorizontal: layout.horizontalPadding,
    marginTop: layout.sectionGap,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.panelBorder,
    borderRadius: layout.panelRadius,
    backgroundColor: colors.appBackground
  },
  shortcutContent: {
    paddingHorizontal: 8,
    paddingVertical: 7,
    gap: 7
  },
  shortcutButton: {
    minWidth: 50,
    height: layout.shortcutHeight,
    paddingHorizontal: 10,
    borderRadius: layout.panelRadius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.panelBorder,
    backgroundColor: colors.panel,
    alignItems: "center",
    justifyContent: "center"
  },
  shortcutButtonPressed: {
    backgroundColor: colors.panelMuted
  },
  shortcutText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "700",
    fontFamily: terminalFont
  },
  inputRow: {
    minHeight: 64,
    paddingHorizontal: layout.horizontalPadding,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.panelBorder,
    backgroundColor: colors.panel,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: layout.inputMinHeight,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: layout.panelRadius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.commandBorder,
    backgroundColor: colors.commandBackground,
    color: colors.textPrimary,
    fontSize: 14,
    fontFamily: terminalFont
  },
  sendButton: {
    width: 58,
    minHeight: layout.inputMinHeight,
    borderRadius: layout.panelRadius,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center"
  },
  sendButtonPressed: {
    backgroundColor: colors.accentPressed
  },
  sendButtonText: {
    color: colors.accentText,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0
  }
});
