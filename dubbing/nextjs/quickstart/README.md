# Dubbing Recorder (Next.js)

Record your voice in the browser, dub it into another language with the ElevenLabs Dubbing API (v2, Dubbing Projects), and play or download the result.

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

## Run

```bash
pnpm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

- Click **Record** and allow microphone access when prompted.
- Speak into your microphone — a timer and pulsing indicator show the recording is active.
- Click **Stop** to end the recording and preview the original audio.
- Choose the source language or leave it on auto-detect, then choose a target language.
- Click **Dub Recording** and wait while the app polls for the dubbed result.
- Play the dubbed audio in the browser or download it.
- Click **Record Again** to start over.
