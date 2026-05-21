import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import "dotenv/config";

import { enableFirstMessageOverride } from "../lib/speech-engine-overrides";

const API_KEY = process.env.ELEVENLABS_API_KEY?.trim();
const PUBLIC_WS_URL = process.env.PUBLIC_WS_URL?.trim();

if (!API_KEY) {
  throw new Error(
    "Set ELEVENLABS_API_KEY in .env before creating a Speech Engine."
  );
}

if (!PUBLIC_WS_URL) {
  throw new Error("Set PUBLIC_WS_URL in .env before creating a Speech Engine.");
}

const elevenlabs = new ElevenLabsClient({
  apiKey: API_KEY,
});

const engine = await elevenlabs.speechEngine.create({
  name: "Speech Engine Quickstart",
  speechEngine: {
    wsUrl: PUBLIC_WS_URL,
  },
});

await enableFirstMessageOverride(elevenlabs, engine.engineId);

console.log(`Speech Engine ID: ${engine.engineId}`);
console.log("First-message override enabled for this Speech Engine.");
console.log("Next steps:");
console.log(`1. Add ELEVENLABS_SPEECH_ENGINE_ID=${engine.engineId} to .env`);
console.log("2. Run `pnpm run speech-engine:server`");
console.log("3. Run `pnpm run dev`");
