#!/bin/zsh
set -e
SKILL="${0:A:h:h:h}"
INSTALL_TEST_PYTHON="$SKILL/.venv/bin/python"
[ -x "$INSTALL_TEST_PYTHON" ] || INSTALL_TEST_PYTHON=$(zsh "$SKILL/scripts/python.sh")
"$INSTALL_TEST_PYTHON" -I "$SKILL/tests/installers/test_installers.py"
