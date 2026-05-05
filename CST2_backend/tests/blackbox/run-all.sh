#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

mkdir -p tests/blackbox/reports

echo "SolarTrust Black Box Test Runner"
echo "Backend under test: ${BLACKBOX_BASE_URL:-http://127.0.0.1:3000}"
if [[ -n "${BLACKBOX_LIVE_BASE_URL:-${RENDER_BACKEND_URL:-}}" ]]; then
  echo "Live e2e backend: ${BLACKBOX_LIVE_BASE_URL:-$RENDER_BACKEND_URL}"
else
  echo "Live e2e backend: not configured; e2e/live-render-preprod.test.js will be skipped"
fi

npx jest --config tests/blackbox/jest.config.js --runInBand "$@"

echo
echo "HTML report: $ROOT_DIR/tests/blackbox/reports/blackbox-report.html"
