import crypto from "node:crypto";
import { createRequire } from "node:module";
import { resolve } from "node:path";

import dotenv from "dotenv";

const require = createRequire(import.meta.url);
const WebSocket = require("ws") as typeof import("ws");

const envPath = resolve(process.cwd(), ".env.local");

dotenv.config({ path: envPath, quiet: true });

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing ${name} in ${envPath}.`);
  }

  return value;
}

function base64Url(value: string): string {
  return Buffer.from(value).toString("base64url");
}

function signJwt(apiKey: string, agentId: string, conversationId: string): string {
  const secret = crypto.createHash("sha256").update(apiKey.trim()).digest();
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64Url(
    JSON.stringify({
      iss: "https://api.elevenlabs.io/convai/speech-engine",
      sub: "convai_speech_engine_upstream",
      agent_id: agentId,
      conversation_id: conversationId,
      iat: now,
      exp: now + 600,
    }),
  );
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${header}.${payload}`)
    .digest("base64url");

  return `${header}.${payload}.${signature}`;
}

async function main() {
  const apiKey = requireEnv("ELEVENLABS_API_KEY");
  const engineId = requireEnv("ELEVENLABS_SPEECH_ENGINE_ID");
  const agentId = engineId.replace(/^seng_/, "agent_");
  const conversationId = "conv_test_local";
  const token = signJwt(apiKey, agentId, conversationId);

  await new Promise<void>((resolvePromise, reject) => {
    const ws = new WebSocket("ws://localhost:3001/ws", {
      headers: {
        "X-Elevenlabs-Speech-Engine-Authorization": `Bearer ${token}`,
      },
    });

    let sawFinalResponse = false;

    ws.on("open", () => {
      console.log("WebSocket connected with auth.");

      ws.send(JSON.stringify({ type: "init", conversation_id: conversationId }));
      ws.send(
        JSON.stringify({
          type: "user_transcript",
          event_id: 1,
          user_transcript: [{ role: "user", content: "What is 2 plus 2?" }],
        }),
      );
    });

    ws.on("message", (data) => {
      const message = JSON.parse(data.toString()) as {
        type?: string;
        text?: string;
        is_final?: boolean;
      };

      console.log("Received:", JSON.stringify(message).slice(0, 240));

      if (message.type === "agent_response" && message.is_final) {
        sawFinalResponse = true;
        ws.close();
        resolvePromise();
      }
    });

    ws.on("error", reject);

    setTimeout(() => {
      if (!sawFinalResponse) {
        reject(new Error("Timed out waiting for a final agent response."));
      }
    }, 20_000);
  });

  console.log("Speech Engine server responded successfully.");
}

main().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : "Speech Engine WS test failed.";

  console.error(message);
  process.exitCode = 1;
});

export {};
