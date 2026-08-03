import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from elevenlabs import ElevenLabs
from elevenlabs.core.api_error import ApiError

load_dotenv()

DEFAULT_PROMPT = "Cinematic Braam, Horror"
OUTPUT_FILE = "output.mp3"


def main() -> int:
    prompt = " ".join(sys.argv[1:]).strip() or DEFAULT_PROMPT
    output_path = Path.cwd() / OUTPUT_FILE

    try:
        client = ElevenLabs(api_key=os.environ["ELEVENLABS_API_KEY"])
        audio = client.text_to_sound_effects.convert(text=prompt)

        with output_path.open("wb") as output_file:
            output_file.writelines(audio)

        print(f"Wrote generated sound effect to {output_path}")
        return 0
    except KeyError:
        print("Missing ELEVENLABS_API_KEY. Add it to .env before running.", file=sys.stderr)
        return 1
    except (ApiError, OSError) as error:
        print(f"Sound effect generation failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
