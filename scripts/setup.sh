#!/bin/zsh
# Установка и настройка скилла. Идемпотентна: повторный запуск ничего не ломает и не трогает ваши уроки и config.json.
#   zsh setup.sh                    — зависимости + config.json (режим full, если config.json ещё нет)
#   zsh setup.sh --mode lite        — режим без 21st Magic MCP
#   zsh setup.sh --mode full        — режим с 21st Magic MCP (нужен ключ, см. инструкцию)
#   zsh setup.sh --no-3d            — без 3D: Magic Patterns не подключается, 3D-объекты не генерируются
#   zsh setup.sh --system           — доставить недостающие программы через Homebrew: Node.js, Python 3.12, Google Chrome, poppler
#   zsh setup.sh --with-libreoffice — вместе с --system: ещё LibreOffice для проверки PPTX без PowerPoint
#   zsh setup.sh --no-mcp           — не подключать Magic Patterns MCP в Claude Code и Codex (проверка останется)
#   zsh setup.sh --selftest         — плюс собрать демо-деку и прогнать проверки
#   zsh setup.sh --font <папка|zip|URL> — поставить шрифт бренда из фирменного пакета (иначе config.json → font_source)
set -e
SKILL="${0:A:h:h}"
MODE=""; NO3D=0; SELFTEST=0; FONTSRC=""; SYSTEM=0; LO=0; NOMCP=0
while [ $# -gt 0 ]; do
  case "$1" in
    --mode) MODE="$2"; shift ;;
    --no-3d) NO3D=1 ;;
    --selftest) SELFTEST=1 ;;
    --font) FONTSRC="$2"; shift ;;
    --system) SYSTEM=1 ;;
    --with-libreoffice) LO=1 ;;
    --no-mcp) NOMCP=1 ;;
  esac
  shift
done
say() { print -P "%F{cyan}›%f $1"; }
[ -z "$MODE" ] || [ "$MODE" = full ] || [ "$MODE" = lite ] || { echo "--mode: full или lite"; exit 1; }

say "Программы (Node.js 18+, Python 3.11+, Google Chrome, poppler)"
# что нужно доставить: формулы и cask-и Homebrew. Без --system только список и команда, ничего не ставится
need=(); casks=()
{ command -v node >/dev/null && [ "$(node -p 'process.versions.node.split(".")[0]')" -ge 18 ]; } || need+=node
zsh "$SKILL/scripts/python.sh" >/dev/null || need+=python@3.12
command -v pdftotext >/dev/null || need+=poppler
zsh "$SKILL/scripts/chrome.sh" >/dev/null || casks+=google-chrome
[ $LO = 1 ] && ! command -v soffice >/dev/null && [ ! -d /Applications/LibreOffice.app ] && casks+=libreoffice
if [ ${#need} = 0 ] && [ ${#casks} = 0 ]; then echo "  всё на месте"
elif [ $SYSTEM = 1 ] && command -v brew >/dev/null; then
  [ ${#need} = 0 ] || { echo "  brew install ${need[*]}"; brew install -q ${need[@]}; }
  [ ${#casks} = 0 ] || { echo "  brew install --cask ${casks[*]}"; brew install -q --cask ${casks[@]}; }
  rehash
elif [ $SYSTEM = 1 ]; then
  echo "  нет Homebrew: поставьте его по инструкции https://brew.sh и повторите zsh $0 --system"; exit 1
else
  echo "  не хватает: ${need[*]} ${casks[*]}"
  echo "  поставить: zsh $0 --system   (или вручную: brew install ${need[*]}${casks:+; brew install --cask ${casks[*]}})"
fi
command -v node >/dev/null || { echo "Нужен Node.js 18+: zsh $0 --system или brew install node"; exit 1; }
PY=$(zsh "$SKILL/scripts/python.sh") || { echo "Нужен Python 3.11+ (системный python3 на macOS — 3.9): zsh $0 --system, brew install python@3.12 или uv python install 3.12"; exit 1; }

say "Python-окружение скилла ($("$PY" -V))"
# venv на старом Python (до 1.6.1 он собирался на системном 3.9) пересоздаётся: исправленный Pillow на нём не ставится
if [ -x "$SKILL/.venv/bin/python" ] && ! "$SKILL/.venv/bin/python" -I -c 'import sys; sys.exit(sys.version_info < (3, 11))'; then
  say "venv на $("$SKILL/.venv/bin/python" -V) — пересоздаю на $("$PY" -V)"; rm -rf "$SKILL/.venv"
fi
[ -x "$SKILL/.venv/bin/python" ] || "$PY" -m venv "$SKILL/.venv"
# pip из python -m venv отстаёт от исправленных версий (pip-audit: уязвимости до 26.2): сначала поднимаем его до закреплённой
PIP_VERSION=26.2.2
[ "$("$SKILL/.venv/bin/python" -I -m pip --version 2>/dev/null | cut -d' ' -f2)" = "$PIP_VERSION" ] \
  || "$SKILL/.venv/bin/python" -I -m pip -q install --disable-pip-version-check "pip==$PIP_VERSION"
"$SKILL/.venv/bin/pip" -q install --disable-pip-version-check -r "$SKILL/requirements.txt"

say "pptxgenjs (сборка PPTX)"
# точные версии из package-lock.json, без install-скриптов пакетов; после обновления скилла lock меняется — пакеты ставятся заново
LOCK=$(shasum -a 256 "$SKILL/package-lock.json" | cut -d' ' -f1)
if [ ! -d "$SKILL/node_modules/pptxgenjs" ] || [ "$(cat "$SKILL/node_modules/.pds-lock" 2>/dev/null)" != "$LOCK" ]; then
  (cd "$SKILL" && npm ci --silent --ignore-scripts --no-audit --no-fund >/dev/null) && echo "$LOCK" > "$SKILL/node_modules/.pds-lock" && echo "  пакеты по package-lock.json"
else echo "  актуальны"; fi

say "Скиллы-зависимости (ставятся рядом со скиллом, только если их нет)"
# рядом со скиллом: ~/.claude/skills в Claude Code, ~/.codex/skills в Codex
ROOT="${SKILL:h}"
for s in humanizer taste-skill; do
  if [ ! -f "$ROOT/$s/SKILL.md" ] && [ -d "$SKILL/vendor/$s" ]; then
    mkdir -p "$ROOT/$s" && cp -R "$SKILL/vendor/$s/." "$ROOT/$s/"
    echo "  поставлен $s из vendor/"
  fi
done

say "Режим"
if [ ! -f "$SKILL/config.json" ]; then cp "$SKILL/config.default.json" "$SKILL/config.json"; fi
node -e '
const fs = require("fs"), f = process.argv[1], c = JSON.parse(fs.readFileSync(f, "utf8"));
const mode = process.argv[2]; if (mode) { c.mode = mode; c.magic_mcp = mode === "full"; }
if (process.argv[3] === "1") { c.magicpatterns = false; c.image_provider = "none"; }
if (!c.image_provider) c.image_provider = c.magicpatterns === false ? "none" : "auto";   // config.json до 1.8.0
if (!(c.config_v >= 2)) { if (c.update_check_days == null || c.update_check_days === 7) c.update_check_days = 1; c.config_v = 2; }   // до 1.11.1 по умолчанию раз в неделю; переводим один раз, свой выбор потом не трогаем
fs.writeFileSync(f, JSON.stringify(c, null, 2) + "\n");
console.log("  режим: " + c.mode + ", 21st Magic MCP: " + (c.magic_mcp ? "да" : "нет") + ", 3D Magic Patterns: " + (c.magicpatterns ? "да" : "нет") + ", провайдер 3D: " + c.image_provider); ' "$SKILL/config.json" "$MODE" "$NO3D"

say "3D-генерация: Magic Patterns MCP (Claude Code, Codex) и image_gen (Codex)"
if [ $NO3D = 1 ]; then echo "  выключена (--no-3d)"
elif [ $NOMCP = 1 ]; then zsh "$SKILL/scripts/mcp_setup.sh" --check || true
else zsh "$SKILL/scripts/mcp_setup.sh" || true; fi

say "Шрифт бренда"
[ -n "$FONTSRC" ] || FONTSRC=$(zsh "$SKILL/scripts/jget.sh" "$SKILL/config.json" font_source)
if zsh "$SKILL/scripts/font.sh" check >/dev/null 2>&1; then echo "  уже установлен"
elif [ -n "$FONTSRC" ]; then zsh "$SKILL/scripts/font.sh" install "$FONTSRC" || echo "  не поставился: деки соберутся на запасном шрифте"
else echo "  не установлен: zsh $SKILL/scripts/font.sh install <папка или zip из фирменного пакета>; до этого деки на запасном шрифте"; fi

say "Демо-объекты 3D для заготовки (публичный CDN Magic Patterns)"
D3="$SKILL/templates/deck-starter/img/3d"; mkdir -p "$D3" "$SKILL/.build"
# скачивание и вырезка — в частной папке, в заготовку файлы встают переименованием: параллельный new_deck не увидит половину файла
DL=$(mktemp -d "$SKILL/.build/3d.XXXXXX")
# только https с CDN Magic Patterns, имя файла — буквы, цифры, «_», «-»; сверка sha256, если он указан
node -e 'const s=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));for(const [n,v] of Object.entries(s)){const u=typeof v==="string"?v:v.url,h=typeof v==="string"?"":(v.sha256||"");console.log(n+" "+u+" "+h)}' "$D3/sources.json" | while read n u h; do
  [[ "$n" =~ '^[A-Za-z0-9_-]+$' && "$u" == https://cdn.magicpatterns.com/* ]] || { echo "  пропущен $n: недопустимое имя или адрес"; continue; }
  if [ ! -f "$D3/$n.png" ]; then
    if curl -sSfL --proto '=https' --max-filesize 5000000 -o "$DL/$n.jpg" "$u" && { [ -z "$h" ] || [ "$(shasum -a 256 "$DL/$n.jpg" | cut -d' ' -f1)" = "$h" ] || { echo "  $n: хэш не совпал, файл удалён"; rm -f "$DL/$n.jpg"; false; }; }; then
      "$SKILL/.venv/bin/python" -I "$SKILL/scripts/cutout.py" "$DL/$n.jpg" >/dev/null && { [ ! -f "$DL/$n.json" ] || mv -f "$DL/$n.json" "$D3/$n.json"; } && mv -f "$DL/$n.png" "$D3/$n.png"
    else echo "  не скачался $n — демо-слайды соберутся без этого объекта"; fi
  fi
done
rm -rf "$DL"

say "Уроки"
mkdir -p "$SKILL/learnings"
"$SKILL/.venv/bin/python" -I "$SKILL/scripts/learn.py" digest >/dev/null && echo "  learnings/LESSONS.md собран"

# в git-клоне: проверка на утечки перед каждым коммитом
[ -d "$SKILL/.git" ] && git -C "$SKILL" config core.hooksPath scripts/hooks
chmod +x "$SKILL"/scripts/*.sh "$SKILL"/templates/deck-starter/render.sh 2>/dev/null || true

if [ $SELFTEST = 1 ]; then
  say "Самопроверка: демо-дека в $SKILL/.selftest"
  # сборка в частной папке, затем подмена .selftest: параллельные самопроверки из разных сессий не мешают друг другу
  mkdir -p "$SKILL/.build"; ST=$(mktemp -d "$SKILL/.build/selftest.XXXXXX")
  # pipefail: ошибка проверки внутри «… | tail -1» валит самопроверку, а не теряется в конвейере
  (setopt pipefail; cd "$ST" && zsh "$SKILL/scripts/new_deck.sh" src-demo "Демо" Демо '{"topic":"Страховая платформа в контуре банка (демо)","slides":6,"3d":true}' >/dev/null \
    && cd src-demo && ./render.sh >/dev/null \
    && "$SKILL/.venv/bin/python" -I "$SKILL/scripts/pptx_audit.py" ../Демо.pptx | tail -1 \
    && "$SKILL/.venv/bin/python" -I "$SKILL/scripts/facts_check.py" out/facts.json --root . --html out/deck.html | tail -1 \
    && "$SKILL/.venv/bin/python" -I "$SKILL/scripts/library_check.py" . | tail -1 \
    && "$SKILL/.venv/bin/python" -I "$SKILL/scripts/plan_check.py" . | sed -n 1p \
    && "$SKILL/.venv/bin/python" -I "$SKILL/scripts/brief_coverage.py" check . --map data/coverage.example.json | tail -1 | cut -d';' -f1 \
    && "$SKILL/.venv/bin/python" -I "$SKILL/scripts/variants.py" check | tail -1) \
    || { rm -rf "$ST"; echo "  самопроверка не пройдена"; exit 1; }
  zsh "$SKILL/scripts/publish_dir.sh" "$ST" "$SKILL/.selftest"
  echo "  PNG-превью: $SKILL/.selftest/src-demo/out/png"
  say "Галерея библиотеки компонентов"
  zsh "$SKILL/scripts/gallery.sh" | tail -3
  [ ${pipestatus[1]} = 0 ] || { echo "  галерея не пройдена: переполнения или ошибки аудита"; exit 1; }
  echo "  контакт-лист: $SKILL/components/.gallery/sheet.png"
fi
say "Диагностика"
zsh "$SKILL/scripts/doctor.sh" || true
