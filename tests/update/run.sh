#!/bin/zsh
# Офлайн-тесты scripts/update.sh: установка из архива и git-клон, подписи, отказ сети, сломанный setup, откат.
#   zsh tests/update/run.sh   — код 1, если хоть одна проверка не прошла
# Всё — во временной папке: свой HOME и git-config, локальный bare-репозиторий, одноразовые SSH-ключи.
# Папку скилла и ключи пользователя тест не трогает; update.sh берётся копией из рабочего дерева.
SKILL="${0:A:h:h:h}"
UPD="$SKILL/scripts/update.sh"
T=$(mktemp -d "${TMPDIR:-/tmp}/pds-update.XXXXXX")
trap 'rm -rf "$T"' EXIT
export HOME="$T/home" GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL="$T/gitconfig" GIT_TERMINAL_PROMPT=0
unset SSH_AUTH_SOCK PDS_REMOTE
mkdir -p "$HOME"
FAILS=0; N=0
ok()  { N=$((N+1)); print -P "  %F{green}✓%f $1"; }
bad() { N=$((N+1)); FAILS=$((FAILS+1)); print -P "  %F{red}✗%f $1"; [ -z "$OUT" ] || print -r -- "$OUT" | sed 's/^/      | /' | tail -15; }
check() { local msg="$1"; shift; if "$@"; then ok "$msg"; else bad "$msg"; fi; }
has() { [[ "$OUT" == *"$1"* ]]; }
# контрольная сумма дерева: пути, права и содержимое всех файлов и ссылок
treesum() { (cd "$1" && find . \( -type f -o -type l \) -print0 | sort -z | xargs -0 shasum -a 256 2>/dev/null; find . -print0 | sort -z | xargs -0 stat -f '%N %Lp %HT' 2>/dev/null) | shasum -a 256 | cut -d' ' -f1; }
run() { OUT=$(cd "$T" && "$@" 2>&1); RC=$?; }

git config --global user.name "Test Author"
git config --global user.email author@example.invalid
git config --global init.defaultBranch main
git config --global gpg.format ssh
git config --global advice.detachedHead false
ssh-keygen -q -t ed25519 -N '' -C test -f "$T/key"
ssh-keygen -q -t ed25519 -N '' -C evil -f "$T/evil"
echo "author@example.invalid namespaces=\"git\" $(cut -d' ' -f1,2 "$T/key.pub")" > "$T/signers"
echo "author@example.invalid namespaces=\"git\" $(cut -d' ' -f1,2 "$T/evil.pub")" > "$T/signers.evil"

# ── репозиторий-источник с релизами ──
S="$T/src"; mkdir -p "$S/scripts" "$S/learnings" "$S/.github"
cp "$UPD" "$S/scripts/update.sh"
cp "$SKILL/.gitignore" "$S/.gitignore"
cat > "$S/scripts/setup.sh" <<'EOF'
#!/bin/zsh
# заглушка setup.sh: без сети; падает, если в релизе есть BROKEN_DEP (несовместимая зависимость)
set -e
SKILL="${0:A:h:h}"
echo "setup $SKILL" >> "$PDS_TEST_LOG"
[ ! -f "$SKILL/BROKEN_DEP" ] || { echo "несовместимая зависимость"; exit 1; }
mkdir -p "$SKILL/.venv/bin" "$SKILL/learnings"
[ -f "$SKILL/.venv/bin/pip" ] || printf '#!%s/.venv/bin/python\n' "$SKILL" > "$SKILL/.venv/bin/pip"
[ -f "$SKILL/config.json" ] || cp "$SKILL/config.default.json" "$SKILL/config.json"
EOF
echo '{"mode": "full"}' > "$S/config.default.json"
echo '{"lockfileVersion": 3}' > "$S/package-lock.json"
echo "# стартовые уроки" > "$S/learnings/SEED.md"
cd "$S" && git init -q
release() {  # release <версия> <ключ|unsigned> [signers]
  echo "$1" > "$S/VERSION"
  print "# pitch-deck-skill (тест)\n\n## $1\n\n- изменение $1\n" > "$S/CHANGELOG.md"
  echo "---\nname: pitch-deck-skill\n---\nверсия $1" > "$S/SKILL.md"
  cp "${3:-$T/signers}" "$S/.github/allowed_signers"
  git -C "$S" add -A && git -C "$S" commit -qm "$1"
  if [ "$2" = unsigned ]; then git -C "$S" tag -a "v$1" -m "v$1"
  else git -C "$S" -c user.signingkey="$2" tag -s "v$1" -m "v$1"; fi
}
echo 'echo old' > "$S/scripts/old.sh"
release 1.0.0 "$T/key"
git -C "$S" rm -q scripts/old.sh; echo 'echo new' > "$S/scripts/new.sh"
release 1.1.0 "$T/key"
touch "$S/BROKEN_DEP"; release 1.2.0 "$T/key"; git -C "$S" rm -q BROKEN_DEP
release 1.3.0 unsigned
# чужой ключ и подменённый allowed_signers внутри самого релиза
release 1.4.0 "$T/evil" "$T/signers.evil"
git clone -q --bare "$S" "$T/remote.git"
export PDS_TEST_LOG="$T/setup.log"
: > "$PDS_TEST_LOG"

# пользовательские данные: config.json без перевода строки, уроки, бинарная картинка, *.local.md, окружение
userdata() {
  printf '{"mode":"lite","brand":"Тест"}' > "$1/config.json"
  mkdir -p "$1/learnings/gallery" "$1/node_modules/pptxgenjs" "$1/.venv/bin"
  printf '{"slide":1,"score":5}\n' > "$1/learnings/ratings.jsonl"
  echo "# уроки" > "$1/learnings/LESSONS.md"
  echo "мой урок" > "$1/learnings/SEED.local.md"
  head -c 4096 /dev/urandom > "$1/learnings/gallery/a.png"
  echo "заметки" > "$1/notes.local.md"
  echo "module.exports = 1" > "$1/node_modules/pptxgenjs/index.js"
  printf '#!%s/.venv/bin/python\n' "$1" > "$1/.venv/bin/pip"
  printf '#!/bin/sh\nexit 0\n' > "$1/.venv/bin/python"; chmod +x "$1/.venv/bin/python"
}
same_data() {  # same_data <установка> <эталон>
  cmp -s "$1/config.json" "$2/config.json" && diff -r "$1/learnings" "$2/learnings" >/dev/null && cmp -s "$1/notes.local.md" "$2/notes.local.md"
}

# ── установка из архива ──
echo "Установка из архива (без .git)"
R="$T/skills"; A="$R/pitch-deck-skill"; BK="$R/.pitch-deck-skill.backups"
mkdir -p "$A" "$R/other-skill"; echo "чужой скилл" > "$R/other-skill/SKILL.md"
git -C "$S" archive v1.0.0 | tar -x -C "$A"
userdata "$A"
mkdir -p "$T/ref"; cp -pR "$A/config.json" "$A/learnings" "$A/notes.local.md" "$T/ref/"
OTHER=$(treesum "$R/other-skill")
export PDS_REMOTE="$T/remote.git"

S0=$(treesum "$A")
run zsh "$A/scripts/update.sh" v1.1.0
check "просмотр: код 2, подпись проверена, CHANGELOG и diff показаны" eval '[ $RC = 2 ] && has "подпись релиза проверена" && has "изменение 1.1.0" && has "scripts/new.sh"'
check "просмотр ничего не меняет" [ "$(treesum "$A")" = "$S0" ]
check "просмотр не создаёт папку резервных копий" [ ! -e "$BK" ]

run zsh "$A/scripts/update.sh" --yes v1.0.9
check "несуществующий релиз — отказ" eval '[ $RC = 1 ] && has "релиза v1.0.9 нет"'

PDS_REMOTE="$T/nope.git" run zsh "$A/scripts/update.sh" --yes v1.1.0
check "нет сети: код 1, понятное сообщение" eval '[ $RC = 1 ] && has "Не удалось связаться"'
check "нет сети: установка не тронута" [ "$(treesum "$A")" = "$S0" ]

run zsh "$A/scripts/update.sh" --yes v1.3.0
check "релиз без подписи — отказ" eval '[ $RC = 1 ] && has "не проверена"'
check "релиз без подписи: установка не тронута" [ "$(treesum "$A")" = "$S0" ]

run zsh "$A/scripts/update.sh" --yes
check "последний релиз с чужим ключом и своим allowed_signers — отказ" eval '[ $RC = 1 ] && has "Подпись релиза v1.4.0 не проверена"'
check "чужой ключ: установка не тронута" [ "$(treesum "$A")" = "$S0" ]

run zsh "$A/scripts/update.sh" --yes v1.2.0
check "setup.sh в промежуточной папке упал — код 1, без подмены" eval '[ $RC = 1 ] && has "setup.sh релиза v1.2.0 не прошёл"'
check "сломанный setup: установка не тронута" [ "$(treesum "$A")" = "$S0" ]
check "сломанный setup: промежуточная папка убрана, резервной копии нет" eval '[ -z "$(ls -A "$BK" 2>/dev/null)" ]'
check "setup запускался в промежуточной папке, не в установке" eval 'grep -q "/.stage-" "$PDS_TEST_LOG" && ! grep -qx "setup $A" "$PDS_TEST_LOG"'

: > "$PDS_TEST_LOG"
run zsh "$A/scripts/update.sh" --yes v1.1.0
check "обновление: код 0" eval '[ $RC = 0 ] && has "обновлено до v1.1.0"'
check "стоит v1.1.0, новый файл есть, удалённый в релизе — нет" eval '[ "$(cat "$A/VERSION")" = 1.1.0 ] && [ -f "$A/scripts/new.sh" ] && [ ! -e "$A/scripts/old.sh" ]'
check "config.json, learnings/, *.local.md побайтно те же" same_data "$A" "$T/ref"
check "окружение перенесено (node_modules), .git не появился" eval '[ -f "$A/node_modules/pptxgenjs/index.js" ] && [ ! -e "$A/.git" ]'
check "пути venv указывают на папку скилла" eval '[ "$(head -1 "$A/.venv/bin/pip")" = "#!$A/.venv/bin/python" ]'
B1=( "$BK"/[0-9]*(N/) )
check "резервная копия v1.0.0 — полная, с данными" eval '[ ${#B1} = 1 ] && [[ "${B1[1]:t}" == *-v1.0.0 ]] && [ -f "$B1[1]/scripts/old.sh" ] && same_data "$B1[1]" "$T/ref"'
check "резервная копия — не папка-скилл верхнего уровня" eval '[ "$(ls -A "$R" | sort | tr "\n" " ")" = ".pitch-deck-skill.backups other-skill pitch-deck-skill " ]'
check "промежуточных папок и блокировки не осталось" eval '[ -z "$(print -r -- "$BK"/.stage-*(N) "$BK"/.lock(N))" ]'
check "другой скилл не тронут" [ "$(treesum "$R/other-skill")" = "$OTHER" ]

S1=$(treesum "$A")
run zsh "$A/scripts/update.sh" --yes v1.1.0
check "повторный запуск: «уже стоит», ничего не меняется" eval '[ $RC = 0 ] && has "уже стоит" && [ "$(treesum "$A")" = "$S1" ] && [ $(ls -d "$BK"/[0-9]* | wc -l) = 1 ]'

# скилл поработал после обновления: новые оценки должны пережить откат
printf '{"slide":2,"score":1}\n' >> "$A/learnings/ratings.jsonl"; cp -p "$A/learnings/ratings.jsonl" "$T/ref/learnings/"
run zsh "$A/scripts/update.sh" --rollback
check "откат без --yes: код 2, показывает, что вернёт" eval '[ $RC = 2 ] && has "v1.1.0 → резервная копия v1.0.0" && [ "$(cat "$A/VERSION")" = 1.1.0 ]'
run zsh "$A/scripts/update.sh" --rollback --yes
check "откат: стоит v1.0.0 из резервной копии" eval '[ $RC = 0 ] && [ "$(cat "$A/VERSION")" = 1.0.0 ] && [ -f "$A/scripts/old.sh" ] && [ ! -e "$A/scripts/new.sh" ]'
check "откат: config.json и уроки — текущие, побайтно" same_data "$A" "$T/ref"
check "откат: версия v1.1.0 сохранена резервной копией" eval 'B2=( "$BK"/[0-9]*(N/On) ); [ ${#B2} = 1 ] && [[ "${B2[1]:t}" == *-v1.1.0 ]]'
run zsh "$A/scripts/update.sh" --rollback --yes
check "повторный откат возвращает v1.1.0" eval '[ $RC = 0 ] && [ "$(cat "$A/VERSION")" = 1.1.0 ] && same_data "$A" "$T/ref"'
check "другой скилл не тронут" [ "$(treesum "$R/other-skill")" = "$OTHER" ]

# установка из архива без .gitignore и с неизвестной версией: обновление идёт, данные сохраняются
echo "Установка из архива без VERSION и .gitignore"
A2="$T/skills2/pitch-deck-skill"; mkdir -p "$A2"
git -C "$S" archive v1.0.0 | tar -x -C "$A2"; rm -f "$A2/VERSION" "$A2/.gitignore"; userdata "$A2"
mkdir -p "$T/ref2"; cp -pR "$A2/config.json" "$A2/learnings" "$A2/notes.local.md" "$T/ref2/"
run zsh "$A2/scripts/update.sh" --yes v1.1.0
check "обновление при неизвестной версии: код 0, данные те же" eval '[ $RC = 0 ] && [ "$(cat "$A2/VERSION")" = 1.1.0 ] && same_data "$A2" "$T/ref2"'

# ── git-клон: прежнее поведение ──
echo "Git-клон"
unset PDS_REMOTE
C="$T/gitskills/pitch-deck-skill"; mkdir -p "${C:h}"
git clone -q "$T/remote.git" "$C" && git -C "$C" checkout -q v1.0.0
userdata "$C"
mkdir -p "$T/ref3"; cp -pR "$C/config.json" "$C/learnings" "$C/notes.local.md" "$T/ref3/"
run zsh "$C/scripts/update.sh" v1.1.0
check "git: просмотр — код 2" eval '[ $RC = 2 ] && has "подпись релиза проверена"'
run zsh "$C/scripts/update.sh" --yes v1.3.0
check "git: релиз без подписи — отказ" eval '[ $RC = 1 ] && [ "$(git -C "$C" describe --tags)" = v1.0.0 ]'
run zsh "$C/scripts/update.sh" --yes v1.1.0
check "git: переключение на v1.1.0" eval '[ $RC = 0 ] && [ "$(git -C "$C" describe --tags --exact-match)" = v1.1.0 ]'
check "git: config.json и уроки побайтно те же" same_data "$C" "$T/ref3"
check "git: резервных копий не создаётся" [ ! -e "${C:h}/.pitch-deck-skill.backups" ]
run zsh "$C/scripts/update.sh" --rollback --yes
check "git: --rollback без резервных копий — подсказка и код 1" eval '[ $RC = 1 ] && has "Резервных копий нет"'

echo
if [ $FAILS = 0 ]; then echo "update: пройдено $N/$N"; exit 0; fi
echo "update: не пройдено $FAILS из $N"; exit 1
