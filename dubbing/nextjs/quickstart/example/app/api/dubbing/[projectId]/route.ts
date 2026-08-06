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
  { params }: { params: Promise<{ projectId: string }> }
) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return jsonError("Server is missing ELEVENLABS_API_KEY.", 500);
  }

  const { projectId } = await params;
  if (!projectId || !isValidId(projectId)) {
    return jsonError("Invalid project id.", 400);
  }

  const client = new ElevenLabsClient({ apiKey });

  try {
    const project = await client.dubbing.project.get(projectId);
    const languageId = project.languageIds?.[0] ?? null;

    let languageStatus: string | null = null;
    if (languageId) {
      const language = await client.dubbing.project.language.get(
        projectId,
        languageId
      );
      languageStatus = language.status;
    }

    return NextResponse.json({
      projectStatus: project.status,
      languageId,
      languageStatus,
    });
  } catch (e) {
    if (e instanceof ElevenLabsError) {
      return jsonError(
        e.message || "Failed to fetch dubbing status.",
        e.statusCode ?? 502
      );
    }
    const message =
      e instanceof Error ? e.message : "Failed to fetch dubbing status.";
    return jsonError(message, 502);
  }
}
