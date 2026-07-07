Before writing any code, invoke the `/music` skill to learn the correct ElevenLabs SDK patterns.

## `index.ts`

Create a tutorial-friendly script that generates music from a text prompt using the live Eleven Music REST API. Do not use the ElevenLabs JS SDK for music v2 yet.

- Load env vars from `.env`.
- Read the music prompt from CLI args; fall back to `A chill lo-fi beat with jazzy piano chords`.
- Build a request body with `prompt`, `music_length_ms: 10_000`, and `model_id: "music_v2"`.
- Use `fetch` to POST the JSON body to `https://api.elevenlabs.io/v1/music`.
- Save the returned MP3 response body to `output.mp3`.
- Print a success message with the output path.
- Keep the code on the happy path; a simple `response.ok` check is enough.
