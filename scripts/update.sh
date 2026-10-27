#!/bin/zsh
# Обновление скилла до последнего релиза с GitHub (папка скилла — git-клон).
#   zsh update.sh            — показать, что изменится (код 2: нужно подтверждение)
#   zsh update.sh --yes      — переключиться на последний релиз и доустановить зависимости
#   zsh update.sh --yes v1.4.0 — на конкретный релиз
# Локальные config.json, learnings/, *.local.md в git не входят и не меняются.
set -e
SKILL="${0:A:h:h}"
cd "$SKILL"
[ -d .git ] || { echo "Скилл стоит не из git. Переустановите: git clone https://github.com/aleksandrermolov87-cloud/pitch-deck-skill.git (см. README)"; exit 1; }
YES=0; WANT=""
for a in "$@"; do case "$a" in --yes) YES=1 ;; v*) WANT="$a" ;; esac; done
[ -z "$(git status --porcelain --untracked-files=no)" ] || { echo "В папке скилла есть изменённые файлы из репозитория (git status). Сохраните их отдельно или верните: git stash"; exit 1; }

git fetch --quiet --tags --force origin
NEW=${WANT:-$(git tag -l 'v*' --sort=-v:refname | head -1)}
[ -n "$NEW" ] || { echo "релизов нет"; exit 1; }
[[ "$NEW" =~ '^v[0-9]+\.[0-9]+\.[0-9]+$' ]] || { echo "неверное имя релиза: $NEW"; exit 1; }
CUR=$(git describe --tags --exact-match 2>/dev/null || git rev-parse --short HEAD)
if [ "$CUR" = "$NEW" ]; then echo "уже стоит последний релиз $NEW"; exit 0; fi

echo "Сейчас: $CUR → релиз: $NEW"
if git verify-tag "$NEW" >/dev/null 2>&1; then echo "подпись релиза проверена"; else echo "релиз без проверяемой подписи: сверьте автора и изменения ниже"; fi
echo "\nЧто нового (CHANGELOG.md):"
git show "$NEW:CHANGELOG.md" | awk 'NR>2 && /^## /{n++} n<1' | head -40
echo "\nИзменения в исполняемых частях и инструкциях агента:"
git diff --stat "HEAD" "$NEW" -- scripts templates SKILL.md reference components requirements.txt package.json package-lock.json | tail -25
if [ $YES = 0 ]; then
  echo "\nПроверьте изменения (git diff HEAD $NEW -- scripts templates SKILL.md) и запустите: zsh $SKILL/scripts/update.sh --yes $NEW"
  exit 2
fi
git -c advice.detachedHead=false checkout --quiet "$NEW"
zsh "$SKILL/scripts/setup.sh"
echo "обновлено до $NEW. Откройте новую сессию Claude Code, чтобы скилл перечитался"
