#!/bin/zsh
# Проверка на утечки перед упаковкой и коммитом: ключи, токены, личные пути, внутренние названия.
#   zsh leakcheck.sh [папка]        — по умолчанию папка скилла; код 1, если что-то найдено
# Общие шаблоны лежат здесь; внутренние названия — в scripts/leaks.local.txt (локально, в git не попадает).
SKILL="${0:A:h:h}"
DIR="${1:-$SKILL}"
PAT=(
  'sk-[A-Za-z0-9_-]{16,}' 'gh[pousr]_[A-Za-z0-9]{20,}' 'github_pat_[A-Za-z0-9_]{20,}' 'AKIA[0-9A-Z]{16}'
  '-----BEGIN [A-Z ]*PRIVATE KEY' 'x-api-key: *[A-Za-z0-9]{8,}' 'Bearer [A-Za-z0-9._-]{20,}' 'xox[baprs]-[A-Za-z0-9-]{10,}'
  '/Users/[A-Za-z]' '/home/[a-z][a-z0-9_-]+/'
)
[ -f "$SKILL/scripts/leaks.local.txt" ] && PAT+=(${(f)"$(grep -v '^#' "$SKILL/scripts/leaks.local.txt" | grep -v '^$')"})
HITS=""
for p in $PAT; do
  h=$(grep -rnIE -e "$p" "$DIR" --exclude-dir=.git --exclude-dir=.venv --exclude-dir=node_modules --exclude-dir=.selftest \
      --exclude-dir='.gallery*' --exclude=leaks.local.txt --exclude='*.local.md' --exclude=config.json \
      --exclude=ratings.jsonl --exclude-dir=gallery 2>/dev/null | grep -v "scripts/leakcheck.sh:")
  [ -n "$h" ] && HITS+="$h"$'\n'
done
# картинки: текстовые чанки и EXIF с путями или именами
for f in ${(f)"$(find "$DIR" -name '*.png' -not -path '*/.venv/*' -not -path '*/node_modules/*' -not -path '*/.selftest/*' -not -path '*/.gallery*' -not -path '*/learnings/gallery/*' 2>/dev/null)"}; do
  strings "$f" | grep -qiE '/Users/|tEXtAuthor|tEXtComment' && HITS+="$f: метаданные в PNG"$'\n'
done
if [ -n "$HITS" ]; then echo "Найдены возможные утечки:"; echo "$HITS" | head -40; exit 1; fi
echo "утечек не найдено"
