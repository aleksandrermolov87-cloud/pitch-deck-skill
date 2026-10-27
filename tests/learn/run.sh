#!/bin/zsh
# Тест обучения на оценках (scripts/learn.py, reference/07-learning.md) на вымышленных оценках и выборах во временной PITCH_LEARN_DIR.
#   zsh tests/learn/run.sh [папка]   по умолчанию $SKILL/.acceptance/learn-<время>; существующая папка — ошибка
# Критерии: 1) апостериорное Beta(1,1): среднее и интервал 80% сходятся с точной формулой; 2) правило по P(доля > 0,5) ≥ 0,8,
# а не по счёту: 2 плохих из 10 — не правило, 3 из 3 — правило; 3) record пишет lib и версию навыка; 4) без prefs.json
# счёт variants.py тот же, что до обучения, с prefs.json — плюс W·(mean−0,5)·n/(n+5) и строка «по вашим оценкам»;
# 5) pick пишет learnings/picks.jsonl и пересобирает prefs.json. learnings/ пользователя не трогаются.
set -e
SKILL="${0:A:h:h:h}"; PY="$SKILL/.venv/bin/python"
OUT="${1:-$SKILL/.acceptance/learn-$(date +%Y%m%d-%H%M%S)-$$}"
[ -e "$OUT" ] && { echo "папка уже есть, не перезаписываю: $OUT"; exit 1; }
mkdir -p "$OUT"; cd "$OUT"
fail=0
ok()  { print -P "  %F{green}✓%f $1"; }
bad() { print -P "  %F{red}✗%f $1"; fail=1; }
REAL=$(cat "$SKILL/learnings/ratings.jsonl" 2>/dev/null | shasum | cut -d' ' -f1)

echo "› оценки и выборы → prefs.json и LESSONS.md"
export PITCH_LEARN_DIR="$OUT/L"; mkdir -p L
"$PY" -I - L <<'PY'
import json, sys
L = sys.argv[1]
R = []
def r(arch, verdict, lib, reasons=(), slide=0):
    R.append({'date': '2026-10-01', 'deck': 'Тест', 'src': '/x', 'slide': slide or len(R) + 1, 'fn': 'f', 'archetype': arch,
              'title': f'слайд {len(R) + 1}', 'verdict': verdict, 'reasons': list(reasons), 'comment': '',
              'png': f'{L}/gallery/{verdict}/s{len(R) + 1}.png', 'lib': lib})
for i in range(10):   # 2 плохих из 10 по композиции: раньше правило (счёт ≥ 2), теперь нет
    r('arch-a', 'bad' if i < 2 else 'good', ['rankingList'], ['композиция'] if i < 2 else [])
for i in range(3):    # 3 плохих из 3 по тексту — правило
    r('arch-b', 'bad', ['kpiList'], ['текст'])
r('arch-c', 'bad', [], ['данные'])   # 1 из 1 — не правило; без lib — только архетип
open(f'{L}/ratings.jsonl', 'w').write(''.join(json.dumps(x, ensure_ascii=False) + '\n' for x in R))
P = [{'src': '/d', 'run': 'r1', 'slide': 4, 'chosen': 'barsTrend', 'shown': ['barsTrend', 'lineChart', 'kpiHero']},
     {'src': '/d', 'run': 'r1', 'slide': 4, 'chosen': 'lineChart', 'shown': ['barsTrend', 'lineChart', 'kpiHero']},   # передумал: верен этот
     {'src': '/d', 'run': 'r1', 'slide': 5, 'chosen': 'barsTrend', 'shown': ['barsTrend', 'lineChart']}]
open(f'{L}/picks.jsonl', 'w').write(''.join(json.dumps(x) + '\n' for x in P))
PY
H=$(shasum L/ratings.jsonl | cut -d' ' -f1)
"$PY" -I "$SKILL/scripts/learn.py" digest > digest.txt && cp L/prefs.json prefs1.json && "$PY" -I "$SKILL/scripts/learn.py" digest >/dev/null
cmp -s L/prefs.json prefs1.json && ok "повторный digest даёт тот же prefs.json (фиксированное зерно)" || bad "prefs.json меняется от запуска к запуску"
[ "$(shasum L/ratings.jsonl | cut -d' ' -f1)" = "$H" ] && ok "digest не меняет ratings.jsonl" || bad "digest изменил ratings.jsonl"

"$PY" -I - L <<'PY' && ok "критерии 1–2: апостериорное Beta(1,1) и порог правила" || bad "критерии 1–2"
import json, sys
import numpy as np
L = sys.argv[1]
P = json.load(open(f'{L}/prefs.json'))
md = open(f'{L}/LESSONS.md').read()
err = []
def q(a, b, p):   # квантиль Beta(a, b) численным интегрированием на сетке — независимо от выборки в learn.py
    x = np.linspace(0, 1, 200001)[1:-1]
    pdf = np.exp((a - 1) * np.log(x) + (b - 1) * np.log1p(-x))
    cdf = np.cumsum(pdf); cdf /= cdf[-1]
    return float(np.interp(p, cdf, x))
want = {'rankingList': (8, 2, 0, 0), 'kpiList': (0, 3, 0, 0), 'barsTrend': (0, 0, 1, 1), 'lineChart': (0, 0, 1, 1), 'kpiHero': (0, 0, 0, 1)}
for c, (g, b, pk, rj) in want.items():
    p = P['components'].get(c)
    if not p:
        err.append(f'{c}: нет в prefs.json'); continue
    if (p['good'], p['bad'], p['picks'], p['rejects']) != (g, b, pk, rj):
        err.append(f'{c}: счёт {p["good"], p["bad"], p["picks"], p["rejects"]}, ждали {g, b, pk, rj}')
    A, B = 1 + g + pk, 1 + b + 0.5 * rj
    lo, hi = q(A, B, 0.1), q(A, B, 0.9)
    if abs(p['mean'] - A / (A + B)) > 1e-3 or abs(p['lo'] - lo) > 0.01 or abs(p['hi'] - hi) > 0.01 or abs(p['n'] - (A + B - 2)) > 1e-9:
        err.append(f'{c}: {p["mean"]} [{p["lo"]}–{p["hi"]}], ждали {A / (A + B):.3f} [{lo:.3f}–{hi:.3f}]')
    print(f'    {c}: Beta({A:g}, {B:g}) → {p["mean"]} [{p["lo"]}–{p["hi"]}]')
# Beta(1, 4): квантили в замкнутом виде 1 − (1 − q)^(1/4); P(доля > 0,5) = 0,5^4
k = P['components']['kpiList']
if abs(k['lo'] - (1 - 0.9 ** 0.25)) > 0.01 or abs(k['hi'] - (1 - 0.1 ** 0.25)) > 0.01 or abs(k['p_hi'] - 0.5 ** 4) > 0.01:
    err.append(f'kpiList: Beta(1,4) не сходится с формулой: {k}')
rules = md.split('## Кандидаты в правила')[1] if '## Кандидаты в правила' in md else ''
if '**arch-b**, «текст»: 3 из 3' not in rules:
    err.append('3 плохих из 3 не стали правилом')
if 'arch-a' in rules:
    err.append('2 плохих из 10 стали правилом (порог по счёту, а не по вероятности)')
if 'arch-c' in rules:
    err.append('1 плохой из 1 стал правилом')
if 'Компонент **kpiList**' not in rules:
    err.append('компонент с 0 из 3 хороших не попал в кандидаты')
work = md.split('## Что работает у вас')[1].split('\n## ')[0]
if '| rankingList |' not in work or '| kpiList |' not in work or 'barsTrend' in work or 'kpiHero' in work:
    err.append('таблица «Что работает у вас»: нужны только компоненты с n ≥ 2')
if work.find('rankingList') > work.find('kpiList'):
    err.append('таблица не отсортирована по доле хороших')
if P['archetypes'].get('arch-c', {}).get('n') != 1 or 'arch-c' in str(P['components']):
    err.append('оценка без lib должна идти только в архетип')
for e in err:
    print('    ✗', e)
sys.exit(1 if err else 0)
PY

echo "› record: компоненты слайда и версия навыка"
mkdir -p deck/out
cat > deck/deck.json <<'J'
{"name": "Тест_обучения"}
J
printf 'function one() {\n  return 1;\n}\n' > deck/slides.js
cat > deck/out/slides.json <<'J'
[{"n": 1, "fn": "one", "archetype": "bars-trend", "title": "Рост", "lib": ["barsTrend"], "hidden": false}]
J
"$PY" -I "$SKILL/scripts/learn.py" record deck --ratings '{"1":{"verdict":"good"}}' > record.txt
"$PY" -I - L "$(cat "$SKILL/VERSION")" <<'PY' && ok "критерий 3: в ratings.jsonl есть lib и skill" || bad "критерий 3: нет lib или skill"
import json, sys
r = json.loads(open(f'{sys.argv[1]}/ratings.jsonl').read().splitlines()[-1])
p = json.load(open(f'{sys.argv[1]}/prefs.json'))['components']['barsTrend']
print(f'    lib={r.get("lib")} skill={r.get("skill")}; barsTrend: хорошо {p["good"]}, выбран {p["picks"]}')
sys.exit(0 if r.get('lib') == ['barsTrend'] and r.get('skill') == sys.argv[2] and p['good'] == 1 else 1)
PY

echo "› variants.py: поправка по оценкам"
zsh "$SKILL/scripts/new_deck.sh" src "Варианты" Варианты >/dev/null
CONTENT="$SKILL/tests/variants/content.json"
mkdir -p E; PITCH_LEARN_DIR="$OUT/E" "$PY" -I "$SKILL/scripts/variants.py" suggest src --content "$CONTENT" --json > s0.json
"$PY" -I - "$SKILL/components/fields.json" s0.json <<'PY' && ok "критерий 4а: без prefs.json счёт равен формуле до обучения" || bad "критерий 4а: счёт без prefs.json изменился"
import json, re, sys
F = json.load(open(sys.argv[1]))
txt = open(sys.argv[2]).read()
rec = json.loads(txt[txt.index('{'):txt.rindex('\n}') + 2])
err = n = 0
for s in rec['slides']:
    for t in s.get('candidates', []):
        cm, mean = F[t['component']]['meaning'], s['meaning']
        base = 3 * (mean[0] in cm) + (mean[0] == cm[0]) + 2 * len(set(mean) & set(cm)) / len(mean) + (0.5 if t['current'] else 0)
        base -= 1.0 * sum(1 for m in t['missing'] if m['key']) + 0.3 * sum('знаков, в галерее проверено' in w for w in t['warn'])
        n += 1
        if t['score'] != round(base, 2) or t['pref'] != 0:
            err += 1
            print(f'    ✗ слайд {s["n"]} {t["component"]}: {t["score"]} ≠ {round(base, 2)} (pref {t["pref"]})')
print(f'    кандидатов {n}, расхождений {err}')
sys.exit(1 if err or not n else 0)
PY
# prefs.json с компонентами не из этого подбора — счёт тот же; с компонентом из подбора — сдвиг на W·(mean−0,5)·n/(n+5)
"$PY" -I - s0.json <<'PY'
import json, os
txt = open('s0.json').read()
rec = json.loads(txt[txt.index('{'):txt.rindex('\n}') + 2])
s = next(x for x in rec['slides'] if len(x.get('candidates', [])) >= 2)
c = s['candidates'][-1]['component']
os.makedirs('O', exist_ok=True); os.makedirs('P', exist_ok=True)
json.dump({'components': {'нет-такого': {'n': 30, 'mean': 0.95}}}, open('O/prefs.json', 'w'))
json.dump({'components': {c: {'n': 20, 'mean': 0.95}}}, open('P/prefs.json', 'w'))
open('boost.txt', 'w').write(f'{s["n"]} {c}')
PY
PITCH_LEARN_DIR="$OUT/O" "$PY" -I "$SKILL/scripts/variants.py" suggest src --content "$CONTENT" --json > s1.json
PITCH_LEARN_DIR="$OUT/P" "$PY" -I "$SKILL/scripts/variants.py" suggest src --content "$CONTENT" > s2.txt
"$PY" -I - <<'PY' && ok "критерий 4б: поправка W·(mean−0,5)·n/(n+5) и «по вашим оценкам» в таблице" || bad "критерий 4б"
import glob, json, os
def load(f):
    t = open(f).read(); return json.loads(t[t.index('{'):t.rindex('\n}') + 2])
def scores(rec):
    return {(s['n'], t['component']): t['score'] for s in rec['slides'] for t in s.get('candidates', [])}
s0, s1 = load('s0.json'), load('s1.json')
n, c = open('boost.txt').read().split()
run = max(glob.glob('src/out/variants/*/suggest.json'), key=os.path.getmtime)
s2 = json.load(open(run))
md = open(os.path.join(os.path.dirname(run), 'suggest.md')).read()
err = []
if scores(s0) != scores(s1):
    err.append('prefs.json без компонентов подбора изменил счёт')
all2 = {(s['n'], t['component']): t for s in s2['slides'] for t in s.get('candidates', [])}
t = all2.get((int(n), c))
want = round(1.5 * 0.45 * 20 / 25, 2)
b0 = scores(s0)
if not t or t['pref'] != want or abs(t['score'] - round(b0[(int(n), c)] + 1.5 * 0.45 * 20 / 25, 2)) > 0.011:
    err.append(f'слайд {n} {c}: pref {t and t["pref"]}, ждали {want}')
if f'{c} · по вашим оценкам: +0,5' not in md and f'{c} (сейчас) · по вашим оценкам: +0,5' not in md:
    err.append('в suggest.md нет «по вашим оценкам: +0,5»')
print(f'    слайд {n}: {c} +{want} → {t and t["score"]}')
for e in err:
    print('    ✗', e)
raise SystemExit(1 if err else 0)
PY

echo "› pick → learnings/picks.jsonl → prefs.json"
mkdir -p K; RUN=$(basename "$(dirname "$(ls -t src/out/variants/*/suggest.json | head -1)")")
PITCH_LEARN_DIR="$OUT/K" "$PY" -I "$SKILL/scripts/variants.py" pick src --run "$RUN" --slide 3 --variant B --why тест > pick.txt
"$PY" -I - K "src/out/variants/$RUN/suggest.json" <<'PY' && ok "критерий 5: выбор в picks.jsonl, выбранный и отказы в prefs.json" || bad "критерий 5"
import json, sys
p = [json.loads(l) for l in open(f'{sys.argv[1]}/picks.jsonl')]
s = next(x for x in json.load(open(sys.argv[2]))['slides'] if x['n'] == 3)
B = next(t['component'] for t in s['candidates'] if t['id'] == 'B')
shown = [t['component'] for t in s['candidates']]
P = json.load(open(f'{sys.argv[1]}/prefs.json'))['components']
ok = len(p) == 1 and p[0]['chosen'] == B and p[0]['shown'] == shown and p[0]['slide'] == 3 and p[0]['deck'] and p[0]['date'] \
     and P[B]['picks'] == 1 and all(P[c]['rejects'] == 1 for c in shown if c != B)
print(f'    выбран {B} из {", ".join(shown)}; prefs: ' + ', '.join(f'{c} {P[c]["mean"]}' for c in shown))
sys.exit(0 if ok else 1)
PY

[ "$(cat "$SKILL/learnings/ratings.jsonl" 2>/dev/null | shasum | cut -d' ' -f1)" = "$REAL" ] && ok "learnings/ пользователя не тронуты" || bad "изменился learnings/ratings.jsonl пользователя"
echo
[ $fail = 0 ] && echo "тест пройден: $OUT" || echo "тест НЕ пройден: $OUT"
exit $fail
