import os
import sys

from dotenv import load_dotenv
from elevenlabs import ElevenLabs
from elevenlabs.core.api_error import ApiError

load_dotenv()

def main():
    if len(sys.argv) > 1:
        text = " ".join(sys.argv[1:])
    else:
        text = "Hello, welcome to ElevenLabs!"

    try:
        client = ElevenLabs(api_key=os.environ["ELEVENLABS_API_KEY"])

        audio = client.text_to_speech.convert(
            text=text,
            voice_id="JBFqnCBsd6RMkjVDRZzb",
            model_id="eleven_multilingual_v2"
        )

        with open("output.mp3", "wb") as f:
            f.writelines(audio)

        print("Success! Audio saved to output.mp3")

    except KeyError:
        print("Error: Missing ELEVENLABS_API_KEY")
        sys.exit(1)
    except (ApiError, OSError) as e:
        print(f"Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
