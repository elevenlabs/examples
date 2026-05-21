import { NextResponse } from "next/server";

import { linkVoiceHistory } from "@/lib/voice-history";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    conversationId?: unknown;
    historyId?: unknown;
  } | null;

  if (
    typeof body?.conversationId !== "string" ||
    typeof body.historyId !== "string"
  ) {
    return NextResponse.json(
      { error: "Provide a conversationId and historyId." },
      { status: 400 }
    );
  }

  const linked = await linkVoiceHistory(body.conversationId, body.historyId);

  if (!linked) {
    return NextResponse.json(
      { error: "The voice history could not be found." },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true });
}
