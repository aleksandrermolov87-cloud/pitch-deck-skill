#!/bin/zsh
# Регрессионный тест сравнения содержания в version_compare.py compare (reference/16-version-compare.md).
#   zsh tests/version_compare/run.sh [папка]   по умолчанию $SKILL/.acceptance/version-compare-<время>; существующая папка — ошибка
# Каждый кейс fixtures/cases/*.json — пара синтетических прогонов A и B (без сборки и Chrome) и ожидания к отчёту:
#   нет манифеста, частичная структура, неизвестный формат, корректно пустой манифест, два новых манифеста с правкой,
#   1.5.0 → новая версия при одинаковых входах и PNG (отчёт не утверждает редакционных правок), 1.6.x без заметок.
# Код 1, если хоть один кейс не прошёл.
set -e
SKILL="${0:A:h:h:h}"; FIX="${0:A:h}"; PY="$SKILL/.venv/bin/python"
OUT="${1:-$SKILL/.acceptance/version-compare-$(date +%Y%m%d-%H%M%S)-$$}"   # $$: два запуска в одну секунду не столкнутся
[ -e "$OUT" ] && { echo "папка уже есть, не перезаписываю: $OUT"; exit 1; }
mkdir -p "$OUT"
fail=0
for case in "$FIX"/fixtures/cases/*.json; do
  n=${case:t:r}
  "$PY" -I "$FIX/vc_fixture.py" build "$case" "$OUT/$n"
  if ! "$PY" -I "$SKILL/scripts/version_compare.py" compare "$OUT/$n/A" "$OUT/$n/B" --out "$OUT/$n/cmp" > "$OUT/$n/compare.txt" 2>&1; then
    print -P "  %F{red}✗%f $n: compare упал"; sed 's/^/    /' "$OUT/$n/compare.txt" | tail -5; fail=1; continue
  fi
  if "$PY" -I "$FIX/vc_fixture.py" expect "$case" "$OUT/$n/cmp"; then
    print -P "  %F{green}✓%f $n"
  else
    print -P "  %F{red}✗%f $n"; fail=1
  fi
done
echo
[ $fail = 0 ] && echo "сравнение содержания: все кейсы пройдены ($OUT)" || echo "сравнение содержания: есть ошибки ($OUT)"
exit $fail
