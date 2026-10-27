#!/bin/zsh
# Тест двух провайдеров 3D без сети: prompt3d.py --provider, cutout.py на готовой альфе, visuals.py choose/import/fetch/record/list.
#   zsh tests/visuals/run.sh     код 1, если хоть одна проверка не прошла
SKILL="${0:A:h:h:h}"; PY="$SKILL/.venv/bin/python"
T=$(mktemp -d "${TMPDIR:-/tmp}/pds-visuals.XXXXXX"); trap 'rm -rf "$T"' EXIT
fail=0
ok()  { print -P "  %F{green}✓%f $1"; }
bad() { print -P "  %F{red}✗%f $1"; fail=1; }
V() { "$PY" -I "$SKILL/scripts/visuals.py" "$@" >"$T/last" 2>&1; }
yes() { if V "${@:2}"; then ok "$1"; else bad "$1: $(tail -1 "$T/last")"; fi; }
no()  { if V "${@:2}"; then bad "$1: принято"; else ok "$1"; fi; }

export CODEX_HOME="$T/codex"; G="$CODEX_HOME/generated_images/s1"; P="$T/proj"
mkdir -p "$G" "$P/data" "$P/img/3d"
cp "$SKILL/templates/deck-starter/data/objects3d.json" "$P/data/"
"$PY" -I -c "
from PIL import Image, ImageDraw
im = Image.new('RGBA', (400, 400), (0, 0, 0, 0)); ImageDraw.Draw(im).ellipse((100, 120, 300, 320), fill=(239, 49, 36, 255)); im.save('$G/ig.png')
im = Image.new('RGB', (400, 400), (255, 255, 255)); ImageDraw.Draw(im).rectangle((120, 100, 280, 300), fill=(20, 20, 20)); im.save('$T/white.jpg')"

echo "› prompt3d.py"
"$PY" -I "$SKILL/scripts/prompt3d.py" "$P/data/objects3d.json" --theme "$SKILL/templates/deck-starter/theme.json" --provider codex-imagegen --out "$T/codex.json" >/dev/null
"$PY" -I "$SKILL/scripts/prompt3d.py" "$P/data/objects3d.json" --theme "$SKILL/templates/deck-starter/theme.json" --out "$T/mp.json" >/dev/null
node -e 'const c=require(process.argv[1]),m=require(process.argv[2]);process.exit(c.calls.length===m.batches.flatMap(b=>b.images).length&&c.calls.every(x=>/Transparent background/.test(x.prompt)&&x.size)&&m.batches.every(b=>b.images.length<=5)?0:1)' "$T/codex.json" "$T/mp.json" \
  && ok "Codex: один вызов на картинку, прозрачный фон; MagicPatterns: пачки до 5" || bad "формат промптов"

echo "› cutout.py"
"$PY" -I "$SKILL/scripts/cutout.py" "$G/ig.png" --out "$T/ig_cut.png" >/dev/null && "$PY" -I "$SKILL/scripts/cutout.py" "$T/white.jpg" >/dev/null
node -e 'const a=require(process.argv[1]),b=require(process.argv[2]);process.exit(a.fill>0.6&&a.fill<0.75&&b.fill>0.7?0:1)' "$T/ig_cut.json" "$T/white.json" \
  && ok "готовая альфа сохранена, белый фон вырезан" || bad "cutout: fill $(cat "$T/ig_cut.json") / $(cat "$T/white.json")"

echo "› visuals.py"
no  "без выбора пользователя картинка не принимается" import "$P" --file "$G/ig.png" --name obj --slide 1
yes "выбор записан" choose "$P" --provider codex-imagegen --quota "тест"
no  "файл не из папки Codex отклонён" import "$P" --file "$T/white.jpg" --name obj --slide 1
no  "имя с путём отклонено" import "$P" --file "$G/ig.png" --name '../obj' --slide 1
yes "картинка image_gen перенесена" import "$P" --file "$G/ig.png" --name cover_platform_v1 --slide 1 --payload "$T/codex.json"
no  "MagicPatterns при выборе Codex отклонён до скачивания" fetch "$P" --url https://cdn.magicpatterns.com/x.jpg --name y --slide 2
no  "чужой адрес отклонён" fetch "$P" --url https://example.com/cdn.magicpatterns.com/x.jpg --name y --slide 2
no  "record вне проекта отклонён" record "$P" --file img/3d/../../../white.jpg --slide 3
cp "$T/white.jpg" "$P/img/3d/stray.jpg"
V list "$P"; grep -q 'cover_platform_v1.png | 1 | codex-imagegen | image_gen' "$T/last" && grep -q 'stray.jpg: происхождение не записано' "$T/last" \
  && ok "list: провайдер по слайдам и файл без записи" || bad "list: $(cat "$T/last")"
node -e 'const v=require(process.argv[1]);process.exit(v.provider_choice.chosen_by_user&&/^[0-9a-f]{64}$/.test(v.images[0].prompt_sha)&&v.images[0].data_sent==="generalized"?0:1)' "$P/data/visuals.json" \
  && ok "в записи хэш промпта, а не текст" || bad "запись visuals.json"

[ $fail = 0 ] && echo "ok: провайдеры 3D" || { echo "провайдеры 3D: есть ошибки"; exit 1; }
