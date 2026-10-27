#!/bin/zsh
# Установка шрифта бренда (по умолчанию Styrene A LC) из фирменного пакета шрифтов.
#   zsh font.sh install <папка | .zip | URL .zip>  — копирует Styrene*.otf/.ttf в шрифты пользователя
#   zsh font.sh check                              — установлен ли шрифт из theme.json (код 0/1)
# Сам шрифт в скилл не входит: Styrene — коммерческий шрифт Commercial Type, его файлы берутся из фирменного
# пакета компании. Путь или ссылку на пакет можно один раз записать в config.json → font_source,
# тогда setup.sh поставит шрифт сам.
set -e
SKILL="${0:A:h:h}"
FAMILY=$(zsh "$SKILL/scripts/jget.sh" "$SKILL/templates/deck-starter/theme.json" font.regular "Styrene A LC")
MASK="${FONT_MASK:-Styrene*}"
case "$(uname)" in
  Darwin) DEST="$HOME/Library/Fonts" ;;
  *) DEST="$HOME/.local/share/fonts" ;;
esac

if [ "$1" = check ]; then
  zsh "$SKILL/scripts/doctor.sh" --font "$FAMILY" && { echo "шрифт «$FAMILY» установлен"; exit 0; }
  echo "шрифт «$FAMILY» не установлен"; exit 1
fi
[ "$1" = install ] && [ -n "$2" ] || { echo "usage: font.sh install <папка | .zip | URL .zip> | font.sh check"; exit 1; }

SRC="$2"; TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
case "$SRC" in
  http://*) echo "только https"; exit 1 ;;
  https://*) curl -sSfL --proto =https --max-filesize 100000000 -o "$TMP/fonts.zip" "$SRC"; SRC="$TMP/fonts.zip" ;;
esac
if [ -f "$SRC" ] && [[ "$SRC" == *.zip ]]; then
  # FONT_SHA256 — ожидаемый хэш архива (по желанию)
  if [ -n "$FONT_SHA256" ] && [ "$(shasum -a 256 "$SRC" | cut -d' ' -f1)" != "$FONT_SHA256" ]; then echo "хэш архива не совпал"; exit 1; fi
  # распаковка только шрифтов, без путей из архива, без ссылок и выхода за папку
  python3 -I -c '
import os, sys, zipfile, stat
z = zipfile.ZipFile(sys.argv[1]); out = sys.argv[2]; os.makedirs(out, exist_ok=True)
for i in z.infolist():
    name = os.path.basename(i.filename)
    if i.is_dir() or not name.lower().endswith((".otf", ".ttf")) or "__MACOSX" in i.filename or stat.S_ISLNK(i.external_attr >> 16) or i.file_size > 20_000_000:
        continue
    with z.open(i) as src, open(os.path.join(out, name), "wb") as dst: dst.write(src.read())
' "$SRC" "$TMP/x" && SRC="$TMP/x"
fi
[ -d "$SRC" ] || { echo "нет папки или архива: $2"; exit 1; }

FILES=(${(f)"$(find "$SRC" -type f ! -type l \( -iname "$MASK.otf" -o -iname "$MASK.ttf" \) ! -path '*/__MACOSX/*')"})
[ -n "${FILES[1]}" ] || { echo "в $2 нет файлов $MASK.otf / .ttf"; exit 1; }
mkdir -p "$DEST"
for f in $FILES; do cp -f "$f" "$DEST/"; echo "  поставлен ${f:t}"; done
command -v fc-cache >/dev/null && fc-cache -f "$DEST" >/dev/null 2>&1 || true
if zsh "$SKILL/scripts/doctor.sh" --font "$FAMILY"; then
  echo "шрифт «$FAMILY» установлен. Перезапустите PowerPoint, если он открыт; в новых деках вернётся шрифт бренда"
else
  echo "файлы скопированы в $DEST, но «$FAMILY» не найден: проверьте, что в пакете есть Regular и Bold"; exit 1
fi
