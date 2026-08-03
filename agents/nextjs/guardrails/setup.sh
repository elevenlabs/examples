#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$DIR/../../.." && pwd)"
cd "$DIR"

# Clean example/ but preserve node_modules for speed
if [ -d example ]; then
  find example -mindepth 1 -maxdepth 1 ! -name node_modules ! -name .next -exec rm -rf {} +
fi
mkdir -p example

# Copy shared template structure (skip node_modules, .next, lock files, empty example/ dir)
rsync -a \
  --exclude node_modules --exclude .next \
  --exclude pnpm-lock.yaml --exclude package-lock.json \
  --exclude example \
  "$REPO_ROOT/templates/nextjs/" example/

# Copy project-specific README when present
if [ -f README.md ]; then
  cp README.md example/README.md
fi

# Add ElevenLabs dependencies (fetch latest versions at setup time)
cd example
export REACT_VER=$(npm view @elevenlabs/react version)
export ELEVENLABS_VER=$(npm view @elevenlabs/elevenlabs-js version)
node -e "
  const pkg = JSON.parse(require('fs').readFileSync('package.json', 'utf8'));
  pkg.name = 'agents-guardrails-demo';
  pkg.dependencies['@elevenlabs/react'] = '^' + process.env.REACT_VER;
  pkg.dependencies['@elevenlabs/elevenlabs-js'] = '^' + process.env.ELEVENLABS_VER;
  delete pkg.dependencies['@elevenlabs/client'];
  require('fs').writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
"

# Create API route directories
mkdir -p app/api/agent
mkdir -p app/api/conversation-token

# Setup env
if [ -f "$DIR/.env" ]; then
  cp "$DIR/.env" .env.local
fi

# Install dependencies
pnpm install --config.confirmModulesPurge=false
