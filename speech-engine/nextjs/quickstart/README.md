# Speech Engine Quickstart (Next.js)

Add real-time voice to your own LLM-backed agent: a Speech Engine WebSocket server streams OpenAI responses to ElevenLabs, and a Next.js client starts WebRTC voice sessions.

## Setup

1. Copy the environment file and add your credentials:

   ```bash
   cp .env.example .env
   ```

   Then edit `.env` and set:
   - `ELEVENLABS_API_KEY` — [create one in the dashboard](https://elevenlabs.io/app/settings/api-keys)
   - `OPENAI_API_KEY` — for the assistant LLM in the Speech Engine server
   - `PUBLIC_WS_URL` — public `wss://` URL for your Speech Engine WebSocket (see step 2)

2. Expose port **3001** with [ngrok](https://ngrok.com/) (run this before creating the Speech Engine resource):

   ```bash
   ngrok http 3001
   ```

   Set `PUBLIC_WS_URL` to your forwarding URL with `/ws` appended, for example `wss://abc123.ngrok-free.app/ws`.

3. Install dependencies:

   ```bash
   pnpm install
   ```

4. Create the Speech Engine resource and enable client first-message overrides:

   ```bash
   pnpm run speech-engine:create
   pnpm run speech-engine:enable-first-message
   ```

   Copy the printed Speech Engine ID into `.env` as `ELEVENLABS_SPEECH_ENGINE_ID`.

## Run

Three processes must run together:

1. **ngrok** — `ngrok http 3001`
2. **Speech Engine server** — `pnpm run speech-engine:server` (port 3001)
3. **Next.js app** — `pnpm run dev` (port 3000)

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

- Click **Start conversation** and allow microphone access when prompted.
- Speak naturally; the agent responds with streamed speech. With `debug: true` on the server, transcripts and responses log to the terminal.
- Click **End conversation** to stop the session.
- The agent greets first using `overrides.agent.firstMessage` (requires `speech-engine:enable-first-message` once per Speech Engine ID).
