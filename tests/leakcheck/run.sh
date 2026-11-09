#!/bin/zsh
set -e
SKILL="${0:A:h:h:h}"
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
mkdir "$T/tree"
python3 -I - "$T/tree/.git" <<'PY'
from pathlib import Path
import sys
Path(sys.argv[1]).write_text('gitdir: /Us'+'ers/example/worktrees/demo\n')
PY
zsh "$SKILL/scripts/leakcheck.sh" "$T/tree" > "$T/out" 2>&1 || { echo 'FAIL: worktree metadata treated as package content'; exit 1; }
cp "$T/tree/.git" "$T/tree/real.txt"
if zsh "$SKILL/scripts/leakcheck.sh" "$T/tree" > "$T/out" 2>&1; then echo 'FAIL: real leaked path accepted'; exit 1; fi
grep -q 'real.txt' "$T/out"
echo 'PASS: worktree metadata ignored, real content still checked'
