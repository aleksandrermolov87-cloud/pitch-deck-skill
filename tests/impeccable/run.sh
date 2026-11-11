#!/bin/bash
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
TASK_TMP=$(mktemp -d)
trap 'rm -rf "$TASK_TMP"' EXIT
for location in .codex/skills .agents/skills .claude/skills custom-codex/skills; do
  task_home="$TASK_TMP/$location home"; mkdir -p "$task_home/$location/impeccable/scripts"
  cat > "$task_home/$location/impeccable/scripts/impeccable" <<'MOCK'
#!/bin/sh
printf '%s\n' "$@"
exit 7
MOCK
  chmod +x "$task_home/$location/impeccable/scripts/impeccable"
  if [ "$location" = custom-codex/skills ]; then task_codex="$task_home/custom-codex"; else task_codex="$task_home/.codex"; fi
  actual=$(HOME="$task_home" CODEX_HOME="$task_codex" zsh "$ROOT/scripts/impeccable.sh" --where) || { echo "FAIL: $location discovery"; exit 1; }
  [ "$actual" = "$task_home/$location/impeccable" ]
  set +e
  HOME="$task_home" CODEX_HOME="$task_codex" zsh "$ROOT/scripts/impeccable.sh" detect 'file with spaces.html' > "$TASK_TMP/args"
  code=$?; set -e
  [ "$code" = 7 ]
  [ "$(sed -n '2p' "$TASK_TMP/args")" = 'file with spaces.html' ]
done
mkdir -p "$TASK_TMP/untrusted/.agents/skills/impeccable/scripts" "$TASK_TMP/empty"
printf '#!/bin/sh\ntouch "%s"\n' "$TASK_TMP/executed" > "$TASK_TMP/untrusted/.agents/skills/impeccable/scripts/impeccable"
chmod +x "$TASK_TMP/untrusted/.agents/skills/impeccable/scripts/impeccable"
cd "$TASK_TMP/untrusted"
if HOME="$TASK_TMP/empty" CODEX_HOME="$TASK_TMP/empty/codex" zsh "$ROOT/scripts/impeccable.sh" --where >/dev/null 2>&1; then echo 'FAIL: trusted cwd'; exit 1; fi
[ ! -e "$TASK_TMP/executed" ]
echo 'PASS: Codex, agents, Claude, custom CODEX_HOME; arguments/status; refuses cwd executables'
