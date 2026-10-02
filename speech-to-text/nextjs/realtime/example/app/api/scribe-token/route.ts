import { NextResponse } from "next/server";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

export async function GET() {
  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "ElevenLabs API key not configured" },
      { status: 500 }
    );
  }

  try {
    const elevenlabs = new ElevenLabsClient({
      apiKey: apiKey,
    });

    // Generate a single-use token for realtime transcription
    // create() already returns { token: "..." } so we pass it through directly
    const result = await elevenlabs.tokens.singleUse.create("realtime_scribe");
    return NextResponse.json(result);
  } catch (error) {
    console.error("Token generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate token" },
      { status: 500 }
    );
  }
}
