#!/bin/zsh
# Приёмочный тест подбора вариантов (scripts/variants.py, reference/18-variants.md) на вымышленном содержании content.json.
#   zsh tests/variants/run.sh [папка]   по умолчанию $SKILL/.acceptance/variants-<время>; существующая папка — ошибка
# Критерии: 1) сравнение, процесс и рейтинг получают по 2+ пригодных варианта; 2) journeyMap без настроения не предлагается
# как заполненный, treemap без целого исключён с причиной; 3) показ собирает обе темы без ошибок компонентов;
# 4) выбор пишется в data/variants.json; 5) повторный показ идёт в новую папку, прошлый не меняется.
set -e
SKILL="${0:A:h:h:h}"; FIX="${0:A:h}"; PY="$SKILL/.venv/bin/python"
OUT="${1:-$SKILL/.acceptance/variants-$(date +%Y%m%d-%H%M%S)-$$}"
[ -e "$OUT" ] && { echo "папка уже есть, не перезаписываю: $OUT"; exit 1; }
mkdir -p "$OUT"; cd "$OUT"
export PITCH_LEARN_DIR="$OUT/learn"   # выборы теста не идут в learnings/ пользователя, его prefs.json не меняют счёт
fail=0
ok()  { print -P "  %F{green}✓%f $1"; }
bad() { print -P "  %F{red}✗%f $1"; fail=1; }

echo "› проект и подбор"
zsh "$SKILL/scripts/new_deck.sh" src "Варианты" Варианты >/dev/null
"$PY" -I "$SKILL/scripts/variants.py" suggest src --content "$FIX/content.json" > suggest.txt
RUN=$(sed -n 's/^прогон \([0-9-]*\):.*/\1/p' suggest.txt | tail -1)
[ -n "$RUN" ] && ok "прогон $RUN" || { bad "suggest не создал прогон"; cat suggest.txt; exit 1; }
"$PY" -I - "src/out/variants/$RUN/suggest.json" <<'PY' && ok "критерии 1–2: варианты и исключения" || bad "критерии 1–2"
import json, sys
r = {s['n']: s for s in json.load(open(sys.argv[1]))['slides']}
err = []
for n, what in ((1, 'сравнение'), (2, 'процесс'), (3, 'рейтинг')):
    c = r[n]['candidates']
    print(f'    {what}: ' + ', '.join(f'{t["id"]}={t["component"]} ({t["status"]})' for t in c))
    if len(c) < 2:
        err.append(f'{what}: вариантов {len(c)}')
jm = [t for t in r[2]['candidates'] if t['component'] == 'journeyMap']
if jm and (jm[0]['status'] != 'частично' or not any(m['path'] == 'stages[].mood' for m in jm[0]['missing'])):
    err.append('journeyMap предложен как заполненный')
if not jm and not any(e['component'] == 'journeyMap' for e in r[2]['excluded']):
    err.append('journeyMap ни в кандидатах, ни в исключённых')
print('    journeyMap: ' + (f'{jm[0]["status"]}, нет mood' if jm else next(e['why'] for e in r[2]['excluded'] if e['component'] == 'journeyMap')))
if not any(e['component'] == 'treemap' and 'целое' in e['why'] for e in r[3]['excluded']):
    err.append('treemap без целого не исключён')
for e in err:
    print('    ✗', e)
sys.exit(1 if err else 0)
PY

echo "› показ в обеих темах"
"$PY" -I "$SKILL/scripts/variants.py" demo src --run "$RUN" > demo.txt || { bad "demo упал"; cat demo.txt; }
D="src/out/variants/$RUN"
for n in 1 2 3; do [ -f "$D/sheet-s$n.png" ] && ok "лист вариантов слайда $n" || bad "нет $D/sheet-s$n.png"; done
[ -f "$D/Варианты.pptx" ] && [ -f "$D/Варианты_светлая.pptx" ] && ok "PPTX вариантов в обеих темах" || bad "нет PPTX вариантов"
"$PY" -I - "$D/demo.json" <<'PY' && ok "критерий 3: компоненты собрались без ошибок" || bad "критерий 3: ошибки компонентов"
import json, sys
d = json.load(open(sys.argv[1]))
v = [x for s in d['slides'].values() for x in s.values()]
for x in v:
    if x['error'] or x['overflow']:
        print(f'    {x["component"]}: {x["state"]}')
sys.exit(1 if any(x['error'] for x in v) else 0)
PY

echo "› выбор и повтор"
"$PY" -I "$SKILL/scripts/variants.py" pick src --run "$RUN" --slide 3 --variant B --why "тест" > pick.txt
grep -q '"3"' src/data/variants.json && ok "критерий 4: выбор в data/variants.json" || bad "критерий 4: выбора нет"
H=$(shasum "$D/demo.json" | cut -d' ' -f1)
"$PY" -I "$SKILL/scripts/variants.py" demo src --run "$RUN" --slides 3 > demo2.txt
R2=$(sed -n 's/^прогон \([0-9-]*\):.*/\1/p' demo2.txt | tail -1)
[ -n "$R2" ] && [ "$R2" != "$RUN" ] && [ "$(shasum "$D/demo.json" | cut -d' ' -f1)" = "$H" ] && grep -q "\"repeat_of\": \"$RUN\"" "src/out/variants/$R2/suggest.json" \
  && ok "критерий 5: повтор в $R2, прошлый показ не изменён" || bad "критерий 5: повтор перезаписал прошлый показ"

echo
[ $fail = 0 ] && echo "приёмка пройдена: $OUT" || echo "приёмка НЕ пройдена: $OUT"
exit $fail
