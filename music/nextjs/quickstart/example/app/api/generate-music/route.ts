import { ElevenLabsClient, ElevenLabsError } from "@elevenlabs/elevenlabs-js";
import { NextRequest } from "next/server";

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Request body must be valid JSON.", 400);
  }

  const prompt =
    typeof body === "object" && body !== null && "prompt" in body
      ? (body as { prompt: unknown }).prompt
      : undefined;

  if (typeof prompt !== "string" || prompt.trim().length === 0) {
    return jsonError("prompt is required and must be a non-empty string.", 400);
  }

  try {
    const client = new ElevenLabsClient();
    const stream = await client.music.compose({
      prompt: prompt.trim(),
      musicLengthMs: 10000,
      modelId: "music_v2",
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "audio/mpeg",
      },
    });
  } catch (error) {
    if (error instanceof ElevenLabsError) {
      const status = error.statusCode ?? 502;
      return jsonError(
        error.message || "ElevenLabs API request failed.",
        status >= 400 && status < 600 ? status : 502
      );
    }
    const message =
      error instanceof Error ? error.message : "Music generation failed.";
    return jsonError(message, 500);
  }
}
