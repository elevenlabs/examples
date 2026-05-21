import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import "dotenv/config";

import { enableFirstMessageOverride } from "../lib/speech-engine-overrides";

const API_KEY = process.env.ELEVENLABS_API_KEY?.trim();
const SPEECH_ENGINE_ID = process.env.ELEVENLABS_SPEECH_ENGINE_ID?.trim();

if (!API_KEY || !SPEECH_ENGINE_ID) {
  throw new Error(
    "Set ELEVENLABS_API_KEY and ELEVENLABS_SPEECH_ENGINE_ID in .env before enabling first-message overrides."
  );
}

const elevenlabs = new ElevenLabsClient({
  apiKey: API_KEY,
});

await enableFirstMessageOverride(elevenlabs, SPEECH_ENGINE_ID);

console.log(`First-message override enabled for ${SPEECH_ENGINE_ID}.`);
