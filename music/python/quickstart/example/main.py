from __future__ import annotations

import argparse
import json
import os
import sys
from typing import Any

from dotenv import load_dotenv
from elevenlabs import ElevenLabs
from elevenlabs.core.api_error import ApiError

DEFAULT_PROMPT = "A chill lo-fi beat with jazzy piano chords"
OUTPUT_FILE = "output.mp3"


def _body_as_dict(error: ApiError) -> dict[str, Any]:
    body = error.body
    if body is None:
        return {}
    if isinstance(body, dict):
        return body
    if hasattr(body, "model_dump"):
        return body.model_dump()
    if isinstance(body, str):
        try:
            parsed = json.loads(body)
            return parsed if isinstance(parsed, dict) else {}
        except json.JSONDecodeError:
            return {}
    return {}


def _find_prompt_suggestion(obj: Any) -> str | None:
    if isinstance(obj, dict):
        suggestion = obj.get("prompt_suggestion")
        if suggestion:
            return str(suggestion)
        for value in obj.values():
            found = _find_prompt_suggestion(value)
            if found is not None:
                return found
    elif isinstance(obj, list):
        for item in obj:
            found = _find_prompt_suggestion(item)
            if found is not None:
                return found
    return None


def _contains_bad_prompt(obj: Any) -> bool:
    if isinstance(obj, dict):
        if obj.get("type") == "bad_prompt":
            return True
        return any(_contains_bad_prompt(v) for v in obj.values())
    if isinstance(obj, list):
        return any(_contains_bad_prompt(item) for item in obj)
    return False


def _format_api_error(error: ApiError) -> str:
    parts = []
    if error.status_code is not None:
        parts.append(f"HTTP {error.status_code}")
    body = _body_as_dict(error)
    if body:
        detail = body.get("detail")
        if isinstance(detail, str):
            parts.append(detail)
        elif isinstance(detail, list) and detail:
            msgs = []
            for item in detail:
                if isinstance(item, dict) and "msg" in item:
                    msgs.append(str(item["msg"]))
            if msgs:
                parts.append("; ".join(msgs))
    if not parts:
        return str(error)
    return ": ".join(parts)


def main() -> None:
    load_dotenv()

    try:
        api_key = os.environ["ELEVENLABS_API_KEY"]
    except KeyError:
        print(
            "Missing ELEVENLABS_API_KEY. Set it in your environment or in a .env file "
            "(see .env.example).",
            file=sys.stderr,
        )
        raise SystemExit(1) from None

    parser = argparse.ArgumentParser(description="Generate music from a text prompt via ElevenLabs.")
    parser.add_argument(
        "prompt_parts",
        nargs="*",
        help="Prompt describing the music (optional; default used if omitted)",
    )
    args = parser.parse_args()
    prompt = " ".join(args.prompt_parts).strip() or DEFAULT_PROMPT

    client = ElevenLabs(api_key=api_key)
    out_path = os.path.abspath(OUTPUT_FILE)

    try:
        audio = client.music.compose(
            prompt=prompt,
            music_length_ms=10000,
            model_id="music_v2",
        )
        with open(out_path, "wb") as f:
            f.writelines(audio)
    except ApiError as e:
        body_dict = _body_as_dict(e)
        suggestion = _find_prompt_suggestion(body_dict)
        if _contains_bad_prompt(body_dict) or suggestion:
            print("The prompt could not be used (content restriction).", file=sys.stderr)
            if suggestion:
                print(f"Suggested replacement prompt: {suggestion}", file=sys.stderr)
        else:
            print(f"Request failed: {_format_api_error(e)}", file=sys.stderr)
        raise SystemExit(1) from None
    except OSError as e:
        print(f"Could not write {out_path}: {e}", file=sys.stderr)
        raise SystemExit(1) from None

    print(f"Saved music to {out_path}")


if __name__ == "__main__":
    main()
