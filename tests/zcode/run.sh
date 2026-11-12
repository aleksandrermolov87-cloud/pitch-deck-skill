#!/bin/zsh
set -e
SKILL="${0:A:h:h:h}"
PY="$SKILL/.venv/bin/python"
[ -x "$PY" ] || PY=$(zsh "$SKILL/scripts/python.sh")
"$PY" -I "$SKILL/tests/zcode/test_zcode.py"
