#!/bin/zsh
# Выпуск новой версии (для автора): проверки, тег, пуш, релиз на GitHub с установочными md.
#   zsh release.sh 1.4.0          — VERSION и раздел CHANGELOG «## 1.4.0» уже должны быть в коммите
#   zsh release.sh 1.4.0 --quick  — без самопроверки (только если она прошла в этом же коде)
# Тег подписывается SSH-ключом (git config gpg.format ssh, user.signingkey); без ключа релиз не выпускается.
# Публичный ключ лежит в .github/allowed_signers: по нему update.sh у коллег проверяет подпись.
set -e
SKILL="${0:A:h:h}"
cd "$SKILL"
VER="$1"
[[ "$VER" =~ '^[0-9]+\.[0-9]+\.[0-9]+$' ]] || { echo "usage: release.sh X.Y.Z [--quick]"; exit 1; }
[ "$(cat VERSION)" = "$VER" ] || { echo "VERSION = $(cat VERSION), а не $VER"; exit 1; }
grep -q "^## $VER" CHANGELOG.md || { echo "в CHANGELOG.md нет раздела «## $VER»"; exit 1; }
[ -z "$(git status --porcelain)" ] || { echo "есть незакоммиченные изменения"; git status --short | head; exit 1; }
git rev-parse "v$VER" >/dev/null 2>&1 && { echo "тег v$VER уже есть"; exit 1; }
KEY=$(git config user.signingkey || true)
[ "$(git config gpg.format)" = ssh ] && [ -n "$KEY" ] && [ -f "${KEY/#\~/$HOME}" ] || { echo "нет ключа подписи: git config gpg.format ssh; git config user.signingkey ~/.ssh/<ключ>.pub"; exit 1; }
grep -qF "$(cut -d' ' -f2 "${KEY/#\~/$HOME}")" .github/allowed_signers || { echo "ключ подписи не записан в .github/allowed_signers — коллеги не смогут проверить релиз"; exit 1; }

echo "› проверка на утечки"; zsh scripts/leakcheck.sh
if [ "$2" != --quick ]; then echo "› самопроверка"; zsh scripts/setup.sh --selftest | grep -E "Демо.pptx|фактов|Галерея_"; fi

DIST=$(mktemp -d); trap 'rm -rf "$DIST"' EXIT
echo "› установочные md"
OUT=$(zsh scripts/package.sh "$DIST"); echo "$OUT" | tail -1
SHA=$(echo "$OUT" | sed -n 's/.*sha256 \([0-9a-f]*\).*/\1/p')
# GitHub не принимает кириллицу в именах файлов релиза: латинские имена, русские подписи
cp "$DIST/pitch-deck-skill — установка (с Magic-MCP).md" "$DIST/pitch-deck-skill-install-full.md"
cp "$DIST/pitch-deck-skill — установка (без Magic-MCP).md" "$DIST/pitch-deck-skill-install-lite.md"

NOTES="$DIST/notes.md"
awk -v v="## $VER" '$0 ~ "^"v {f=1; next} f && /^## / {exit} f' CHANGELOG.md > "$NOTES"
printf '\n---\nSHA-256 архива внутри установочных md: `%s`\n\nУстановка и обновление — README.md.\n' "$SHA" >> "$NOTES"

git tag -s "v$VER" -m "pitch-deck-skill $VER"
git -c gpg.ssh.allowedSignersFile="$SKILL/.github/allowed_signers" verify-tag "v$VER" || { git tag -d "v$VER"; echo "подпись тега не проверилась, тег удалён"; exit 1; }
git push origin HEAD "v$VER"
gh release create "v$VER" --title "pitch-deck-skill $VER" --notes-file "$NOTES" --verify-tag \
  "$DIST/pitch-deck-skill-install-full.md#Установка с Magic-MCP (21st, платный ключ)" \
  "$DIST/pitch-deck-skill-install-lite.md#Установка без Magic-MCP"
echo "релиз v$VER опубликован, sha256 $SHA"
