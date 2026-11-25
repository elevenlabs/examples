import { NextResponse } from "next/server";
import { ElevenLabsClient, ElevenLabsError } from "@elevenlabs/elevenlabs-js";
import { ClientEvent } from "@elevenlabs/elevenlabs-js/api/types/ClientEvent";

function requireApiKey(): string | null {
  const key = process.env.ELEVENLABS_API_KEY;
  return key?.trim() ? key : null;
}

function client() {
  return new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY! });
}

function apiErrorMessage(err: unknown): string {
  if (err instanceof ElevenLabsError) {
    return err.message;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return "An unexpected error occurred.";
}

export async function GET(request: Request) {
  const apiKey = requireApiKey();
  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing ELEVENLABS_API_KEY. Add it to your environment." },
      { status: 500 }
    );
  }

  const agentId = new URL(request.url).searchParams.get("agentId")?.trim();
  if (!agentId) {
    return NextResponse.json(
      { error: "Missing agentId. Pass ?agentId=your-agent-id" },
      { status: 400 }
    );
  }

  try {
    const agent = await client().conversationalAi.agents.get(agentId);
    return NextResponse.json({
      agentId: agent.agentId,
      agentName: agent.name,
    });
  } catch (err) {
    const status =
      err instanceof ElevenLabsError && err.statusCode ? err.statusCode : 502;
    return NextResponse.json(
      { error: apiErrorMessage(err) },
      { status: status >= 400 && status < 600 ? status : 502 }
    );
  }
}

export async function POST() {
  const apiKey = requireApiKey();
  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing ELEVENLABS_API_KEY. Add it to your environment." },
      { status: 500 }
    );
  }

  try {
    const created = await client().conversationalAi.agents.create({
      name: "Quickstart demo assistant",
      enableVersioning: true,
      conversationConfig: {
        agent: {
          firstMessage:
            "Hi! I'm your demo assistant. What would you like to talk about?",
          language: "en",
          prompt: {
            prompt:
              "You are a friendly voice assistant for a product demo. Speak naturally, keep replies concise, and behave like a regular spoken voice agent rather than a text-only assistant.",
            llm: "gemini-3.5-flash",
            temperature: 0,
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
          ],
        },
      },
      platformSettings: {
        widget: {
          textInputEnabled: false,
          supportsTextOnly: false,
        },
      },
    });

    return NextResponse.json({
      agentId: created.agentId,
      agentName: "Quickstart demo assistant",
    });
  } catch (err) {
    const status =
      err instanceof ElevenLabsError && err.statusCode ? err.statusCode : 502;
    return NextResponse.json(
      { error: apiErrorMessage(err) },
      { status: status >= 400 && status < 600 ? status : 502 }
    );
  }
}
