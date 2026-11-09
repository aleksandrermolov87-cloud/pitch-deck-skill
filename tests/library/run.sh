#!/bin/zsh
# Library metadata must name real catalog components; no network or personal state.
set -e
SKILL="${0:A:h:h:h}"
"$SKILL/.venv/bin/python" -I "$SKILL/tests/library/test_library_check.py"
