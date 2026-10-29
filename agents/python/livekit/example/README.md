# LiveKit Agents with Eleven Realtime (Python)

Talk to a [LiveKit Agents](https://docs.livekit.io/agents/) voice agent powered by ElevenLabs Realtime, with a function tool, from your terminal.

> This example depends on the unreleased `elevenlabs.realtime` module from [livekit/agents#8075](https://github.com/livekit/agents/pull/8075), so `requirements.txt` installs `livekit-plugins-elevenlabs` from that pull request's branch.

## Setup

1. Copy the environment file and add your API key:

   ```bash
   cp .env.example .env
   ```

   Then edit `.env` and set `ELEVEN_API_KEY` to your [ElevenLabs API key](https://elevenlabs.io/app/settings/api-keys).

2. Create a virtual environment and install dependencies:

   ```bash
   python3 -m venv .venv
   .venv/bin/pip install -r requirements.txt
   ```

## Run

```bash
.venv/bin/python main.py console
```

Console mode uses your local microphone and speakers, so no LiveKit server is needed.

## Usage

- The agent greets you when the session starts.
- Talk; the agent replies by voice.
- Ask about the weather somewhere to have the agent call the `lookup_weather` tool.
- Press `Ctrl+C` to end the session.

## How it works

- `elevenlabs.realtime.RealtimeModel` from `livekit-plugins-elevenlabs` is the session's `llm`, handling speech in and speech out with `eleven_realtime_v1_mini` and the `brian` voice.
- `lookup_weather` is a `@function_tool`; its docstring becomes the tool description the model sees.
