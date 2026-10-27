#!/bin/zsh
# Подмена папки результата готовой сборкой: zsh publish_dir.sh <собранная папка> <папка результата>
# Сборки (gallery.sh, setup.sh --selftest) идут в частной папке $SKILL/.build/<имя>.XXXXXX, поэтому параллельные запуски
# из разных сессий не стирают файлы друг друга. Подмена — под блокировкой <результат>.lock: старая папка уходит в сторону
# и удаляется, новая встаёт переименованием (та же файловая система, без копирования). Кто опубликовал последним — того и результат.
set -e
SRC="${1:A}"; DST="${2:A}"
[ -d "$SRC" ] && [ -n "$DST" ] || { echo "usage: publish_dir.sh <собранная папка> <папка результата>"; exit 1; }
LOCK="$DST.lock"
for i in {1..600}; do
  mkdir "$LOCK" 2>/dev/null && break
  # блокировка старше 2 минут — от упавшего процесса: снимаем
  [ -n "$(find "$LOCK" -maxdepth 0 -mmin +2 2>/dev/null)" ] && rmdir "$LOCK" 2>/dev/null
  sleep 0.2
done
[ -d "$LOCK" ] || { echo "не дождался блокировки $LOCK"; exit 1; }
trap 'rmdir "$LOCK" 2>/dev/null' EXIT
OLD=""
if [ -e "$DST" ]; then OLD="$DST.old-$$"; mv "$DST" "$OLD"; fi
mv "$SRC" "$DST"
rmdir "$LOCK"; trap - EXIT
[ -n "$OLD" ] && rm -rf "$OLD"
exit 0
