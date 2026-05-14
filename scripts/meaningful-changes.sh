#!/usr/bin/env bash

set -euo pipefail

BASE_REF="${1:-origin/main}"

if ! git rev-parse --verify "${BASE_REF}" >/dev/null 2>&1; then
  echo "Base ref not found: ${BASE_REF}" >&2
  exit 2
fi

meaningful_paths=()
ignored_paths=()

while IFS= read -r path; do
  [[ -n "${path}" ]] || continue

  case "${path}" in
    */output.mp3|*/output.wav|*/output.m4a|*/output.ogg|*/output.webm)
      ignored_paths+=("${path}")
      ;;
    */.next/*|*/dist/*|*/build/*|*/coverage/*|*.tsbuildinfo)
      ignored_paths+=("${path}")
      ;;
    *)
      meaningful_paths+=("${path}")
      ;;
  esac
done < <(git diff --name-only "${BASE_REF}...HEAD")

if (( ${#meaningful_paths[@]} == 0 )); then
  echo "No meaningful changes detected."
  if (( ${#ignored_paths[@]} > 0 )); then
    echo
    echo "Ignored generated/runtime artifacts:"
    printf "  %s\n" "${ignored_paths[@]}"
  fi
  exit 1
fi

echo "Meaningful changes detected:"
printf "  %s\n" "${meaningful_paths[@]}"

if (( ${#ignored_paths[@]} > 0 )); then
  echo
  echo "Ignored generated/runtime artifacts:"
  printf "  %s\n" "${ignored_paths[@]}"
fi
