#!/bin/zsh
# Оргструктуры и связи подразделений (kit/orgs.js, reference/19-schemes.md, раздел 7): детектор находит оргсхемы во вводных,
# галерея собирается без ошибок аудита, суммы и доли сходятся в реестре фактов, ссылки на неизвестные узлы дают понятную ошибку.
#   zsh tests/orgs/run.sh     код 1, если хоть одна проверка не прошла
SKILL="${0:A:h:h:h}"; FIX="${0:A:h}"; PY="$SKILL/.venv/bin/python"
T=$(mktemp -d "${TMPDIR:-/tmp}/pds-orgs.XXXXXX"); trap 'rm -rf "$T"' EXIT
fail=0
ok()  { print -P "  %F{green}✓%f $1"; }
bad() { print -P "  %F{red}✗%f $1"; fail=1; }
cd "$T"

"$PY" -I "$SKILL/scripts/viz_suggest.py" brief "$FIX/brief.md" --json > sug.json
"$PY" -I - sug.json <<'PY' && ok "детектор: дерево департамента, двойное подчинение, трайбы, было → стало" || bad "детектор: $(head -c 400 sug.json)"
import json, sys
got = {s['component'] for s in json.load(open(sys.argv[1]))}
need = {'deptTree', 'dualReporting', 'tribeChapters', 'orgTransition'}
assert need <= got, sorted(need - got)
PY

zsh "$SKILL/scripts/new_deck.sh" src "Оргсхемы" Оргсхемы >/dev/null
cp "$SKILL/components/gallery-orgs.js" src/
echo "module.exports = { S: require('./gallery-orgs.js').S };" > src/slides.js
(cd src && node build.js >"$T/build.log" 2>&1) && ok "13 оргсхем собираются" || bad "сборка: $(tail -3 build.log)"
"$PY" -I "$SKILL/scripts/pptx_audit.py" Оргсхемы.pptx > audit.txt 2>&1
grep -q 'ошибок 0' audit.txt && ok "аудит: 0 ошибок (оргсхемы не блоковые)" || bad "аудит: $(grep -E 'ERR' audit.txt | head -5)"
"$PY" -I "$SKILL/scripts/facts_check.py" src/out/facts.json > facts.txt 2>&1 && grep -q 'расхождений 0' facts.txt \
  && ok "реестр фактов: суммы, доли и счёт сходятся" || bad "факты: $(grep -E 'ERR|расхожд' facts.txt | head -5)"
"$PY" -I - src/out/facts.json <<'PY' && ok "итоги — derived: штат всего, доли уровней, сеть, норма" || bad "derived-итоги не зарегистрированы"
import json, sys
F = json.load(open(sys.argv[1]))
lab = {f['label']: f for f in F}
for l in ('штат всего', 'всего: чел.', 'сеть всего: точек', 'руководителей в норме управляемости', 'Специалисты: доля от всех'):
    assert lab[l]['type'] == 'derived', l
PY

bad_case() {   # $1 — вызов компонента, $2 — ожидаемый текст ошибки, $3 — название проверки
  echo "const K = require('./components.js'); module.exports = { S: [() => ({ els: $1 })] };" > src/slides.js
  (cd src && node build.js >"$T/bad.log" 2>&1) && bad "$3: принято" || { grep -q "$2" bad.log && ok "$3 — понятная ошибка" || bad "$3: $(tail -2 bad.log)"; }
}
B='{ x: 0.6, y: 2, w: 12, h: 4.8 }'
bad_case "K.dualReporting($B, { root: { name: 'Р' }, units: [{ name: 'А', func: ['нет'] }], functions: [{ id: 'f', name: 'Ф' }] })" 'неизвестная функция «нет»' "двойное подчинение: неизвестная функция"
bad_case "K.orgTransition($B, { before: { head: 'Было', units: [{ id: 'a', name: 'А' }] }, after: { head: 'Стало', units: [{ id: 'b', name: 'Б' }] }, moves: [{ from: 'a', to: 'x' }] })" 'неизвестное подразделение' "было → стало: связь на неизвестное звено"
bad_case "K.relationshipWeb($B, { nodes: [{ id: 'a', name: 'А' }, { id: 'b', name: 'Б' }], links: [{ from: 'a', to: 'нет' }] })" 'неизвестного участника' "сеть отношений: неизвестный участник"
bad_case "K.deptTree($B, { root: { name: 'Д', size: 5 }, children: [{ name: 'О', size: 3 }] })" 'нет источника' "штат без источника"

[ $fail = 0 ] && echo "ok: оргсхемы" || { echo "оргсхемы: есть ошибки"; exit 1; }
