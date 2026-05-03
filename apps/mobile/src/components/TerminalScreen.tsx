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
import {
  clearPairingToken,
  createSecureStorePairingTokenStorage,
  loadPairingToken,
  savePairingToken
} from "../state/pairingTokenStore";
import { createTerminalState } from "../state/terminalStore";
import { getConnectionStatusLabel, getPairingPanelMode, mobileShellTheme } from "./mobileShellTheme";
import { terminalShortcutPayloads } from "./terminalShortcuts";

export function TerminalScreen() {
  const runtimeConfig = useMemo(() => loadMobileRuntimeConfig(), []);
  const terminalState = useMemo(() => createTerminalState(), []);
  const pairingTokenStorage = useMemo(() => createSecureStorePairingTokenStorage(), []);
  const [snapshot, setSnapshot] = useState(() => terminalState.getSnapshot());
  const [connecting, setConnecting] = useState(false);
  const [pairingCode, setPairingCode] = useState("");
  const [pairingStatus, setPairingStatus] = useState<string | null>(null);
  const [pairingSubmitting, setPairingSubmitting] = useState(false);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [pairedDeviceId, setPairedDeviceId] = useState<string | null>(null);
  const [appActive, setAppActive] = useState(true);
  const [manualReconnectVisible, setManualReconnectVisible] = useState(false);
  const clientRef = useRef<SessionClient | undefined>(undefined);
  const autoConnectAttemptedRef = useRef(false);
  const autoPairAttemptedRef = useRef(false);
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

  const submitPairingCode = async (normalizedCode: string) => {
    if (!normalizedCode || pairingSubmitting) {
      appendLocalLine("Enter a pairing code first.");
      return;
    }

    setPairingSubmitting(true);
    setPairingStatus("sending");
    setSessionToken(null);
    setPairedDeviceId(null);
    try {
      const client = new PairingClient({
        apiBaseUrl: runtimeConfig.apiBaseUrl,
        devToken: runtimeConfig.devToken
      });
      const result = await client.requestPairing({
        pairingCode: normalizedCode,
        mobileClientId: runtimeConfig.mobileClientId,
        mobileName: runtimeConfig.mobileName
      });
      setPairingStatus(`pending ${result.pairingRequestId}`);
      appendLocalLine(`Pairing request pending for ${result.deviceId}.`);
      const auth = await client.waitForApproval(result.pairingRequestId);
      setSessionToken(auth.sessionToken);
      setPairedDeviceId(auth.deviceId);
      setPairingStatus(`paired until ${auth.expiresAt}`);
      await savePairingToken(pairingTokenStorage, {
        deviceId: auth.deviceId,
        sessionToken: auth.sessionToken,
        expiresAt: auth.expiresAt,
        pairedAt: new Date().toISOString()
      });
      appendLocalLine(`Pairing approved for ${auth.deviceId}.`);
      if (runtimeConfig.autoConnect) {
        openTerminalSession(auth.sessionToken);
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Pairing request failed.";
      setPairingStatus(reason);
      appendLocalLine(`Pairing request failed: ${reason}`);
    } finally {
      setPairingSubmitting(false);
    }
  };

  const handlePairingSubmit = async () => {
    await submitPairingCode(pairingCode.trim());
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

  useEffect(() => {
    let active = true;

    void loadPairingToken(pairingTokenStorage)
      .then((token) => {
        if (!active || !token) {
          return;
        }

        setSessionToken(token.sessionToken);
        setPairedDeviceId(token.deviceId);
        setPairingStatus(`paired ${token.deviceId} until ${token.expiresAt}`);
        appendLocalLine(`Restored pairing for ${token.deviceId}.`);
      })
      .catch((error) => {
        if (!active) {
          return;
        }

        const reason = error instanceof Error ? error.message : "Pairing restore failed.";
        setPairingStatus(reason);
        appendLocalLine(`Pairing restore failed: ${reason}`);
      });

    return () => {
      active = false;
    };
  }, [pairingTokenStorage]);

  const handleForgetPairing = async () => {
    const tokenToRevoke = sessionToken;
    const deviceToRevoke = pairedDeviceId;

    try {
      if (tokenToRevoke && deviceToRevoke) {
        const client = new PairingClient({
          apiBaseUrl: runtimeConfig.apiBaseUrl,
          devToken: runtimeConfig.devToken
        });
        await client.revokeSessionToken({
          deviceId: deviceToRevoke,
          sessionToken: tokenToRevoke
        });
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Session token revoke failed.";
      appendLocalLine(`Session token revoke failed: ${reason}`);
    }

    try {
      await clearPairingToken(pairingTokenStorage);
      closeCurrentClient();
      setSessionToken(null);
      setPairedDeviceId(null);
      setPairingStatus("not paired");
      terminalState.setConnected(false);
      setConnecting(false);
      appendLocalLine("Forgot paired device.");
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Forget device failed.";
      setPairingStatus(reason);
      appendLocalLine(`Forget device failed: ${reason}`);
    }
  };

  const openTerminalSession = (sessionTokenOverride: string | null) => {
    if (snapshot.connected || connecting) {
      return;
    }

    setConnecting(true);
    try {
      closeCurrentClient();
      let smokeCommandSent = false;
      const client = new SessionClient({
        url: runtimeConfig.sessionUrl,
        deviceId: runtimeConfig.deviceId,
        sessionToken: sessionTokenOverride,
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
    openTerminalSession(sessionToken);
  };

  useEffect(() => {
    if (
      !shouldAutoConnectTerminal({
        autoConnect: runtimeConfig.autoConnect,
        autoPairingCode: runtimeConfig.autoPairingCode,
        autoConnectAttempted: autoConnectAttemptedRef.current,
        sessionToken
      })
    ) {
      return;
    }

    autoConnectAttemptedRef.current = true;
    handleConnect();
  }, [runtimeConfig.autoConnect, runtimeConfig.autoPairingCode, sessionToken]);

  useEffect(() => {
    if (!runtimeConfig.autoPairingCode || autoPairAttemptedRef.current || sessionToken || pairingSubmitting) {
      return;
    }

    autoPairAttemptedRef.current = true;
    setPairingCode(runtimeConfig.autoPairingCode);
    void submitPairingCode(runtimeConfig.autoPairingCode);
  }, [runtimeConfig.autoPairingCode, pairingSubmitting, sessionToken]);

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

  const pairingPanelMode = getPairingPanelMode(pairedDeviceId);

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.screen}
      >
        <View style={styles.header}>
          <View style={styles.titleGroup}>
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
                  deviceId: runtimeConfig.deviceId
                })}
              </Text>
            </View>
            <Text numberOfLines={1} style={styles.configText}>
              {runtimeConfig.deviceId} · {runtimeConfig.displaySessionUrl}
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
          {pairingPanelMode === "setup" ? (
            <>
              <View style={styles.pairingMeta}>
                <Text style={styles.pairingTitle}>Pair Mac</Text>
                <Text numberOfLines={1} style={styles.pairingApiText}>
                  {runtimeConfig.mobileClientId} · {runtimeConfig.displayApiBaseUrl}
                </Text>
              </View>
              <View style={styles.pairingControls}>
                <TextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="number-pad"
                  onChangeText={setPairingCode}
                  placeholder="配对码"
                  placeholderTextColor={colors.textMuted}
                  style={styles.pairingInput}
                  value={pairingCode}
                />
                <Pressable
                  accessibilityRole="button"
                  disabled={pairingSubmitting}
                  onPress={handlePairingSubmit}
                  style={({ pressed }) => [
                    styles.pairingButton,
                    pairingSubmitting && styles.pairingButtonDisabled,
                    pressed && !pairingSubmitting && styles.pairingButtonPressed
                  ]}
                >
                  <Text style={styles.pairingButtonText}>{pairingSubmitting ? "..." : "Pair"}</Text>
                </Pressable>
              </View>
              {pairingStatus ? (
                <Text numberOfLines={1} style={styles.pairingStatusText}>
                  {pairingStatus}
                </Text>
              ) : null}
            </>
          ) : (
            <View style={styles.pairedCompactRow}>
              <View style={styles.pairedDeviceMeta}>
                <Text style={styles.pairingTitle}>Mac</Text>
                <Text numberOfLines={1} style={styles.pairedDeviceText}>
                  {pairedDeviceId} · Ready
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
          )}
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
  pairingMeta: {
    gap: 2
  },
  pairingTitle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "700"
  },
  pairingApiText: {
    color: colors.textMuted,
    fontSize: 11,
    fontFamily: terminalFont
  },
  pairingControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  pairingInput: {
    flex: 1,
    minHeight: 38,
    borderRadius: layout.panelRadius,
    borderWidth: 1,
    borderColor: colors.commandBorder,
    backgroundColor: colors.commandBackground,
    color: colors.textPrimary,
    paddingHorizontal: 10,
    fontSize: 15,
    fontFamily: terminalFont
  },
  pairingButton: {
    minHeight: 38,
    minWidth: 64,
    borderRadius: layout.panelRadius,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.textPrimary,
    paddingHorizontal: 12
  },
  pairingButtonPressed: {
    backgroundColor: "#384247"
  },
  pairingButtonDisabled: {
    backgroundColor: colors.panelMuted
  },
  pairingButtonText: {
    color: colors.panel,
    fontSize: 13,
    fontWeight: "700"
  },
  pairingStatusText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontFamily: terminalFont
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
