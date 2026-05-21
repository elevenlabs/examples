import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function getRequiredEnv(
  name: "ELEVENLABS_API_KEY" | "ELEVENLABS_SPEECH_ENGINE_ID"
) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing ${name}.`);
  }

  return value;
}

export async function GET() {
  try {
    const apiKey = getRequiredEnv("ELEVENLABS_API_KEY");
    const speechEngineId = getRequiredEnv("ELEVENLABS_SPEECH_ENGINE_ID");
    const elevenlabs = new ElevenLabsClient({ apiKey });
    const response =
      await elevenlabs.conversationalAi.conversations.getWebrtcToken({
        agentId: speechEngineId,
      });

    return NextResponse.json({ token: response.token });
  } catch (error: unknown) {
    const details =
      error instanceof Error ? error.message : "Failed to create a token.";

    return NextResponse.json(
      { error: "Unable to create a conversation token.", details },
      { status: 500 }
    );
  }
}
