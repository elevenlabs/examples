"use client";

import { useState, useCallback, useRef } from "react";
import { useScribe, CommitStrategy } from "@elevenlabs/react";
import { LiveWaveform } from "@/components/ui/live-waveform";

type CommittedEntry = {
  id: number;
  text: string;
};

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

export default function Home() {
  const [error, setError] = useState<string | null>(null);
  const [partialTranscript, setPartialTranscript] = useState("");
  const [committedHistory, setCommittedHistory] = useState<CommittedEntry[]>(
    []
  );
  const nextEntryIdRef = useRef(0);

  const scribe = useScribe({
    modelId: "scribe_v3_live",
    commitStrategy: CommitStrategy.VAD,
    vadSilenceThresholdSecs: 1.5,
    vadThreshold: 0.4,
    onPartialTranscript: data => {
      setPartialTranscript(data.text || "");
    },
    onCommittedTranscript: data => {
      const text = data.text?.trim();
      if (text) {
        const id = nextEntryIdRef.current++;
        setCommittedHistory(prev => [{ id, text }, ...prev]);
      }
      setPartialTranscript("");
    },
    onDisconnect: () => {
      setPartialTranscript("");
    },
    onError: err => {
      console.error("Scribe error:", err);
      setPartialTranscript("");
      setError(
        errorMessage(err, "Connection error occurred. Please try again.")
      );
    },
  });

  // Status moves to "transcribing" while speech is processed, so both states mean the session is live.
  const isActive =
    scribe.status === "connected" || scribe.status === "transcribing";
  const isConnecting = scribe.status === "connecting";

  const statusLabel =
    scribe.status === "connecting"
      ? "Connecting"
      : scribe.status === "transcribing"
        ? "Transcribing"
        : scribe.status === "connected"
          ? "Connected"
          : scribe.status === "error"
            ? "Error"
            : "Disconnected";

  const handleStart = useCallback(async () => {
    try {
      setError(null);
      setPartialTranscript("");

      // Tokens are single-use, so fetch a fresh one for every session.
      const response = await fetch("/api/scribe-token");
      const body = (await response.json().catch(() => null)) as {
        token?: string;
        error?: string;
      } | null;
      if (!response.ok || !body?.token) {
        throw new Error(body?.error || "Failed to get transcription token");
      }

      await scribe.connect({
        token: body.token,
        microphone: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (err) {
      console.error("Failed to start transcription:", err);
      setError(
        errorMessage(
          err,
          "Failed to start transcription. Please check your permissions and try again."
        )
      );
    }
  }, [scribe]);

  const handleStop = useCallback(() => {
    scribe.disconnect();
    setPartialTranscript("");
  }, [scribe]);

  const handleToggle = () => {
    if (isActive) {
      handleStop();
    } else {
      handleStart();
    }
  };

  const handleClearHistory = () => {
    setCommittedHistory([]);
  };

  return (
    <main className="min-h-screen bg-white text-neutral-900">
      <div className="mx-auto w-full max-w-2xl px-6 py-12 sm:py-16">
        <header className="space-y-2">
          <h1 className="text-2xl font-medium tracking-tight sm:text-3xl">
            Realtime Transcription
          </h1>
          <p className="text-sm text-neutral-500">
            Live speech-to-text with ElevenLabs Scribe.
          </p>
        </header>

        <div className="mt-10 space-y-8">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleToggle}
              disabled={isConnecting}
              className={
                isConnecting
                  ? "cursor-not-allowed rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-400"
                  : isActive
                    ? "rounded-md border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-900"
                    : "rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
              }
            >
              {isConnecting ? "Connecting…" : isActive ? "Stop" : "Start"}
            </button>
            {committedHistory.length > 0 ? (
              <button
                type="button"
                onClick={handleClearHistory}
                className="rounded-md px-4 py-2 text-sm font-medium text-neutral-500"
              >
                Clear History
              </button>
            ) : null}
            <p className="text-xs text-neutral-400">{statusLabel}</p>
          </div>

          {error ? (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}

          <LiveWaveform
            active={isActive}
            processing={isConnecting}
            barColor="rgb(115 115 115)"
            fadeEdges
            fadeWidth={24}
            height={64}
          />

          {isActive || partialTranscript ? (
            <div className="space-y-2">
              <p className="text-xs text-neutral-400">Live</p>
              <p className="min-h-6 text-sm text-neutral-500">
                {partialTranscript || "Listening…"}
              </p>
            </div>
          ) : null}

          {committedHistory.length > 0 ? (
            <div className="space-y-3">
              <p className="text-xs text-neutral-400">History</p>
              <div className="space-y-3">
                {committedHistory.map(entry => (
                  <p key={entry.id} className="text-sm text-neutral-900">
                    {entry.text}
                  </p>
                ))}
              </div>
            </div>
          ) : null}

          {!isActive && !isConnecting && committedHistory.length === 0 ? (
            <p className="text-sm text-neutral-500">
              Click Start to transcribe audio from your microphone.
            </p>
          ) : null}
        </div>
      </div>
    </main>
  );
}
