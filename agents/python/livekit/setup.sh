#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$DIR/../../.." && pwd)"
cd "$DIR"

if [ -d example ]; then
  find example -mindepth 1 -maxdepth 1 ! -name .venv -exec rm -rf {} +
fi
mkdir -p example

rsync -a \
  --exclude .venv \
  --exclude example \
  "$REPO_ROOT/templates/python/" example/

cp README.md example/README.md

# TODO: pin a released livekit-plugins-elevenlabs once livekit/agents#8075 ships
cat > example/requirements.txt <<'EOF'
livekit-agents>=1.8.10
livekit-plugins-elevenlabs @ git+https://github.com/kraenhansen/livekit-agents@kraen/elevenlabs-realtime#subdirectory=livekit-plugins/livekit-plugins-elevenlabs
python-dotenv>=1.2.1
EOF
echo "ELEVEN_API_KEY=" > example/.env.example

if [ -f "$DIR/.env" ]; then
  cp "$DIR/.env" example/.env
fi

cd example
python3 -m venv .venv
.venv/bin/pip install --upgrade pip
.venv/bin/pip install -r requirements.txt
