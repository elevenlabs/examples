# Example Generator Reference

## Generator behavior

- `pnpm run generate` runs `scripts/generate-examples.sh`.
- The script finds every `PROMPT.md` outside ignored folders.
- If a target folder has `setup.sh` and no `example/`, it runs `setup.sh` first.
- The generator prepends repo context before sending the prompt:
  - check existing `example/` first
  - `setup.sh` already ran
  - implement in `example/` only
  - read root `DESIGN.md` for UI work
- The generator auto-loads repo SDK skills from `.agents/skills` when the prompt contains backticked skill names such as `/text-to-speech`. Keep the backticks and leading slash.

## Available repo skills

Inspect `.agents/skills/*/SKILL.md` before finalizing the first line of `PROMPT.md`.

Current repo skills:

- `/agents`
- `/music`
- `/setup-api-key`
- `/sound-effects`
- `/speech-engine`
- `/speech-to-text`
- `/text-to-speech`

## Directory shape

```text
<product>/<runtime>/<slug>/
|-- README.md
|-- PROMPT.md
|-- setup.sh
|-- assets/          # optional
|-- .env             # optional, local only
`-- example/         # generated output
```

Ignore the deprecated root `examples/` folder for new work.

## Current example matrix

| Path                                   | Shared template        | Prompt sections                                                                                         | Setup extras                                                                                                        |
| -------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `text-to-speech/typescript/quickstart` | `templates/typescript` | `index.ts`                                                                                              | Copies `.env`, preserves `node_modules`, installs with `pnpm`                                                       |
| `text-to-speech/python/quickstart`     | `templates/python`     | `main.py`                                                                                               | Copies `.env`, preserves `.venv`, installs with `pip`                                                               |
| `speech-to-text/typescript/quickstart` | `templates/typescript` | `index.ts`                                                                                              | Optional `assets/`, copies `.env`, preserves `node_modules`                                                         |
| `speech-to-text/python/quickstart`     | `templates/python`     | `main.py`                                                                                               | Optional `assets/`, copies `.env`, preserves `.venv`                                                                |
| `music/typescript/quickstart`          | `templates/typescript` | `index.ts`                                                                                              | Copies `.env`, preserves `node_modules`, installs with `pnpm`                                                       |
| `music/nextjs/quickstart`              | `templates/nextjs`     | `app/api/generate-music/route.ts`, `app/page.tsx`                                                       | Adds `@elevenlabs/elevenlabs-js`, copies `.env.local`, preserves `node_modules` and `.next`                         |
| `speech-to-text/nextjs/realtime`       | `templates/nextjs`     | `app/api/scribe-token/route.ts`, `app/page.tsx`                                                         | Adds `@elevenlabs/react` and `@elevenlabs/elevenlabs-js`, copies `.env.local`, preserves `node_modules` and `.next` |
| `agents/nextjs/quickstart`             | `templates/nextjs`     | `app/api/agent/route.ts`, `app/api/conversation-token/route.ts`, `app/page.tsx`                         | Same Next.js setup pattern, removes `@elevenlabs/client` if present                                                 |
| `agents/nextjs/guardrails`             | `templates/nextjs`     | `app/api/agent/route.ts`, `app/api/conversation-token/route.ts`, `app/page.tsx`                         | Same as quickstart, but prompt targets guardrails and `onGuardrailTriggered`                                        |
| `speech-engine/nextjs/quickstart`      | `templates/nextjs`     | `server.mts`, `scripts/create-engine.mts`, `app/api/token/route.ts`, `app/page.tsx`, `lib/assistant.ts` | Adds `openai`, `dotenv`, `tsx`; Speech Engine scripts; `livekit-client` override; copies `.env.example`             |

## Runtime setup rules

| Runtime      | Seed template           | Preserve on clean       | Env copied into `example/` | Install step                                                                 |
| ------------ | ----------------------- | ----------------------- | -------------------------- | ---------------------------------------------------------------------------- |
| `typescript` | `templates/typescript/` | `node_modules`          | `.env`                     | `pnpm install --config.confirmModulesPurge=false`                            |
| `python`     | `templates/python/`     | `.venv`                 | `.env`                     | create `.venv`, upgrade `pip`, `pip install -r requirements.txt`             |
| `nextjs`     | `templates/nextjs/`     | `node_modules`, `.next` | `.env.local`               | patch `package.json`, then `pnpm install --config.confirmModulesPurge=false` |
| `expo`       | `templates/expo/`       | `node_modules`, `.expo` | `.env`                     | `pnpm install --config.confirmModulesPurge=false`                            |

## Expo runtime notes

- `templates/expo/` should provide the generic Expo Router app shell, `web.output: "server"` config, a baseline `/api/health` route, and reusable verification scripts such as `typecheck` and `export:web`.
- Keep Expo `PROMPT.md` files focused on ElevenLabs-specific UI, SDK usage, token exchange, `+api.ts` routes, and error handling instead of generic app bootstrapping.
- Until the repo has dedicated Expo examples, use the closest same-product `nextjs` example as the authoring reference for Expo scaffolds.

## Prompt rules

- Start with `Before writing any code, invoke the \`/skill-name\` skill...`.
- Choose that skill by checking `.agents/skills/` first; do not assume only `/text-to-speech`, `/speech-to-text`, and `/agents` exist.
- Use `## \`path/to/file\``headings only for files inside`example/`.
- Keep prompts short and implementation-focused. Current prompts are direct checklists, not essays.
- Mention the concrete SDK client, env loading, output format, model ids, voice ids, API route security, and UI behavior when those details are known.
- Do not repeat repo-wide context that the generator already injects.
- For `expo`, assume the shared template already includes the app shell and baseline checks; only prompt for ElevenLabs-specific changes.

## README rules

- Always include a title, one-sentence summary, `## Setup`, and `## Run`.
- Add `## Usage` for interactive or multi-step examples such as Next.js, Expo, and agents demos.
- Keep commands valid from inside `example/`.
- Use the closest current example as the formatting reference.

## Best reference by request

- Simple CLI text-to-speech script: start from `text-to-speech/typescript/quickstart` or `text-to-speech/python/quickstart`.
- Simple CLI music script: start from `music/typescript/quickstart`.
- Simple Next.js music prompt form: start from `sound-effects/nextjs/quickstart`.
- CLI transcription or file-based Scribe example: start from the speech-to-text quickstarts.
- Realtime microphone UI: start from `speech-to-text/nextjs/realtime`.
- Voice agent creation and conversation UI: start from `agents/nextjs/quickstart`.
- Speech Engine WebSocket server plus Next.js WebRTC client: start from `speech-engine/nextjs/quickstart`.
- First Expo full-stack example for a product: start from the closest same-product `nextjs` example until a dedicated Expo reference exists.
- For specialized agent behavior, start from `agents/nextjs/quickstart` and consult `agents/nextjs/guardrails` only as an existing reference, not as a scaffold mode.

## Scaffold helper

The helper script creates a new example directory by copying `PROMPT.md`, `README.md`, and `setup.sh` from the closest existing example. It auto-detects the best reference by scanning the repo, or accepts an explicit `--reference`.

```bash
python3 .cursor/skills/scaffold-elevenlabs-example/scripts/scaffold_example.py \
  --path agents/expo/my-agent-demo
```

Useful flags:

- `--reference sound-effects/nextjs/quickstart` to copy from a specific example
- `--with-assets` to create an `assets/` directory
- `--force` to overwrite scaffold files in an existing directory

The helper copies files verbatim from the reference. Edit `PROMPT.md`, `README.md`, and `setup.sh` after scaffolding to match the new example.
