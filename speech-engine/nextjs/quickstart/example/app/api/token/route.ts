import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing ${name}.`);
  }

  return value;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Failed to create token.";
}

export async function GET() {
  try {
    const client = new ElevenLabsClient({
      apiKey: requireEnv("ELEVENLABS_API_KEY"),
    });
    const speechEngineId = requireEnv("ELEVENLABS_SPEECH_ENGINE_ID");
    const response =
      await client.conversationalAi.conversations.getWebrtcToken({
        agentId: speechEngineId,
      });

    return NextResponse.json({ token: response.token });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error: "Unable to create a conversation token.",
        details: errorMessage(error),
      },
      { status: 500 },
    );
  }
}
