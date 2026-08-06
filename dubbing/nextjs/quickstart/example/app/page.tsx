"use client";

import { useEffect, useRef, useState } from "react";

import { recordedBlobToWavFile } from "@/lib/wav";
import { cn } from "@/lib/utils";

const LANG_OPTIONS = [
  { code: "en", label: "English" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "it", label: "Italian" },
  { code: "pt", label: "Portuguese" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "hi", label: "Hindi" },
] as const;

const SOURCE_OPTIONS = [
  { code: "auto", label: "Auto-detect" },
  ...LANG_OPTIONS,
] as const;

type Phase = "idle" | "recording" | "preparing" | "polling" | "ready" | "error";

function pickRecorderMimeType(): string | undefined {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
  ] as const;
  for (const m of candidates) {
    if (
      typeof MediaRecorder !== "undefined" &&
      MediaRecorder.isTypeSupported(m)
    ) {
      return m;
    }
  }
  return undefined;
}

export default function Home() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);

  const [sourceLang, setSourceLang] = useState<string>("auto");
  const [targetLang, setTargetLang] = useState<string>("es");

  const [elapsedMs, setElapsedMs] = useState(0);
  const [wavFile, setWavFile] = useState<File | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);

  const [projectId, setProjectId] = useState<string | null>(null);
  const [dubbedUrl, setDubbedUrl] = useState<string | null>(null);
  const [pollNote, setPollNote] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordMimeRef = useRef<string>("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordStartRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      if (originalUrl) URL.revokeObjectURL(originalUrl);
      if (dubbedUrl) URL.revokeObjectURL(dubbedUrl);
    };
  }, [originalUrl, dubbedUrl]);

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startRecording = async () => {
    setError(null);
    setOriginalUrl(prev => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setWavFile(null);
    setDubbedUrl(prev => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setProjectId(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = pickRecorderMimeType();
      recordMimeRef.current = mimeType ?? "";
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined
      );
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = e => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onerror = () => {
        setError("Recording failed.");
        setPhase("error");
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        mediaRecorderRef.current = null;

        const blobType = recordMimeRef.current || "audio/webm";
        const rawBlob = new Blob(chunksRef.current, { type: blobType });
        setPhase("preparing");
        try {
          const wav = await recordedBlobToWavFile(rawBlob);
          setOriginalUrl(prev => {
            if (prev) URL.revokeObjectURL(prev);
            return URL.createObjectURL(wav);
          });
          setWavFile(wav);
          setPhase("idle");
        } catch (e) {
          setError(
            e instanceof Error
              ? e.message
              : "Could not convert recording to WAV."
          );
          setPhase("error");
        } finally {
          stopTimer();
          setElapsedMs(0);
        }
      };

      recordStartRef.current = Date.now();
      setElapsedMs(0);
      setPhase("recording");
      recorder.start(250);

      stopTimer();
      timerRef.current = setInterval(() => {
        setElapsedMs(Date.now() - recordStartRef.current);
      }, 100);
    } catch (e) {
      const msg =
        e instanceof DOMException && e.name === "NotAllowedError"
          ? "Microphone access was denied."
          : e instanceof Error
            ? e.message
            : "Could not access the microphone.";
      setError(msg);
      setPhase("error");
    }
  };

  const stopRecording = () => {
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== "inactive") {
      rec.stop();
    } else {
      stopTimer();
      setElapsedMs(0);
    }
  };

  const startDubbing = async () => {
    if (!wavFile) return;
    setError(null);
    setDubbedUrl(prev => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setPhase("polling");
    setProjectId(null);
    setPollNote(null);

    const body = new FormData();
    body.set("audio", wavFile);
    body.set("targetLang", targetLang);
    body.set("sourceLang", sourceLang);

    try {
      const res = await fetch("/api/dubbing", { method: "POST", body });
      const data = (await res.json()) as {
        projectId?: string;
        languageId?: string | null;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Upload failed.");
        setPhase("error");
        return;
      }
      if (!data.projectId) {
        setError("Missing project id in response.");
        setPhase("error");
        return;
      }
      setProjectId(data.projectId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
      setPhase("error");
    }
  };

  useEffect(() => {
    if (phase !== "polling" || !projectId) return;

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      try {
        const res = await fetch(
          `/api/dubbing/${encodeURIComponent(projectId)}`
        );
        const data = (await res.json()) as {
          projectStatus?: string;
          languageId?: string | null;
          languageStatus?: string | null;
          error?: string;
        };

        if (cancelled) return;

        if (!res.ok) {
          setError(data.error ?? "Status request failed.");
          setPhase("error");
          return;
        }

        if (data.projectStatus === "failed") {
          setError("Preparing the source audio failed.");
          setPhase("error");
          return;
        }
        if (data.languageStatus === "failed") {
          setError("Dubbing failed.");
          setPhase("error");
          return;
        }

        if (data.languageStatus === "completed" && data.languageId) {
          try {
            const audioRes = await fetch(
              `/api/dubbing/${encodeURIComponent(projectId)}/audio/${encodeURIComponent(data.languageId)}`
            );
            if (!audioRes.ok) {
              const errJson = (await audioRes.json().catch(() => ({}))) as {
                error?: string;
              };
              setError(errJson.error ?? "Could not load dubbed audio.");
              setPhase("error");
              return;
            }
            const blob = await audioRes.blob();
            if (cancelled) return;
            setDubbedUrl(prev => {
              if (prev) URL.revokeObjectURL(prev);
              return URL.createObjectURL(blob);
            });
            setPhase("ready");
          } catch (e) {
            if (!cancelled) {
              setError(
                e instanceof Error ? e.message : "Could not load dubbed audio."
              );
              setPhase("error");
            }
          }
          return;
        }

        setPollNote(
          data.projectStatus !== "ready"
            ? "Transcribing your recording…"
            : "Generating the dubbed audio…"
        );
        timeoutId = setTimeout(poll, 5000);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Polling failed.");
          setPhase("error");
        }
      }
    };

    poll();

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [phase, projectId]);

  const sameLangBlocked = sourceLang !== "auto" && sourceLang === targetLang;

  const formatElapsed = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const statusLine = () => {
    switch (phase) {
      case "idle":
        return wavFile ? "Ready to dub." : "Record a clip to get started.";
      case "recording":
        return "Recording…";
      case "preparing":
        return "Preparing audio…";
      case "polling":
        return pollNote ?? "Dubbing in progress… checking every 5s.";
      case "ready":
        return "Dubbing complete.";
      case "error":
        return "Something went wrong.";
      default:
        return "";
    }
  };

  return (
    <main className="min-h-screen bg-white text-neutral-900">
      <div className="mx-auto w-full max-w-2xl px-6 py-12 sm:py-16">
        <header className="space-y-2">
          <h1 className="text-2xl font-medium tracking-tight sm:text-3xl">
            Browser dubbing
          </h1>
          <p className="text-sm text-neutral-500">
            Record audio and dub it with ElevenLabs.
          </p>
        </header>

        <div className="mt-10 space-y-8">
          <p className="text-xs text-neutral-400">{statusLine()}</p>

          {error ? (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            {phase === "recording" ? (
              <>
                <span
                  className="inline-flex h-2 w-2 rounded-full bg-red-500 animate-pulse"
                  aria-hidden
                />
                <span className="text-sm tabular-nums">
                  {formatElapsed(elapsedMs)}
                </span>
                <button
                  type="button"
                  className="rounded-md border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-900"
                  onClick={stopRecording}
                >
                  Stop
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={phase === "preparing" || phase === "polling"}
                className={cn(
                  "rounded-md px-4 py-2 text-sm font-medium",
                  phase === "preparing" || phase === "polling"
                    ? "cursor-not-allowed bg-neutral-100 text-neutral-400"
                    : "bg-neutral-900 text-white"
                )}
                onClick={startRecording}
              >
                {phase === "preparing" ? "Preparing…" : "Record"}
              </button>
            )}
          </div>

          {originalUrl && wavFile ? (
            <div className="space-y-4">
              <div>
                <p className="text-xs text-neutral-400">Original</p>
                <audio className="mt-1 w-full" controls src={originalUrl} />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-1">
                  <span className="text-xs text-neutral-400">
                    Source language
                  </span>
                  <select
                    className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm"
                    value={sourceLang}
                    onChange={e => setSourceLang(e.target.value)}
                    disabled={phase === "polling"}
                  >
                    {SOURCE_OPTIONS.map(o => (
                      <option key={o.code} value={o.code}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className="text-xs text-neutral-400">
                    Target language
                  </span>
                  <select
                    className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm"
                    value={targetLang}
                    onChange={e => setTargetLang(e.target.value)}
                    disabled={phase === "polling"}
                  >
                    {LANG_OPTIONS.map(o => (
                      <option key={o.code} value={o.code}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {sameLangBlocked ? (
                <p className="text-xs text-neutral-500">
                  Choose different source and target languages (or use
                  auto-detect for source).
                </p>
              ) : null}

              <button
                type="button"
                disabled={phase === "polling" || sameLangBlocked || !wavFile}
                className={cn(
                  "rounded-md px-4 py-2 text-sm font-medium",
                  phase === "polling" || sameLangBlocked
                    ? "cursor-not-allowed bg-neutral-100 text-neutral-400"
                    : "bg-neutral-900 text-white"
                )}
                onClick={startDubbing}
              >
                {phase === "polling" ? "Dubbing…" : "Dub recording"}
              </button>
            </div>
          ) : null}

          {dubbedUrl && phase === "ready" ? (
            <div>
              <p className="text-xs text-neutral-400">Dubbed</p>
              <audio className="mt-1 w-full" controls src={dubbedUrl} />
              <a
                className="mt-2 inline-block text-sm text-neutral-900 underline"
                href={dubbedUrl}
                download={`dub-${targetLang}.wav`}
              >
                Download WAV
              </a>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
