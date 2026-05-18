import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import "dotenv/config";

const elevenlabs = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY,
});

const engine = await elevenlabs.speechEngine.create({
  name: "My Speech Engine",
  speechEngine: {
    wsUrl: "wss://shaun-unfished-marget.ngrok-free.dev/ws",
  },
});

console.log("Speech Engine ID:", engine.engineId);
