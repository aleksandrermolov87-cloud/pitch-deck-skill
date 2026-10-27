#!/bin/zsh
# Оценка качества деки (scripts/eval_deck.py) на синтетических артефактах: веса, неизмеренные метрики, итог, журнал, тренд, gate.
#   zsh tests/eval/run.sh     код 1, если хоть одна проверка не прошла
SKILL="${0:A:h:h:h}"; PY="$SKILL/.venv/bin/python"; EV="$SKILL/scripts/eval_deck.py"
T=$(mktemp -d "${TMPDIR:-/tmp}/pds-eval.XXXXXX"); trap 'rm -rf "$T"' EXIT
fail=0
ok()  { print -P "  %F{green}✓%f $1"; }
bad() { print -P "  %F{red}✗%f $1"; fail=1; }
chk() { "$PY" -I - "$@" 2>&1; }      # проверка на Python: код 0 — пройдена, иначе печатает причину

# ── синтетическая дека без PPTX: 3 слайда, 2 факта, 1 переполнение, 2 картинки (одна без записи), план выполнен ──
S="$T/src"; mkdir -p "$S/out" "$S/data" "$S/img/3d"
cat > "$S/deck.json" <<'J'
{"name": "Синт", "plan": {"topic": "Тест оценки", "slides": 3, "3d": true}}
J
cat > "$S/out/slides.json" <<'J'
[{"n": 1, "archetype": "cover", "title": "Обложка", "lib": [], "texts": [{"id": "s1-title", "runs": ["Обложка"]}]},
 {"n": 2, "archetype": "bars-trend", "title": "Сборы выросли вдвое", "lib": ["barsTrend"],
  "texts": [{"id": "s2-title", "runs": ["Сборы выросли вдвое"]}, {"id": "s2-src", "runs": ["Источник: длинная строка источника не считается"]},
            {"id": null, "runs": ["2 / 3"]}, {"id": null, "lib": "barsTrend", "runs": ["2023 2024 рост"]}]},
 {"n": 3, "archetype": "text-next-steps", "title": "Что мы предлагаем сделать комитету в следующем квартале по всем трём направлениям", "lib": ["nextStepsText"],
  "texts": [{"id": "s3-title", "runs": ["Что предлагаем"]}]}]
J
cat > "$S/out/facts.json" <<'J'
[{"slide": 2, "label": "сборы 2024", "value": 2, "type": "user", "quote": "2", "shown": true, "shown_as": "label"},
 {"slide": 2, "label": "сборы 2023", "value": 1, "type": "user", "quote": "1", "shown": true, "shown_as": "value"}]
J
echo '{"slides": 3, "font": true, "overflow": ["s2-x"]}' > "$S/out/render.json"
touch "$S/img/3d/a.png" "$S/img/3d/b.png" "$S/img/3d/a_check.png" "$S/img/3d/a.json"
echo '{"provider_choice": {"provider": "magicpatterns", "chosen_by_user": true}, "images": [{"file": "img/3d/a.jpg", "slide": 1, "provider": "magicpatterns"}]}' > "$S/data/visuals.json"

echo "› веса"
chk "$SKILL/scripts" <<'PY' && ok "веса в сумме 1.0, у каждой метрики имя и формула" || bad "веса"
import sys; sys.path.insert(0, sys.argv[1]); import eval_deck as E
assert abs(sum(E.WEIGHTS.values()) - 1) < 1e-9, sum(E.WEIGHTS.values())
assert set(E.WEIGHTS) == set(E.NAMES) == set(E.FORMULAS), 'ключи WEIGHTS / NAMES / FORMULAS'
assert all(w > 0 for w in E.WEIGHTS.values())
PY

echo "› score: значения и неизмеренные метрики"
"$PY" -I "$EV" score "$S" --log --evals "$T/evals.jsonl" > "$T/score.txt" 2>&1 && ok "score: код 0" || { bad "score упал"; cat "$T/score.txt"; }
chk "$S/out/eval.json" "$SKILL/scripts" <<'PY' && ok "метрики по формулам: факты 1 / 0,5; переполнения 2/3; заголовки 2/3; 3D 1/2; план 1" || bad "значения метрик"
import json, sys; sys.path.insert(0, sys.argv[2]); import eval_deck as E
e = json.load(open(sys.argv[1])); m = e['metrics']
want = {'facts_match': 1.0, 'facts_labeled': 0.5, 'overflow': 0.6667, 'titles': 0.6667, 'provenance': 0.5, 'plan': 1.0, 'library': 1.0, 'words': 1.0}
bad = {k: (m.get(k), v) for k, v in want.items() if m.get(k) is None or abs(m[k] - v) > 1e-3}
assert not bad, bad
PY
chk "$S/out/eval.json" "$SKILL/scripts" <<'PY' && ok "без PPTX: audit, coverage, smart, no_block, visual_density — «не измерялось», null, а не 0 или 1" || bad "неизмеренные метрики"
import json, sys
e = json.load(open(sys.argv[1])); m = e['metrics']
miss = {'audit', 'coverage', 'smart', 'no_block', 'visual_density'}
assert all(m[k] is None for k in miss), {k: m[k] for k in miss}
assert set(e['not_measured']) == miss, e['not_measured']
assert all(e['details'][k].get('missing') for k in miss)
PY
for k in audit coverage smart no_block visual_density; do
  grep -q "(\`$k\`): " "$S/out/eval.md" || bad "eval.md: $k нет в разделе «Не измерялось»"
done
grep -q '### Не измерялось' "$S/out/eval.md" && ok "eval.md: раздел «Не измерялось» с причинами" || bad "eval.md без раздела «Не измерялось»"
chk "$S/out/eval.json" "$SKILL/scripts" <<'PY' && ok "итог = взвешенное среднее только по измеренным; одна метрика 0,5 → итог 0,5" || bad "итог"
import json, sys; sys.path.insert(0, sys.argv[2]); import eval_deck as E
e = json.load(open(sys.argv[1])); m = e['metrics']
used = {k: w for k, w in E.WEIGHTS.items() if m[k] is not None}
want = sum(m[k] * w for k, w in used.items()) / sum(used.values())
assert abs(e['score'] - want) < 1e-3, (e['score'], want)
only = {k: None for k in E.WEIGHTS}; only['coverage'] = 0.5
assert E.overall(only)[0] == 0.5, E.overall(only)
assert E.overall({k: None for k in E.WEIGHTS})[0] is None
PY

echo "› gate"
G() { "$PY" -I "$EV" gate "$S/out/eval.json" --baseline "$T/base.json" "$@" > "$T/gate.txt" 2>&1; }
base() { chk "$S/out/eval.json" "$T/base.json" "$1" <<'PY'
import json, sys
e = json.load(open(sys.argv[1])); e['metrics'].update(json.loads(sys.argv[3]))
json.dump(e, open(sys.argv[2], 'w'))
PY
}
base '{}'; G && ok "эталон = текущая оценка: регрессий нет" || { bad "gate против себя"; cat "$T/gate.txt"; }
base '{"overflow": 0.7}'; G && bad "падение overflow 0,70 → 0,67 пропущено" || { grep -q '^  - overflow: 0.7000 → 0.6667' "$T/gate.txt" && ok "падение overflow больше допуска: код 1, метрика названа" || { bad "gate: нет строки про overflow"; cat "$T/gate.txt"; }; }
base '{"overflow": 0.7}'; G --tol 0.05 && ok "то же падение в пределах --tol 0.05 — пропущено" || bad "--tol не работает"
base '{"overflow": 0.6}'; G && ok "рост метрики не регрессия" || bad "рост метрики назван регрессией"
base '{"audit": 0.9}'; G && bad "пропавшая метрика пропущена" || { grep -q 'audit: в эталоне 0.9000, сейчас не измерялось' "$T/gate.txt" && ok "метрика есть в эталоне, а сейчас не измерялась — код 1" || { bad "gate: пропавшая метрика"; cat "$T/gate.txt"; }; }
base '{"plan": null}'; G && ok "метрика не измерялась в эталоне — не валит" || bad "null в эталоне валит gate"
chk "$S/out/eval.json" "$T/base.json" <<'PY'
import json, sys
e = json.load(open(sys.argv[1])); e['score'] += 0.05; json.dump(e, open(sys.argv[2], 'w'))
PY
G && bad "падение итога пропущено" || { grep -q '^  - score: ' "$T/gate.txt" && ok "падение итога больше допуска — код 1" || bad "gate: итог"; }

echo "› журнал и тренд"
"$PY" -I "$EV" score "$S" --log --evals "$T/evals.jsonl" >/dev/null 2>&1
chk "$T/evals.jsonl" <<'PY' && ok "--log: строки {date, skill.version + commit, deck, metrics, score}" || bad "журнал оценок"
import json, sys
rows = [json.loads(l) for l in open(sys.argv[1])]
assert len(rows) == 2, len(rows)
assert all(set(r) == {'date', 'skill', 'deck', 'metrics', 'score'} and r['skill']['version'] and r['skill']['commit'] and r['deck'] == 'Синт' for r in rows)
PY
"$PY" -I "$EV" trend --evals "$T/evals.jsonl" --deck Синт > "$T/trend.txt" 2>&1 && grep -q "| $(cat "$SKILL/VERSION") | .* | 2 | Синт | " "$T/trend.txt" && ok "trend: версия, 2 прогона, дека" || { bad "trend"; cat "$T/trend.txt"; }
"$PY" -I "$EV" trend --evals "$T/evals.jsonl" --deck нет > "$T/trend2.txt" 2>&1; [ "$(grep -c '^| [0-9]' "$T/trend2.txt")" = 0 ] && ok "trend --deck фильтрует" || bad "trend --deck не фильтрует"
"$PY" -I "$EV" trend --evals "$T/none.jsonl" >/dev/null 2>&1 && bad "trend без журнала — код 0" || ok "trend без журнала: понятный отказ"

[ $fail = 0 ] && echo "ok: оценка качества деки" || { echo "оценка качества деки: есть ошибки"; exit 1; }
