"use client";

import { useCallback, useEffect, useState } from "react";
import { CommitStrategy, useScribe } from "@elevenlabs/react";
import { LiveWaveform } from "@/components/ui/live-waveform";

function statusLabel(
  status: string,
  isConnecting: boolean,
  isActive: boolean
): string {
  if (isConnecting) {
    return "Connecting";
  }
  if (status === "transcribing") {
    return "Transcribing";
  }
  if (isActive) {
    return "Connected";
  }
  if (status === "error") {
    return "Error";
  }
  return "Disconnected";
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

  const isActive =
    scribe.status === "connected" || scribe.status === "transcribing";
  const isConnecting = scribe.status === "connecting";

  const handleStart = useCallback(async () => {
    try {
      setError(null);
      setPartialTranscript("");

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
    } else {
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

        <div className="mt-10 space-y-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleToggle}
              disabled={isConnecting}
              className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isConnecting ? "Connecting..." : isActive ? "Stop" : "Start"}
            </button>
            <span className="text-xs text-neutral-400">
              {statusLabel(scribe.status, isConnecting, isActive)}
            </span>
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

          {(isActive || partialTranscript) && (
            <div className="space-y-1.5">
              <p className="text-xs text-neutral-400">Live transcript</p>
              <p className="min-h-[1.5rem] text-sm italic text-neutral-500">
                {partialTranscript || "Listening..."}
              </p>
            </div>
          )}

          {committedHistory.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-neutral-400">History</p>
              <div className="max-h-96 space-y-3 overflow-y-auto">
                {committedHistory.map((text, index) => (
                  <p key={`${index}-${text.slice(0, 24)}`} className="text-sm">
                    {text}
                  </p>
                ))}
              </div>
            </div>
          )}

          {!isActive && !isConnecting && committedHistory.length === 0 && (
            <p className="text-sm text-neutral-500">
              Click Start to begin transcribing audio from your microphone.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
