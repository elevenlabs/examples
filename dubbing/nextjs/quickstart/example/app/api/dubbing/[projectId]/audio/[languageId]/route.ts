import { ElevenLabsClient, ElevenLabsError } from "@elevenlabs/elevenlabs-js";
import { NextResponse } from "next/server";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function isValidId(id: string) {
  return /^[a-zA-Z0-9_-]+$/.test(id) && id.length > 0 && id.length <= 128;
}

export async function GET(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{ projectId: string; languageId: string }>;
  }
) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return jsonError("Server is missing ELEVENLABS_API_KEY.", 500);
  }

  const { projectId, languageId } = await params;
  if (!projectId || !isValidId(projectId)) {
    return jsonError("Invalid project id.", 400);
  }
  if (!languageId || !isValidId(languageId)) {
    return jsonError("Invalid language id.", 400);
  }

  const client = new ElevenLabsClient({ apiKey });

  try {
    const language = await client.dubbing.project.language.get(
      projectId,
      languageId
    );

    // outputs carries a signed, time-limited download URL once completed.
    const outputUrl = language.outputs?.losslessAudio;
    if (language.status !== "completed" || !outputUrl) {
      return jsonError("Dubbed audio is not ready yet.", 503);
    }

    const upstream = await fetch(outputUrl);
    if (!upstream.ok || !upstream.body) {
      return jsonError("Failed to download dubbed audio.", 502);
    }

    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? "audio/wav",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (e) {
    if (e instanceof ElevenLabsError) {
      const status = e.statusCode ?? 502;
      return jsonError(
        e.message || "Failed to fetch dubbed audio.",
        status >= 400 && status < 600 ? status : 502
      );
    }
    const message =
      e instanceof Error ? e.message : "Failed to fetch dubbed audio.";
    return jsonError(message, 502);
  }
}
