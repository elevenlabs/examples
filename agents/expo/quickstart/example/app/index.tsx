import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ConversationProvider, useConversation } from "@elevenlabs/react";

type TranscriptLine = {
  key: string;
  role: "user" | "agent";
  text: string;
};

function VoiceAgentPanel({
  onClearProviderError,
}: {
  onClearProviderError: () => void;
}) {
  const [agentId, setAgentId] = useState("");
  const [agentName, setAgentName] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [apiError, setApiError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"idle" | "create" | "load" | "token">(
    "idle"
  );

  const {
    startSession,
    endSession,
    status,
    message: statusMessage,
  } = useConversation({
    onMessage: props => {
      setTranscript(prev => [
        ...prev,
        {
          key: `${props.event_id ?? Date.now()}-${prev.length}`,
          role: props.role,
          text: props.message,
        },
      ]);
    },
  });

  const clearConversationError = useCallback(() => {
    setApiError(null);
  }, []);

  const createAgent = useCallback(async () => {
    setBusy("create");
    setApiError(null);
    try {
      const response = await fetch("/api/agent", { method: "POST" });
      const data = (await response.json()) as {
        agentId?: string;
        agentName?: string;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? `Request failed (${response.status})`);
      }
      if (!data.agentId) {
        throw new Error("Missing agentId in response");
      }
      setAgentId(data.agentId);
      setAgentName(data.agentName ?? null);
    } catch (e) {
      setApiError(e instanceof Error ? e.message : "Failed to create agent");
    } finally {
      setBusy("idle");
    }
  }, []);

  const loadAgent = useCallback(async () => {
    if (!agentId.trim()) {
      setApiError("Enter an agent id first.");
      return;
    }
    setBusy("load");
    setApiError(null);
    try {
      const response = await fetch(
        `/api/agent?agentId=${encodeURIComponent(agentId.trim())}`
      );
      const data = (await response.json()) as {
        agentId?: string;
        agentName?: string;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? `Request failed (${response.status})`);
      }
      setAgentName(data.agentName ?? null);
    } catch (e) {
      setApiError(e instanceof Error ? e.message : "Failed to load agent");
    } finally {
      setBusy("idle");
    }
  }, [agentId]);

  const startVoice = useCallback(async () => {
    if (!agentId.trim()) {
      setApiError("Enter or create an agent id first.");
      return;
    }
    setBusy("token");
    setApiError(null);
    onClearProviderError();
    setTranscript([]);
    try {
      if (
        typeof navigator !== "undefined" &&
        navigator.mediaDevices?.getUserMedia
      ) {
        await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      const response = await fetch(
        `/api/conversation-token?agentId=${encodeURIComponent(agentId.trim())}`
      );
      const data = (await response.json()) as {
        token?: string;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? `Request failed (${response.status})`);
      }
      if (!data.token) {
        throw new Error("Missing token in response");
      }
      await startSession({
        conversationToken: data.token,
        connectionType: "webrtc",
      });
    } catch (e) {
      setApiError(e instanceof Error ? e.message : "Failed to start session");
    } finally {
      setBusy("idle");
    }
  }, [agentId, onClearProviderError, startSession]);

  const stopVoice = useCallback(() => {
    setApiError(null);
    onClearProviderError();
    void endSession();
  }, [endSession, onClearProviderError]);

  const isBusy = busy !== "idle";
  const isConnected = status === "connected";
  const canStart = !isBusy && !isConnected && !!agentId.trim();
  const primaryDisabled = isConnected ? false : !canStart || isBusy;

  return (
    <View>
      <Text style={styles.label}>Agent ID</Text>
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={t => {
          setAgentId(t);
          clearConversationError();
        }}
        placeholder="Paste or create an agent id"
        style={styles.input}
        value={agentId}
      />

      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          disabled={isBusy}
          onPress={createAgent}
          style={({ pressed }) => [
            styles.buttonSecondary,
            (pressed || isBusy) && styles.buttonPressed,
          ]}
        >
          {busy === "create" ? (
            <ActivityIndicator color="#171717" />
          ) : (
            <Text style={styles.buttonSecondaryText}>Create Agent</Text>
          )}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={isBusy}
          onPress={loadAgent}
          style={({ pressed }) => [
            styles.buttonSecondary,
            (pressed || isBusy) && styles.buttonPressed,
          ]}
        >
          {busy === "load" ? (
            <ActivityIndicator color="#171717" />
          ) : (
            <Text style={styles.buttonSecondaryText}>Load agent</Text>
          )}
        </Pressable>
      </View>

      {agentName ? <Text style={styles.meta}>Loaded: {agentName}</Text> : null}

      <Pressable
        accessibilityRole="button"
        disabled={primaryDisabled}
        onPress={isConnected ? stopVoice : startVoice}
        style={({ pressed }) => [
          styles.buttonPrimary,
          (pressed || (isBusy && busy === "token")) && styles.buttonPressed,
          primaryDisabled ? styles.buttonDisabled : null,
        ]}
      >
        {busy === "token" ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={styles.buttonText}>
            {isConnected ? "Stop" : "Start"}
          </Text>
        )}
      </Pressable>

      <Text style={styles.statusLabel}>Status</Text>
      <Text style={styles.status}>
        {status}
        {statusMessage ? ` — ${statusMessage}` : ""}
      </Text>

      {apiError ? <Text style={styles.error}>{apiError}</Text> : null}

      <Text style={styles.transcriptLabel}>Transcript</Text>
      <ScrollView style={styles.transcriptBox}>
        {transcript.length === 0 ? (
          <Text style={styles.transcriptEmpty}>
            Messages appear here during a conversation.
          </Text>
        ) : (
          transcript.map(line => (
            <Text key={line.key} style={styles.transcriptLine}>
              <Text style={styles.transcriptRole}>
                {line.role === "user" ? "You" : "Agent"}:{" "}
              </Text>
              {line.text}
            </Text>
          ))
        )}
      </ScrollView>
    </View>
  );
}

export default function HomeScreen() {
  const [providerError, setProviderError] = useState<string | null>(null);
  const clearProviderError = useCallback(() => setProviderError(null), []);

  if (Platform.OS !== "web") {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.container}>
          <Text style={styles.eyebrow}>Expo Template</Text>
          <Text style={styles.title}>Voice agent (web)</Text>
          <Text style={styles.description}>
            This example uses Expo Router API routes and the ElevenLabs web
            conversation client. Run the app with{" "}
            <Text style={styles.descriptionEm}>npx expo start --web</Text> to
            try voice on the web build.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ConversationProvider
        onError={msg => {
          console.error("Conversation error:", msg);
          setProviderError(msg);
        }}
      >
        <View style={styles.container}>
          <Text style={styles.eyebrow}>Expo Template</Text>
          <Text style={styles.title}>Voice agent</Text>
          <Text style={styles.description}>
            Create a voice agent, then start a session. Mic access is requested
            when you start. The transcript appends each message.
          </Text>
          {providerError ? (
            <Text style={styles.error}>{providerError}</Text>
          ) : null}
          <VoiceAgentPanel onClearProviderError={clearProviderError} />
        </View>
      </ConversationProvider>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  container: {
    flex: 1,
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  eyebrow: {
    color: "#525252",
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  title: {
    marginTop: 12,
    color: "#171717",
    fontSize: 28,
    fontWeight: "600",
    letterSpacing: -0.5,
  },
  description: {
    marginTop: 8,
    color: "#737373",
    fontSize: 15,
    lineHeight: 22,
  },
  descriptionEm: {
    fontWeight: "600",
    color: "#525252",
  },
  label: {
    marginTop: 24,
    fontSize: 12,
    color: "#a3a3a3",
  },
  input: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: "#e5e5e5",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: "#171717",
    backgroundColor: "#ffffff",
  },
  row: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  buttonPrimary: {
    marginTop: 16,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
    backgroundColor: "#171717",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  buttonSecondary: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#e5e5e5",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  buttonSecondaryText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#171717",
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  meta: {
    marginTop: 8,
    fontSize: 13,
    color: "#525252",
  },
  statusLabel: {
    marginTop: 20,
    fontSize: 12,
    color: "#a3a3a3",
  },
  status: {
    marginTop: 4,
    fontSize: 14,
    color: "#404040",
    lineHeight: 20,
  },
  transcriptLabel: {
    marginTop: 20,
    fontSize: 12,
    color: "#a3a3a3",
  },
  transcriptBox: {
    marginTop: 8,
    maxHeight: 320,
    borderWidth: 1,
    borderColor: "#e5e5e5",
    borderRadius: 6,
    padding: 12,
  },
  transcriptEmpty: {
    fontSize: 14,
    color: "#a3a3a3",
  },
  transcriptLine: {
    fontSize: 14,
    color: "#404040",
    lineHeight: 20,
    marginBottom: 8,
  },
  transcriptRole: {
    fontWeight: "600",
    color: "#171717",
  },
  error: {
    marginTop: 12,
    fontSize: 14,
    color: "#b91c1c",
    lineHeight: 20,
  },
});
