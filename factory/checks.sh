#!/usr/bin/env bash
# The repo's checks. Exit 0 only when the branch is fit to review.
#
# The gate runs this script from the main checkout with the job's worktree as
# the working directory. Keep it fast, deterministic and non-interactive: no
# watch modes, no prompts, nothing that rewrites files.
set -euo pipefail

echo "== api: install, typecheck, build, test" >&2
(
  cd apps/api
  npm ci --prefer-offline --no-audit --no-fund
  npx tsc --noEmit
  npm run build
  npm test
)

echo "== web: install, lint, build, test" >&2
(
  cd apps/web
  npm ci --prefer-offline --no-audit --no-fund
  npx oxlint
  npm run build
  npm test
)
