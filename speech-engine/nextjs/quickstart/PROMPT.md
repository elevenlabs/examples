Before writing any code, invoke the `/speech-engine` skill to learn the correct ElevenLabs SDK patterns.

## 1. `package.json`

- Add `@elevenlabs/react`, `@elevenlabs/elevenlabs-js`, `openai`, `dotenv`, and `tsx`.
- Add scripts: `speech-engine:create` (`tsx scripts/create-engine.mts`), `speech-engine:enable-first-message` (`tsx scripts/enable-first-message.mts`), `speech-engine:server` (`tsx server.mts`).
- Pin `livekit-client` to `2.16.1` under `pnpm.overrides` for WebRTC stability.

## 2. `.env.example`

- Document `ELEVENLABS_API_KEY`, `ELEVENLABS_SPEECH_ENGINE_ID`, `OPENAI_API_KEY`, and `PUBLIC_WS_URL` (`wss://…/ws` from ngrok).

## 3. `scripts/create-engine.mts`

- Load env with `dotenv/config`.
- Create a Speech Engine with `elevenlabs.speechEngine.create`, using `speechEngine.wsUrl` from `PUBLIC_WS_URL`.
- Call a shared helper to enable `overrides.firstMessage` on the new resource.
- Print `engineId` and next-step instructions.

## 4. `scripts/enable-first-message.mts`

- Update an existing Speech Engine (`ELEVENLABS_SPEECH_ENGINE_ID`) so the client may set `overrides.agent.firstMessage`.

## 5. `lib/speech-engine-overrides.ts`

- Export `enableFirstMessageOverride(client, speechEngineId)` using `speechEngine.update` with `overrides: { firstMessage: true }`.

## 6. `lib/assistant.ts`

- Shared OpenAI Responses API helpers: `ASSISTANT_INSTRUCTIONS`, `VOICE_FIRST_MESSAGE`, `isChatRole`, `normalizeChatMessages`, `transcriptToChatMessages`, `createAssistantReply(messages, signal)`, and `createAssistantStream(messages, signal)`.
- Map Speech Engine `agent` role to OpenAI `assistant`; keep responses concise.
- Normalize history before sending it to OpenAI: trim content, drop empty messages, cap message count and per-message length.

## 7. `lib/voice-history.ts`

- Add a tiny local store that lets the Next.js app hand typed chat history to the standalone Speech Engine server.
- Store normalized `ChatMessage[]` in `.next/cache/voice-history.json` by random `historyId`.
- Export `createVoiceHistory(messages)`, `linkVoiceHistory(conversationId, historyId)`, and `loadVoiceHistory(conversationId)`.
- Keep this demo-only and file-backed; no database or auth layer.

## 8. `server.mts`

- Standalone HTTP server on port **3001** with `speechEngine.attach(SPEECH_ENGINE_ID, httpServer, "/ws", { debug: true, … })`.
- `onTranscript`: load any typed chat history linked to `session.conversationId`, append `transcriptToChatMessages(transcript)`, pass `AbortSignal` into `createAssistantStream`, and `session.sendResponse(stream)`.
- Cache loaded initial history per conversation and retry briefly because the browser may link history immediately after the voice conversation is created.
- Log `onInit`, `onClose`, and `onError`. Require `ELEVENLABS_SPEECH_ENGINE_ID` and `OPENAI_API_KEY`.

## 9. `app/api/chat/route.ts`

- Secure POST route for regular typed chat.
- Accept `{ messages }`, validate each message as `{ role: "user" | "assistant", content: string }`, cap request history, and call `createAssistantReply(messages, request.signal)`.
- Return `{ message }`; return JSON errors for invalid payloads or OpenAI failures.
- This route and voice mode must use the same `ChatMessage` shape so context can move between modes.

## 10. `app/api/voice-history/route.ts`

- POST route that accepts the current typed chat history before voice mode starts.
- Validate and normalize messages with `isChatRole`, call `createVoiceHistory(messages)`, and return `{ historyId }`.
- Return a 400 if no valid messages are provided.

## 11. `app/api/voice-history/link/route.ts`

- POST route that accepts `{ historyId, conversationId }` from the browser once the Speech Engine client creates a voice conversation.
- Call `linkVoiceHistory(conversationId, historyId)` and return `{ ok: true }`, or 404 if the history id is unknown.

## 12. `app/api/token/route.ts`

- Secure GET route; never expose `ELEVENLABS_API_KEY` to the client.
- Return `{ token }` from `conversationalAi.conversations.getWebrtcToken({ agentId: ELEVENLABS_SPEECH_ENGINE_ID })`.
- Handle missing env and API errors with JSON error responses.

## 13. `app/page.tsx`

- Build a single chat UI that works like a normal assistant chat first, then can switch into voice mode without losing context.
- Keep one `messages` state array with `{ id, role: "user" | "assistant", content, channel: "chat" | "voice", pending?, error? }`.
- Text submit path: append the user message, POST the full normalized history to `/api/chat`, replace the pending assistant message with the reply, and keep the composer usable.
- Voice start path: request microphone access, POST current non-pending/non-error chat history to `/api/voice-history`, fetch `/api/token`, then `startSession({ conversationToken: token, overrides: { agent: { firstMessage: VOICE_FIRST_MESSAGE } }, onConversationCreated })`.
- In `onConversationCreated`, link the stored `historyId` to `voiceConversation.getId()` with `/api/voice-history/link`; if useful, also send a contextual update summarizing recent typed chat.
- Voice event path: use `useConversation({ onMessage })` to append or update transcript messages in the same `messages` array, mapping SDK role `agent` to local role `assistant`.
- While voice is connected, allow typed messages too: append them to the same thread and call `conversation.sendUserMessage(content)`; avoid duplicating echoes from `onMessage`.
- The next typed chat after voice mode must include voice transcript messages in the history sent to `/api/chat`.
- Show a scrollable message thread, a text composer, a mic/start voice control, a stop voice control, connection status, mute/unmute when connected, and separate chat/voice error messages.
- Follow `DESIGN.md`; make the page feel like a regular chat app with voice as a mode, not a voice-only demo.
