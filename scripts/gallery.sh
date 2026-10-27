#!/bin/zsh
# Галерея библиотеки компонентов: по слайду на компонент в обеих темах + контакт-лист.
#   zsh gallery.sh                 → все группы: components/.gallery/{sheet.png, sheet-light.png}, PNG в src/out*/png
#   zsh gallery.sh market product  → только components/gallery-market.js и gallery-product.js в components/.gallery-market-product
# Базовые 19 компонентов — группа core (components/gallery.js). Собирается в цветах theme.json заготовки.
# Папки .gallery* локальные, в пакет не входят. Код выхода 1, если есть переполнения или ошибки аудита.
# Сборка идёт в частной папке $SKILL/.build/gallery.XXXXXX и в конце подменяет .gallery* (scripts/publish_dir.sh):
# параллельные запуски из разных сессий не стирают друг другу файлы.
set -e
SKILL="${0:A:h:h}"
for g in "$@"; do [[ "$g" =~ '^[a-z0-9]+$' ]] || { echo "группа: только a-z0-9 ($g)"; exit 1; }; done
if [ $# -gt 0 ]; then GROUPS=("$@"); G="$SKILL/components/.gallery-${(j:-:)GROUPS}"
else GROUPS=(core ${${(@f)$(ls "$SKILL/components" | sed -n 's/^gallery-\(.*\)\.js$/\1/p' | sort)}}); G="$SKILL/components/.gallery"; fi
mkdir -p "$SKILL/.build"; B=$(mktemp -d "$SKILL/.build/gallery.XXXXXX"); trap 'rm -rf "$B"' EXIT
(cd "$B" && zsh "$SKILL/scripts/new_deck.sh" src "Галерея компонентов" Галерея_компонентов >/dev/null)
REQ=""
for g in $GROUPS; do
  f=$([ "$g" = core ] && echo gallery.js || echo "gallery-$g.js")
  [ -f "$SKILL/components/$f" ] || { echo "нет components/$f"; exit 1; }
  cp "$SKILL/components/$f" "$B/src/$f"
  REQ="$REQ...require('./$f').S, "
done
echo "module.exports = { S: [$REQ] };" > "$B/src/slides.js"
# демо-экраны для компонентов с мокапами
[ -d "$SKILL/components/demo-screens" ] && mkdir -p "$B/src/img/screens" && cp "$SKILL/components/demo-screens/"*.png "$B/src/img/screens/" 2>/dev/null || true
cd "$B/src"
node build.js | tail -1
THEME=light node build.js | tail -1
R1=$(./render.sh | head -1); R2=$(OUT=out-light ./render.sh | head -1)
echo "тёмная: $R1"; echo "светлая: $R2"
"$SKILL/.venv/bin/python" -I - "$B/src" <<'PY'
import json, sys
from pathlib import Path
from PIL import Image, ImageDraw
root = Path(sys.argv[1])
names = [s['title'].split()[0] for s in json.load(open(root / 'out' / 'slides.json'))]
for out, name in (('out', 'sheet.png'), ('out-light', 'sheet-light.png')):
    pngs = sorted((root / out / 'png').glob('s*.png'), key=lambda p: int(p.stem[1:]))
    cols, tw, th, pad = 4, 480, 270, 14
    rows = (len(pngs) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * (tw + pad) + pad, rows * (th + pad + 24) + pad), (24, 24, 24) if out == 'out' else (236, 236, 236))
    d = ImageDraw.Draw(sheet)
    for i, p in enumerate(pngs):
        im = Image.open(p).convert('RGB').resize((tw, th))
        x, y = pad + (i % cols) * (tw + pad), pad + (i // cols) * (th + pad + 24)
        sheet.paste(im, (x, y + 24))
        d.text((x, y + 5), f'{i + 1}. {names[i] if i < len(names) else p.stem}', fill=(200, 200, 200) if out == 'out' else (60, 60, 60))
    sheet.save(root.parent / name)
PY
A1=$("$SKILL/.venv/bin/python" -I "$SKILL/scripts/pptx_audit.py" "$B/Галерея_компонентов.pptx" | tail -1)
A2=$("$SKILL/.venv/bin/python" -I "$SKILL/scripts/pptx_audit.py" "$B/Галерея_компонентов_светлая.pptx" | tail -1)
echo "$A1"; echo "$A2"
cd "$SKILL"; zsh "$SKILL/scripts/publish_dir.sh" "$B" "$G"
echo "ok $G/sheet.png"
case "$R1$R2" in *'"overflow":[]'*'"overflow":[]'*) ;; *) exit 1 ;; esac
case "$A1$A2" in *'ошибок 0'*'ошибок 0'*) ;; *) exit 1 ;; esac
