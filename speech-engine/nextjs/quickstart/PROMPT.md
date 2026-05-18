Before writing any code, invoke the `/speech-engine` skill to learn the correct ElevenLabs SDK patterns.

## 1. `package.json`

- Add `@elevenlabs/react`, `@elevenlabs/elevenlabs-js`, `openai`, and `dotenv`.
- Add `tsx` as a dev dependency.
- Add scripts: `speech-engine:create` runs `scripts/create-engine.mts`; `speech-engine:server` runs `server.mts`.

## 2. `.env.example`

- Include `ELEVENLABS_API_KEY`, `ELEVENLABS_SPEECH_ENGINE_ID`, `PUBLIC_WS_URL`, `OPENAI_API_KEY`, and `OPENAI_MODEL=gpt-4o`.

## 3. `scripts/create-engine.mts`

Small script that creates a Speech Engine resource.

- Load env from `.env.local`.
- Validate `ELEVENLABS_API_KEY` and `PUBLIC_WS_URL`.
- Accept `wss://` or `https://` ngrok URLs with `/ws` appended. Normalize `https://` to `wss://` before calling the API.
- Use `ElevenLabsClient` and call `client.speechEngine.create({ name, speechEngine: { wsUrl } })`.
- Print the returned `engineId` or `speechEngineId` clearly so it can be copied to `ELEVENLABS_SPEECH_ENGINE_ID`.

## 4. `server.mts`

Node Speech Engine server that listens on port `3001` and attaches the SDK on `/ws`.

- Load env from `.env.local`.
- Validate `ELEVENLABS_API_KEY`, `ELEVENLABS_SPEECH_ENGINE_ID`, `OPENAI_API_KEY`, and `OPENAI_MODEL`.
- Create a Node HTTP server with `/health`.
- Fetch the resource with `client.speechEngine.get(speechEngineId)`, then call `engine.attach(httpServer, "/ws", callbacks)`.
- In `onTranscript`, call `openai.responses.create` with `stream: true`, concise voice-assistant instructions, and the full transcript mapped to OpenAI roles (`agent` -> `assistant`).
- Pass the provided `AbortSignal` to OpenAI so user interruptions cancel the in-flight response.
- `await session.sendResponse(response)` with the OpenAI stream.
- Wrap `onTranscript` in try/catch; on failure, log the error and send a short fallback string with `session.sendResponse(...)` unless the turn was aborted.
- Log `onInit`, `onClose`, `onDisconnect`, and `onError`; keep `debug: true` for local development.

## 5. `app/api/token/route.ts`

Secure GET endpoint that returns a fresh conversation token for `ELEVENLABS_SPEECH_ENGINE_ID`.
Never expose `ELEVENLABS_API_KEY` to the client.

- Use `ElevenLabsClient`.
- Call `client.conversationalAi.conversations.getWebrtcToken({ agentId: speechEngineId })`.
- Return `{ token }`; return readable JSON errors for missing env and API failures.

## 6. `app/page.tsx`

Minimal Speech Engine voice chat page.

- Wrap the page in `ConversationProvider` and use `useConversation` from `@elevenlabs/react`.
- Show setup reminders: run ngrok for port `3001`, create a Speech Engine with `PUBLIC_WS_URL`, run `pnpm run speech-engine:server`, then run the Next.js app.
- Start voice sessions by requesting microphone access, fetching `/api/token`, and calling `conversation.startSession({ conversationToken: token })`.
- Do not set `overrides.agent.firstMessage` unless the Speech Engine resource explicitly allows that override.
- Track a local starting state so users cannot launch multiple overlapping sessions while WebRTC is connecting.
- Show Start/Stop controls, connection status, and inline errors.
- Use callbacks such as `onConnect`, `onDisconnect`, `onMessage`, and `onError` to render a running transcript when events are available.
- Rely on the SDK's connection-type inference; do not hardcode `connectionType`.
