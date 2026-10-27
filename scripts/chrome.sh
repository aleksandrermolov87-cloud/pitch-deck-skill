#!/bin/zsh
# Путь к Chrome / Chromium для headless-рендера (macOS и Linux). Код 1, если не найден.
for c in "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
         "$HOME/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
         "/Applications/Chromium.app/Contents/MacOS/Chromium" \
         "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"; do
  [ -x "$c" ] && { echo "$c"; exit 0; }
done
for c in google-chrome google-chrome-stable chromium chromium-browser; do
  command -v $c >/dev/null && { command -v $c; exit 0; }
done
exit 1
