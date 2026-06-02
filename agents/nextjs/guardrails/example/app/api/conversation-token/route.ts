import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Server misconfiguration: ELEVENLABS_API_KEY is not set." },
      { status: 500 }
    );
  }

  const agentId = new URL(request.url).searchParams.get("agentId")?.trim();
  if (!agentId) {
    return NextResponse.json(
      { error: "Missing agentId query parameter." },
      { status: 400 }
    );
  }

  const client = new ElevenLabsClient({ apiKey });

  try {
    const { signedUrl } =
      await client.conversationalAi.conversations.getSignedUrl({
        agentId,
      });
    return NextResponse.json({ signedUrl });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to create signed URL.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
