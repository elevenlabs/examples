import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const SPEECH_ENGINE_ID =
  process.env.ELEVENLABS_SPEECH_ENGINE_ID ?? "seng_0801kry8xv4nf43vb65vas7b064x";

const elevenlabs = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY,
});

export async function GET() {
  try {
    const response =
      await elevenlabs.conversationalAi.conversations.getSignedUrl({
        agentId: SPEECH_ENGINE_ID,
      });

    return NextResponse.json({ signedUrl: response.signedUrl });
  } catch (error: unknown) {
    const details =
      error instanceof Error ? error.message : "Failed to create signed URL.";

    return NextResponse.json(
      { error: "Unable to create a conversation signed URL.", details },
      { status: 500 },
    );
  }
}
