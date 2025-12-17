#!/usr/bin/env bash
set -euo pipefail

OUTPUT="expatise-snapshot.md"
TMP="${OUTPUT}.tmp"

: > "$TMP"

FILES=$(
  {
    git ls-files
    git ls-files --others --exclude-standard
  } |
  # include only code/text (avoid images/binaries)
  grep -E '\.(ts|tsx|js|jsx|css|json|md)$' |
  # exclude generated/noisy folders + public images
  grep -vE '^(node_modules/|\.next/|dist/|build/|out/|coverage/|\.git/|\.vercel/|public/images/)' |
  # CRITICAL: never include the snapshot itself
  grep -vE "^${OUTPUT}$" |
  sort -u
)

while IFS= read -r file; do
  [ -f "$file" ] || continue

  echo "### $file" >> "$TMP"

  ext="${file##*.}"
  case "$ext" in
    ts|tsx|js|jsx) lang="tsx" ;;
    css)           lang="css" ;;
    json)          lang="json" ;;
    md)            lang="md" ;;
    *)             lang="" ;;
  esac

  printf '```%s\n' "$lang" >> "$TMP"
  cat "$file" >> "$TMP"
  printf '\n```\n\n' >> "$TMP"
done <<< "$FILES"

mv "$TMP" "$OUTPUT"
echo "✅ Snapshot written to $OUTPUT"
