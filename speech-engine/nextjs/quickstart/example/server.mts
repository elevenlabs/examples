import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { createServer } from "node:http";
import "dotenv/config";

import {
  type ChatMessage,
  createAssistantStream,
  transcriptToChatMessages,
} from "./lib/assistant";
import { loadVoiceHistory } from "./lib/voice-history";

const API_KEY = process.env.ELEVENLABS_API_KEY?.trim();
const OPENAI_API_KEY = process.env.OPENAI_API_KEY?.trim();
const SPEECH_ENGINE_ID = process.env.ELEVENLABS_SPEECH_ENGINE_ID?.trim();

if (!API_KEY) {
  throw new Error("Missing ELEVENLABS_API_KEY in .env");
}

if (!OPENAI_API_KEY) {
  throw new Error("Missing OPENAI_API_KEY in .env");
}

if (!SPEECH_ENGINE_ID) {
  throw new Error("Missing ELEVENLABS_SPEECH_ENGINE_ID in .env");
}

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

    await new Promise(resolve => setTimeout(resolve, 80));
  }

  return [];
}

const elevenlabs = new ElevenLabsClient({
  apiKey: API_KEY,
});

const httpServer = createServer();

elevenlabs.speechEngine.attach(SPEECH_ENGINE_ID, httpServer, "/ws", {
  debug: true,

  onInit(conversationId) {
    console.log("Speech Engine session started:", conversationId);
  },

  async onTranscript(transcript, signal, session) {
    const initialHistory = session.conversationId
      ? await loadInitialHistory(session.conversationId)
      : [];

    const responseStream = await createAssistantStream(
      [...initialHistory, ...transcriptToChatMessages(transcript)],
      signal
    );

    session.sendResponse(responseStream);
  },

  onClose(session) {
    if (session.conversationId) {
      initialHistoryByConversation.delete(session.conversationId);
    }

    console.log("Speech Engine session closed:", session.conversationId);
  },

  onError(error) {
    console.error("Speech Engine error:", error);
  },
});

httpServer.listen(3001, () => {
  console.log("Speech Engine server listening on http://localhost:3001");
});
