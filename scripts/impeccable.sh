#!/bin/zsh
# Обёртка impeccable: находит установленный impeccable (скилл в ~/.claude/skills, в проекте или плагин) и передаёт ему аргументы.
#   zsh impeccable.sh detect <file.html>      — детектор
#   zsh impeccable.sh --where                 — путь к папке impeccable (код 1, если не найден)
# Папку текущего проекта не смотрим: в чужом репозитории там может лежать подложенный исполняемый файл.
for base in "$HOME/.claude/skills/impeccable" \
            $HOME/.claude/plugins/cache/*/impeccable*/skills/impeccable(N) $HOME/.claude/plugins/marketplaces/*/skills/impeccable(N); do
  if [ -x "$base/scripts/impeccable" ]; then
    if [ "$1" = "--where" ]; then echo "$base"; exit 0; fi
    exec "$base/scripts/impeccable" "$@"
  fi
done
echo "impeccable не найден. Установка: npx -y impeccable install (из папки проекта) или /plugin marketplace add pbakaus/impeccable в Claude Code." >&2
exit 1
