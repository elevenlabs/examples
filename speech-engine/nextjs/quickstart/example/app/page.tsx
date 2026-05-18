"use client";

import { ConversationProvider, useConversation } from "@elevenlabs/react";
import { useCallback, useRef, useState } from "react";

type TranscriptRole = "assistant" | "system" | "user";

type TranscriptEntry = {
  id: number;
  role: TranscriptRole;
  text: string;
};

type TokenResponse = {
  token?: string;
  error?: string;
  details?: string;
};

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }

  return "Voice chat failed.";
}

function normalizeMessage(
  value: unknown,
): { role: "assistant" | "user"; text: string } | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const text = [record.message, record.text, record.content].find(
    (candidate): candidate is string =>
      typeof candidate === "string" && candidate.trim().length > 0,
  );

  if (!text) {
    return null;
  }

  const source = record.source ?? record.role ?? record.type;
  const role = source === "user" ? "user" : "assistant";

  return { role, text };
}

function SpeechEnginePage() {
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const nextTranscriptId = useRef(0);

  const appendTranscript = useCallback((role: TranscriptRole, text: string) => {
    const trimmedText = text.trim();

    if (!trimmedText) {
      return;
    }

    const id = nextTranscriptId.current + 1;
    nextTranscriptId.current = id;

    setTranscript((current) => [
      ...current,
      {
        id,
        role,
        text: trimmedText,
      },
    ]);
  }, []);

  const conversation = useConversation({
    onConnect({ conversationId }) {
      setError(null);
      appendTranscript(
        "system",
        `Connected to the Speech Engine session: ${conversationId}. Start speaking when you are ready.`,
      );
    },
    onDisconnect(details) {
      appendTranscript(
        "system",
        details.reason === "error"
          ? `Disconnected: ${details.message}`
          : "Disconnected from the Speech Engine session.",
      );
    },
    onMessage(message) {
      const entry = normalizeMessage(message);

      if (entry) {
        appendTranscript(entry.role, entry.text);
      }
    },
    onError(message) {
      const nextError = formatError(message);

      setError(nextError);
      appendTranscript("system", nextError);
    },
    onDebug(event) {
      console.debug("[speech-engine client]", JSON.stringify(event, null, 2));
    },
  });

  const startConversation = useCallback(async () => {
    try {
      setError(null);
      setIsStarting(true);
      conversation.endSession();
      setTranscript([]);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());

      const response = await fetch("/api/token", { cache: "no-store" });
      const data = (await response.json()) as TokenResponse;

      if (!response.ok || !data.token) {
        throw new Error(
          data.details ?? data.error ?? "Failed to fetch a conversation token.",
        );
      }

      appendTranscript("system", "Starting a new voice session.");
      conversation.startSession({ conversationToken: data.token });
    } catch (startError: unknown) {
      const nextError = formatError(startError);

      setError(nextError);
      appendTranscript("system", nextError);
    } finally {
      setIsStarting(false);
    }
  }, [appendTranscript, conversation]);

  const stopConversation = useCallback(() => {
    setError(null);
    conversation.endSession();
  }, [conversation]);

  const [typedMessage, setTypedMessage] = useState("");

  const sendTypedMessage = useCallback(() => {
    const text = typedMessage.trim();

    if (!text || conversation.status !== "connected") {
      return;
    }

    setError(null);
    appendTranscript("user", text);
    conversation.sendUserMessage(text);
    setTypedMessage("");
  }, [appendTranscript, conversation, typedMessage]);

  return (
    <main className="min-h-screen bg-white text-neutral-900">
      <div className="mx-auto w-full max-w-2xl px-6 py-12 sm:py-16">
        <header className="space-y-2">
          <h1 className="text-2xl font-medium tracking-tight sm:text-3xl">
            Speech Engine Voice Chat
          </h1>
          <p className="text-sm text-neutral-500">
            Add voice to your own OpenAI-backed agent with ElevenLabs Speech
            Engine.
          </p>
        </header>

        <section className="mt-8 space-y-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
          <h2 className="text-sm font-medium text-neutral-900">
            Local setup reminders
          </h2>
          <ol className="space-y-2 text-sm text-neutral-600">
            <li>1. Run `ngrok http 3001`.</li>
            <li>
              2. Set `PUBLIC_WS_URL` to your ngrok URL with `/ws` appended.
            </li>
            <li>3. Run `pnpm run speech-engine:create`.</li>
            <li>4. Run `pnpm run speech-engine:server` and `pnpm run dev`.</li>
          </ol>
        </section>

        <section className="mt-6 rounded-2xl border border-neutral-200 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-neutral-900">
                Connection status
              </p>
              <p className="text-sm capitalize text-neutral-600">
                {conversation.status}
              </p>
            </div>

            <div className="flex gap-3">
              <button
                className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-neutral-300"
                disabled={
                  isStarting ||
                  conversation.status === "connected" ||
                  conversation.status === "connecting"
                }
                onClick={startConversation}
                type="button"
              >
                {isStarting ? "Starting..." : "Start conversation"}
              </button>
              <button
                className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 disabled:cursor-not-allowed disabled:border-neutral-200 disabled:text-neutral-400"
                disabled={conversation.status !== "connected"}
                onClick={stopConversation}
                type="button"
              >
                Stop conversation
              </button>
            </div>
          </div>

          {error ? (
            <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          {conversation.status === "connected" ? (
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <input
                className="flex-1 rounded-xl border border-neutral-300 px-4 py-2 text-sm text-neutral-900 outline-none ring-neutral-900 focus:ring-2"
                onChange={(event) => setTypedMessage(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    sendTypedMessage();
                  }
                }}
                placeholder="Or type a message to test without the microphone"
                type="text"
                value={typedMessage}
              />
              <button
                className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 disabled:cursor-not-allowed disabled:border-neutral-200 disabled:text-neutral-400"
                disabled={typedMessage.trim().length === 0}
                onClick={sendTypedMessage}
                type="button"
              >
                Send text
              </button>
            </div>
          ) : null}
        </section>

        <section className="mt-6 rounded-2xl border border-neutral-200 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-neutral-900">Transcript</h2>
            <p className="text-xs uppercase tracking-[0.2em] text-neutral-400">
              {conversation.status}
            </p>
          </div>

          <div className="mt-4 space-y-3">
            {transcript.length > 0 ? (
              transcript.map((entry) => (
                <div
                  className="rounded-2xl bg-neutral-50 px-4 py-3 text-sm text-neutral-700"
                  key={entry.id}
                >
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-400">
                    {entry.role}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap">{entry.text}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-neutral-500">
                Start a session to capture conversation events here.
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

export default function Home() {
  return (
    <ConversationProvider>
      <SpeechEnginePage />
    </ConversationProvider>
  );
}
