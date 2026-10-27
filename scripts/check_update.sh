#!/bin/zsh
# Проверка новой версии скилла не чаще раза в неделю. Ничего не ставит — только сообщает, если есть подписанный релиз новее.
#   zsh check_update.sh           — проверить, если с прошлой проверки прошло update_check_days дней (config.json, по умолчанию 7; 0 — не проверять)
#   zsh check_update.sh --force   — проверить сейчас
# Вывод пустой, если проверять рано, обновлений нет или сети нет. Иначе первая строка начинается с «ОБНОВЛЕНИЕ:».
# Код выхода всегда 0: проверка не должна мешать работе.
SKILL="${0:A:h:h}"
REPO=aleksandrermolov87-cloud/pitch-deck-skill
STAMP="$SKILL/.update-check"
DAYS=$(zsh "$SKILL/scripts/jget.sh" "$SKILL/config.json" update_check_days 7)
[[ "$DAYS" =~ '^[0-9]+$' ]] || DAYS=7
[ "$DAYS" = 0 ] && [ "$1" != --force ] && exit 0
NOW=$(date +%s)
if [ "$1" != --force ] && [ -f "$STAMP" ]; then
  LAST=$(cat "$STAMP" 2>/dev/null); [[ "$LAST" =~ '^[0-9]+$' ]] || LAST=0
  [ $(( NOW - LAST )) -lt $(( DAYS * 86400 )) ] && exit 0
fi
CUR=$(cat "$SKILL/VERSION" 2>/dev/null | tr -d '[:space:]')
newer() { [ "$1" != "$2" ] && [ "$(printf '%s\n%s\n' "$1" "$2" | sort -V | tail -1)" = "$1" ]; }   # $1 новее $2
# сеть недоступна — повторить завтра, а не при каждом запуске
retry_tomorrow() { echo $(( NOW - DAYS * 86400 + 86400 )) > "$STAMP"; exit 0; }

if [ -d "$SKILL/.git" ]; then
  perl -e 'alarm 20; exec @ARGV' git -C "$SKILL" fetch --quiet --tags --force origin 2>/dev/null || retry_tomorrow
  TAG=$(git -C "$SKILL" tag -l 'v*' --sort=-v:refname | head -1)
  NEW=${TAG#v}
  echo $NOW > "$STAMP"
  [[ "$NEW" =~ '^[0-9]+\.[0-9]+\.[0-9]+$' ]] && newer "$NEW" "$CUR" || exit 0
  # предлагаем только релиз, подписанный ключом автора из уже установленной версии
  SIGNERS=$(mktemp); trap 'rm -f "$SIGNERS"' EXIT
  cp "$SKILL/.github/allowed_signers" "$SIGNERS" 2>/dev/null || exit 0
  git -C "$SKILL" -c gpg.ssh.allowedSignersFile="$SIGNERS" verify-tag "$TAG" >/dev/null 2>&1 || { echo "ВНИМАНИЕ: в репозитории есть релиз $TAG без подписи ключом автора — не обновляйтесь, сообщите автору"; exit 0; }
  echo "ОБНОВЛЕНИЕ: доступна версия $NEW (у вас $CUR), релиз подписан ключом автора"
  git -C "$SKILL" show "$TAG:CHANGELOG.md" 2>/dev/null | awk '/^## /{n++} n==1' | grep -v '^$' | head -12
  echo "Обновить: zsh $SKILL/scripts/update.sh --yes $TAG"
else
  NEW=$(perl -e 'alarm 15; exec @ARGV' curl -sSf --proto '=https' "https://api.github.com/repos/$REPO/releases/latest" 2>/dev/null \
        | sed -n 's/.*"tag_name": *"v\([0-9][0-9.]*\)".*/\1/p' | head -1) || retry_tomorrow
  [ -n "$NEW" ] || retry_tomorrow
  echo $NOW > "$STAMP"
  newer "$NEW" "$CUR" || exit 0
  echo "ОБНОВЛЕНИЕ: доступна версия $NEW (у вас $CUR)"
  echo "Скилл стоит не из git: переустановите по README (https://github.com/$REPO), настройки и уроки сохранятся"
fi
exit 0
