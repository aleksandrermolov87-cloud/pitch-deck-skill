#!/bin/zsh
# Выпуск новой версии (для автора): проверки, тег, пуш, релиз на GitHub с установочными md.
#   zsh release.sh 1.4.0          — VERSION и раздел CHANGELOG «## 1.4.0» уже должны быть в коммите
#   zsh release.sh 1.4.0 --quick  — без самопроверки (только если она прошла в этом же коде)
set -e
SKILL="${0:A:h:h}"
cd "$SKILL"
VER="$1"
[[ "$VER" =~ '^[0-9]+\.[0-9]+\.[0-9]+$' ]] || { echo "usage: release.sh X.Y.Z [--quick]"; exit 1; }
[ "$(cat VERSION)" = "$VER" ] || { echo "VERSION = $(cat VERSION), а не $VER"; exit 1; }
grep -q "^## $VER" CHANGELOG.md || { echo "в CHANGELOG.md нет раздела «## $VER»"; exit 1; }
[ -z "$(git status --porcelain)" ] || { echo "есть незакоммиченные изменения"; git status --short | head; exit 1; }
git rev-parse "v$VER" >/dev/null 2>&1 && { echo "тег v$VER уже есть"; exit 1; }

echo "› проверка на утечки"; zsh scripts/leakcheck.sh
if [ "$2" != --quick ]; then echo "› самопроверка"; zsh scripts/setup.sh --selftest | grep -E "Демо.pptx|фактов|Галерея_"; fi

DIST=$(mktemp -d); trap 'rm -rf "$DIST"' EXIT
echo "› установочные md"; zsh scripts/package.sh "$DIST" | tail -1
SHA=$(zsh scripts/package.sh "$DIST" | sed -n 's/.*sha256 \([0-9a-f]*\).*/\1/p')

NOTES="$DIST/notes.md"
awk -v v="## $VER" '$0 ~ "^"v {f=1; next} f && /^## / {exit} f' CHANGELOG.md > "$NOTES"
printf '\n---\nSHA-256 архива внутри установочных md: `%s`\n\nУстановка и обновление — README.md.\n' "$SHA" >> "$NOTES"

if git config user.signingkey >/dev/null; then git tag -s "v$VER" -m "pitch-deck-skill $VER"; else git tag -a "v$VER" -m "pitch-deck-skill $VER"; fi
git push origin HEAD "v$VER"
gh release create "v$VER" --title "pitch-deck-skill $VER" --notes-file "$NOTES" "$DIST"/*.md
echo "релиз v$VER опубликован, sha256 $SHA"
