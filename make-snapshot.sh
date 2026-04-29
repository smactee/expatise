#!/usr/bin/env bash
set -euo pipefail

# Curated snapshot defaults.
# Override any of these at invocation time, for example:
#   MAX_FILES=24 MAX_TOTAL_BYTES=220000 ./make-snapshot.sh
OUTPUT="${OUTPUT:-expatise-snapshot.md}"

COMPACT=0
for arg in "$@"; do
  if [[ "$arg" == "--compact" ]]; then
    COMPACT=1
    break
  fi
done

if [[ "$COMPACT" -eq 1 ]]; then
  MAX_FILES="${MAX_FILES:-22}"
  MAX_TOTAL_BYTES="${MAX_TOTAL_BYTES:-180000}"
  MAX_FILE_BYTES="${MAX_FILE_BYTES:-5000}"
else
  MAX_FILES="${MAX_FILES:-28}"
  MAX_TOTAL_BYTES="${MAX_TOTAL_BYTES:-300000}"
  MAX_FILE_BYTES="${MAX_FILE_BYTES:-8000}"
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

node "$ROOT_DIR/scripts/generate-curated-snapshot.mjs" \
  --repo-root "$ROOT_DIR" \
  --output "$OUTPUT" \
  --max-files "$MAX_FILES" \
  --max-total-bytes "$MAX_TOTAL_BYTES" \
  --max-file-bytes "$MAX_FILE_BYTES" \
  "$@"
