#!/bin/zsh
# Новый проект деки из заготовки: bash new_deck.sh <папка> "<Название деки>" [файл-имя]
# Пример: bash new_deck.sh src-инвесторы "Страховая платформа: раунд A" Платформа_раунд_A
set -e
SKILL="${0:A:h:h}"
DIR="$1"; TITLE="$2"; NAME="${3:-${TITLE// /_}}"
[ -n "$DIR" ] && [ -n "$TITLE" ] || { echo "usage: new_deck.sh <папка> \"<Название>\" [имя-файла]"; exit 1; }
# имя папки и файла: буквы, цифры, «_», «-», «.» — без кавычек, пробелов и путей наверх
case "$DIR" in .*|*/*|*\\*|*\'*|*\"*|*\`*|*\$*|*\ *|*\;*|*\&*|*\|*) echo "папка: без пробелов, кавычек, / и спецсимволов (получено: $DIR)"; exit 1 ;; esac
NAME="${NAME//[\/\\\'\"\`\$;&|<>]/_}"; NAME="${NAME#.}"
[ -e "$DIR" ] && { echo "$DIR уже существует, выберите другую папку"; exit 1; }
cp -R "$SKILL/templates/deck-starter" "$DIR"
mkdir -p "$DIR/img/3d" "$DIR/user-edits" "$DIR/out"
chmod +x "$DIR/render.sh"
node -e 'const fs=require("fs"),f=process.argv[1],d=JSON.parse(fs.readFileSync(f,"utf8"));d.title=process.argv[2];d.name=process.argv[3];fs.writeFileSync(f,JSON.stringify(d,null,2)+"\n")' "$DIR/deck.json" "$TITLE" "$NAME"
# pptxgenjs ставит setup.sh в папку скилла; проект ссылается на него
[ -d "$SKILL/node_modules/pptxgenjs" ] || zsh "$SKILL/scripts/setup.sh" >/dev/null
ln -s "$SKILL/node_modules" "$DIR/node_modules"
# шрифт бренда не установлен — проект собирается на запасном шрифте из config.json (и это видно в render.sh: font=false)
BF=$(zsh "$SKILL/scripts/jget.sh" "$DIR/theme.json" font.regular)
if ! zsh "$SKILL/scripts/doctor.sh" --font "$BF"; then
  FB=$(zsh "$SKILL/scripts/jget.sh" "$SKILL/config.json" font_fallback Arial)
  node -e 'const fs=require("fs"),f=process.argv[1],t=JSON.parse(fs.readFileSync(f,"utf8"));t.font.regular=process.argv[2];t.font.thin=process.argv[2];fs.writeFileSync(f,JSON.stringify(t,null,2)+"\n")' "$DIR/theme.json" "$FB"
  echo "шрифт «$BF» не установлен: проект собирается на «$FB». Поставьте шрифт бренда и верните его в theme.json"
fi
(cd "$DIR" && "$SKILL/.venv/bin/python" -I bg.py >/dev/null && node build.js | tail -1)
# impeccable: интервал 1,2 только у однострочных подписей в фиксированных боксах (многострочные build.js поднимает до 1,1).
# Исключение с причиной ставится для обеих тем новой деки; если impeccable не установлен — пропускаем.
if zsh "$SKILL/scripts/impeccable.sh" --where >/dev/null 2>&1; then
  for f in "$DIR/out/deck.html" "$DIR/out-light/deck.html"; do
    zsh "$SKILL/scripts/impeccable.sh" hooks ignore-value tight-leading "*" --file "$f" \
      --reason "Claude: line-height 1.2 only on single-line slide labels in fixed PPTX boxes; multi-line boxes are raised to 1.32 by build.js" >/dev/null 2>&1 || true
  done
fi
cat > "$DIR/README.md" <<EOF
# $TITLE

Пересборка после правки данных (из папки проекта):

1. \`$SKILL/.venv/bin/python -I bg.py\` — фоны, если менялись свечения или палитра
2. \`node build.js\` и \`THEME=light node build.js\` — PPTX и HTML-двойник
3. \`./render.sh\` и \`OUT=out-light ./render.sh\` — PNG и замер переполнений (\`SCALE=2\` — 4K)
4. \`zsh $SKILL/scripts/impeccable.sh detect out/deck.html\`
5. \`$SKILL/.venv/bin/python -I $SKILL/scripts/pptx_audit.py ../$NAME.pptx\`
6. \`$SKILL/.venv/bin/python -I $SKILL/scripts/facts_check.py out/facts.json --root . [--xlsx <модель.xlsx>]\`
7. \`$SKILL/.venv/bin/python -I $SKILL/scripts/library_check.py .\` — тело каждого слайда из библиотеки или причина custom

8. \`$SKILL/.venv/bin/python -I $SKILL/scripts/brief_coverage.py check .\` — всё ли из брифа видно на слайдах (requirements.json, reference/15-brief-coverage.md)

Быстрая правка текста: \`copy_edit.py list . --slide N\`, затем \`copy_edit.py apply . --edits '[…]'\`,
\`ONLY=N node build.js && SLIDE='N' ./render.sh\` (reference/13-quick-copy-edit.md).
Быстрая правка подложки: \`bg_edit.py show . --slide N\`, затем \`bg_edit.py apply . --slide N --do stripes-softer,glow-off\`
(пересоберёт подложку и слайд, «было → стало» в out/review/).
EOF
echo "ok: $DIR (пример из 6 слайдов на компонентах библиотеки собран; замените data/, requirements.json и slides.js)"
