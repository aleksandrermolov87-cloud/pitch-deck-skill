#!/bin/zsh
# Обновление скилла до последнего релиза с GitHub. Папка скилла — git-клон или установка из архива (без .git).
#   zsh update.sh            — показать, что изменится (код 2: нужно подтверждение)
#   zsh update.sh --yes      — переключиться на последний релиз и доустановить зависимости
#   zsh update.sh --yes v1.4.0 — на конкретный релиз
#   --allow-unsigned          — разрешить релиз без проверенной подписи (только если автор подтвердил это лично)
#   zsh update.sh --rollback [--yes] — вернуть последнюю резервную копию (установка из архива)
# Подпись проверяется по .github/allowed_signers из ТЕКУЩЕЙ, уже доверенной версии, а не из нового релиза.
# Локальные config.json, learnings/, *.local.md в git не входят и не меняются.
# Установка из архива: релиз скачивается во временный git-клон, собирается в промежуточной папке вместе с вашими
# файлами, там же проходят setup.sh и быстрая проверка; только после этого папки меняются местами.
# Прежняя версия остаётся резервной копией в ../.<имя скилла>.backups/<время>-v<версия> (не папка-скилл, Claude её не грузит).
# PDS_REMOTE — только для тестов (tests/update/run.sh): другой адрес репозитория для установки из архива.
set -e
SKILL="${0:A:h:h}"
cd "$SKILL"
YES=0; WANT=""; UNSIGNED=0; ROLLBACK=0
for a in "$@"; do case "$a" in --yes) YES=1 ;; --allow-unsigned) UNSIGNED=1 ;; --rollback) ROLLBACK=1 ;; v*) WANT="$a" ;; esac; done

BK="${SKILL:h}/.${SKILL:t}.backups"
TMP=""; STAGE=""; LOCKED=0
cleanup() { [ -z "$STAGE" ] || rm -rf "$STAGE"; [ -z "$TMP" ] || rm -rf "$TMP"; [ $LOCKED = 0 ] || rmdir "$BK/.lock" 2>/dev/null; true; }
trap cleanup EXIT
zmodload zsh/datetime
stamp() { local t=$EPOCHREALTIME; strftime -s REPLY '%Y%m%d-%H%M%S' ${t%.*}; REPLY+="-${${t#*.}[1,3]}"; }
ver() { local v=""; [ ! -f "$1/VERSION" ] || v=$(tr -d '[:space:]' < "$1/VERSION"); echo "v${v:-?}"; }
lock() {
  mkdir -p "$BK"
  mkdir "$BK/.lock" 2>/dev/null || { echo "Уже идёт другое обновление или откат. Если нет — удалите $BK/.lock"; exit 1; }
  LOCKED=1
}
# venv привязан к своей папке: после переноса пути в скриптах .venv/bin и pyvenv.cfg переписываются
relocate() {
  [ -d "$1/.venv" ] || return 0
  grep -rlIF -- "$2/.venv" "$1/.venv/bin" "$1/.venv/pyvenv.cfg" 2>/dev/null | while IFS= read -r f; do
    [ -L "$f" ] || F="$2/.venv" T="$3/.venv" perl -pi -e 's/\Q$ENV{F}\E/$ENV{T}/g' "$f"
  done
}
# ваши файлы в папке $1 по её .gitignore: config.json, уроки, *.local.md
userdata() {
  GIT_INDEX_FILE="$TMP/none" git -C "$1" --git-dir="$G/.git" --work-tree="$1" ls-files -z --others --ignored --exclude-standard -- config.json learnings ':(glob)**/*.local.md'
}

if [ $ROLLBACK = 1 ]; then
  BB=( "$BK"/[0-9]*(N/On) )
  if [ ${#BB} = 0 ]; then
    echo "Резервных копий нет ($BK)."
    [ ! -d .git ] || echo "В git-клоне вернитесь на прошлый релиз: zsh $SKILL/scripts/update.sh --yes vX.Y.Z"
    exit 1
  fi
  B=$BB[1]
  echo "Откат: сейчас $(ver "$SKILL") → резервная копия $(ver "$B") (${B:t})"
  [ -f "$B/SKILL.md" ] && [ -f "$B/scripts/update.sh" ] || { echo "Резервная копия неполная, откат невозможен: $B"; exit 1; }
  if [ $YES = 0 ]; then
    echo "Настройки и уроки перенесутся из текущей версии, она сама станет резервной копией."
    echo "Откатить: zsh $SKILL/scripts/update.sh --rollback --yes"
    exit 2
  fi
  command -v git >/dev/null || { echo "Нужен git: xcode-select --install"; exit 1; }
  lock
  TMP=$(mktemp -d); G="$TMP/g"; git init -q "$G"; cp "$SKILL/.gitignore" "$G/.git/info/exclude" 2>/dev/null || true
  # ваши данные берутся из текущей версии: копия получает их поверх своих, текущая версия целиком уходит в резервную копию
  userdata "$SKILL" | while IFS= read -r -d '' p; do mkdir -p "$B/${p:h}"; cp -p "$SKILL/$p" "$B/$p"; done
  stamp; AWAY="$BK/$REPLY-$(ver "$SKILL")"
  mv "$SKILL" "$AWAY" || { echo "Не удалось переименовать папку скилла, ничего не изменено"; exit 1; }
  if ! mv "$B" "$SKILL"; then mv "$AWAY" "$SKILL"; echo "Не удалось вернуть резервную копию, установка не тронута"; exit 1; fi
  echo "Откат выполнен: стоит $(ver "$SKILL"). Версия, с которой откатились: $AWAY (повторный --rollback --yes вернёт её)"
  echo "Откройте новую сессию Claude Code, чтобы скилл перечитался"
  exit 0
fi

if [ ! -d .git ]; then
  # ── установка из архива ──
  REMOTE=${PDS_REMOTE:-https://github.com/aleksandrermolov87-cloud/pitch-deck-skill.git}
  [ -z "$PDS_REMOTE" ] || echo "ВНИМАНИЕ: источник релизов переопределён PDS_REMOTE=$PDS_REMOTE (только для тестов)"
  command -v git >/dev/null || { echo "Нужен git: xcode-select --install"; exit 1; }
  export GIT_TERMINAL_PROMPT=0
  CUR=$(ver "$SKILL")
  TMP=$(mktemp -d); G="$TMP/g"; git init -q "$G"
  net() { perl -e 'alarm shift; exec @ARGV' "$@" 2>/dev/null; }
  TAGS=$(net 60 git ls-remote --tags --refs "$REMOTE" 'refs/tags/v*') || { echo "Не удалось связаться с $REMOTE (нет сети?). Ничего не изменено"; exit 1; }
  NEW=${WANT:-$(print -r -- "$TAGS" | sed -n 's#.*refs/tags/\(v[0-9]*\.[0-9]*\.[0-9]*\)$#\1#p' | sort -V | tail -1)}
  [ -n "$NEW" ] || { echo "релизов нет"; exit 1; }
  [[ "$NEW" =~ '^v[0-9]+\.[0-9]+\.[0-9]+$' ]] || { echo "неверное имя релиза: $NEW"; exit 1; }
  [[ $'\n'"$TAGS"$'\n' == *$'\t'"refs/tags/$NEW"$'\n'* ]] || { echo "релиза $NEW нет"; exit 1; }
  if [ "$CUR" = "$NEW" ]; then echo "уже стоит последний релиз $NEW"; exit 0; fi
  fetch() { net 600 git -C "$G" fetch --quiet --depth=1 --no-tags "$REMOTE" "+refs/tags/${1}:refs/tags/${1}"; }
  fetch "$NEW" || { echo "Не удалось скачать релиз $NEW (нет сети?). Ничего не изменено"; exit 1; }
  OLD=""; if [ "$CUR" != "v?" ] && fetch "$CUR"; then OLD="$CUR"; fi
  gq() { git -C "$G" -c core.quotePath=false "$@"; }
  # правила .gitignore релиза — на случай, если установщик не положил .gitignore в папку скилла
  gq show "${NEW}:.gitignore" > "$G/.git/info/exclude" 2>/dev/null || true

  echo "Сейчас: $CUR (установка без git) → релиз: $NEW"
  SIGNERS="$TMP/allowed_signers"
  cp "$SKILL/.github/allowed_signers" "$SIGNERS" 2>/dev/null || : > "$SIGNERS"
  if [ -s "$SIGNERS" ] && gq -c gpg.ssh.allowedSignersFile="$SIGNERS" verify-tag "$NEW" >/dev/null 2>&1; then
    echo "подпись релиза проверена ключом автора"
  elif [ $UNSIGNED = 1 ]; then
    echo "ВНИМАНИЕ: подпись не проверена, обновление по --allow-unsigned"
  else
    echo "Подпись релиза $NEW не проверена ключом из .github/allowed_signers. Не обновляйте, пока автор не подтвердит релиз лично."
    echo "Если автор сменил ключ, он сообщит об этом; тогда: zsh $SKILL/scripts/update.sh --yes --allow-unsigned $NEW"
    exit 1
  fi
  [ "$(gq show "${NEW}:VERSION" 2>/dev/null | tr -d '[:space:]')" = "${NEW#v}" ] || { echo "VERSION в релизе $NEW не совпадает с тегом — не обновляю"; exit 1; }

  # дерево текущей установки (только файлы релизов) — чтобы показать реальные изменения и локальные правки
  { gq ls-tree -r -z --name-only "$NEW"; [ -z "$OLD" ] || gq ls-tree -r -z --name-only "$OLD"; } > "$TMP/all"
  for p in ${(0u)"$(<"$TMP/all")"}; do if [ -e "$SKILL/$p" ] || [ -L "$SKILL/$p" ]; then print -rn -- "$p"$'\0'; fi; done > "$TMP/have"
  [ ! -s "$TMP/have" ] || GIT_INDEX_FILE="$TMP/idx" git --literal-pathspecs -C "$SKILL" --git-dir="$G/.git" --work-tree="$SKILL" add -f --pathspec-from-file="$TMP/have" --pathspec-file-nul
  INST=$(GIT_INDEX_FILE="$TMP/idx" git --git-dir="$G/.git" write-tree)
  echo "\nЧто нового (CHANGELOG.md):"
  gq show "${NEW}:CHANGELOG.md" 2>/dev/null | awk '/^## /{n++} n==1' | head -40
  echo "\nИзменения в исполняемых частях и инструкциях агента:"
  gq diff --stat "$INST" "$NEW" -- scripts templates SKILL.md reference components requirements.txt package.json package-lock.json | tail -25
  if [ -n "$OLD" ]; then
    MOD=$(gq diff --raw --no-abbrev --no-renames "$OLD" "$INST" | awk -F'\t' '{split($1,a," ")} a[5]=="M" && a[3]!=a[4] {print $2}')
    if [ -n "$MOD" ]; then
      echo "\nИзменены локально — заменятся версией релиза, ваши копии останутся в резервной копии:"
      print -r -- "$MOD" | sed 's/^/  /' | head -20
    fi
  else
    echo "\nПредыдущий релиз не найден: файлы, удалённые в $NEW, могут остаться в папке"
  fi
  if [ $YES = 0 ]; then
    echo "\nПроверьте изменения и запустите: zsh $SKILL/scripts/update.sh --yes $NEW"
    [ -z "$OLD" ] || [ -n "$PDS_REMOTE" ] || echo "Полный diff: https://github.com/aleksandrermolov87-cloud/pitch-deck-skill/compare/$OLD...$NEW"
    exit 2
  fi

  lock
  stamp; TS=$REPLY
  STAGE="$BK/.stage-$TS"; mkdir "$STAGE"; STAGED="$STAGE"
  gq archive -o "$TMP/release.tar" "$NEW"
  tar -xf "$TMP/release.tar" -C "$STAGE"
  echo "\nПереношу настройки, уроки и окружение в промежуточную папку"
  # всё, чего нет в релизе, переносится побайтно; файлы релиза — из нового тега
  rsync -a --ignore-existing "$SKILL/" "$STAGE/"
  # файлы, удалённые в новом релизе, не возвращаются
  if [ -n "$OLD" ]; then
    typeset -A KEEP; for p in ${(0)"$(gq ls-tree -r -z --name-only "$NEW")"}; do KEEP[$p]=1; done
    for p in ${(0)"$(gq ls-tree -r -z --name-only "$OLD")"}; do [ -n "${KEEP[$p]}" ] || rm -f "$STAGE/$p"; done
  fi
  # ваши config.json, уроки и *.local.md всегда остаются вашими, даже если релиз принёс файл с тем же именем
  userdata "$SKILL" | while IFS= read -r -d '' p; do mkdir -p "$STAGE/${p:h}"; cp -p "$SKILL/$p" "$STAGE/$p"; done
  # другие зависимости npm — поставить заново по package-lock.json релиза
  if [ -f "$SKILL/package-lock.json" ] || [ -f "$STAGE/package-lock.json" ]; then
    cmp -s "$SKILL/package-lock.json" "$STAGE/package-lock.json" || rm -rf "$STAGE/node_modules"
  fi
  relocate "$STAGE" "$SKILL" "$STAGE"

  echo "\nУстановка зависимостей и проверка в промежуточной папке"
  zsh "$STAGE/scripts/setup.sh" || { echo "setup.sh релиза $NEW не прошёл. Установка не тронута: $SKILL"; exit 1; }
  quick() {
    [ "$(ver "$STAGE")" = "$NEW" ] && [ -f "$STAGE/SKILL.md" ] || { echo "  в релизе нет SKILL.md или VERSION"; return 1; }
    if [ -f "$STAGE/config.json" ] && command -v node >/dev/null; then
      node -e 'JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"))' "$STAGE/config.json" || { echo "  config.json не читается"; return 1; }
    fi
    # что работало до обновления, должно работать и после
    if [ -x "$SKILL/.venv/bin/python" ]; then "$STAGE/.venv/bin/python" -I -m pip check >/dev/null || { echo "  несовместимые Python-зависимости (pip check)"; return 1; }; fi
    if [ -d "$SKILL/node_modules/pptxgenjs" ]; then [ -d "$STAGE/node_modules/pptxgenjs" ] || { echo "  не поставился pptxgenjs"; return 1; }; fi
    return 0
  }
  quick || { echo "Быстрая проверка релиза $NEW не прошла. Установка не тронута: $SKILL"; exit 1; }

  BACKUP="$BK/$TS-$CUR"
  mv "$SKILL" "$BACKUP" || { echo "Не удалось переименовать папку скилла. Установка не тронута: $SKILL"; exit 1; }
  if ! mv "$STAGE" "$SKILL"; then mv "$BACKUP" "$SKILL"; echo "Не удалось подменить папку. Установка не тронута: $SKILL"; exit 1; fi
  STAGE=""
  relocate "$SKILL" "$STAGED" "$SKILL"
  echo "обновлено до $NEW. Прежняя версия сохранена: $BACKUP"
  echo "Откат: zsh $SKILL/scripts/update.sh --rollback --yes. Откройте новую сессию Claude Code, чтобы скилл перечитался"
  exit 0
fi

# ── git-клон ──
[ -z "$(git status --porcelain --untracked-files=no)" ] || { echo "В папке скилла есть изменённые файлы из репозитория (git status). Сохраните их отдельно или верните: git stash"; exit 1; }

git fetch --quiet --tags --force origin
NEW=${WANT:-$(git tag -l 'v*' --sort=-v:refname | head -1)}
[ -n "$NEW" ] || { echo "релизов нет"; exit 1; }
[[ "$NEW" =~ '^v[0-9]+\.[0-9]+\.[0-9]+$' ]] || { echo "неверное имя релиза: $NEW"; exit 1; }
CUR=$(git describe --tags --exact-match 2>/dev/null || git rev-parse --short HEAD)
if [ "$CUR" = "$NEW" ]; then echo "уже стоит последний релиз $NEW"; exit 0; fi

echo "Сейчас: $CUR → релиз: $NEW"
SIGNERS=$(mktemp); trap 'rm -f "$SIGNERS"' EXIT
cp "$SKILL/.github/allowed_signers" "$SIGNERS" 2>/dev/null || : > "$SIGNERS"
if [ -s "$SIGNERS" ] && git -c gpg.ssh.allowedSignersFile="$SIGNERS" verify-tag "$NEW" >/dev/null 2>&1; then
  echo "подпись релиза проверена ключом автора"
elif [ $UNSIGNED = 1 ]; then
  echo "ВНИМАНИЕ: подпись не проверена, обновление по --allow-unsigned"
else
  echo "Подпись релиза $NEW не проверена ключом из .github/allowed_signers. Не обновляйте, пока автор не подтвердит релиз лично."
  echo "Если автор сменил ключ, он сообщит об этом; тогда: zsh $SKILL/scripts/update.sh --yes --allow-unsigned $NEW"
  exit 1
fi
echo "\nЧто нового (CHANGELOG.md):"
git show "$NEW:CHANGELOG.md" | awk '/^## /{n++} n==1' | head -40
echo "\nИзменения в исполняемых частях и инструкциях агента:"
git diff --stat "HEAD" "$NEW" -- scripts templates SKILL.md reference components requirements.txt package.json package-lock.json | tail -25
if [ $YES = 0 ]; then
  echo "\nПроверьте изменения (git diff HEAD $NEW -- scripts templates SKILL.md) и запустите: zsh $SKILL/scripts/update.sh --yes $NEW"
  exit 2
fi
git -c advice.detachedHead=false checkout --quiet "$NEW"
zsh "$SKILL/scripts/setup.sh"
echo "обновлено до $NEW. Откройте новую сессию Claude Code, чтобы скилл перечитался"
