#!/bin/zsh
# Под-скилл «Схемы» (reference/19-schemes.md): детектор находит участников и связи, черновик собирается в schemeMap,
# аудит запрещает блоковые слайды и пропускает схемы, детектор деки помечает блоковый слайд.
#   zsh tests/schemes/run.sh     код 1, если хоть одна проверка не прошла
SKILL="${0:A:h:h:h}"; FIX="${0:A:h}"; PY="$SKILL/.venv/bin/python"
T=$(mktemp -d "${TMPDIR:-/tmp}/pds-schemes.XXXXXX"); trap 'rm -rf "$T"' EXIT
fail=0
ok()  { print -P "  %F{green}✓%f $1"; }
bad() { print -P "  %F{red}✗%f $1"; fail=1; }
cd "$T"

"$PY" -I "$SKILL/scripts/viz_suggest.py" brief "$FIX/brief.md" --json --emit viz > sug.json
"$PY" -I - sug.json viz/scheme-1.json <<'PY' && ok "детектор: 4 участника, хаб, связи, черновик" || bad "детектор: $(head -c 400 sug.json)"
import json, sys
s = json.load(open(sys.argv[1])); d = json.load(open(sys.argv[2]))
names = [n['name'] for n in d['nodes']]
assert s[0]['component'] == 'schemeMap', s[0]['component']
assert sorted(names) == sorted(['Кредитный блок', 'Команда страхования', 'Дистрибуция', 'Страховая компания']), names
assert [n['name'] for n in d['nodes'] if n.get('kind') == 'hub'] == ['Команда страхования'], 'хаб'
assert len(d['edges']) >= 3, d['edges']
PY

zsh "$SKILL/scripts/new_deck.sh" src "Схемы" Схемы >/dev/null
cat > src/slides.js <<'JS'
const L = require('./lib.js'), K = require('./components.js'), fs = require('fs');
const { C, W, M, T, chrome, rect, text } = L;
const B = { x: M, y: T.canvas.bodyTop + 0.1, w: W - 2 * M, h: T.canvas.bodyBottom - T.canvas.bodyTop - 0.15 };
const draft = JSON.parse(fs.readFileSync(process.env.DRAFT, 'utf8'));
draft.edges.forEach(e => { e.tag = 'Связь'; e.text = e.text.slice(0, 30); });
const cards = () => [0, 1, 2].map(i => [rect(M + i * 4.1, 2.4, 3.8, 3, { r: 0.14, fill: C.card }), text(M + i * 4.1 + 0.2, 2.6, 3.4, 1, `Карточка ${'АБВ'[i]}: текст пункта`, { size: 14 })]).flat();
const S = [
  () => ({ archetype: 'scheme-map', els: [...chrome({ title: 'Схема из черновика', panel: false }), ...K.schemeMap(B, draft)] }),
  () => ({ archetype: 'cards', custom: 'тест блокового слайда', els: [...chrome({ title: 'Три карточки', panel: false }), ...cards()] }),
  () => ({ archetype: 'scheme-test', custom: 'тест исключения схем', els: [...chrome({ title: 'Карточки-узлы схемы', panel: false }), ...cards()] }),
];
module.exports = { S };
JS
(cd src && DRAFT="$T/viz/scheme-1.json" node build.js >"$T/build.log" 2>&1) && ok "черновик собирается в schemeMap" || bad "сборка: $(tail -3 build.log)"
"$PY" -I "$SKILL/scripts/pptx_audit.py" Схемы.pptx > audit.txt 2>&1
grep -q 'слайд 2: блоковый слайд' audit.txt && ok "три одинаковые карточки — ERR «блоковый слайд»" || bad "блоковый слайд не пойман: $(grep -E 'ERR|WARN' audit.txt | head -5)"
grep -qE 'слайд 3: блок' audit.txt && bad "схема (scheme-*) ошибочно названа блоковой" || ok "архетип scheme-* не блоковый"
grep -qE 'слайд 1: (блок|тексты пересекаются)' audit.txt && bad "схема из черновика: $(grep 'слайд 1' audit.txt | head -3)" || ok "схема из черновика без блоков и пересечений"
"$PY" -I "$SKILL/scripts/viz_suggest.py" deck src --pptx Схемы.pptx > deck.txt
grep -q 'слайд 2 .*БЛОКОВЫЙ' deck.txt && ok "детектор деки помечает блоковый слайд" || bad "детектор деки: $(cat deck.txt)"
grep -q 'слайд 1 ' deck.txt && bad "детектор предложил схему поверх схемы" || ok "слайд-схема не предлагается повторно"
cat > src/slides.js <<'JS'
const K = require('./components.js'), L = require('./lib.js');
module.exports = { S: [() => ({ els: K.schemeMap({ x: 1, y: 2, w: 11, h: 4 }, { nodes: [{ id: 'a', name: 'А' }], edges: [{ from: 'a', to: 'нет' }] }) })] };
JS
(cd src && node build.js >"$T/bad.log" 2>&1) && bad "связь на неизвестный узел принята" || { grep -q 'неизвестный узел «нет»' bad.log && ok "связь на неизвестный узел — понятная ошибка" || bad "ошибка: $(tail -2 bad.log)"; }

[ $fail = 0 ] && echo "ok: схемы" || { echo "схемы: есть ошибки"; exit 1; }
