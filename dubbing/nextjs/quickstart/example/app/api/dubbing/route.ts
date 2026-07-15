import { ElevenLabsClient, ElevenLabsError } from "@elevenlabs/elevenlabs-js";
import { NextResponse } from "next/server";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return jsonError("Server is missing ELEVENLABS_API_KEY.", 500);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError("Invalid form data.", 400);
  }

  const audio = formData.get("audio");
  const targetLangRaw = formData.get("targetLang");
  const sourceLangRaw = formData.get("sourceLang");

  if (typeof targetLangRaw !== "string" || !targetLangRaw.trim()) {
    return jsonError("Missing or invalid targetLang.", 400);
  }
  const targetLang = targetLangRaw.trim();

  const sourceLang =
    typeof sourceLangRaw === "string" && sourceLangRaw.trim()
      ? sourceLangRaw.trim()
      : "auto";

  if (!(audio instanceof File)) {
    return jsonError("Missing or invalid audio file.", 400);
  }
  if (audio.size === 0) {
    return jsonError("Audio file is empty.", 400);
  }

  const client = new ElevenLabsClient({ apiKey });

  try {
    // The targetLanguage shortcut also queues a language target, which starts
    // automatically once the project finishes transcribing.
    const project = await client.dubbing.project.create({
      file: audio,
      targetLanguage: targetLang,
      sourceLanguage: sourceLang === "auto" ? undefined : sourceLang,
      modelId: "dubbing_v2",
      reference: "Browser dubbing demo",
    });

    return NextResponse.json({
      projectId: project.projectId,
      languageId: project.languageIds?.[0] ?? null,
    });
  } catch (e) {
    if (e instanceof ElevenLabsError) {
      return jsonError(
        e.message || "Dubbing request failed.",
        e.statusCode ?? 502
      );
    }
    const message = e instanceof Error ? e.message : "Dubbing request failed.";
    return jsonError(message, 502);
  }
}
