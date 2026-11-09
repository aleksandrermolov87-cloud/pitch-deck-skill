#!/bin/bash
# Integration tests: real Chrome + Poppler, no Node modules or Python packages.
# PITCH_PYTHON=/path/to/python3 bash tests/pdf/run.sh
set -euo pipefail
SKILL=$(cd "$(dirname "$0")/../.." && pwd)
PY=${PITCH_PYTHON:-python3}
TASK_TMP=$(mktemp -d "${TMPDIR:-/tmp}/pitch pdf tests.XXXXXX")
trap 'rm -rf "$TASK_TMP"' EXIT
fail() { echo "FAIL: $*" >&2; exit 1; }
test -f "$SKILL/scripts/pdf_export.sh" || fail "PDF export route is missing"
test -f "$SKILL/scripts/pdf_check.py" || fail "PDF check route is missing"
mkdir "$TASK_TMP/source with spaces" "$TASK_TMP/output with spaces"
HTML="$TASK_TMP/source with spaces/deck with spaces.html"
PDF="$TASK_TMP/output with spaces/deck with spaces.pdf"
cat > "$HTML" <<'HTML'
<!doctype html><meta charset="utf-8"><title>FORBIDDEN_HEADER</title>
<style>@page{size:640px 360px;margin:0}body{margin:0}.page{width:640px;height:360px;break-after:page;overflow:hidden}.page:last-child{break-after:auto}</style>
<section class="page">PAGE_ONE QA analysis</section><section class="page">PAGE_TWO $1500</section>
HTML
bash "$SKILL/scripts/pdf_export.sh" "$HTML" "$PDF"
"$PY" -I "$SKILL/scripts/pdf_check.py" "$PDF" --out "$TASK_TMP/positive check" --expected-pages 2 --expected-size 480x270 --require-text PAGE_ONE --require-text PAGE_TWO --forbid-text FORBIDDEN_HEADER --forbid-text file://
"$PY" -I - "$TASK_TMP/positive check/check.json" <<'PY'
import json, pathlib, sys
r=json.loads(pathlib.Path(sys.argv[1]).read_text())
assert r['status']=='passed',r
assert len(r['pages'])==2 and len(r['renders'])==2,r
assert r['fonts'] and r['limits']['visual_review']=='not_performed',r
assert all(pathlib.Path(p).is_file() for p in r['renders'])
PY
echo 'PASS: CSS size, two pages, text, fonts, all-page PNG, spaces, no headers'
printf 'foreign file' > "$TASK_TMP/foreign.pdf"
if bash "$SKILL/scripts/pdf_export.sh" "$HTML" "$TASK_TMP/foreign.pdf" >/dev/null 2>&1; then fail 'overwrote foreign PDF'; fi
test "$(cat "$TASK_TMP/foreign.pdf")" = 'foreign file' || fail 'changed refused output'
bash "$SKILL/scripts/pdf_export.sh" "$HTML" "$TASK_TMP/foreign.pdf" --overwrite >/dev/null
pdfinfo "$TASK_TMP/foreign.pdf" >/dev/null
echo 'PASS: refuses overwrite, permits explicit overwrite'
if bash "$SKILL/scripts/pdf_export.sh" "$TASK_TMP/missing.html" "$TASK_TMP/no.pdf" >/dev/null 2>&1; then fail 'accepted missing HTML'; fi
test ! -e "$TASK_TMP/no.pdf" || fail 'created PDF for missing source'
if "$PY" -I "$SKILL/scripts/pdf_check.py" "$PDF" --out "$TASK_TMP/wrong count" --expected-pages 3 >/dev/null; then fail 'accepted wrong page count'; fi
if "$PY" -I "$SKILL/scripts/pdf_check.py" "$PDF" --out "$TASK_TMP/missing text" --require-text ABSENT_FROM_PDF >/dev/null; then fail 'accepted missing required text'; fi
if "$PY" -I "$SKILL/scripts/pdf_check.py" "$PDF" --out "$TASK_TMP/wrong size" --expected-size 800x600 >/dev/null; then fail 'accepted wrong page size'; fi
if "$PY" -I "$SKILL/scripts/pdf_check.py" "$PDF" --out "$TASK_TMP/forbidden text" --forbid-text PAGE_ONE >/dev/null; then fail 'accepted forbidden text'; fi
mkdir "$TASK_TMP/foreign check"
printf 'keep me' > "$TASK_TMP/foreign check/check.json"
if "$PY" -I "$SKILL/scripts/pdf_check.py" "$PDF" --out "$TASK_TMP/foreign check" >/dev/null 2>&1; then fail 'overwrote check artifacts'; fi
test "$(cat "$TASK_TMP/foreign check/check.json")" = 'keep me' || fail 'changed refused check artifacts'
"$PY" -I "$SKILL/scripts/pdf_check.py" "$PDF" --out "$TASK_TMP/foreign check" --overwrite >/dev/null
for NAME in fonts.txt page-1.png; do
  COLLISION="$TASK_TMP/collision $NAME"
  mkdir "$COLLISION"
  cp "$PDF" "$COLLISION/$NAME"
  if "$PY" -I "$SKILL/scripts/pdf_check.py" "$COLLISION/$NAME" --out "$COLLISION" --overwrite >/dev/null 2>&1; then fail 'accepted input/output artifact collision'; fi
  cmp -s "$PDF" "$COLLISION/$NAME" || fail "destroyed PDF input named $NAME"
done
echo 'PASS: overwrite cannot consume input named fonts.txt or page-1.png'
if "$PY" -I "$SKILL/scripts/pdf_check.py" "$PDF" --out "$TASK_TMP/wrong font" --require-font NonexistentTestFont >/dev/null; then fail 'accepted missing font'; fi
printf 'not a PDF' > "$TASK_TMP/invalid.pdf"
if "$PY" -I "$SKILL/scripts/pdf_check.py" "$TASK_TMP/invalid.pdf" --out "$TASK_TMP/invalid check" >/dev/null; then fail 'accepted invalid PDF'; fi
cat > "$TASK_TMP/blank.html" <<'HTML'
<!doctype html><style>@page{size:640px 360px;margin:0}body{margin:0}</style><div style="height:1px"></div>
HTML
bash "$SKILL/scripts/pdf_export.sh" "$TASK_TMP/blank.html" "$TASK_TMP/blank.pdf" >/dev/null
if "$PY" -I "$SKILL/scripts/pdf_check.py" "$TASK_TMP/blank.pdf" --out "$TASK_TMP/blank check" >/dev/null; then fail 'accepted PDF without extractable text'; fi
"$PY" -I - "$TASK_TMP" <<'PY'
import json,pathlib,sys
root=pathlib.Path(sys.argv[1])
for name,needle in [('wrong count','page count'),('missing text','required text'),('wrong size','page size'),('forbidden text','forbidden text'),('blank check','extractable text'),('wrong font','required font'),('invalid check','pdfinfo')]:
    r=json.loads((root/name/'check.json').read_text())
    assert r['status']=='failed' and any(needle in e for e in r['errors']),(name,r)
PY
echo 'PASS: count, size, missing/forbidden/empty text negatives and artifact protection'
