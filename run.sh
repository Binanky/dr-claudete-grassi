#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/app"
[ -f .env ] || cp ../config/mysql.env.example .env
command -v pnpm >/dev/null 2>&1 || { echo 'Instale Node.js 22 e pnpm antes de continuar.'; exit 1; }
[ -d node_modules ] || pnpm install
pnpm build
exec pnpm start
