import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { ClientEvent } from "@elevenlabs/elevenlabs-js/api/types/ClientEvent";
import type { ConversationalConfig } from "@elevenlabs/elevenlabs-js/api/types/ConversationalConfig";

function getClient() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return {
      error: Response.json(
        { error: "Missing ELEVENLABS_API_KEY" },
        { status: 500 }
      ),
    };
  }
  return { client: new ElevenLabsClient({ apiKey }) };
}

function voiceFirstConversationConfig(): ConversationalConfig {
  return {
    agent: {
      firstMessage: "Hello! How can I help you today?",
      language: "en",
      prompt: {
        prompt:
          "You are a helpful voice assistant. Keep replies concise and natural for spoken conversation.",
        llm: "gemini-2.0-flash",
        temperature: 0.7,
      },
    },
    tts: {
      voiceId: "JBFqnCBsd6RMkjVDRZzb",
      modelId: "eleven_flash_v2",
    },
    conversation: {
      textOnly: false,
      clientEvents: [
        ClientEvent.Audio,
        ClientEvent.Interruption,
        ClientEvent.UserTranscript,
        ClientEvent.TentativeUserTranscript,
        ClientEvent.AgentResponse,
        ClientEvent.InternalTentativeAgentResponse,
        ClientEvent.AgentChatResponsePart,
        ClientEvent.AgentResponseComplete,
      ],
    },
  };
}

export async function POST() {
  const res = getClient();
  if ("error" in res) {
    return res.error;
  }

  try {
    const agentName = "Expo Voice Agent";
    const created = await res.client.conversationalAi.agents.create({
      name: agentName,
      enableVersioning: true,
      conversationConfig: voiceFirstConversationConfig(),
      platformSettings: {
        widget: {
          textInputEnabled: false,
          supportsTextOnly: false,
          conversationModeToggleEnabled: false,
        },
      },
    });

    return Response.json({
      agentId: created.agentId,
      agentName,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create agent";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const res = getClient();
  if ("error" in res) {
    return res.error;
  }

  const url = new URL(request.url);
  const agentId = url.searchParams.get("agentId");
  if (!agentId?.trim()) {
    return Response.json(
      { error: "Missing agentId query parameter" },
      { status: 400 }
    );
  }

  try {
    const agent = await res.client.conversationalAi.agents.get(agentId.trim());
    return Response.json({
      agentId: agent.agentId,
      agentName: agent.name,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load agent";
    return Response.json({ error: message }, { status: 500 });
  }
}
