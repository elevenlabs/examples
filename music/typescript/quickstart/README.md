# ElevenLabs Music — Quickstart Example

Generate an MP3 track from a text prompt using the Eleven Music REST API.

This example calls the REST API directly with `model_id: "music_v2"` while SDK support for the v2 model catches up.

## Setup

1. Copy the environment file and add your API key:

   ```bash
   cp .env.example .env
   ```

   Then edit `.env` and paste your [ElevenLabs API key](https://elevenlabs.io/app/settings/api-keys).

2. Install dependencies:

   ```bash
   pnpm install
   ```

The Eleven Music API is available to paid ElevenLabs users.

## Run

```bash
pnpm run start "A chill lo-fi beat with jazzy piano chords"
```

The generated track is saved to `output.mp3`.
