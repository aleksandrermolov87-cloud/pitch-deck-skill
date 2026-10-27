#!/bin/zsh
# Обязательные вопросы планировщика: new_deck.sh пишет ответы в deck.json → plan, plan_check.py проверяет их исполнение.
#   zsh tests/plan/run.sh     код 1, если хоть одна проверка не прошла
SKILL="${0:A:h:h:h}"; PY="$SKILL/.venv/bin/python"
T=$(mktemp -d "${TMPDIR:-/tmp}/pds-plan.XXXXXX"); trap 'rm -rf "$T"' EXIT
fail=0
ok()  { print -P "  %F{green}✓%f $1"; }
bad() { print -P "  %F{red}✗%f $1"; fail=1; }
pc()  { "$PY" -I "$SKILL/scripts/plan_check.py" "$T/src" >"$T/out" 2>&1; }
setp() { node -e 'const f=process.argv[1],d=require(f);d.plan=JSON.parse(process.argv[2]);require("fs").writeFileSync(f,JSON.stringify(d))' "$T/src/deck.json" "$1"; }

cd "$T"
zsh "$SKILL/scripts/new_deck.sh" bad "Тест" Тест '{oops' >/dev/null 2>&1 && bad "кривой JSON ответов принят" || { [ -e bad ] && bad "после отказа осталась папка" || ok "кривой JSON отклонён до копирования"; }
zsh "$SKILL/scripts/new_deck.sh" src "Тест" Тест >/dev/null
pc && bad "без ответов дека пропущена" || { grep -q 'нет ответа «тема»' "$T/out" && grep -q 'количество слайдов' "$T/out" && grep -q '3D-генерации' "$T/out" && ok "без ответов: три ошибки" || bad "без ответов: $(cat "$T/out")"; }
setp '{"topic":"Тест","slides":6,"3d":false}'; mkdir -p src/data; echo '{"provider_choice":{"provider":"none"},"images":[]}' > src/data/visuals.json
pc && ok "6 слайдов как просили, без 3D" || bad "точное число: $(cat "$T/out")"
setp '{"topic":"Тест","slides":8,"3d":false}'
pc && bad "8 вместо 6 пропущено" || ok "просили 8, в деке 6 — ошибка"
setp '{"topic":"Тест","slides":8,"3d":false,"slides_why":"пользователь согласился на 6"}'
pc && ok "отклонение с причиной — предупреждение" || bad "slides_why: $(cat "$T/out")"
setp '{"topic":"Тест","slides":"auto","3d":false}'
echo '{"provider_choice":{"provider":"none"},"images":[{"file":"img/3d/x.png","slide":2,"provider":"magicpatterns"}]}' > src/data/visuals.json
pc && bad "«без 3D» с картинкой пропущено" || ok "«без 3D», а картинка есть — ошибка"
setp '{"topic":"Тест","slides":"auto","3d":true}'
echo '{"provider_choice":{"provider":"magicpatterns","chosen_by_user":true},"images":[]}' > src/data/visuals.json
pc && grep -q '3D: да, провайдер magicpatterns' "$T/out" && ok "«с 3D» и провайдер записан" || bad "с 3D: $(cat "$T/out")"

[ $fail = 0 ] && echo "ok: вопросы планировщика" || { echo "вопросы планировщика: есть ошибки"; exit 1; }
