Before writing any code, invoke the `/text-to-speech` skill to learn the correct ElevenLabs SDK patterns.

This example uses the Dubbing Projects API (dubbing v2): a **project** holds the source media and its transcript, and each **language target** produces one dubbed output.

## 1. `app/api/dubbing/route.ts`

Secure POST endpoint that starts a dubbing project from an uploaded recording.

- Read `ELEVENLABS_API_KEY` from `process.env`. Return 500 if missing.
- Accept `audio` (File), `targetLang` (string), and optional `sourceLang` (string, default `auto`) from request `FormData`.
- Return 400 for missing or invalid audio, or a missing `targetLang`.
- Use `ElevenLabsClient` and call `client.dubbing.project.create({ file: audio, targetLanguage: targetLang, sourceLanguage: sourceLang === "auto" ? undefined : sourceLang, modelId: "dubbing_v2", reference: "Browser dubbing demo" })`. The `targetLanguage` shortcut also queues a language target that starts automatically once the project finishes transcribing.
- Return JSON `{ projectId, languageId }`, reading `languageId` from `project.languageIds?.[0] ?? null`.
- Wrap failures in readable JSON errors.

## 2. `app/api/dubbing/[projectId]/route.ts`

Secure GET endpoint that returns combined project and language status for polling.

- Read and validate `projectId` from the route params.
- Call `client.dubbing.project.get(projectId)`. Project statuses are `queued`, `preparing`, `processing`, `ready`, or `failed`.
- If the project has a language target (`project.languageIds?.[0]`), also call `client.dubbing.project.language.get(projectId, languageId)`. Language statuses are `queued`, `processing`, `completed`, `stale`, or `failed`.
- Return JSON with `projectStatus`, `languageId`, and `languageStatus`.
- Keep the response small and friendly for client polling.

## 3. `app/api/dubbing/[projectId]/audio/[languageId]/route.ts`

Secure GET endpoint that proxies the dubbed audio output.

- Read and validate `projectId` and `languageId` from the route params.
- Call `client.dubbing.project.language.get(projectId, languageId)`. Once the language is `completed`, `outputs.losslessAudio` carries a signed, time-limited download URL.
- Return 503 with a readable JSON error if the language is not `completed` yet or has no output URL.
- Fetch the signed URL server-side and stream the body back with the upstream content type (default `audio/wav`).

## 4. `app/page.tsx`

In-browser voice recorder and dubbing page.

- Use a compact curated language list in the page: `auto` for source detection plus English, Spanish, French, German, Italian, Portuguese, Japanese, Korean, and Hindi.
- Record from the microphone with `navigator.mediaDevices.getUserMedia({ audio: true })` and `MediaRecorder`, using a browser-supported mime type (prefer `audio/webm;codecs=opus`, then `audio/webm`, then `audio/mp4`).
- After stopping, convert the recorded blob to a WAV `File` in the browser before upload. Do not send raw `audio/webm;codecs=opus` to `/api/dubbing`, because the Dubbing API rejects that content type.
- Show clear states: idle, recording, preparing, polling, ready, and error. While recording, show elapsed time and a pulsing red indicator.
- After recording, show the original audio player plus source-language and target-language selects. Prevent choosing the same explicit source and target language.
- On **Dub Recording**, `POST` `FormData` with the converted WAV file to `/api/dubbing` and keep the returned `projectId`.
- Poll `/api/dubbing/${projectId}` every 5 seconds. While polling, show "Transcribing your recording…" until `projectStatus` is `ready`, then "Generating the dubbed audio…". Stop with an error if `projectStatus` or `languageStatus` is `failed`.
- When `languageStatus` is `completed`, fetch `/api/dubbing/${projectId}/audio/${languageId}`, create an object URL, and render a dubbed `<audio>` player with controls plus a WAV download link.
- Display inline errors for microphone denial, upload failures, and dubbing failures.
- Keep the UI minimal and easy to scan.
