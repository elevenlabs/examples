![ElevenLabs Examples Header](./examples-header.png)

Prompt-driven ElevenLabs examples for text-to-speech, speech-to-text, music, sound effects, and agents. Each project includes:

- `PROMPT.md` — instructions for agent-driven generation
- `setup.sh` — scaffolds the `example/` directory from a shared template
- `example/` — the generated, runnable example with its own `README.md`

Shared base templates live in `templates/` (Expo, Next.js, Python, TypeScript). UI styling rules are in `DESIGN.md`.

> The legacy `examples/` folder is being deprecated and can be ignored for new work.

## Current examples

- [Text-to-Speech Quickstart (TypeScript)](text-to-speech/typescript/quickstart/example/README.md) — Generate an MP3 from text with the ElevenLabs JS SDK.
- [Text-to-Speech Quickstart (Python)](text-to-speech/python/quickstart/example/README.md) — Generate an MP3 from text with the ElevenLabs Python SDK.
- [Text to Speech Playground (Next.js)](text-to-speech/nextjs/quickstart/example/README.md) — Generate speech from text in a Next.js app and play it back in the browser.
- [Speech-to-Text Quickstart (TypeScript)](speech-to-text/typescript/quickstart/example/README.md) — Transcribe local audio files with Scribe v2.
- [Speech-to-Text Quickstart (Python)](speech-to-text/python/quickstart/example/README.md) — Transcribe local audio files with Scribe v2.
- [Music Quickstart (TypeScript)](music/typescript/quickstart/example/README.md) — Generate an MP3 track from a text prompt with the ElevenLabs JS SDK.
- [Music Quickstart (Python)](music/python/quickstart/example/README.md) — Generate an MP3 track from a text prompt with the ElevenLabs Python SDK.
- [Music Playground (Next.js)](music/nextjs/quickstart/example/README.md) — Enter a prompt, generate a music track, and play it back in the browser.
- [Sound Effects Quickstart (TypeScript)](sound-effects/typescript/quickstart/example/README.md) — Generate a sound effect MP3 from a text prompt with the ElevenLabs JS SDK.
- [Sound Effects Quickstart (Python)](sound-effects/python/quickstart/example/README.md) — Generate a sound effect MP3 from a text prompt with the ElevenLabs Python SDK.
- [Sound Effects Playground (Next.js)](sound-effects/nextjs/quickstart/example/README.md) — Enter a prompt, generate a sound effect, and play it back in the browser.
- [Real-Time Speech-to-Text (Next.js)](speech-to-text/nextjs/realtime/example/README.md) — Live microphone transcription with VAD in a Next.js app.
- [Speech Engine Quickstart (Next.js)](speech-engine/nextjs/quickstart/example/README.md) — Add voice to your own LLM-backed chat agent with a Speech Engine WebSocket server and Next.js client.
- [Real-Time Voice Agent (Next.js)](agents/nextjs/quickstart/example/README.md) — Live voice conversations with the ElevenLabs Agents Platform using the React Agents SDK.
- [Voice Agent Guardrails Demo (Next.js)](agents/nextjs/guardrails/example/README.md) — Demonstrate custom guardrails and the `guardrail_triggered` client event in a live voice agent.
- [Voice Isolator (Next.js)](voice-isolator/nextjs/quickstart/example/README.md) — Record your voice in the browser and remove background noise with the Voice Isolator API.
- [Dubbing Recorder (Next.js)](dubbing/nextjs/quickstart/example/README.md) — Record your voice in the browser, dub it into another language, and play or download the result.

## Generate examples from prompts

The general prompt-runner workflow is in `scripts/generate-examples.sh` and is exposed as:

```bash
pnpm run generate
```

### Prerequisites

- `pnpm`
- `cursor` CLI

Install root dependencies first:

```bash
pnpm install
```

### Usage

Run all example prompts:

```bash
pnpm run generate
```

Run only one example:

```bash
pnpm run generate speech-to-text/nextjs/realtime
```

Optional flags:

```bash
pnpm run generate -t 1200                     # timeout per prompt in seconds (default: 600)
pnpm run generate -m "claude-4-sonnet"        # model selection (default: Cursor auto-select)
pnpm run generate -v                          # verbose output
pnpm run generate -m "claude-4-sonnet" -t 1200 -v
```

## Try an example directly

Each example has an `example/` folder with a README containing setup and run instructions. See the links in [Current examples](#current-examples) above.

## Contributing

We welcome contributions from the community. Install the pre-commit hook before submitting:

```bash
pip install pre-commit
pre-commit install
```

## Learn more

- [ElevenLabs Developer Docs](https://elevenlabs.io/docs/api-reference/getting-started)
- [API Reference](https://api.elevenlabs.io/docs)
- [ElevenLabs app](https://elevenlabs.io/)

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
