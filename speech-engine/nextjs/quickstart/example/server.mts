import { createRequire } from "node:module";
import { createServer, type IncomingMessage, type Server } from "node:http";
import { resolve as resolvePath } from "node:path";
import type { Duplex } from "node:stream";

import {
  ElevenLabsClient,
  SpeechEngineResource,
  type SpeechEngineCallbacks,
} from "@elevenlabs/elevenlabs-js";
import dotenv from "dotenv";
import OpenAI from "openai";

const require = createRequire(import.meta.url);
const { Server: WebSocketServer } = require("ws") as typeof import("ws");

const envPath = resolvePath(process.cwd(), ".env.local");
const port = 3001;
const wsPath = "/ws";

dotenv.config({ path: envPath });

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing ${name} in ${envPath}.`);
  }

  return value;
}

function isAbortError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "AbortError" || error.message.includes("aborted"))
  );
}

function wireSpeechEngineCallbacks(
  engine: SpeechEngineResource,
  session: ReturnType<SpeechEngineResource["createSession"]>,
  handler: SpeechEngineCallbacks,
) {
  const { onInit, onTranscript, onClose, onDisconnect, onError } = handler;

  if (onInit) {
    session.on("init", (conversationId) => {
      onInit.call(session, conversationId, session);
    });
  }

  if (onTranscript) {
    session.on("user_transcript", (transcript, signal) => {
      Promise.resolve(onTranscript.call(session, transcript, signal, session)).catch(
        (error: unknown) => {
          if (isAbortError(error)) {
            return;
          }

          const nextError =
            error instanceof Error ? error : new Error(String(error));

          if (onError) {
            onError.call(session, nextError, session);
          }
        },
      );
    });
  }

  if (onClose) {
    session.on("close", () => {
      onClose.call(session, session);
    });
  }

  if (onDisconnect) {
    session.on("disconnected", () => {
      onDisconnect.call(session, session);
    });
  }

  if (onError) {
    session.on("error", (error) => {
      onError.call(session, error, session);
    });
  }

  void engine;
}

function attachSpeechEngine(
  engine: SpeechEngineResource,
  httpServer: Server,
  path: string,
  handler: SpeechEngineCallbacks,
  devSkipAuth: boolean,
) {
  const debug = handler.debug ?? false;
  const log = debug
    ? (...args: unknown[]) => console.log("[SpeechEngine]", ...args)
    : () => {};

  const wss = new WebSocketServer({ noServer: true });

  const upgradeListener = async (
    request: IncomingMessage,
    socket: Duplex,
    head: Buffer,
  ) => {
    const url = new URL(request.url ?? "/", `http://${request.headers.host}`);

    log(`upgrade request: ${request.method} ${url.pathname}`);

    if (url.pathname !== path) {
      log(`path mismatch: expected ${path}, got ${url.pathname} — skipping`);
      return;
    }

    const authHeader = request.headers["x-elevenlabs-speech-engine-authorization"];
    console.log("request headers:", request.headers);
    const hasAuth = Boolean(
      Array.isArray(authHeader) ? authHeader[0] : authHeader,
    );

  
      if (!(await engine.verifyRequest(request))) {
        log("rejected connection — invalid X-Elevenlabs-Speech-Engine-Authorization header");
        socket.destroy();
        return;
      }
    

    log("upgrading connection to WebSocket");

    wss.handleUpgrade(request, socket, head, (webSocket) => {
      log("WebSocket connection established");
      wss.emit("connection", webSocket);
    });
  };

  httpServer.on("upgrade", upgradeListener);

  wss.on("connection", (webSocket) => {
    log("creating new session");
    const session = engine.createSession(webSocket, { debug });
    wireSpeechEngineCallbacks(engine, session, handler);
  });

  log(`listening for WebSocket upgrades on ${path}`);
}

const speechEngineId = requireEnv("ELEVENLABS_SPEECH_ENGINE_ID");
const devSkipAuth = process.env.SPEECH_ENGINE_DEV_SKIP_AUTH === "true";
const elevenlabs = new ElevenLabsClient({
  apiKey: requireEnv("ELEVENLABS_API_KEY"),
});
const openai = new OpenAI({
  apiKey: requireEnv("OPENAI_API_KEY"),
});
const model = requireEnv("OPENAI_MODEL");

const httpServer = createServer((request, response) => {
  if (request.url === "/health") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: true, devSkipAuth }));
    return;
  }

  response.writeHead(404, { "content-type": "application/json" });
  response.end(JSON.stringify({ error: "Not found" }));
});

const speechEngineCallbacks: SpeechEngineCallbacks = {
  debug: true,

  onInit(conversationId) {
    console.log("[speech-engine] session started:", conversationId);
  },

  async onTranscript(transcript, signal, session) {
    console.log(
      "[speech-engine] transcript payload:",
      JSON.stringify(transcript),
    );

    const latestMessage = transcript.at(-1)?.content?.trim() ?? "";

    if (transcript.length === 0 || !latestMessage) {
      console.warn("[speech-engine] received empty transcript, sending fallback.");

      if (!signal.aborted) {
        session.sendResponse("I didn't catch that. Could you say that again?");
      }

      return;
    }

    console.log("[speech-engine] transcript:", latestMessage);

    try {
      const response = await openai.responses.create(
        {
          model,
          instructions:
            "You are a helpful voice assistant. Keep responses concise and conversational.",
          input: transcript.map((message) => ({
            role: message.role === "agent" ? "assistant" : "user",
            content: message.content,
          })),
          stream: true,
        },
        { signal },
      );

      session.sendResponse(response);
      console.log("[speech-engine] response streaming for:", latestMessage);
    } catch (error: unknown) {
      if (signal.aborted) {
        console.log("[speech-engine] response aborted for:", latestMessage);
        return;
      }

      const message =
        error instanceof Error ? error.message : "Failed to generate a response.";

      console.error("[speech-engine] onTranscript error:", message);

      try {
        session.sendResponse(
          "Sorry, I ran into an error generating a response. Please try again.",
        );
      } catch (fallbackError: unknown) {
        console.error(
          "[speech-engine] failed to send fallback response:",
          fallbackError instanceof Error ? fallbackError.message : fallbackError,
        );
      }
    }
  },

  onClose(session) {
    console.log("[speech-engine] session ended:", session.conversationId);
  },

  onDisconnect(session) {
    console.log("[speech-engine] session disconnected:", session.conversationId);
  },

  onError(error) {
    console.error("[speech-engine] error:", error);
  },
};

const engine = await elevenlabs.speechEngine.get(speechEngineId);

attachSpeechEngine(engine, httpServer, wsPath, speechEngineCallbacks, devSkipAuth);

httpServer.listen(port, () => {
  console.log(`Speech Engine server listening on http://localhost:${port}`);
  console.log(`WebSocket endpoint: ws://localhost:${port}${wsPath}`);
  console.log(`Health check: http://localhost:${port}/health`);
  console.log(`Speech Engine ID: ${speechEngineId}`);

  if (devSkipAuth) {
    console.warn(
      "SPEECH_ENGINE_DEV_SKIP_AUTH=true — accepting upstream WebSocket connections without JWT.",
    );
  }
});

export {};
