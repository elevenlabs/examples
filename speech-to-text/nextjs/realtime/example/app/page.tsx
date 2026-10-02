"use client";

import { useState, useCallback, useEffect } from "react";
import { useScribe, CommitStrategy } from "@elevenlabs/react";
import { LiveWaveform } from "@/components/ui/live-waveform";

function statusLabel(status: string) {
  switch (status) {
    case "connecting":
      return "Connecting";
    case "connected":
      return "Connected";
    case "transcribing":
      return "Transcribing";
    case "error":
      return "Error";
    default:
      return "Disconnected";
  }
}

export default function Home() {
  const [error, setError] = useState<string | null>(null);
  const [partialTranscript, setPartialTranscript] = useState("");
  const [committedHistory, setCommittedHistory] = useState<string[]>([]);

  const scribe = useScribe({
    modelId: "scribe_v2_realtime",
    commitStrategy: CommitStrategy.VAD,
    vadSilenceThresholdSecs: 1.5,
    vadThreshold: 0.4,
    onPartialTranscript: data => {
      setPartialTranscript(data.text || "");
    },
    onCommittedTranscript: data => {
      if (data.text && data.text.trim()) {
        setCommittedHistory(prev => [data.text, ...prev]);
      }
      setPartialTranscript("");
    },
    onError: err => {
      console.error("Scribe error:", err);
      setError("Connection error occurred. Please try again.");
    },
  });

  useEffect(() => {
    if (scribe.status === "disconnected" || scribe.status === "error") {
      setPartialTranscript("");
    }
  }, [scribe.status]);

  // Status moves to "transcribing" while speech is processed, so both
  // active states must keep the session controls and waveform up.
  const isActive =
    scribe.status === "connected" || scribe.status === "transcribing";
  const isConnecting = scribe.status === "connecting";

  const handleStart = useCallback(async () => {
    try {
      setError(null);
      setPartialTranscript("");

      // A failed session can leave the connection open. Drop it so the
      // next single-use token can connect.
      if (scribe.status === "error") {
        scribe.disconnect();
      }

      const response = await fetch("/api/scribe-token");
      const data = (await response.json().catch(() => ({}))) as {
        token?: string;
        error?: string;
      };
      if (!response.ok || !data.token) {
        throw new Error(data.error || "Failed to get transcription token");
      }

      await scribe.connect({
        token: data.token,
        microphone: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (err) {
      console.error("Failed to start transcription:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to start transcription. Please check your permissions and try again."
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
    } else if (!isConnecting) {
      void handleStart();
    }
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
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleToggle}
                disabled={isConnecting}
                className={
                  isActive
                    ? "rounded-md border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-900"
                    : "rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                }
              >
                {isConnecting ? "Connecting…" : isActive ? "Stop" : "Start"}
              </button>
              {committedHistory.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setCommittedHistory([])}
                  className="rounded-md px-4 py-2 text-sm font-medium text-neutral-600"
                >
                  Clear history
                </button>
              ) : null}
            </div>
            <p className="text-xs text-neutral-400">
              {statusLabel(scribe.status)}
            </p>
          </div>

          {error ? (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}

          <LiveWaveform
            active={isActive}
            barColor="rgb(115 115 115)"
            fadeEdges
            fadeWidth={24}
            height={64}
          />

          {isActive || partialTranscript ? (
            <div className="space-y-2">
              <h2 className="text-xs text-neutral-400">Live transcript</h2>
              <p className="text-sm italic text-neutral-500">
                {partialTranscript || "Listening…"}
              </p>
            </div>
          ) : null}

          {committedHistory.length > 0 ? (
            <div className="space-y-3">
              <h2 className="text-xs text-neutral-400">History</h2>
              <div className="max-h-96 space-y-3 overflow-y-auto">
                {committedHistory.map((text, index) => (
                  <p key={`${index}-${text}`} className="text-sm">
                    {text}
                  </p>
                ))}
              </div>
            </div>
          ) : null}

          {!isActive && !isConnecting && committedHistory.length === 0 ? (
            <p className="text-sm text-neutral-500">
              Click Start to begin transcribing audio from your microphone.
            </p>
          ) : null}
        </div>
      </div>
    </main>
  );
}
