import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { createReadStream } from "fs";
import { config } from "dotenv";

config();

const audioPath = process.argv[2] || "./audio.mp3";

try {
  const client = new ElevenLabsClient();
  const result = await client.speechToText.convert({
    file: createReadStream(audioPath),
    modelId: "scribe_v2",
  });

  if (!("text" in result)) {
    throw new Error("Unexpected response: no transcript text returned.");
  }

  console.log(result.text);
} catch (error) {
  console.error(
    `Transcription failed: ${error instanceof Error ? error.message : String(error)}`
  );
  process.exit(1);
}
