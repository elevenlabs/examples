import { NextResponse } from "next/server";

import { isChatRole, type ChatMessage } from "@/lib/assistant";
import { createVoiceHistory } from "@/lib/voice-history";

export const dynamic = "force-dynamic";

function parseMessages(input: unknown): ChatMessage[] | null {
  if (!Array.isArray(input)) {
    return null;
  }

  const messages = input
    .filter((message): message is ChatMessage => {
      if (!message || typeof message !== "object") {
        return false;
      }

      const { role, content } = message as Partial<ChatMessage>;
      return isChatRole(role) && typeof content === "string";
    })
    .map(message => ({
      role: message.role,
      content: message.content.trim(),
    }))
    .filter(message => message.content.length > 0);

  return messages.length > 0 ? messages : null;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    messages?: unknown;
  } | null;

  const messages = parseMessages(body?.messages);

  if (!messages) {
    return NextResponse.json(
      { error: "Provide at least one chat message." },
      { status: 400 }
    );
  }

  const historyId = await createVoiceHistory(messages);

  return NextResponse.json({ historyId });
}
