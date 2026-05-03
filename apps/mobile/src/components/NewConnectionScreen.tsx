import { useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from "react-native";
import { tryLoadMobileRuntimeConfig } from "../config/runtimeConfig";
import { PairingClient } from "../protocol/pairingClient";
import type { PairingTokenRecord } from "../state/pairingTokenStore";
import { mobileShellTheme } from "./mobileShellTheme";

export interface NewConnectionScreenProps {
  onCancel: () => void;
  onPaired: (record: PairingTokenRecord) => void;
}

export function NewConnectionScreen({ onCancel, onPaired }: NewConnectionScreenProps) {
  const runtimeConfigResult = useMemo(() => tryLoadMobileRuntimeConfig(), []);
  const [pairingCode, setPairingCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState("Enter the pairing code shown on your Mac.");

  const submitPairingCode = async () => {
    const normalizedCode = pairingCode.trim();
    if (!normalizedCode || submitting) {
      setStatus("Enter a pairing code first.");
      return;
    }

    setSubmitting(true);
    setStatus("Waiting for Mac approval.");
    try {
      if (!runtimeConfigResult.ok) {
        throw new Error(runtimeConfigResult.error);
      }

      const client = new PairingClient({
        apiBaseUrl: runtimeConfigResult.config.apiBaseUrl,
        devToken: runtimeConfigResult.config.devToken
      });
      const result = await client.requestPairing({
        pairingCode: normalizedCode,
        mobileClientId: runtimeConfigResult.config.mobileClientId,
        mobileName: runtimeConfigResult.config.mobileName
      });
      const auth = await client.waitForApproval(result.pairingRequestId);
      onPaired({
        deviceId: auth.deviceId,
        sessionToken: auth.sessionToken,
        expiresAt: auth.expiresAt,
        pairedAt: new Date().toISOString()
      });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Pairing request failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.screen}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" onPress={onCancel} style={styles.cancelButton}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Text style={styles.headerTitle}>New Connection</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.content}>
          <Text style={styles.title}>Pair a Mac</Text>
          <Text style={styles.subtitle}>Open the Agent on your Mac, create a pairing code, then enter it here.</Text>
          {!runtimeConfigResult.ok ? (
            <View style={styles.configPanel}>
              <Text style={styles.configText}>{runtimeConfigResult.error}</Text>
            </View>
          ) : null}
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="number-pad"
            onChangeText={setPairingCode}
            placeholder="Pairing code"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            value={pairingCode}
          />
          <Pressable
            accessibilityRole="button"
            disabled={submitting || !runtimeConfigResult.ok}
            onPress={submitPairingCode}
            style={({ pressed }) => [
              styles.primaryButton,
              (submitting || !runtimeConfigResult.ok) && styles.primaryButtonDisabled,
              pressed && !submitting && runtimeConfigResult.ok && styles.primaryButtonPressed
            ]}
          >
            <Text style={styles.primaryButtonText}>{submitting ? "Waiting" : "Pair"}</Text>
          </Pressable>
          <Text style={styles.statusText}>{status}</Text>
        </View>
      </KeyboardAvoidingView>
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
  screen: {
    flex: 1,
    backgroundColor: colors.appBackground
  },
  header: {
    minHeight: 54,
    paddingHorizontal: layout.horizontalPadding,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.panelBorder,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  cancelButton: {
    minWidth: 64,
    minHeight: 36,
    justifyContent: "center"
  },
  cancelText: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: "600"
  },
  headerTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "700"
  },
  headerSpacer: {
    width: 64
  },
  content: {
    padding: layout.horizontalPadding,
    gap: 12
  },
  title: {
    marginTop: 18,
    color: colors.textPrimary,
    fontSize: 30,
    fontWeight: "700"
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 21
  },
  configPanel: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: layout.panelRadius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.panelBorder,
    backgroundColor: colors.warningSurface
  },
  configText: {
    color: colors.warning,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18
  },
  input: {
    minHeight: 48,
    paddingHorizontal: 12,
    borderRadius: layout.panelRadius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.commandBorder,
    backgroundColor: colors.commandBackground,
    color: colors.textPrimary,
    fontSize: 18
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: layout.panelRadius,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center"
  },
  primaryButtonPressed: {
    backgroundColor: colors.accentPressed
  },
  primaryButtonDisabled: {
    backgroundColor: colors.panelMuted
  },
  primaryButtonText: {
    color: colors.accentText,
    fontSize: 17,
    fontWeight: "700"
  },
  statusText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20
  }
});
