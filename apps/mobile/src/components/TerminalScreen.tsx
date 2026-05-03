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
import { loadMobileRuntimeConfig } from "../config/runtimeConfig";
import { PairingClient } from "../protocol/pairingClient";
import { SessionClient } from "../protocol/sessionClient";
import {
  clearPairingToken,
  createSecureStorePairingTokenStorage,
  loadPairingToken,
  savePairingToken
} from "../state/pairingTokenStore";
import { createTerminalState } from "../state/terminalStore";
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

  const handlePairingSubmit = async () => {
    const normalizedCode = pairingCode.trim();
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
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Pairing request failed.";
      setPairingStatus(reason);
      appendLocalLine(`Pairing request failed: ${reason}`);
    } finally {
      setPairingSubmitting(false);
    }
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

  const handleConnect = () => {
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
        sessionToken,
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

  useEffect(() => {
    if (!runtimeConfig.autoConnect || autoConnectAttemptedRef.current) {
      return;
    }

    autoConnectAttemptedRef.current = true;
    handleConnect();
  }, [runtimeConfig.autoConnect]);

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
            <Text style={styles.title}>Remote Terminal</Text>
            <View style={styles.statusRow}>
              <View
                style={[
                  styles.statusDot,
                  snapshot.connected ? styles.statusOnline : connecting ? styles.statusConnecting : styles.statusOffline
                ]}
              />
              <Text style={styles.statusText}>
                {snapshot.connected ? "session open" : connecting ? "connecting" : runtimeConfig.deviceId}
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
              {snapshot.connected ? "Connected" : connecting ? "Connecting" : "Connect"}
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
          <View style={styles.pairingMeta}>
            <Text style={styles.pairingTitle}>Pair device</Text>
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
              placeholderTextColor="#6f756f"
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
          {pairedDeviceId ? (
            <View style={styles.pairedDeviceRow}>
              <Text numberOfLines={1} style={styles.pairedDeviceText}>
                Paired {pairedDeviceId}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={handleForgetPairing}
                style={({ pressed }) => [styles.forgetButton, pressed && styles.forgetButtonPressed]}
              >
                <Text style={styles.forgetButtonText}>Forget</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.outputContent}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          style={styles.outputPanel}
        >
          {snapshot.output.length === 0 ? (
            <Text style={styles.emptyText}>Connect to {runtimeConfig.deviceId} to start a terminal session.</Text>
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
            placeholderTextColor="#6f756f"
            returnKeyType="send"
            style={styles.input}
            value={snapshot.input}
          />
          <Pressable
            accessibilityRole="button"
            onPress={handleSend}
            style={({ pressed }) => [styles.sendButton, pressed && styles.sendButtonPressed]}
          >
            <Text style={styles.sendButtonText}>发送</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#111312"
  },
  screen: {
    flex: 1,
    backgroundColor: "#111312"
  },
  header: {
    minHeight: 64,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#242826",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  titleGroup: {
    flex: 1,
    minWidth: 0
  },
  title: {
    color: "#eef2ed",
    fontSize: 20,
    fontWeight: "700"
  },
  statusRow: {
    marginTop: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: 7
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  statusOnline: {
    backgroundColor: "#73d578"
  },
  statusOffline: {
    backgroundColor: "#d7a84d"
  },
  statusConnecting: {
    backgroundColor: "#d7a84d"
  },
  statusText: {
    color: "#9aa39a",
    fontSize: 12,
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" })
  },
  configText: {
    marginTop: 4,
    color: "#68716a",
    fontSize: 11,
    lineHeight: 15,
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" })
  },
  connectButton: {
    minWidth: 96,
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#5a6a5a",
    backgroundColor: "#1b241d",
    alignItems: "center",
    justifyContent: "center"
  },
  connectButtonPressed: {
    backgroundColor: "#263629"
  },
  connectButtonConnected: {
    borderColor: "#314034",
    backgroundColor: "#151b16"
  },
  connectButtonConnecting: {
    borderColor: "#5f5131",
    backgroundColor: "#221c0f"
  },
  connectButtonText: {
    color: "#dce8dc",
    fontSize: 14,
    fontWeight: "700"
  },
  connectButtonTextConnected: {
    color: "#73d578"
  },
  connectButtonTextConnecting: {
    color: "#e0bd66"
  },
  outputPanel: {
    flex: 1,
    backgroundColor: "#080a09"
  },
  errorBanner: {
    minHeight: 36,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#4f3929",
    backgroundColor: "#211710",
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  errorText: {
    flex: 1,
    minWidth: 0,
    color: "#f1bf85",
    fontSize: 12,
    lineHeight: 18,
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" })
  },
  reconnectButton: {
    minHeight: 30,
    minWidth: 88,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#8a6645",
    backgroundColor: "#2b2118",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10
  },
  reconnectButtonPressed: {
    backgroundColor: "#3a2a1d"
  },
  reconnectButtonText: {
    color: "#f1bf85",
    fontSize: 12,
    fontWeight: "800"
  },
  pairingPanel: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#242826",
    backgroundColor: "#151816",
    gap: 8
  },
  pairingMeta: {
    gap: 2
  },
  pairingTitle: {
    color: "#eef2ed",
    fontSize: 13,
    fontWeight: "700"
  },
  pairingApiText: {
    color: "#8f978f",
    fontSize: 11,
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" })
  },
  pairingControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  pairingInput: {
    flex: 1,
    minHeight: 38,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#313733",
    backgroundColor: "#101211",
    color: "#f4f7f2",
    paddingHorizontal: 10,
    fontSize: 15,
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" })
  },
  pairingButton: {
    minHeight: 38,
    minWidth: 68,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#dce8cc",
    paddingHorizontal: 12
  },
  pairingButtonPressed: {
    backgroundColor: "#f2f7e9"
  },
  pairingButtonDisabled: {
    backgroundColor: "#586052"
  },
  pairingButtonText: {
    color: "#111312",
    fontSize: 13,
    fontWeight: "800"
  },
  pairingStatusText: {
    color: "#b9c2b6",
    fontSize: 12,
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" })
  },
  pairedDeviceRow: {
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  pairedDeviceText: {
    flex: 1,
    minWidth: 0,
    color: "#9ed29a",
    fontSize: 12,
    fontWeight: "700",
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" })
  },
  forgetButton: {
    minHeight: 30,
    minWidth: 64,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#51433a",
    backgroundColor: "#1f1815",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10
  },
  forgetButtonPressed: {
    backgroundColor: "#2d211c"
  },
  forgetButtonText: {
    color: "#e5b99a",
    fontSize: 12,
    fontWeight: "800"
  },
  outputContent: {
    flexGrow: 1,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  outputText: {
    color: "#d7ddd4",
    fontSize: 13,
    lineHeight: 19,
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" })
  },
  emptyText: {
    color: "#7f877f",
    fontSize: 13,
    lineHeight: 19,
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" })
  },
  shortcutRail: {
    maxHeight: 48,
    borderTopWidth: 1,
    borderTopColor: "#202522",
    backgroundColor: "#101311"
  },
  shortcutContent: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8
  },
  shortcutButton: {
    minWidth: 54,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#2f3933",
    backgroundColor: "#171d19",
    alignItems: "center",
    justifyContent: "center"
  },
  shortcutButtonPressed: {
    backgroundColor: "#233029"
  },
  shortcutText: {
    color: "#d7ddd4",
    fontSize: 13,
    fontWeight: "700",
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" })
  },
  inputRow: {
    minHeight: 64,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#242826",
    backgroundColor: "#121513",
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 42,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#303733",
    backgroundColor: "#090b0a",
    color: "#eef2ed",
    fontSize: 14,
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" })
  },
  sendButton: {
    width: 64,
    minHeight: 42,
    borderRadius: 6,
    backgroundColor: "#c8a453",
    alignItems: "center",
    justifyContent: "center"
  },
  sendButtonPressed: {
    backgroundColor: "#ddb95f"
  },
  sendButtonText: {
    color: "#15120a",
    fontSize: 15,
    fontWeight: "800"
  }
});
