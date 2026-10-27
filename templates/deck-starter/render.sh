#!/bin/zsh
# PNG каждого слайда из HTML-двойника (headless Chrome) + отчёт {font, overflow}.
# OUT=out|out-light — каталог темы; SCALE=2 — 4K (3840×2160) вместо 1920×1080; SLIDE='3 5' — только эти слайды (быстрая правка текста).
cd "$(dirname "$0")"
OUT=${OUT:-out}
SCALE=${SCALE:-1}
CHROME=""
for c in "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" "$HOME/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
         "/Applications/Chromium.app/Contents/MacOS/Chromium" "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge" \
         $(command -v google-chrome chromium chromium-browser 2>/dev/null); do [ -x "$c" ] && { CHROME="$c"; break; }; done
[ -n "$CHROME" ] || { echo "Нужен Google Chrome или Chromium для рендера PNG"; exit 1; }
FONT=$(node -e 'console.log(JSON.parse(require("fs").readFileSync("theme.json","utf8")).font.regular)')
HTML="$PWD/$OUT/deck.html"
PROFILE=$(mktemp -d "${TMPDIR:-/tmp}/pitch-deck-chrome-XXXXXX")   # свой профиль на запуск: параллельные рендеры не мешают друг другу; --use-mock-keychain — Chrome не трогает связку ключей macOS
trap 'rm -rf "$PROFILE"' EXIT
DIR=$OUT/png$([ "$SCALE" = 1 ] || echo "@${SCALE}x")
mkdir -p "$DIR"
N=$(grep -o '<section class="slide"' "$HTML" | wc -l | tr -d ' ')
LIST=${SLIDE:-$(seq 1 $N)}
for i in ${=LIST}; do
  sed "s#</style>#body{padding:0}.slide:not(\#s$i){display:none}.slide{width:1920px}</style>#" "$HTML" > $OUT/_one.html
  perl -e 'alarm 45; exec @ARGV' "$CHROME" --headless=new --disable-gpu --use-mock-keychain --password-store=basic --no-first-run --user-data-dir="$PROFILE" --hide-scrollbars \
    --force-device-scale-factor=$SCALE --window-size=1920,1080 --virtual-time-budget=3000 \
    --screenshot="$PWD/$DIR/s$i.png" "file://$PWD/$OUT/_one.html" >/dev/null 2>&1
done
# Замер: текст, вылезший за свой бокс, и наличие шрифта
sed "s#</body>#<script>document.fonts.ready.then(()=>{const bad=[];document.querySelectorAll('.t').forEach(t=>{const p=t.querySelector('p').getBoundingClientRect(),b=t.getBoundingClientRect();if(p.height>b.height+1||p.width>b.width+1)bad.push((t.dataset.id||t.textContent.slice(0,30))+' h:'+p.height.toFixed(0)+'/'+b.height.toFixed(0)+' w:'+p.width.toFixed(0)+'/'+b.width.toFixed(0));});const o=document.createElement('pre');o.id='M';o.textContent=JSON.stringify({slides:$N,font:document.fonts.check('12px \"$FONT\"'),overflow:bad});document.body.appendChild(o);});</script></body>#" "$HTML" > $OUT/_m.html
perl -e 'alarm 45; exec @ARGV' "$CHROME" --headless=new --disable-gpu --use-mock-keychain --password-store=basic --no-first-run --user-data-dir="$PROFILE" --window-size=1920,1080 \
  --virtual-time-budget=3000 --dump-dom "file://$PWD/$OUT/_m.html" 2>/dev/null | grep -o '<pre id="M">.*</pre>' | sed 's#<[^>]*>##g'
rm -f $OUT/_one.html $OUT/_m.html
echo "PNG: $PWD/$DIR"
