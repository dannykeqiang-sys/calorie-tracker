#!/usr/bin/env bash
# Render build script
set -o errexit

echo "=== Installing build dependencies ==="
apt-get update -qq && apt-get install -y -qq python3 make g++ 2>/dev/null || true

echo "=== Installing npm dependencies ==="
npm install

echo "=== Building TypeScript ==="
npm run build

echo "=== Build complete ==="
ls -la dist/
