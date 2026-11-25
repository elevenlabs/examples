"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb";
const DEFAULT_MODEL_ID = "eleven_multilingual_sts_v2";

type VoiceOption = {
  voiceId: string;
  name: string;
  previewUrl: string | null;
};

function formatElapsed(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function Home() {
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [voicesError, setVoicesError] = useState<string | null>(null);
  const [voiceId, setVoiceId] = useState(DEFAULT_VOICE_ID);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingElapsed, setRecordingElapsed] = useState(0);
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);

  const [isConverting, setIsConverting] = useState(false);
  const [convertedUrl, setConvertedUrl] = useState<string | null>(null);
  const [convertError, setConvertError] = useState<string | null>(null);
  const [micError, setMicError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // Bumped whenever a conversion result would be stale, so in-flight requests are ignored.
  const conversionIdRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/voices");
        const data: { voices?: VoiceOption[]; error?: string } =
          await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to load voices.");
        }
        if (!cancelled && Array.isArray(data.voices)) {
          setVoices(data.voices);
          const list = data.voices;
          setVoiceId(prev =>
            list.length === 0 || list.some(v => v.voiceId === prev)
              ? prev
              : list[0].voiceId
          );
        }
      } catch (e) {
        if (!cancelled) {
          setVoicesError(
            e instanceof Error ? e.message : "Failed to load voices."
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!originalUrl) return;
    return () => URL.revokeObjectURL(originalUrl);
  }, [originalUrl]);

  useEffect(() => {
    if (!convertedUrl) return;
    return () => URL.revokeObjectURL(convertedUrl);
  }, [convertedUrl]);

  const discardConversion = useCallback(() => {
    conversionIdRef.current += 1;
    setConvertedUrl(null);
    setConvertError(null);
    setIsConverting(false);
  }, []);

  const changeVoice = useCallback(
    (nextVoiceId: string) => {
      setVoiceId(nextVoiceId);
      discardConversion();
    },
    [discardConversion]
  );

  useEffect(() => {
    if (!isRecording) return;
    const start = Date.now();
    const id = window.setInterval(() => {
      setRecordingElapsed(Math.floor((Date.now() - start) / 1000));
    }, 250);
    return () => window.clearInterval(id);
  }, [isRecording]);

  const startRecording = useCallback(async () => {
    setMicError(null);
    setConvertError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : undefined;

      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined
      );
      const chunks: Blob[] = [];

      recorder.ondataavailable = e => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        recorderRef.current = null;
        const blob = new Blob(chunks, {
          type: recorder.mimeType || mimeType || "audio/webm",
        });
        setRecordingBlob(blob);
        setOriginalUrl(URL.createObjectURL(blob));
        setIsRecording(false);
      };

      recorderRef.current = recorder;
      recorder.start();
      setRecordingElapsed(0);
      setIsRecording(true);
    } catch (e) {
      const denied = e instanceof DOMException && e.name === "NotAllowedError";
      setMicError(
        denied
          ? "Microphone access was denied. Allow the microphone for this site to record."
          : e instanceof Error
            ? e.message
            : "Could not access the microphone."
      );
    }
  }, []);

  const stopRecording = useCallback(() => {
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") {
      rec.stop();
    }
  }, []);

  const recordAgain = useCallback(() => {
    discardConversion();
    setRecordingBlob(null);
    setOriginalUrl(null);
    setRecordingElapsed(0);
    setMicError(null);
  }, [discardConversion]);

  const convertVoice = useCallback(async () => {
    if (!recordingBlob) return;
    const conversionId = ++conversionIdRef.current;
    setIsConverting(true);
    setConvertedUrl(null);
    setConvertError(null);
    try {
      const file = new File([recordingBlob], "recording.webm", {
        type: recordingBlob.type || "audio/webm",
      });
      const formData = new FormData();
      formData.append("audio", file);
      formData.append("voiceId", voiceId);
      formData.append("modelId", DEFAULT_MODEL_ID);

      const res = await fetch("/api/voice-changer", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        const msg =
          typeof errBody === "object" &&
          errBody !== null &&
          "error" in errBody &&
          typeof (errBody as { error: unknown }).error === "string"
            ? (errBody as { error: string }).error
            : "Conversion failed.";
        throw new Error(msg);
      }

      const blob = await res.blob();
      if (conversionId !== conversionIdRef.current) return;
      setConvertedUrl(URL.createObjectURL(blob));
    } catch (e) {
      if (conversionId !== conversionIdRef.current) return;
      setConvertError(e instanceof Error ? e.message : "Conversion failed.");
    } finally {
      if (conversionId === conversionIdRef.current) {
        setIsConverting(false);
      }
    }
  }, [recordingBlob, voiceId]);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      const rec = recorderRef.current;
      if (rec && rec.state !== "inactive") {
        rec.stop();
      }
    };
  }, []);

  const hasRecording = recordingBlob !== null;
  const canConvert = hasRecording && voiceId !== "" && !isConverting;
  const voiceSelectDisabled = !hasRecording;

  return (
    <main className="min-h-screen bg-white text-neutral-900">
      <div className="mx-auto w-full max-w-2xl px-6 py-12 sm:py-16">
        <header className="space-y-2">
          <h1 className="text-2xl font-medium tracking-tight sm:text-3xl">
            Voice Changer
          </h1>
          <p className="text-sm text-neutral-500">
            Record audio, pick a voice, and convert with ElevenLabs
            speech-to-speech.
          </p>
        </header>

        <div className="mt-10 space-y-8">
          {voicesError && (
            <p className="text-sm text-red-600" role="alert">
              {voicesError}
            </p>
          )}

          <div className="space-y-3">
            <label
              className="block text-xs text-neutral-400"
              htmlFor="voice-select"
            >
              Target voice
            </label>
            <select
              id="voice-select"
              disabled={voiceSelectDisabled}
              value={voiceId}
              onChange={e => changeVoice(e.target.value)}
              className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {voices.length === 0 ? (
                <option value={DEFAULT_VOICE_ID}>George (default)</option>
              ) : (
                voices.map(v => (
                  <option key={v.voiceId} value={v.voiceId}>
                    {v.name}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="space-y-4">
            {!hasRecording && !isRecording && (
              <button
                type="button"
                onClick={startRecording}
                className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
              >
                Record
              </button>
            )}

            {isRecording && (
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full bg-red-600 animate-pulse"
                    aria-hidden
                  />
                  <span className="text-sm tabular-nums text-neutral-900">
                    {formatElapsed(recordingElapsed)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={stopRecording}
                  className="rounded-md border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-900"
                >
                  Stop
                </button>
              </div>
            )}

            {micError && (
              <p className="text-sm text-red-600" role="alert">
                {micError}
              </p>
            )}

            {hasRecording && !isRecording && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-xs text-neutral-400">Original recording</p>
                  {originalUrl && (
                    <audio className="w-full" controls src={originalUrl} />
                  )}
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled={!canConvert}
                    onClick={convertVoice}
                    className="inline-flex items-center justify-center gap-2 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isConverting && (
                      <Loader2
                        className="h-4 w-4 shrink-0 animate-spin"
                        aria-hidden
                      />
                    )}
                    Convert Voice
                  </button>
                  <button
                    type="button"
                    onClick={recordAgain}
                    className="rounded-md border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-900"
                  >
                    Record Again
                  </button>
                </div>

                {convertError && (
                  <p className="text-sm text-red-600" role="alert">
                    {convertError}
                  </p>
                )}

                {convertedUrl && !isConverting && (
                  <div className="space-y-2">
                    <p className="text-xs text-neutral-400">Converted Audio</p>
                    <audio className="w-full" controls src={convertedUrl} />
                    <a
                      href={convertedUrl}
                      download="converted.mp3"
                      className="inline-block text-sm font-medium text-neutral-900 underline underline-offset-2"
                    >
                      Download
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
