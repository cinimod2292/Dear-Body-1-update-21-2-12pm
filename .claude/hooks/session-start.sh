#!/bin/bash
set -euo pipefail

# Only run in Claude Code remote (web) environments.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

echo "==> Installing backend dependencies..."
cd "$CLAUDE_PROJECT_DIR/backend"
npm install

echo "==> Generating Prisma client..."
npx prisma generate

echo "==> Installing frontend dependencies..."
cd "$CLAUDE_PROJECT_DIR/frontend"
npm install

echo "==> Session start complete."
