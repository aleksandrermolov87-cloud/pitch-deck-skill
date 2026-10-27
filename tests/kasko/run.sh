#!/bin/zsh
# Приёмочный тест полноты и чисел графиков на тестовом брифе «КАСКО в России» (12 слайдов, числа условные).
#   zsh tests/kasko/run.sh [папка]   по умолчанию $SKILL/.acceptance/kasko-<время>; существующая папка — ошибка
# Собирает два варианта одной деки в обеих темах: lossy (потери из сравнения 1.5.0 и 1.6.1) и fixed (всё видно),
# запускает check_report.py и сравнение прогонов version_compare.py и проверяет критерии приёмки:
#   1) карта покрытия всех 12 слайдов, пропущенные требования отмечены;
#   2) 51,4% рисует точку линии → зарегистрирован как факт; в fixed по opt.show появляется читаемая подпись;
#   3) сравнение lossy → fixed отделяет правки содержания от сборщика; повторная сборка fixed — контрольная;
#   4) отчёт: версия навыка, компоненты, результаты проверок, отличия от предыдущей сборки;
#   5) прошлые прогоны не перезаписываются;
#   6) идентичность фактов и точность долей stackedShare (tests/kasko/identity.sh, отдельная дека).
# Код 1, если хоть один критерий не выполнен.
set -e
SKILL="${0:A:h:h:h}"; FIX="${0:A:h}"; PY="$SKILL/.venv/bin/python"
OUT="${1:-$SKILL/.acceptance/kasko-$(date +%Y%m%d-%H%M%S)-$$}"   # $$: два запуска в одну секунду не столкнутся
[ -e "$OUT" ] && { echo "папка уже есть, не перезаписываю: $OUT"; exit 1; }
mkdir -p "$OUT"; cd "$OUT"
fail=0
ok()  { print -P "  %F{green}✓%f $1"; }
bad() { print -P "  %F{red}✗%f $1"; fail=1; }
expect() { if grep -q -- "$2" "$3"; then ok "$1"; else bad "$1 (нет «$2» в ${3:t})"; fi; }

for v in lossy fixed; do
  echo "› сборка: $v"
  zsh "$SKILL/scripts/new_deck.sh" "src-$v" "КАСКО $v" "КАСКО_$v" >/dev/null
  rm -f "src-$v/data/example.json" "src-$v/data/coverage.example.json"
  cp "$FIX/brief.md" "src-$v/data/brief.md"; cp "$FIX/requirements.json" "$FIX/slides.js" "src-$v/"
  echo "{\"variant\": \"$v\"}" > "src-$v/data/variant.json"
  (cd "src-$v" && node build.js >/dev/null && THEME=light node build.js >/dev/null && ./render.sh >/dev/null && OUT=out-light ./render.sh >/dev/null)
  cp "$FIX/coverage.json" "src-$v/out/coverage.json"
  # оставленное предупреждение с объяснением (раздел 5 сводного отчёта)
  echo '[{"check": "audit", "match": "слайд 3: нижние", "why": "тестовая дека без 3D-объектов шагов: MagicPatterns в тесте не вызывается"}]' > "src-$v/out/waivers.json"
  (cd "src-$v" && "$PY" -I "$SKILL/scripts/check_report.py" . > ../check_$v.txt 2>&1) && echo 0 > rc_$v || echo $? > rc_$v
done

echo "› критерий 1: карта покрытия и пропуски"
[ "$(cat rc_lossy)" = 1 ] && ok "lossy: проверки не пройдены (код 1)" || bad "lossy должен падать"
[ "$(cat rc_fixed)" = 0 ] && ok "fixed: все проверки пройдены (код 0)" || { bad "fixed должен проходить"; cat check_fixed.txt; }
n=$(grep -c '^| [0-9]* | ' src-lossy/out/coverage.md | tr -d ' ' || true)
[ "$(sed -n '/### Карта по слайдам/,$p' src-lossy/out/coverage.md | grep -c '^| [0-9]')" = 12 ] && ok "карта по слайдам: 12 строк" || bad "в карте по слайдам не 12 слайдов"
expect "R1: период не на обложке" 'R1' src-lossy/out/coverage.md
"$PY" -I "$SKILL/scripts/brief_coverage.py" check src-lossy > cov_lossy.txt 2>&1 || true
expect "R1: «2019–2024» нет на обложке" 'R1: ключ «2019–2024' cov_lossy.txt
expect "R2: 31,6 только в заметках" 'R2: число «31,6» есть только в заметках' cov_lossy.txt
expect "R3: 51,4 влияет на график, но не подписано" 'R3: число «51,4» влияет на график слайда' cov_lossy.txt
expect "R7: четвёртый вывод не на слайде" 'R7:' cov_lossy.txt
expect "группа «Только в заметках»" '### Только в заметках докладчика' src-lossy/out/coverage.md
expect "группа «Нет на слайдах или сокращено»" '### Нет на слайдах или сокращено' src-lossy/out/coverage.md
expect "группа «изменено ради читаемости» в fixed" 'формулировка изменена ради читаемости' src-fixed/out/coverage.md

echo "› критерий 2: число из графика в реестре и подпись по требованию"
"$PY" -I - src-lossy/out/facts.json src-fixed/out/facts.json <<'PY' && ok "51,4 в реестре в обоих вариантах: lossy — только в графике, fixed — читается" || bad "51,4: реестр или подпись не те"
import json, sys
L, F = (json.load(open(p)) for p in sys.argv[1:3])
l = [f for f in L if f['slide'] == 6 and abs(f['value'] - 51.4) < 1e-9]
f = [f for f in F if f['slide'] == 6 and abs(f['value'] - 51.4) < 1e-9]
sys.exit(0 if l and f and l[0].get('auto') and l[0]['shown'] is False and f[0]['shown'] is True and l[0].get('type') == 'text' else 1)
PY
"$PY" -I "$SKILL/scripts/brief_coverage.py" dump src-fixed > dump_fixed.txt
expect "fixed: подпись «Коэффициент выплат за 2024 год: 51,4%» на слайде" 'Коэффициент выплат за 2024 год: 51,4%' dump_fixed.txt

echo "› критерий 3 и 5: сравнение прогонов"
"$PY" -I "$SKILL/scripts/version_compare.py" run src-lossy --runs runs --engine skill --label lossy > vc1.txt
"$PY" -I "$SKILL/scripts/version_compare.py" run src-fixed --runs runs --engine skill --label fixed > vc2.txt
"$PY" -I "$SKILL/scripts/version_compare.py" run src-fixed --runs runs --engine skill --label fixed-again > vc3.txt
R=(runs/*(/N)); RL=${R[(r)*_lossy]}; RF=${R[(r)*_fixed]}; RA=${R[(r)*_fixed-again]}
"$PY" -I "$SKILL/scripts/version_compare.py" compare "$RL" "$RF" --out cmp-edit > cmp1.txt
"$PY" -I "$SKILL/scripts/version_compare.py" compare "$RF" "$RA" --out cmp-control > cmp2.txt
expect "lossy → fixed: неконтрольное (менялись входы)" 'неконтрольное сравнение' cmp1.txt
expect "lossy → fixed: правки содержания по слайдам" '## Изменения содержания (редакционные)' cmp-edit/report.md
expect "lossy → fixed: компоненты по слайдам" '## Компоненты по слайдам' cmp-edit/report.md
expect "fixed → fixed: контрольная повторная сборка" 'контрольная повторная сборка' cmp2.txt
expect "повторная сборка совпала попиксельно" 'изменились 0' cmp2.txt
"$PY" -I "$SKILL/scripts/version_compare.py" compare "$RL" "$RF" --out cmp-edit > cmp1b.txt 2>&1 && bad "повторное сравнение в ту же папку должно отказать" || expect "прошлое сравнение не перезаписано" 'не перезаписываю' cmp1b.txt
[ -f "$RL/pptx/КАСКО_lossy_dark.pptx" ] && [ -f "$RL/png/light/s12.png" ] && [ -f "$RL/src/slides.js" ] && ok "в прогоне сохранены PPTX, PNG обеих тем и исходники" || bad "в прогоне нет PPTX, PNG или исходников"

echo "› критерий 4: сводный отчёт"
(cd src-fixed && "$PY" -I "$SKILL/scripts/check_report.py" . --compare ../cmp-edit > ../check_fixed2.txt 2>&1) || true
for s in 'pitch-deck-skill' '### Компоненты по слайдам' 'Реестр фактов по источникам' 'Полнота относительно брифа' 'Переполнения, геометрия и библиотека' \
         'Просмотр в PowerPoint' 'Предупреждения' 'Граница проверки' '### Отличия от предыдущей сборки' 'правка содержания'; do
  expect "checks.md: $s" "$s" src-fixed/out/checks.md
done

echo "› критерий 6: идентичность фактов и точность долей (tests/kasko/identity.sh)"
zsh "$FIX/identity.sh" "$OUT/identity" > identity.txt 2>&1 && ok "identity.sh: пройдена" || { bad "identity.sh не пройдена"; grep -v '✓' identity.txt; }

echo
[ $fail = 0 ] && echo "приёмка пройдена: $OUT" || echo "приёмка НЕ пройдена: $OUT"
exit $fail
