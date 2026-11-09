#!/bin/bash
# Export local HTML with Chrome/Chromium found by scripts/chrome.sh.
# Usage: bash pdf_export.sh INPUT.html OUTPUT.pdf [--overwrite]
# Honors CSS @page size/margins; disables browser date/title/URL headers.
# Uses an isolated temporary browser profile. No Node modules or Python packages.
# Existing output (including symlinks) is refused unless --overwrite is explicit.
# Waits 1500ms of virtual time for local assets; inspect final PDF with pdf_check.py.
set -euo pipefail
die() { echo "pdf_export: $*" >&2; exit 1; }
if [ "$#" -lt 2 ] || [ "$#" -gt 3 ]; then die 'usage: INPUT.html OUTPUT.pdf [--overwrite]'; fi
INPUT=$1
OUTPUT=$2
OVERWRITE=false
if [ "$#" -eq 3 ]; then
  [ "$3" = --overwrite ] || die "unknown option: $3"
  OVERWRITE=true
fi
[ -f "$INPUT" ] || die "HTML not found: $INPUT"
[ ! -d "$OUTPUT" ] || die "output is a directory: $OUTPUT"
if { [ -e "$OUTPUT" ] || [ -L "$OUTPUT" ]; } && [ "$OVERWRITE" = false ]; then
  die "output exists; use --overwrite: $OUTPUT"
fi
SKILL=$(cd "$(dirname "$0")/.." && pwd)
CHROME=$(zsh "$SKILL/scripts/chrome.sh") || die 'Chrome/Chromium not found'
INPUT=$(cd "$(dirname "$INPUT")" && pwd -P)/$(basename "$INPUT")
PDF_PYTHON="$SKILL/.venv/bin/python"
if [ ! -x "$PDF_PYTHON" ]; then
  PDF_PYTHON=$(zsh "$SKILL/scripts/python.sh") || die 'Python 3.11+ not found'
fi
INPUT_URL=$("$PDF_PYTHON" -I -c 'from pathlib import Path; import sys; print(Path(sys.argv[1]).as_uri())' "$INPUT")
mkdir -p "$(dirname "$OUTPUT")"
OUTPUT=$(cd "$(dirname "$OUTPUT")" && pwd -P)/$(basename "$OUTPUT")
[ "$INPUT" != "$OUTPUT" ] || die 'input and output must differ'
# Stage on the output filesystem: hard-link publication is atomic and no-clobber.
TASK_TMP=$(mktemp -d "$(dirname "$OUTPUT")/.pitch-pdf.XXXXXX")
trap 'rm -rf "$TASK_TMP"' EXIT
if ! "$CHROME" --headless --disable-gpu --no-first-run --no-default-browser-check \
  --user-data-dir="$TASK_TMP/profile" --no-pdf-header-footer \
  --print-to-pdf="$TASK_TMP/export.pdf" --timeout=30000 --virtual-time-budget=1500 \
  "$INPUT_URL" >"$TASK_TMP/chrome.log" 2>&1; then
  cat "$TASK_TMP/chrome.log" >&2
  die 'Chrome export failed'
fi
[ -s "$TASK_TMP/export.pdf" ] || die 'Chrome did not create a PDF'
[ "$(head -c 5 "$TASK_TMP/export.pdf")" = '%PDF-' ] || die 'invalid PDF output'
if [ "$OVERWRITE" = true ]; then
  mv -f "$TASK_TMP/export.pdf" "$OUTPUT"
else
  ln "$TASK_TMP/export.pdf" "$OUTPUT" || die 'output appeared during export; refusing overwrite'
fi
echo "$OUTPUT"
