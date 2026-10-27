#!/bin/zsh
# Установка и настройка скилла. Идемпотентна: повторный запуск ничего не ломает и не трогает ваши уроки и config.json.
#   zsh setup.sh                    — зависимости + config.json (режим full, если config.json ещё нет)
#   zsh setup.sh --mode lite        — режим без 21st Magic MCP
#   zsh setup.sh --mode full        — режим с 21st Magic MCP (нужен ключ, см. инструкцию)
#   zsh setup.sh --no-3d            — Magic Patterns не подключён: 3D-объекты не генерируются
#   zsh setup.sh --selftest         — плюс собрать демо-деку и прогнать проверки
#   zsh setup.sh --font <папка|zip|URL> — поставить шрифт бренда из фирменного пакета (иначе config.json → font_source)
set -e
SKILL="${0:A:h:h}"
MODE=""; NO3D=0; SELFTEST=0; FONTSRC=""
while [ $# -gt 0 ]; do
  case "$1" in
    --mode) MODE="$2"; shift ;;
    --no-3d) NO3D=1 ;;
    --selftest) SELFTEST=1 ;;
    --font) FONTSRC="$2"; shift ;;
  esac
  shift
done
say() { print -P "%F{cyan}›%f $1"; }
[ -z "$MODE" ] || [ "$MODE" = full ] || [ "$MODE" = lite ] || { echo "--mode: full или lite"; exit 1; }

command -v node >/dev/null || { echo "Нужен Node.js 18+: brew install node"; exit 1; }
PY=$(zsh "$SKILL/scripts/python.sh") || { echo "Нужен Python 3.11+ (системный python3 на macOS — 3.9): brew install python@3.12 или uv python install 3.12"; exit 1; }

say "Python-окружение скилла ($("$PY" -V))"
# venv на старом Python (до 1.6.1 он собирался на системном 3.9) пересоздаётся: исправленный Pillow на нём не ставится
if [ -x "$SKILL/.venv/bin/python" ] && ! "$SKILL/.venv/bin/python" -I -c 'import sys; sys.exit(sys.version_info < (3, 11))'; then
  say "venv на $("$SKILL/.venv/bin/python" -V) — пересоздаю на $("$PY" -V)"; rm -rf "$SKILL/.venv"
fi
[ -x "$SKILL/.venv/bin/python" ] || "$PY" -m venv "$SKILL/.venv"
"$SKILL/.venv/bin/pip" -q install --disable-pip-version-check -r "$SKILL/requirements.txt"

say "pptxgenjs (сборка PPTX)"
# точные версии из package-lock.json, без install-скриптов пакетов
[ -d "$SKILL/node_modules/pptxgenjs" ] || (cd "$SKILL" && npm ci --silent --ignore-scripts --no-audit --no-fund >/dev/null)

say "Скиллы-зависимости (ставятся только если их нет)"
for s in humanizer taste-skill; do
  if [ ! -f "$HOME/.claude/skills/$s/SKILL.md" ] && [ -d "$SKILL/vendor/$s" ]; then
    mkdir -p "$HOME/.claude/skills/$s" && cp -R "$SKILL/vendor/$s/." "$HOME/.claude/skills/$s/"
    echo "  поставлен $s из vendor/"
  fi
done

say "Режим"
if [ ! -f "$SKILL/config.json" ]; then cp "$SKILL/config.default.json" "$SKILL/config.json"; fi
node -e '
const fs = require("fs"), f = process.argv[1], c = JSON.parse(fs.readFileSync(f, "utf8"));
const mode = process.argv[2]; if (mode) { c.mode = mode; c.magic_mcp = mode === "full"; }
if (process.argv[3] === "1") c.magicpatterns = false;
fs.writeFileSync(f, JSON.stringify(c, null, 2) + "\n");
console.log("  режим: " + c.mode + ", 21st Magic MCP: " + (c.magic_mcp ? "да" : "нет") + ", 3D Magic Patterns: " + (c.magicpatterns ? "да" : "нет"));' "$SKILL/config.json" "$MODE" "$NO3D"

say "Шрифт бренда"
[ -n "$FONTSRC" ] || FONTSRC=$(zsh "$SKILL/scripts/jget.sh" "$SKILL/config.json" font_source)
if zsh "$SKILL/scripts/font.sh" check >/dev/null 2>&1; then echo "  уже установлен"
elif [ -n "$FONTSRC" ]; then zsh "$SKILL/scripts/font.sh" install "$FONTSRC" || echo "  не поставился: деки соберутся на запасном шрифте"
else echo "  не установлен: zsh $SKILL/scripts/font.sh install <папка или zip из фирменного пакета>; до этого деки на запасном шрифте"; fi

say "Демо-объекты 3D для заготовки (публичный CDN Magic Patterns)"
D3="$SKILL/templates/deck-starter/img/3d"; mkdir -p "$D3"
# только https с CDN Magic Patterns, имя файла — буквы, цифры, «_», «-»; сверка sha256, если он указан
node -e 'const s=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));for(const [n,v] of Object.entries(s)){const u=typeof v==="string"?v:v.url,h=typeof v==="string"?"":(v.sha256||"");console.log(n+" "+u+" "+h)}' "$D3/sources.json" | while read n u h; do
  [[ "$n" =~ '^[A-Za-z0-9_-]+$' && "$u" == https://cdn.magicpatterns.com/* ]] || { echo "  пропущен $n: недопустимое имя или адрес"; continue; }
  if [ ! -f "$D3/$n.png" ]; then
    if curl -sSfL --proto '=https' --max-filesize 5000000 -o "$D3/$n.jpg" "$u" && { [ -z "$h" ] || [ "$(shasum -a 256 "$D3/$n.jpg" | cut -d' ' -f1)" = "$h" ] || { echo "  $n: хэш не совпал, файл удалён"; rm -f "$D3/$n.jpg"; false; }; }; then
      "$SKILL/.venv/bin/python" -I "$SKILL/scripts/cutout.py" "$D3/$n.jpg" >/dev/null && rm -f "$D3/$n.jpg"
    else echo "  не скачался $n — демо-слайды соберутся без этого объекта"; fi
  fi
done

say "Уроки"
mkdir -p "$SKILL/learnings"
"$SKILL/.venv/bin/python" -I "$SKILL/scripts/learn.py" digest >/dev/null && echo "  learnings/LESSONS.md собран"

# в git-клоне: проверка на утечки перед каждым коммитом
[ -d "$SKILL/.git" ] && git -C "$SKILL" config core.hooksPath scripts/hooks
chmod +x "$SKILL"/scripts/*.sh "$SKILL"/templates/deck-starter/render.sh 2>/dev/null || true

if [ $SELFTEST = 1 ]; then
  say "Самопроверка: демо-дека в $SKILL/.selftest"
  rm -rf "$SKILL/.selftest"; mkdir -p "$SKILL/.selftest"
  (cd "$SKILL/.selftest" && zsh "$SKILL/scripts/new_deck.sh" src-demo "Демо" Демо >/dev/null \
    && cd src-demo && ./render.sh >/dev/null \
    && "$SKILL/.venv/bin/python" -I "$SKILL/scripts/pptx_audit.py" ../Демо.pptx | tail -1 \
    && "$SKILL/.venv/bin/python" -I "$SKILL/scripts/facts_check.py" out/facts.json --root . --html out/deck.html | tail -1 \
    && "$SKILL/.venv/bin/python" -I "$SKILL/scripts/library_check.py" . | tail -1 \
    && "$SKILL/.venv/bin/python" -I "$SKILL/scripts/brief_coverage.py" check . --map data/coverage.example.json | tail -1 | cut -d';' -f1)
  echo "  PNG-превью: $SKILL/.selftest/src-demo/out/png"
  say "Галерея библиотеки компонентов"
  zsh "$SKILL/scripts/gallery.sh" | tail -2
  echo "  контакт-лист: $SKILL/components/.gallery/sheet.png"
fi
say "Диагностика"
zsh "$SKILL/scripts/doctor.sh" || true
