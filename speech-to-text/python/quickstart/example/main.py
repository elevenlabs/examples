import os
import sys

from dotenv import load_dotenv
from elevenlabs import ElevenLabs
from elevenlabs.core.api_error import ApiError

load_dotenv()

def main():
    audio_path = sys.argv[1] if len(sys.argv) > 1 else "./audio.mp3"

    try:
        client = ElevenLabs(api_key=os.environ["ELEVENLABS_API_KEY"])

        # Transcribe audio file
        with open(audio_path, "rb") as audio_file:
            result = client.speech_to_text.convert(
                file=audio_file,
                model_id="scribe_v2"
            )

        # Print transcript to stdout
        print(result.text)

    except FileNotFoundError:
        print(f"Error: Audio file not found: {audio_path}", file=sys.stderr)
        sys.exit(1)
    except KeyError:
        print("Error: Missing ELEVENLABS_API_KEY", file=sys.stderr)
        sys.exit(1)
    except ApiError as e:
        print(f"Error: Transcription failed: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
