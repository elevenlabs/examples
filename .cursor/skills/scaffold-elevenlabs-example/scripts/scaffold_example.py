#!/usr/bin/env python3
"""Scaffold a new example directory by copying files from the closest existing example."""
from __future__ import annotations

import argparse
import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[4]
SCAFFOLD_FILES = ("PROMPT.md", "README.md", "setup.sh")
IGNORED_DIRS = {"examples", "node_modules", ".venv", ".next", "example", "templates"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Scaffold a new example by copying from the closest existing one."
    )
    parser.add_argument(
        "--path",
        required=True,
        help="Relative path like product/runtime/my-example "
        "(for example, text-to-speech/expo/my-example).",
    )
    parser.add_argument(
        "--reference",
        help="Explicit reference example path (e.g. speech-to-text/nextjs/realtime). "
        "Auto-detected from the repo when omitted.",
    )
    parser.add_argument(
        "--with-assets",
        action="store_true",
        help="Create an assets/ directory in the new example.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Overwrite scaffold files in an existing directory.",
    )
    return parser.parse_args()


def parse_example_path(path_text: str) -> tuple[str, str, str]:
    clean_path = path_text.strip().strip("/")
    parts = [part for part in clean_path.split("/") if part]
    if len(parts) != 3:
        raise SystemExit(
            "Example paths must look like <product>/<runtime>/<slug>, for example "
            "text-to-speech/expo/my-example."
        )

    product, runtime, slug = parts
    if any(part in {".", ".."} for part in parts):
        raise SystemExit("Path segments cannot contain '.' or '..'.")

    if not re.fullmatch(r"[a-z0-9][a-z0-9-]*", slug):
        raise SystemExit("Slug must use lowercase letters, numbers, and hyphens only.")

    return product, runtime, slug


def find_existing_examples() -> list[tuple[str, str, str, Path]]:
    """Scan repo for directories containing PROMPT.md and return (product, runtime, slug, dir)."""
    results: list[tuple[str, str, str, Path]] = []
    for prompt_file in REPO_ROOT.rglob("PROMPT.md"):
        rel = prompt_file.parent.relative_to(REPO_ROOT)
        if any(part in IGNORED_DIRS for part in rel.parts):
            continue
        parts = rel.parts
        if len(parts) == 3:
            results.append((parts[0], parts[1], parts[2], prompt_file.parent))
    return results


def pick_reference(paths: list[Path]) -> Path | None:
    if not paths:
        return None

    return min(paths, key=lambda path: (path.name != "quickstart", str(path)))


def find_reference(
    product: str, runtime: str, examples: list[tuple[str, str, str, Path]]
) -> Path | None:
    """Pick the best existing example to copy from.

    Priority: same product+runtime > same runtime > same product+nextjs for
    Expo > any nextjs for Expo > first available.
    """
    same_product_runtime = [d for p, r, _, d in examples if p == product and r == runtime]
    match = pick_reference(same_product_runtime)
    if match:
        return match

    same_runtime = [d for _, r, _, d in examples if r == runtime]
    match = pick_reference(same_runtime)
    if match:
        return match

    if runtime == "expo":
        same_product_nextjs = [d for p, r, _, d in examples if p == product and r == "nextjs"]
        match = pick_reference(same_product_nextjs)
        if match:
            return match

        nextjs_examples = [d for _, r, _, d in examples if r == "nextjs"]
        match = pick_reference(nextjs_examples)
        if match:
            return match

    if examples:
        return pick_reference([example_dir for _, _, _, example_dir in examples])

    return None


def write_file(path: Path, content: str) -> None:
    path.write_text(content.rstrip() + "\n", encoding="utf-8")


def main() -> None:
    args = parse_args()
    product, runtime, _slug = parse_example_path(args.path)

    target_dir = (REPO_ROOT / args.path.strip().strip("/")).resolve()
    if REPO_ROOT not in target_dir.parents:
        raise SystemExit("Target path must stay inside the repository root.")

    if target_dir.exists() and any(target_dir.iterdir()) and not args.force:
        raise SystemExit(
            f"Target directory '{args.path}' already exists and is not empty. "
            "Use --force to overwrite scaffold files."
        )

    if args.reference:
        ref_dir = REPO_ROOT / args.reference.strip().strip("/")
        if not ref_dir.is_dir():
            raise SystemExit(f"Reference directory '{args.reference}' does not exist.")
    else:
        examples = find_existing_examples()
        ref_dir = find_reference(product, runtime, examples)

    target_dir.mkdir(parents=True, exist_ok=True)
    if args.with_assets:
        (target_dir / "assets").mkdir(exist_ok=True)

    copied = []
    if ref_dir:
        for filename in SCAFFOLD_FILES:
            source = ref_dir / filename
            if source.exists():
                content = source.read_text(encoding="utf-8")
                write_file(target_dir / filename, content)
                copied.append(filename)

        setup_path = target_dir / "setup.sh"
        if setup_path.exists():
            setup_path.chmod(0o755)

    print(f"Scaffolded {args.path.strip().strip('/')}")
    if ref_dir:
        print(f"Copied {', '.join(copied)} from {ref_dir.relative_to(REPO_ROOT)}")
    else:
        print("No existing example found to copy from — created empty directory.")
    print("Next: edit PROMPT.md, README.md, and setup.sh for the new example.")


if __name__ == "__main__":
    main()
