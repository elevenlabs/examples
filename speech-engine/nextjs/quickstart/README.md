# Speech Engine Quickstart (Next.js)

Add voice to your own LLM-backed chat agent with ElevenLabs Speech Engine, a Node WebSocket server, and a Next.js browser client.

## Setup

1. Copy the environment file and add your credentials:

   ```bash
   cp .env.example .env.local
   ```

   Then edit `.env.local` and set:
   - `ELEVENLABS_API_KEY`
   - `OPENAI_API_KEY`
   - `OPENAI_MODEL`

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Expose the Speech Engine server with ngrok:

   ```bash
   ngrok http 3001
   ```

   Copy the forwarding URL into `.env.local` as `PUBLIC_WS_URL` with `/ws` appended, for example `wss://abc123.ngrok.app/ws`. Use `wss://` (the create script accepts `https://` and converts it).

4. Create a Speech Engine and copy the printed id into `.env.local`:

   ```bash
   pnpm run speech-engine:create
   ```

   Set the value as `ELEVENLABS_SPEECH_ENGINE_ID`. If your ngrok URL changes, run this command again and update the id.

## Run

Start the Speech Engine server:

```bash
pnpm run speech-engine:server
```

In another terminal, start the Next.js app:

```bash
pnpm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

- Keep ngrok, `pnpm run speech-engine:server`, and `pnpm run dev` running.
- Click **Start conversation** and allow microphone access. The app fetches a conversation token from the server and starts a WebRTC voice session.
- Once connected, speak naturally. ElevenLabs transcribes your speech, your server streams an OpenAI response back, and ElevenLabs plays the generated voice response in the browser.
- Click **Stop conversation** to end the session.

## Troubleshooting

If the browser cannot connect, check the Speech Engine server terminal first. You should see a session log when the browser starts a conversation. If you do not, confirm ngrok is still forwarding to port `3001`, `PUBLIC_WS_URL` includes `/ws`, and `ELEVENLABS_SPEECH_ENGINE_ID` points to an engine created with that URL. If you previously created the Speech Engine with a different ngrok URL, run `pnpm run speech-engine:create` again and update the id.

When you speak, the Speech Engine server terminal should log `[speech-engine] transcript:` followed by `[speech-engine] response sent for:`. If you see `onTranscript error` instead, fix the reported OpenAI or server issue first. A backend failure can also surface in the browser as a client SDK error about `error_type`.
