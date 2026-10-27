#!/bin/zsh
# Аудит зависимостей скилла на известные уязвимости: npm-пакеты по package-lock.json и Python-пакеты venv (вместе с pip).
#   zsh deps_audit.sh            код 1, если есть уязвимости; release.sh не выпускает версию с ними
# pip-audit ставится в отдельное окружение $SKILL/.build/pip-audit (закреплённая версия) и в venv скилла не попадает.
# Базы уязвимостей — npm registry и PyPI/OSV, нужен интернет. Нет сети — код 2 и «не выполнялось», а не «чисто».
SKILL="${0:A:h:h}"; cd "$SKILL"
PIP_AUDIT=2.10.1
fail=0
print "› npm audit (package-lock.json)"
if OUT=$(npm audit --omit=dev --json 2>/dev/null); then print "  уязвимостей нет"
else
  N=$(print -r -- "$OUT" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const v=JSON.parse(s).metadata.vulnerabilities;console.log(v.total)}catch(e){console.log("?")}})')
  [ "$N" = "?" ] && { print "  npm audit не выполнился (нет сети?)"; exit 2; }
  print -r -- "$OUT" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);for(const[k,v]of Object.entries(j.vulnerabilities||{}))console.log(`  ${v.severity}: ${k} ${v.range}${v.fixAvailable?" — исправление есть":""}`)})'
  fail=1
fi
print "› pip-audit (.venv, вместе с pip)"
[ -x .venv/bin/python ] || { print "  нет .venv: zsh scripts/setup.sh"; exit 2; }
A=.build/pip-audit
if [ ! -x $A/bin/pip-audit ] || [ "$($A/bin/pip-audit --version 2>/dev/null | cut -d' ' -f2)" != $PIP_AUDIT ]; then
  rm -rf $A; mkdir -p .build; "$(zsh scripts/python.sh)" -m venv $A && $A/bin/python -I -m pip -q install --disable-pip-version-check "pip-audit==$PIP_AUDIT" \
    || { print "  pip-audit не установился (нет сети?)"; exit 2; }
fi
SP=$(.venv/bin/python -I -c 'import sysconfig; print(sysconfig.get_paths()["purelib"])')
if OUT=$($A/bin/pip-audit --path "$SP" --progress-spinner off 2>&1); then print "  уязвимостей нет"
else
  print -r -- "$OUT" | grep -qiE 'ConnectionError|Max retries|Failed to resolve' && { print "  pip-audit не выполнился (нет сети?)"; exit 2; }
  print -r -- "$OUT" | sed 's/^/  /'; fail=1
fi
[ $fail = 0 ] && print "ok: зависимости без известных уязвимостей" || { print "есть уязвимые зависимости"; exit 1; }
