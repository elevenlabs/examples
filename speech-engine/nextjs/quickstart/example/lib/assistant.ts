import OpenAI from "openai";

export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

type SpeechTranscriptMessage = {
  role: "user" | "agent";
  content: string;
};

const MAX_HISTORY_MESSAGES = 24;
const MAX_MESSAGE_CHARS = 2_000;

let openai: OpenAI | null = null;

const ASSISTANT_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o";

export const ASSISTANT_INSTRUCTIONS =
  "You are a helpful assistant for a voice-and-text chat demo. Keep responses concise, conversational, and easy to speak aloud.";

function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  openai ??= new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  return openai;
}

export function isChatRole(role: unknown): role is ChatRole {
  return role === "user" || role === "assistant";
}

export function normalizeChatMessages(messages: ChatMessage[]) {
  return messages
    .map(message => ({
      role: message.role,
      content: message.content.trim().slice(0, MAX_MESSAGE_CHARS),
    }))
    .filter(message => message.content.length > 0)
    .slice(-MAX_HISTORY_MESSAGES);
}

export function transcriptToChatMessages(
  transcript: SpeechTranscriptMessage[]
) {
  return normalizeChatMessages(
    transcript.map(message => ({
      role: message.role === "agent" ? "assistant" : "user",
      content: message.content,
    }))
  );
}

function toResponseInput(messages: ChatMessage[]) {
  return normalizeChatMessages(messages).map(message => ({
    role: message.role,
    content: message.content,
  }));
}

export async function createAssistantReply(
  messages: ChatMessage[],
  signal?: AbortSignal
) {
  const response = await getOpenAIClient().responses.create(
    {
      model: ASSISTANT_MODEL,
      instructions: ASSISTANT_INSTRUCTIONS,
      input: toResponseInput(messages),
    },
    { signal }
  );

  return (
    response.output_text.trim() ||
    "I could not generate a response. Please try again."
  );
}

export async function createAssistantStream(
  messages: ChatMessage[],
  signal?: AbortSignal
) {
  const stream = await getOpenAIClient().responses.create(
    {
      model: ASSISTANT_MODEL,
      instructions: ASSISTANT_INSTRUCTIONS,
      input: toResponseInput(messages),
      stream: true,
    },
    { signal }
  );

  return {
    async *[Symbol.asyncIterator]() {
      for await (const event of stream) {
        if (event.type === "response.output_text.delta" && event.delta) {
          yield event.delta;
        }
      }
    },
  };
}
