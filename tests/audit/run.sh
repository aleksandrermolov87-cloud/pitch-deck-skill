#!/bin/zsh
set -e
SKILL="${0:A:h:h:h}"
"$SKILL/.venv/bin/python" -I "$SKILL/tests/audit/geometry.py"
