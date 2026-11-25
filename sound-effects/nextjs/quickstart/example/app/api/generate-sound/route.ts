import { ElevenLabsClient, ElevenLabsError } from "@elevenlabs/elevenlabs-js";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  const prompt =
    body && typeof body === "object" && "prompt" in body
      ? (body as { prompt: unknown }).prompt
      : undefined;

  if (typeof prompt !== "string" || prompt.trim().length === 0) {
    return NextResponse.json(
      { error: "prompt must be a non-empty string." },
      { status: 400 }
    );
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Server is not configured with ELEVENLABS_API_KEY." },
      { status: 503 }
    );
  }

  const client = new ElevenLabsClient({ apiKey });

  try {
    const stream = await client.textToSoundEffects.convert({
      text: prompt.trim(),
      modelId: "eleven_text_to_sound_v3",
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    if (err instanceof ElevenLabsError) {
      const status = err.statusCode ?? 502;
      return NextResponse.json(
        {
          error:
            err.message ||
            "The ElevenLabs API returned an error for this request.",
          details: err.body,
        },
        { status: status >= 400 && status < 600 ? status : 502 }
      );
    }
    const message =
      err instanceof Error ? err.message : "An unexpected error occurred.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
