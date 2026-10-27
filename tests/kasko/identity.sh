#!/bin/zsh
# Приёмка идентичности фактов (#3) и точности долей (#5): zsh tests/kasko/identity.sh [папка]
# Собирает 8 слайдов tests/kasko/identity.js (только PPTX и facts.json, без рендера) и проверяет:
#   kpiHero: match '2024' находит 51,4 во вложенных series.periods и подписывает его с периодом и единицей;
#   два равных значения разных рядов — два факта, ref 'series[1].values[3]' подписывает только второй;
#   равное число другого факта в заголовке не подтверждает точку графика; прежние формы opt.show не дублируют подпись;
#   stackedShare: 15,64% с двумя знаками одной подписью, неизвестный остаток без «Прочие», рассчитанный остаток — derived rest
#   с записью расчёта, сумма в пределах точности — без остатка, перерасход — ошибка сборки; facts_check.py проходит;
#   brief_coverage.py отличает «нарисовано» от «подписано с периодом и единицей».
# Код 1, если хоть одна проверка не выполнена.
set -e
SKILL="${0:A:h:h:h}"; FIX="${0:A:h}"; PY="$SKILL/.venv/bin/python"
OUT="${1:-$SKILL/.acceptance/identity-$(date +%Y%m%d-%H%M%S)-$$}"
[ -e "$OUT" ] && { echo "папка уже есть, не перезаписываю: $OUT"; exit 1; }
mkdir -p "$OUT"; cd "$OUT"
fail=0
ok()  { print -P "  %F{green}✓%f $1"; }
bad() { print -P "  %F{red}✗%f $1"; fail=1; }

zsh "$SKILL/scripts/new_deck.sh" src "Идентичность фактов" Идентичность >/dev/null
rm -f src/data/example.json src/data/coverage.example.json
cp "$FIX/identity.js" src/slides.js
(cd src && node build.js > ../build.txt 2>&1) || { bad "сборка упала"; cat build.txt; exit 1; }

echo "› реестр фактов: идентичность и подписи"
"$PY" -I - src/out/facts.json src/out/slides.json <<'PY' || fail=1
import json, sys
F, S = (json.load(open(p, encoding='utf-8')) for p in sys.argv[1:3])
bad = 0
def chk(name, cond):
    global bad
    print(f"  {'✓' if cond else '✗'} {name}")
    bad |= not cond
on = lambda n: [f for f in F if f['slide'] == n]
txt = lambda n: '\n'.join(''.join(t['runs']) for t in S[n - 1]['texts'])
eq = lambda f, v: abs(f['value'] - v) < 1e-9
# 1 kpiHero
h = [f for f in on(1) if eq(f, 51.4)]
chk('kpiHero: 51,4 — факт с путём series.values[2], периодом 2024 и единицей %',
    len(h) == 1 and h[0].get('path') == 'series.values[2]' and h[0].get('period') == '2024' and h[0].get('unit') == '%' and h[0].get('lib') == 'kpiHero')
chk('kpiHero: подпись «Коэффициент за 2024 год: 51,4%», shown_as = label', 'Коэффициент за 2024 год: 51,4%' in txt(1) and h and h[0].get('shown_as') == 'label')
hero = [f for f in on(1) if eq(f, 54.3)]
chk('kpiHero: 54,3 числа-героя и столбика — два факта, столбик не подтверждён подписью героя',
    len(hero) == 2 and {f.get('path') for f in hero} == {'value', 'series.values[3]'}
    and next(f for f in hero if f['path'] == 'value')['shown'] and not next(f for f in hero if f['path'] == 'series.values[3]')['shown'])
# 2 два ряда
t = [f for f in on(2) if eq(f, 30)]
chk('lineChart: равные 30 рядов А и Б — два факта с разными id', len(t) == 2 and len({f['id'] for f in t}) == 2 and {f.get('series') for f in t} == {'Ряд А', 'Ряд Б'})
b = next((f for f in t if f.get('path') == 'series[1].values[3]'), {})
a_ = next((f for f in t if f.get('path') == 'series[0].values[3]'), {})
chk('ref series[1].values[3]: подписан ряд Б, ряд А только в графике', b.get('shown') is True and a_.get('shown') is False and a_.get('shown_as') == 'graph')
chk('подпись ряда Б с рядом и периодом: «Ряд Б, 2024: 30%»', 'Ряд Б, 2024: 30%' in txt(2) and b.get('shown_as') == 'label')
# 3 посторонний токен
p = next((f for f in on(3) if eq(f, 51.4) and f.get('auto')), {})
o = next((f for f in on(3) if f['label'] == 'другой показатель'), {})
chk('51,4 в заголовке (другой факт) не подтверждает точку графика 51,4', o.get('shown') is True and p.get('shown') is False and p.get('shown_as') == 'graph')
# 4 рейтинг
t4 = txt(4)
chk('рейтинг: 15,64% и 15,03% одной подписью с двумя знаками', t4.count('15,64') == 1 and t4.count('15,03') == 1)
chk('рейтинг: нет округлённых или пересчитанных долей (16%, 15,6%, 25%)', not any(x in t4 for x in ('16%', '22%', '15,6%', '25%')))
chk('рейтинг: неизвестный остаток не стал «Прочие» и не попал в реестр числом',
    'Прочие' not in t4 and 'Остальные: нет данных' in t4 and not any('Остальные' in f['label'] for f in on(4)))
tot = next((f for f in on(4) if f['label'] == 'доля рынка итого'), {})
chk('рейтинг: расчёт остатка записан (calc)', '100,00 − (15,64 + 15,03 + 12,10 + 9,87 + 7,36) = 40,00' in (tot.get('calc') or ''))
# 5 рассчитанный остаток
r = next((f for f in on(5) if f['label'] == 'структура: Прочие'), {})
chk('остаток до 100%: «Прочие» 6 — derived rest от частей, расчёт записан',
    eq(r, 6) if r else False)
chk('остаток: op rest, whole 100, calc «100 − (46 + 31 + 17) = 6»', r.get('op') == 'rest' and r.get('whole') == 100 and r.get('calc') == '100 − (46 + 31 + 17) = 6')
chk('остаток: на слайде «6%» одной подписью', txt(5).count('6%') >= 1 and 'Прочие' in txt(5))
# 6 сумма в пределах точности
e6 = next((f for f in on(6) if f['label'] == 'точная структура итого'), {})
chk('сумма 100,02 при точности ±0,02: остатка нет, это записано', 'остатка нет' in (e6.get('calc') or '') and 'Прочие' not in txt(6))
# 7 доли с одним знаком
s7 = [f for f in on(7) if f['label'].startswith('доля ')]
chk('display share, shareDigits 1: доли 71,9% / 25,1% / 3,0% с одним знаком, без млн ₽ в подписях',
    [f['digits'] for f in s7] == [1, 1, 1] and '71,9%' in txt(7) and '25,1%' in txt(7) and '61,3' not in txt(7))
# 8 прежние формы opt.show
chk('barsTrend: число, строка и объект opt.show — подпись не дублируется (компонент подписал сам)', 'barsTrend-show' not in [x['id'] for x in S[7]['texts']])
chk('у каждого факта компонента есть id, lib, cid', all(f.get('id') and f.get('cid') for f in F if f.get('lib')))
sys.exit(1 if bad else 0)
PY

echo "› stackedShare: перерасход и неверный тип остатка — ошибка сборки"
node -e '
const K = require("./src/components.js"), SRC = { type: "user", quote: "x" };
const box = { x: 0.5, y: 2, w: 12, h: 4 };
let n = 0;
try { K.stackedShare(box, { label: "x", unit: "%", rest: { type: "computed" }, parts: [{ name: "a", value: 60 }, { name: "b", value: 43 }] }, { src: SRC }); } catch (e) { n += /больше целого/.test(e.message); }
try { K.stackedShare(box, { label: "y", unit: "%", rest: { type: "other" }, parts: [{ name: "a", value: 60 }] }, { src: SRC }); } catch (e) { n += /rest.type/.test(e.message); }
try { K.stackedShare(box, { label: "z", unit: "%", rest: { type: "known", value: 10 }, parts: [{ name: "a", value: 60 }, { name: "b", value: 20 }] }, { src: SRC }); } catch (e) { n += /целое/.test(e.message); }
process.exit(n === 3 ? 0 : 1);' && ok "103% с computed, неизвестный тип и known 90% из 100% — ошибки сборки" || bad "stackedShare пропустил неверную сумму или тип"

echo "› нативная диаграмма: категория и легенда — контекст подписи значения (kit/charts.js)"
r=$(node -e '
const K = require("./src/components.js"), L = require("./src/lib.js"), SRC = { type: "user", quote: "x" };
if (!K.nativeChart) { console.log("нет"); process.exit(0); }
L.PAGE.n = 99; const d = { type: "col", label: "сборы", unit: "млрд ₽", digits: 1, periods: ["2023", "2024"], values: [251, 299.6], src: SRC }, b = { x: 0.5, y: 1.8, w: 12, h: 4.5 };
const els = [...K.nativeChart(b, d), ...K.nativeChart(b, d, { native: false })], st = K.linkShown(L.FACTS, els);
console.log(L.FACTS.map(f => st.get(f)).join(","));')
case "$r" in
  нет) ok "nativeChart нет в библиотеке — проверка пропущена" ;;
  label,label,value,value) ok "nativeChart: подписи с категорией — label; режим фигур (native: false) — value" ;;
  *) bad "nativeChart: ожидалось label,label,value,value, получено $r" ;;
esac

echo "› facts_check.py: derived rest и расчёт в отчёте"
(cd src && "$PY" -I "$SKILL/scripts/facts_check.py" out/facts.json --root . > ../facts.txt 2>&1) && ok "facts_check.py: расхождений нет" || { bad "facts_check.py нашёл расхождения"; grep ERR facts.txt | head; }
grep -q 'расчёт «структура: Прочие»: 100 − (46 + 31 + 17) = 6' facts.txt && ok "facts_check.py: расчёт остатка в [INFO]" || bad "нет расчёта остатка в выводе facts_check.py"
grep -q 'подписаны с периодом и единицей' facts.txt && ok "facts_check.py: счёт «подписано с периодом и единицей / только число»" || bad "нет счёта подписей в facts_check.py"

echo "› brief_coverage.py: нарисовано, подписано числом, подписано с периодом"
cat > src/requirements.json <<'JSON'
{"brief": "data/brief.md", "requirements": [
 {"id": "Q1", "text": "Коэффициент 51,4% за 2024 год", "must": "slide", "numbers": ["51,4"], "where": "slide:1"},
 {"id": "Q2", "text": "Сборы 251,0 в 2023 году", "must": "slide", "numbers": ["251,0"], "where": "slide:8"},
 {"id": "Q3", "text": "Точка 46,6 на графике", "must": "slide", "numbers": ["46,6"], "where": "slide:3"}]}
JSON
cat > src/out/coverage.json <<'JSON'
{"by": "тест", "items": [
 {"id": "Q1", "status": "ok", "slide": 1, "element": "kpiHero-show", "evidence": "Коэффициент за 2024 год: 51,4%"},
 {"id": "Q2", "status": "ok", "slide": 8, "element": "lib:barsTrend", "evidence": "столбик 2023"},
 {"id": "Q3", "status": "ok", "slide": 3, "element": "lib:lineChart", "evidence": "точка 2023"}]}
JSON
"$PY" -I "$SKILL/scripts/brief_coverage.py" check src > cov.txt 2>&1 || true
grep -q 'Q1' cov.txt && grep -q '^\[WARN\] Q1\|^\[ERR\] Q1' cov.txt && bad "Q1: подпись kpiHero с периодом не засчитана" || ok "Q1: 51,4 подписано с периодом и единицей — без замечаний"
grep -q 'Q2: число «251,0» на слайде \[8\] подписано без периода или единицы' cov.txt && ok "Q2: barsTrend — число читается, период только на оси" || bad "Q2: нет предупреждения «подписано без периода»"
grep -q 'Q3: число «46,6» влияет на график слайда \[3\] (lineChart series\[0\].values\[1\] Коэффициент 2023)' cov.txt && ok "Q3: точка 46,6 только нарисована — с путём, рядом и периодом" || bad "Q3: нет «влияет на график» с идентичностью факта"
grep -q 'число подписано без периода или единицы рядом' src/out/coverage.md && ok "coverage.md: пояснение «без периода или единицы рядом»" || bad "coverage.md без пояснения"

echo
[ $fail = 0 ] && echo "приёмка идентичности пройдена: $OUT" || echo "приёмка идентичности НЕ пройдена: $OUT"
exit $fail
