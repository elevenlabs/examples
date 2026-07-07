import "dotenv/config";
import { writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_PROMPT = "A chill lo-fi beat with jazzy piano chords";
const MUSIC_API_URL = "https://api.elevenlabs.io/v1/music";
const OUTPUT_FILE = "output.mp3";

const apiKey = process.env.ELEVENLABS_API_KEY;
if (!apiKey) {
  throw new Error("Missing ELEVENLABS_API_KEY. Add it to .env before running.");
}

const prompt = process.argv.slice(2).join(" ").trim() || DEFAULT_PROMPT;

const requestBody = {
  prompt,
  music_length_ms: 10_000,
  model_id: "music_v2",
};

const response = await fetch(MUSIC_API_URL, {
  method: "POST",
  headers: {
    "xi-api-key": apiKey,
    "Content-Type": "application/json",
    Accept: "audio/mpeg",
  },
  body: JSON.stringify(requestBody),
});

if (!response.ok) {
  throw new Error(
    `Music generation failed: ${response.status} ${await response.text()}`
  );
}

const outputPath = path.resolve(process.cwd(), OUTPUT_FILE);
const audio = Buffer.from(await response.arrayBuffer());
await writeFile(outputPath, audio);

console.log(`Wrote generated music to ${outputPath}`);
