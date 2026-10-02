import { NextResponse } from "next/server";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

export const dynamic = "force-dynamic";

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

    // Single-use tokens expire after 15 minutes and must not be cached.
    const result = await elevenlabs.tokens.singleUse.create("realtime_scribe");
    return NextResponse.json(
      { token: result.token },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Token generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate token" },
      { status: 500 }
    );
  }
}
