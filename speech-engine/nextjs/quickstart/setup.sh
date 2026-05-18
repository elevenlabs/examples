#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$DIR/../../.." && pwd)"
cd "$DIR"

# Clean example/ but preserve cache directories for speed.
if [ -d example ]; then
  find example -mindepth 1 -maxdepth 1 ! -name node_modules ! -name .next -exec rm -rf {} +
fi
mkdir -p example

# Copy shared template structure.
rsync -a \
  --exclude node_modules --exclude .next \
  --exclude pnpm-lock.yaml --exclude package-lock.json \
  --exclude example \
  "$REPO_ROOT/templates/nextjs/" example/

# Copy project-specific README.
cp README.md example/README.md

# Add ElevenLabs dependencies, fetching latest versions at setup time.
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
  pkg.devDependencies.tsx = '^' + process.env.TSX_VER;
  delete pkg.dependencies['@elevenlabs/client'];
  pkg.pnpm = pkg.pnpm || {};
  pkg.pnpm.overrides = pkg.pnpm.overrides || {};
  pkg.pnpm.overrides['livekit-client'] = '2.16.1';
  pkg.scripts['speech-engine:create'] = 'tsx scripts/create-engine.mts';
  pkg.scripts['speech-engine:server'] = 'tsx server.mts';
  require('fs').writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
"

mkdir -p app/api/token
mkdir -p scripts

cat > .env.example <<'EOF'
ELEVENLABS_API_KEY=
ELEVENLABS_SPEECH_ENGINE_ID=
PUBLIC_WS_URL=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o
EOF

if [ -f "$DIR/.env" ]; then
  cp "$DIR/.env" .env.local
fi

pnpm install --config.confirmModulesPurge=false
