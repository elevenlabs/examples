# STT realtime UI before vs after

Rendered from `speech-to-text/nextjs/realtime` using the page markup on `main` (before) and this PR (after). History, error, and listening states use the same sample data.

Review-only. Drop this folder before merge if you do not want screenshots in the repo.

## Idle

**Before** — status is right-aligned; hint is centered.

![Before idle](stt_realtime_before_idle.png)

**After** — status sits next to Start; hint is left-aligned and tighter.

![After idle](stt_realtime_after_idle.png)

## History

**Before** — Clear History button, uppercase HISTORY label, each line in a bordered card.

![Before history](stt_realtime_before_history.png)

**After** — no Clear History; history is plain text.

![After history](stt_realtime_after_history.png)

## Error

**Before** — generic permission message in a red box.

![Before error](stt_realtime_before_error.png)

**After** — status can read Error; API error text is shown inline.

![After error](stt_realtime_after_error.png)

## Listening

**Before** — red Stop button, green status dot, boxed live transcript.

![Before listening](stt_realtime_before_listening.png)

**After** — same black button for Start/Stop; live transcript is italic, no box.

![After listening](stt_realtime_after_listening.png)
