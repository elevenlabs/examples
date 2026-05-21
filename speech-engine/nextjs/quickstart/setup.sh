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

# Copy project-specific README
cp README.md example/README.md

# Add ElevenLabs dependencies (fetch latest versions at setup time)
cd example
export REACT_VER=$(npm view @elevenlabs/react version)
export ELEVENLABS_VER=$(npm view @elevenlabs/elevenlabs-js version)
export OPENAI_VER=$(npm view openai version)
export DOTENV_VER=$(npm view dotenv version)
export TSX_VER=$(npm view tsx version)
node -e "
  const pkg = JSON.parse(require('fs').readFileSync('package.json', 'utf8'));
  pkg.name = 'speech-engine-quickstart';
  pkg.dependencies['@elevenlabs/react'] = '^' + process.env.REACT_VER;
  pkg.dependencies['@elevenlabs/elevenlabs-js'] = '^' + process.env.ELEVENLABS_VER;
  pkg.dependencies.openai = '^' + process.env.OPENAI_VER;
  pkg.dependencies.dotenv = '^' + process.env.DOTENV_VER;
  delete pkg.dependencies['@elevenlabs/client'];
  pkg.devDependencies = pkg.devDependencies || {};
  pkg.devDependencies.tsx = '^' + process.env.TSX_VER;
  pkg.scripts = pkg.scripts || {};
  pkg.scripts['speech-engine:create'] = 'tsx scripts/create-engine.mts';
  pkg.scripts['speech-engine:enable-first-message'] = 'tsx scripts/enable-first-message.mts';
  pkg.scripts['speech-engine:server'] = 'tsx server.mts';
  pkg.pnpm = pkg.pnpm || {};
  pkg.pnpm.overrides = pkg.pnpm.overrides || {};
  pkg.pnpm.overrides['livekit-client'] = '2.16.1';
  require('fs').writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
"

# Create route and script directories
mkdir -p app/api/chat
mkdir -p app/api/token
mkdir -p app/api/voice-history
mkdir -p app/api/voice-history/link
mkdir -p scripts
mkdir -p lib

# Setup env
if [ -f "$DIR/.env" ]; then
  cp "$DIR/.env" .env.local
fi
if [ -f "$DIR/.env.example" ]; then
  cp "$DIR/.env.example" .env.example
fi

# Install dependencies
pnpm install --config.confirmModulesPurge=false
