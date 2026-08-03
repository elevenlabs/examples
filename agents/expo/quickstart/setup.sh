#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$DIR/../../.." && pwd)"
cd "$DIR"

# Clean example/ but preserve cached installs and Expo state for speed
if [ -d example ]; then
  find example -mindepth 1 -maxdepth 1 ! -name node_modules ! -name .expo -exec rm -rf {} +
fi
mkdir -p example

# Copy shared Expo template structure
rsync -a \
  --exclude node_modules --exclude .expo \
  --exclude pnpm-lock.yaml --exclude package-lock.json \
  --exclude example \
  "$REPO_ROOT/templates/expo/" example/

# Copy project-specific README
cp README.md example/README.md

# Add ElevenLabs dependencies (fetch latest versions at setup time)
cd example
export REACT_VER=$(npm view @elevenlabs/react version)
export ELEVENLABS_VER=$(npm view @elevenlabs/elevenlabs-js version)
node -e "
  const pkg = JSON.parse(require('fs').readFileSync('package.json', 'utf8'));
  const app = JSON.parse(require('fs').readFileSync('app.json', 'utf8'));
  pkg.name = 'realtime-voice-agent-expo';
  pkg.dependencies['@elevenlabs/react'] = '^' + process.env.REACT_VER;
  pkg.dependencies['@elevenlabs/elevenlabs-js'] = '^' + process.env.ELEVENLABS_VER;
  require('fs').writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
  app.expo.name = 'Real-Time Voice Agent';
  app.expo.slug = 'realtime-voice-agent-expo';
  app.expo.scheme = 'realtime-voice-agent-expo';
  require('fs').writeFileSync('app.json', JSON.stringify(app, null, 2) + '\n');
"

# Create API route directory
mkdir -p app/api

# Setup env
if [ -f "$DIR/.env" ]; then
  cp "$DIR/.env" .env
fi

# Install dependencies
pnpm install --config.confirmModulesPurge=false
