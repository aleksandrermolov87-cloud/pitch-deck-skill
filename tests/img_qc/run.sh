#!/bin/zsh
# Тест img_qc.py на синтетике (make.py) и демо-объектах заготовки, без сети.
#   zsh tests/img_qc/run.sh     код 1, если хоть одна проверка не прошла
SKILL="${0:A:h:h:h}"; PY="$SKILL/.venv/bin/python"; Q="$SKILL/scripts/img_qc.py"
T=$(mktemp -d "${TMPDIR:-/tmp}/pds-imgqc.XXXXXX"); trap 'rm -rf "$T"' EXIT
fail=0
ok()  { print -P "  %F{green}✓%f $1"; }
bad() { print -P "  %F{red}✗%f $1"; fail=1; }
# статус метрики из check --json: st <файл> <метрика>
st() { "$PY" -I "$Q" check "$1" --json | "$PY" -I -c "import json,sys; r=json.load(sys.stdin)[0]; print(next(x['status'] for x in r['rows'] if x['metric']==sys.argv[1]))" "$2"; }

"$PY" -I "$SKILL/tests/img_qc/make.py" "$T" || { echo "make.py не отработал"; exit 1; }

echo "› check"
[ "$(st "$T/red_sphere.png" palette)" = PASS ] && [ "$(st "$T/blue_sphere.png" palette)" = FAIL ] && [ "$(st "$T/blue_sphere.png" hue_off)" = FAIL ] \
  && ok "красный шар в палитре, синий — FAIL палитры и тона" || bad "палитра: красный $(st "$T/red_sphere.png" palette), синий $(st "$T/blue_sphere.png" palette)"
s=$(st "$T/fringe.png" halo); [ "$s" = WARN ] || [ "$s" = FAIL ] && [ "$(st "$T/red_sphere.png" halo)" = PASS ] \
  && ok "белая кайма вырезки: halo $s" || bad "halo: кайма $s, чистый $(st "$T/red_sphere.png" halo)"
[ "$(st "$T/text.png" text)" = WARN ] && [ "$(st "$T/red_sphere.png" text)" = PASS ] \
  && ok "надпись на объекте: text WARN (эвристика)" || bad "text: надпись $(st "$T/text.png" text)"
"$PY" -I "$Q" check "$T/red_sphere.png" >/dev/null && ! "$PY" -I "$Q" check "$T/blue_sphere.png" >/dev/null \
  && ok "код выхода: 0 без FAIL, 1 с FAIL" || bad "код выхода check"

echo "› rank"
"$PY" -I "$Q" rank "$T/obj_v1.png" "$T/obj_v2.png" "$T/obj_v3.png" --json > "$T/rank.json"
"$PY" -I -c "import json,sys; r=json.load(open(sys.argv[1])); sys.exit(0 if r['recommended'].endswith('obj_v2.png') and len(r['why'])==2 and all(w['loses_on'] for w in r['why']) else 1)" "$T/rank.json" \
  && ok "из кайма / чистый / мыло выбран чистый, причины названы" || bad "rank: $(head -c 300 "$T/rank.json")"

echo "› dupes"
"$PY" -I "$Q" dupes "$T/deck" > "$T/dupes.txt"; rc=$?
grep 'coin.png ~ globe.png' "$T/dupes.txt" | grep -qv PASS && ! grep -qE 'card.png ~ card_v2.png|card_v2.png ~ card.png' "$T/dupes.txt" \
  && ! grep -E 'card.*(coin|globe)' "$T/dupes.txt" | grep -qv PASS && [ $rc = 1 ] \
  && ok "одинаковый силуэт у двух сущностей найден, варианты _v2 не сравниваются" || bad "dupes: $(cat "$T/dupes.txt")"

echo "› cutout.py --qc"
"$PY" -I "$SKILL/scripts/cutout.py" "$T/white.jpg" --qc > "$T/cut.txt"; rc=$?
grep -q '^ok ' "$T/cut.txt" && grep -q 'palette' "$T/cut.txt" && [ $rc = 0 ] && ! "$PY" -I "$SKILL/scripts/cutout.py" "$T/white.jpg" --out "$T/w2.png" | grep -q palette \
  && ok "--qc печатает проверку, без флага — как раньше" || bad "cutout --qc: $(cat "$T/cut.txt")"

echo "› демо-объекты заготовки"
D="$SKILL/templates/deck-starter/img/3d"
"$PY" -I "$Q" check "$D"/*.png > "$T/demo.txt" && ! grep -q '^\(WARN\|FAIL\)' "$T/demo.txt" \
  && ok "все демо-объекты PASS" || bad "демо: $(grep -v '^  PASS' "$T/demo.txt")"
"$PY" -I "$Q" dupes "$D" | tail -1 | grep -q '^PASS' && ok "демо: похожих силуэтов нет" || bad "демо: dupes"

[ $fail = 0 ] && echo "ok: контроль качества картинок" || { echo "контроль качества картинок: есть ошибки"; exit 1; }
