#!/bin/zsh
# Пакет для коллег: два самоустанавливающихся md (full — с 21st Magic MCP, lite — без него).
#   zsh package.sh [папка-вывода]      → <папка>/pitch-deck-skill — установка (с Magic-MCP).md и (без Magic-MCP).md
# Локальное не попадает: *.local.md, config.json, .venv, node_modules, оценки и галерея learnings, демо-PNG, .selftest.
# Упаковка падает, если в файлах остались личные пути или ссылки на рабочее место.
set -e
SKILL="${0:A:h:h}"
OUT="${1:-$SKILL/dist}"
VER=$(cat "$SKILL/VERSION")
WORK=$(mktemp -d); trap 'rm -rf "$WORK"' EXIT
STAGE=$WORK/pitch-deck-skill
mkdir -p "$STAGE" "$OUT"

rsync -a "$SKILL/" "$STAGE/" \
  --exclude '.venv' --exclude 'node_modules' --exclude 'dist' --exclude '.selftest' --exclude '__pycache__' --exclude '.DS_Store' \
  --exclude 'config.json' --exclude '*.local.md' --exclude 'leaks.local.txt' --exclude '.git' \
  --exclude 'learnings/ratings.jsonl' --exclude 'learnings/gallery' --exclude 'learnings/LESSONS.md' \
  --exclude 'learnings/copy_edits.jsonl' --exclude 'learnings/bg_edits.jsonl' --exclude '.acceptance' \
  --exclude 'templates/deck-starter/img/3d/*.png' --exclude 'templates/deck-starter/img/3d/cover_*.json' \
  --exclude 'templates/deck-starter/img/3d/step_*.json' --exclude 'templates/deck-starter/img/bg*.jpg' \
  --exclude 'templates/deck-starter/out' --exclude 'templates/install' --exclude 'components/.gallery*'

# проверка приватности: общие шаблоны + локальный список scripts/leaks.local.txt (он не коммитится и не пакуется)
zsh "$SKILL/scripts/leakcheck.sh" "$STAGE" || { echo "Упаковка остановлена"; exit 1; }

TGZ=$WORK/pitch-deck-skill-$VER.tgz
(cd "${STAGE:h}" && COPYFILE_DISABLE=1 tar czf "$TGZ" pitch-deck-skill)
SHA=$(shasum -a 256 "$TGZ" | cut -d' ' -f1)
FILES=$(tar tzf "$TGZ" | grep -v '/$' | wc -l | tr -d ' ')
SIZE=$(du -k "$TGZ" | cut -f1)

for MODE in full lite; do
  if [ $MODE = full ]; then NAME="pitch-deck-skill — установка (с Magic-MCP).md"; else NAME="pitch-deck-skill — установка (без Magic-MCP).md"; fi
  "$SKILL/.venv/bin/python" -I - "$SKILL/templates/install/INSTALL.md.tpl" "$OUT/$NAME" "$MODE" "$VER" "$SHA" "$FILES" "$SIZE" "$TGZ" <<'PY'
import base64, re, sys
tpl, out, mode, ver, sha, files, size, tgz = sys.argv[1:]
s = open(tpl, encoding='utf-8').read()
# блоки {{#full}}…{{/full}} и {{#lite}}…{{/lite}} остаются только для своего режима
for m in ('full', 'lite'):
    s = re.sub(r'\{\{#' + m + r'\}\}(.*?)\{\{/' + m + r'\}\}', (lambda x: x.group(1)) if m == mode else '', s, flags=re.S)
payload = base64.encodebytes(open(tgz, 'rb').read()).decode().strip()
for k, v in {'REPO': 'https://github.com/aleksandrermolov87-cloud/pitch-deck-skill', 'MODE': mode, 'VERSION': ver, 'SHA256': sha, 'FILES': files, 'SIZE_KB': size,
             'FILENAME': out.rsplit('/', 1)[-1], 'PAYLOAD': payload}.items():
    s = s.replace('{{' + k + '}}', v)
open(out, 'w', encoding='utf-8').write(s)
print('ok', out)
PY
done
echo "версия $VER, файлов $FILES, архив ${SIZE} КБ, sha256 $SHA"
