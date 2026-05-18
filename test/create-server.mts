import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { createServer } from "node:http";
import "dotenv/config";
import {
  type ChatMessage,
  createAssistantStream,
  transcriptToChatMessages,
} from "./lib/assistant";
import { loadVoiceHistory } from "./lib/voice-history";

// Replace with your Speech Engine ID from step 4
const SPEECH_ENGINE_ID =
  process.env.ELEVENLABS_SPEECH_ENGINE_ID ?? "seng_0801kry8xv4nf43vb65vas7b064x";

const initialHistoryByConversation = new Map<string, ChatMessage[]>();

async function loadInitialHistory(conversationId: string) {
  if (initialHistoryByConversation.has(conversationId)) {
    return initialHistoryByConversation.get(conversationId) ?? [];
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const history = await loadVoiceHistory(conversationId);

    if (history.length > 0 || attempt === 4) {
      initialHistoryByConversation.set(conversationId, history);
      return history;
    }

    await new Promise((resolve) => setTimeout(resolve, 80));
  }

  return [];
}

const elevenlabs = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY,
});

const httpServer = createServer();

await elevenlabs.speechEngine.attach(SPEECH_ENGINE_ID, httpServer, "/ws", {
  debug: true,

  onInit(conversationId) {
    console.log("Session started:", conversationId);
  },

  async onTranscript(transcript, signal, session) {
    const initialHistory = session.conversationId
      ? await loadInitialHistory(session.conversationId)
      : [];
    const response = await createAssistantStream(
      [...initialHistory, ...transcriptToChatMessages(transcript)],
      signal,
    );

    session.sendResponse(response);
  },

  onClose(session) {
    console.log("Session ended:", session.conversationId);
  },

  onError(err) {
    console.error("Error:", err);
  },
});

httpServer.listen(3001, () => {
  console.log("Speech Engine server listening on port 3001");
});
