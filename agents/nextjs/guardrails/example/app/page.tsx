"use client";

import {
  ConversationProvider,
  useConversationControls,
  useConversationMode,
  useConversationStatus,
} from "@elevenlabs/react";
import { useCallback, useEffect, useState } from "react";

type TranscriptRole = "user" | "agent" | "system";

type TranscriptLine = {
  id: string;
  role: TranscriptRole;
  text: string;
  eventId?: number;
};

type ConversationMessage = {
  message: string;
  source?: string;
  event_id?: number;
};

type GuardrailsPageProps = {
  agentIdInput: string;
  createError: string | null;
  creating: boolean;
  guardrailFired: boolean;
  lookupError: string | null;
  lookupStatus: "idle" | "loading" | "ok" | "error";
  sessionError: string | null;
  setAgentIdInput: (value: string) => void;
  setCreateError: (value: string | null) => void;
  setCreating: (value: boolean) => void;
  setGuardrailFired: (value: boolean) => void;
  setLookupError: (value: string | null) => void;
  setLookupStatus: (value: "idle" | "loading" | "ok" | "error") => void;
  setSessionError: (value: string | null) => void;
  setTranscript: (value: TranscriptLine[]) => void;
  transcript: TranscriptLine[];
};

function GuardrailsPage({
  agentIdInput,
  createError,
  creating,
  guardrailFired,
  lookupError,
  lookupStatus,
  sessionError,
  setAgentIdInput,
  setCreateError,
  setCreating,
  setGuardrailFired,
  setLookupError,
  setLookupStatus,
  setSessionError,
  setTranscript,
  transcript,
}: GuardrailsPageProps) {
  const { startSession, endSession } = useConversationControls();
  const { isSpeaking } = useConversationMode();
  const { status, message } = useConversationStatus();

  const trimmedId = agentIdInput.trim();
  const canStart =
    trimmedId.length > 0 &&
    lookupStatus !== "loading" &&
    lookupStatus !== "error";
  const sessionLive = status === "connected" || status === "connecting";

  const statusLabel =
    status === "connected"
      ? isSpeaking
        ? "Speaking"
        : "Listening"
      : status === "connecting"
        ? "Connecting…"
        : status === "error"
          ? (message ?? "Connection error")
          : "Disconnected";

  function handleAgentIdChange(value: string) {
    setAgentIdInput(value);
    setLookupError(null);
    setLookupStatus(value.trim() ? "loading" : "idle");
  }

  const startOrStop = async () => {
    setSessionError(null);
    if (sessionLive) {
      endSession();
      return;
    }

    if (!trimmedId || !canStart) {
      return;
    }

    setGuardrailFired(false);
    setTranscript([]);
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setSessionError("Microphone permission is required for voice.");
      return;
    }

    try {
      const res = await fetch(
        `/api/conversation-token?agentId=${encodeURIComponent(trimmedId)}`
      );
      const data: { token?: string; error?: string } = await res.json();
      if (!res.ok || !data.token) {
        setSessionError(data.error ?? "Could not get conversation token.");
        return;
      }

      await startSession({
        conversationToken: data.token,
      });
    } catch (error) {
      const nextMessage =
        error instanceof Error ? error.message : "Failed to start session.";
      setSessionError(nextMessage);
    }
  };

  const createAgent = async () => {
    setCreateError(null);
    setCreating(true);
    try {
      const res = await fetch("/api/agent", { method: "POST" });
      const data: { agentId?: string; error?: string } = await res.json();
      if (!res.ok || !data.agentId) {
        setCreateError(data.error ?? "Failed to create agent.");
        return;
      }
      setAgentIdInput(data.agentId);
      setLookupError(null);
      setLookupStatus("ok");
    } catch {
      setCreateError("Network error while creating agent.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <main className="min-h-screen bg-white text-neutral-900">
      <div className="mx-auto w-full max-w-2xl px-6 py-12 sm:py-16">
        <header className="space-y-2">
          <h1 className="text-2xl font-medium tracking-tight sm:text-3xl">
            Voice agent guardrails
          </h1>
          <p className="text-sm text-neutral-500">
            Voice session with platform guardrails and a banking-style custom
            investment-advice policy.
          </p>
        </header>

        <section className="mt-10 space-y-6">
          <div className="flex flex-wrap items-end gap-3">
            <button
              type="button"
              className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              disabled={creating}
              onClick={() => void createAgent()}
            >
              {creating ? "Creating…" : "Create Agent"}
            </button>
            <div className="flex min-w-[200px] flex-1 flex-col gap-1">
              <label className="text-xs text-neutral-400" htmlFor="agent-id">
                Agent ID
              </label>
              <input
                id="agent-id"
                className="rounded-md border border-neutral-200 px-3 py-2 text-sm"
                placeholder="Paste or create an agent id"
                value={agentIdInput}
                onChange={event => handleAgentIdChange(event.target.value)}
              />
            </div>
          </div>

          {createError ? (
            <p className="text-sm text-red-600">{createError}</p>
          ) : null}
          {lookupStatus === "loading" && trimmedId ? (
            <p className="text-xs text-neutral-400">Checking agent…</p>
          ) : null}
          {lookupStatus === "error" && lookupError ? (
            <p className="text-sm text-red-600">{lookupError}</p>
          ) : null}

          <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
            <p className="font-medium text-neutral-900">
              Try asking for investment advice
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              Example questions: &quot;What should I invest ten thousand dollars
              in right now?&quot; or &quot;Should I buy Bitcoin or index funds
              this month?&quot; If the agent crosses the line into investment
              recommendations, the guardrail should block the response and end
              the session.
            </p>
          </div>

          {guardrailFired ? (
            <p className="text-sm font-medium text-amber-800">
              A guardrail fired in this session because the agent attempted
              blocked investment advice. This status persists after the call
              ends.
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              className="rounded-md border border-neutral-200 bg-white px-4 py-2 text-sm font-medium disabled:opacity-50"
              disabled={!sessionLive && !canStart}
              onClick={() => void startOrStop()}
            >
              {sessionLive ? "Stop" : "Start"}
            </button>
            <span className="text-xs text-neutral-400">{statusLabel}</span>
          </div>

          {sessionError ? (
            <p className="text-sm text-red-600">{sessionError}</p>
          ) : null}

          <div className="space-y-2">
            <h2 className="text-sm font-medium text-neutral-800">Transcript</h2>
            <ul className="space-y-2 text-sm">
              {transcript.length === 0 ? (
                <li className="text-neutral-400">No messages yet.</li>
              ) : (
                transcript.map(line => (
                  <li
                    key={line.id}
                    className={
                      line.role === "user"
                        ? "text-neutral-900"
                        : line.role === "agent"
                          ? "text-neutral-700"
                          : "text-neutral-500"
                    }
                  >
                    <span className="text-xs uppercase text-neutral-400">
                      {line.role === "user"
                        ? "You"
                        : line.role === "agent"
                          ? "Agent"
                          : "System"}
                    </span>{" "}
                    {line.text}
                  </li>
                ))
              )}
            </ul>
          </div>
        </section>
      </div>
    </main>
  );
}

export default function Home() {
  const [agentIdInput, setAgentIdInput] = useState("");
  const [lookupStatus, setLookupStatus] = useState<
    "idle" | "loading" | "ok" | "error"
  >("idle");
  const [lookupError, setLookupError] = useState<string | null>(null);

  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [guardrailFired, setGuardrailFired] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  useEffect(() => {
    const id = agentIdInput.trim();
    if (!id) {
      return;
    }
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(`/api/agent?agentId=${encodeURIComponent(id)}`);
        const data: { agentId?: string; error?: string } = await res.json();
        if (!res.ok) {
          setLookupStatus("error");
          setLookupError(data.error ?? "Could not load agent.");
          return;
        }
        setLookupStatus("ok");
        setLookupError(null);
      } catch {
        setLookupStatus("error");
        setLookupError("Network error while loading agent.");
      }
    }, 450);

    return () => clearTimeout(handle);
  }, [agentIdInput]);

  const handleGuardrailTriggered = useCallback(() => {
    setGuardrailFired(true);
    setTranscript(prev => [
      ...prev,
      {
        id: `guardrail-${Date.now()}`,
        role: "system",
        text: "Guardrail triggered - session ended by policy.",
      },
    ]);
  }, []);

  const handleMessage = useCallback((props: ConversationMessage) => {
    const { message, source, event_id: eventId } = props;
    const role: TranscriptRole = source === "user" ? "user" : "agent";
    setTranscript(prev => {
      if (eventId !== undefined) {
        const idx = prev.findIndex(
          line => line.eventId === eventId && line.role === role
        );
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...next[idx], text: message };
          return next;
        }
      }
      return [
        ...prev,
        {
          id:
            eventId !== undefined
              ? `${role}-${eventId}`
              : `${role}-${crypto.randomUUID()}`,
          role,
          text: message,
          eventId,
        },
      ];
    });
  }, []);

  return (
    <ConversationProvider
      onConnect={() => {
        setSessionError(null);
      }}
      onDisconnect={() => {
        setSessionError(null);
      }}
      onError={(error: unknown) => {
        const nextMessage =
          error instanceof Error ? error.message : String(error);
        setSessionError(nextMessage);
      }}
      onGuardrailTriggered={handleGuardrailTriggered}
      onMessage={handleMessage}
    >
      <GuardrailsPage
        agentIdInput={agentIdInput}
        createError={createError}
        creating={creating}
        guardrailFired={guardrailFired}
        lookupError={lookupError}
        lookupStatus={lookupStatus}
        sessionError={sessionError}
        setAgentIdInput={setAgentIdInput}
        setCreateError={setCreateError}
        setCreating={setCreating}
        setGuardrailFired={setGuardrailFired}
        setLookupError={setLookupError}
        setLookupStatus={setLookupStatus}
        setSessionError={setSessionError}
        setTranscript={setTranscript}
        transcript={transcript}
      />
    </ConversationProvider>
  );
}
