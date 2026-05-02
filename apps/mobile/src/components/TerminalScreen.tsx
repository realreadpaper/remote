import { useEffect, useMemo, useRef, useState } from "react";
import {
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
import { SessionClient } from "../protocol/sessionClient";
import { createTerminalState } from "../state/terminalStore";
import { terminalShortcutPayloads } from "./terminalShortcuts";

export function TerminalScreen() {
  const runtimeConfig = useMemo(() => loadMobileRuntimeConfig(), []);
  const terminalState = useMemo(() => createTerminalState(), []);
  const [snapshot, setSnapshot] = useState(() => terminalState.getSnapshot());
  const [connecting, setConnecting] = useState(false);
  const clientRef = useRef<SessionClient | undefined>(undefined);
  const autoConnectAttemptedRef = useRef(false);
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
  };

  useEffect(() => {
    return () => {
      closeCurrentClient();
    };
  }, []);

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
        onMessage(message) {
          if (clientRef.current !== client) {
            return;
          }

          if (message.type === "session.opened") {
            terminalState.setConnected(true);
            setConnecting(false);
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
            closeCurrentClient();
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
          closeCurrentClient();
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
              {runtimeConfig.deviceId} · {runtimeConfig.sessionUrl}
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
          </View>
        ) : null}

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
              onPress={() => sendRawInput(shortcut.payload)}
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
    backgroundColor: "#211710"
  },
  errorText: {
    color: "#f1bf85",
    fontSize: 12,
    lineHeight: 18,
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" })
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
