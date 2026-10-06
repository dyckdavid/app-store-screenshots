#!/usr/bin/env bash
# Mirror this Origin repo's current HEAD to GitHub main.
# Requires GH_TOKEN or GITHUB_TOKEN with Contents write on dyckdavid/app-store-screenshots.
set -euo pipefail

TOKEN="${GH_TOKEN:-${GITHUB_TOKEN:-}}"
if [[ -z "$TOKEN" ]]; then
  echo "error: set GH_TOKEN (or GITHUB_TOKEN) with repo write access" >&2
  exit 1
fi

REMOTE_URL="https://x-access-token:${TOKEN}@github.com/dyckdavid/app-store-screenshots.git"
BRANCH="${1:-main}"

git remote remove github 2>/dev/null || true
git remote add github "$REMOTE_URL"

# Prefer a clean history push; fall back to force if GitHub only has the empty README.
if ! git push -u github "HEAD:${BRANCH}"; then
  echo "fast-forward failed; force-pushing full history onto ${BRANCH}" >&2
  git push -u github "HEAD:${BRANCH}" --force
fi

SHA="$(git rev-parse HEAD)"
echo "mirrored ${SHA} -> https://github.com/dyckdavid/app-store-screenshots/commit/${SHA}"
