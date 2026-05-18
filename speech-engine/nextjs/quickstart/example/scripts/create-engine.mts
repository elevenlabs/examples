import { resolve as resolvePath } from "node:path";

import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import dotenv from "dotenv";

const envPath = resolvePath(process.cwd(), ".env.local");

dotenv.config({ path: envPath });

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing ${name} in ${envPath}.`);
  }

  return value;
}

function normalizeWebSocketUrl(url: string): string {
  const trimmed = url.trim();

  if (trimmed.startsWith("wss://")) {
    return trimmed;
  }

  if (trimmed.startsWith("https://")) {
    return `wss://${trimmed.slice("https://".length)}`;
  }

  if (trimmed.startsWith("http://")) {
    return `ws://${trimmed.slice("http://".length)}`;
  }

  throw new Error(
    "PUBLIC_WS_URL must start with wss://, https://, ws://, or http://.",
  );
}

function readSpeechEngineId(engine: unknown): string {
  if (!engine || typeof engine !== "object") {
    throw new Error("Speech Engine create response did not include an id.");
  }

  const record = engine as Record<string, unknown>;
  const id = record.engineId ?? record.speechEngineId ?? record.speech_engine_id;

  if (typeof id !== "string" || id.length === 0) {
    throw new Error("Speech Engine create response did not include an id.");
  }

  return id;
}

async function main() {
  const apiKey = requireEnv("ELEVENLABS_API_KEY");
  const wsUrl = normalizeWebSocketUrl(requireEnv("PUBLIC_WS_URL"));
  const client = new ElevenLabsClient({ apiKey });

  console.log(`Creating Speech Engine with WebSocket URL: ${wsUrl}`);

  const engine = await client.speechEngine.create({
    name: "Speech Engine Quickstart",
    speechEngine: {
      wsUrl,
    },
  });
  const speechEngineId = readSpeechEngineId(engine);

  const engines = await client.speechEngine.list();
  const duplicates = engines.speechEngines.filter(
    (entry) => entry.speechEngineId !== speechEngineId,
  );

  console.log("Speech Engine created successfully.");
  console.log(`Speech Engine ID: ${speechEngineId}`);
  console.log("");
  console.log(`Copy this into .env.local:`);
  console.log(`ELEVENLABS_SPEECH_ENGINE_ID=${speechEngineId}`);

  if (duplicates.length > 0) {
    console.log("");
    console.warn(
      `Warning: ${duplicates.length} other Speech Engine resource(s) still exist.`,
    );
    console.warn(
      "Delete unused engines in the ElevenLabs dashboard or via the API.",
    );
    console.warn(
      "Multiple engines pointing at the same ws_url can cause upstream connection failures.",
    );
  }
}

main().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : "Failed to create Speech Engine.";

  console.error(message);
  process.exitCode = 1;
});

export {};
