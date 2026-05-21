import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

export async function enableFirstMessageOverride(
  client: ElevenLabsClient,
  speechEngineId: string
) {
  await client.speechEngine.update(speechEngineId, {
    overrides: {
      firstMessage: true,
    },
  });
}
