import { NextResponse } from "next/server";

import {
  createAssistantReply,
  isChatRole,
  type ChatMessage,
} from "@/lib/assistant";

export const dynamic = "force-dynamic";

const MAX_REQUEST_MESSAGES = 30;

function parseMessages(value: unknown): ChatMessage[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const messages: ChatMessage[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object") {
      return null;
    }

    const { role, content } = item as Record<string, unknown>;

    if (!isChatRole(role) || typeof content !== "string") {
      return null;
    }

    const trimmedContent = content.trim();

    if (trimmedContent.length > 0) {
      messages.push({
        role,
        content: trimmedContent,
      });
    }
  }

  return messages.slice(-MAX_REQUEST_MESSAGES);
}

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

  const messages = parseMessages(
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>).messages
      : null
  );

  if (!messages || messages.length === 0) {
    return NextResponse.json(
      { error: "Send at least one user or assistant message." },
      { status: 400 }
    );
  }

  try {
    const message = await createAssistantReply(messages, request.signal);

    return NextResponse.json({ message });
  } catch (error: unknown) {
    const details =
      error instanceof Error ? error.message : "Failed to generate a reply.";

    return NextResponse.json(
      { error: "Unable to generate a chat response.", details },
      { status: 500 }
    );
  }
}
