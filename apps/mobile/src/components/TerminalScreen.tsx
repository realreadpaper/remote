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
import { SessionClient } from "../protocol/sessionClient";
import { createTerminalState } from "../state/terminalStore";

const SESSION_URL = process.env.EXPO_PUBLIC_REMOTE_WS_URL ?? "ws://localhost:3000";
const DEVICE_ID = process.env.EXPO_PUBLIC_REMOTE_DEVICE_ID ?? "mac-dev";

export function TerminalScreen() {
  const terminalState = useMemo(() => createTerminalState(), []);
  const [snapshot, setSnapshot] = useState(() => terminalState.getSnapshot());
  const [connecting, setConnecting] = useState(false);
  const clientRef = useRef<SessionClient | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);

  const refreshSnapshot = () => {
    setSnapshot(terminalState.getSnapshot());
  };

  const appendLocalLine = (message: string) => {
    terminalState.appendOutput(`[local] ${message}\n`);
    refreshSnapshot();
  };

  useEffect(() => {
    return () => {
      clientRef.current?.close();
      clientRef.current = null;
    };
  }, []);

  const handleConnect = () => {
    if (snapshot.connected || connecting) {
      return;
    }

    setConnecting(true);
    try {
      const client = new SessionClient({
        url: SESSION_URL,
        deviceId: DEVICE_ID,
        onMessage(message) {
          if (message.type === "session.opened") {
            terminalState.setConnected(true);
            setConnecting(false);
          }

          if (message.type === "terminal.output") {
            terminalState.appendOutput(message.data);
          }

          if (message.type === "session.error") {
            terminalState.appendOutput(`[server] ${message.message}\n`);
            terminalState.setConnected(false);
            setConnecting(false);
          }

          if (message.type === "terminal.exit") {
            terminalState.appendOutput(
              `[server] terminal exited${message.exitCode === null ? "" : ` with code ${message.exitCode}`}\n`
            );
            terminalState.setConnected(false);
            setConnecting(false);
          }

          refreshSnapshot();
        },
        onDisconnect(reason) {
          terminalState.setConnected(false);
          setConnecting(false);
          terminalState.appendOutput(`[local] ${reason}\n`);
          refreshSnapshot();
        }
      });

      clientRef.current = client;
      client.connect();
    } catch (error) {
      terminalState.setConnected(false);
      setConnecting(false);
      appendLocalLine(error instanceof Error ? error.message : "Unable to connect.");
    }
  };

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
                {snapshot.connected ? "session open" : connecting ? "connecting" : DEVICE_ID}
              </Text>
            </View>
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

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.outputContent}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          style={styles.outputPanel}
        >
          {snapshot.output.length === 0 ? (
            <Text style={styles.emptyText}>Connect to {DEVICE_ID} to start a terminal session.</Text>
          ) : (
            <Text selectable style={styles.outputText}>
              {snapshot.output}
            </Text>
          )}
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
