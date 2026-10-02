"use client";

import { useState, useCallback, useEffect } from "react";
import { useScribe, CommitStrategy } from "@elevenlabs/react";
import { LiveWaveform } from "@/components/ui/live-waveform";

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

  // Check both connected and transcribing states to properly show active status
  const isActive =
    scribe.status === "connected" || scribe.status === "transcribing";
  const isConnecting = scribe.status === "connecting";

  const handleStart = useCallback(async () => {
    try {
      setError(null);
      setPartialTranscript("");

      // Fetch a fresh single-use token from our API
      const response = await fetch("/api/scribe-token");
      if (!response.ok) {
        throw new Error("Failed to get transcription token");
      }
      const { token } = await response.json();

      // Connect with microphone access
      await scribe.connect({
        token,
        microphone: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (err) {
      console.error("Failed to start transcription:", err);
      setError(
        "Failed to start transcription. Please check your permissions and try again."
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

        <div className="mt-8 space-y-6">
          {/* Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={handleToggle}
                disabled={isConnecting}
                className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-red-500 text-white hover:bg-red-600"
                    : isConnecting
                      ? "bg-neutral-200 text-neutral-400 cursor-not-allowed"
                      : "bg-neutral-900 text-white hover:bg-neutral-800"
                }`}
              >
                {isConnecting ? "Connecting..." : isActive ? "Stop" : "Start"}
              </button>
              {committedHistory.length > 0 && (
                <button
                  onClick={handleClearHistory}
                  className="rounded-md px-4 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors"
                >
                  Clear History
                </button>
              )}
            </div>
            <div className="text-xs text-neutral-400">
              {isActive ? (
                <span className="flex items-center">
                  <span className="mr-1.5 h-2 w-2 rounded-full bg-green-500"></span>
                  {scribe.status === "transcribing"
                    ? "Transcribing"
                    : "Connected"}
                </span>
              ) : (
                <span>Disconnected</span>
              )}
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Live waveform */}
          <div className="h-16">
            <LiveWaveform
              active={isActive}
              processing={isActive}
              barColor="rgb(115 115 115)"
              fadeEdges={true}
              fadeWidth={24}
              height={64}
            />
          </div>

          {/* Partial transcript */}
          {(isActive || partialTranscript) && (
            <div className="space-y-2">
              <h2 className="text-xs text-neutral-400 uppercase tracking-wide">
                Live Transcript
              </h2>
              <div className="min-h-[3rem] rounded-md border border-neutral-200 px-4 py-3">
                <p className="text-sm text-neutral-600">
                  {partialTranscript || (
                    <span className="text-neutral-400">Listening...</span>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Committed transcript history */}
          {committedHistory.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-xs text-neutral-400 uppercase tracking-wide">
                History
              </h2>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {committedHistory.map((text, index) => (
                  <div
                    key={index}
                    className="rounded-md border border-neutral-200 px-4 py-3 text-sm"
                  >
                    {text}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Instructions when not started */}
          {!isActive && !isConnecting && committedHistory.length === 0 && (
            <div className="text-center py-12 text-sm text-neutral-500">
              Click "Start" to begin transcribing audio from your microphone.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
