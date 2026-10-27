#!/bin/zsh
# Диагностика окружения скилла: что установлено, какой режим доступен, что исправить.
#   zsh doctor.sh                — полный отчёт (код 1, если не хватает обязательного)
#   zsh doctor.sh --font "<имя>" — установлен ли шрифт (код 0/1)
SKILL="${0:A:h:h}"
font_ok() {
  local f="$1"
  ls ~/Library/Fonts /Library/Fonts /System/Library/Fonts 2>/dev/null | grep -qi "${f// /}" && return 0
  ls ~/Library/Fonts /Library/Fonts 2>/dev/null | grep -qi "${f%% *}" && return 0
  command -v fc-list >/dev/null && fc-list | grep -qi "$f" && return 0
  return 1
}
if [ "$1" = "--font" ]; then font_ok "$2"; exit $?; fi

bad=0
ok()   { print -P "  %F{green}✓%f $1"; }
warn() { print -P "  %F{yellow}•%f $1"; }
fail() { print -P "  %F{red}✗%f $1"; bad=1; }

echo "pitch-deck-skill $(cat "$SKILL/VERSION" 2>/dev/null) — $SKILL"
echo "Обязательное:"
command -v node >/dev/null && ok "Node $(node -v)" || fail "Node.js не найден: brew install node (или https://nodejs.org)"
PY=$(zsh "$SKILL/scripts/python.sh") && ok "Python $("$PY" -V | cut -d' ' -f2)" || fail "нет Python 3.11+: brew install python@3.12 или uv python install 3.12"
if [ -x "$SKILL/.venv/bin/python" ] && "$SKILL/.venv/bin/python" -I -c 'import sys; sys.exit(sys.version_info < (3, 11))'; then ok "venv скилла на $("$SKILL/.venv/bin/python" -V) (numpy, pillow, openpyxl, python-pptx)"
elif [ -x "$SKILL/.venv/bin/python" ]; then fail "venv скилла на $("$SKILL/.venv/bin/python" -V): пересоздайте на 3.11+ — zsh $SKILL/scripts/setup.sh"
else fail "нет venv: zsh $SKILL/scripts/setup.sh"; fi
[ -d "$SKILL/node_modules/pptxgenjs" ] && ok "pptxgenjs" || fail "нет pptxgenjs: zsh $SKILL/scripts/setup.sh"
CHROME=$(zsh "$SKILL/scripts/chrome.sh" 2>/dev/null) && ok "браузер для рендера: ${CHROME:t}" || fail "нет Google Chrome / Chromium (нужен для PNG-превью): brew install --cask google-chrome"

echo "Скиллы-зависимости:"
[ -f ~/.claude/skills/humanizer/SKILL.md ] && ok "humanizer" || warn "humanizer не установлен: zsh $SKILL/scripts/setup.sh поставит копию из vendor/"
{ [ -f ~/.claude/skills/taste-skill/SKILL.md ] || ls -d ~/.claude/plugins/cache/*/taste-skill* >/dev/null 2>&1; } && ok "taste-skill" || warn "taste-skill не установлен: setup.sh поставит копию из vendor/"
IMP=$(zsh "$SKILL/scripts/impeccable.sh" --where 2>/dev/null) && ok "impeccable: $IMP" || warn "impeccable не найден (этап 4 пойдёт без детектора): npx -y impeccable install"

echo "Шрифт бренда:"
BRAND_FONT=$(zsh "$SKILL/scripts/jget.sh" "$SKILL/templates/deck-starter/theme.json" font.regular)
FALLBACK=$(zsh "$SKILL/scripts/jget.sh" "$SKILL/config.json" font_fallback Arial)
font_ok "$BRAND_FONT" && ok "$BRAND_FONT" || warn "$BRAND_FONT не установлен: zsh $SKILL/scripts/font.sh install <папка или zip из фирменного пакета>; до этого деки собираются на $FALLBACK"

echo "Режим (config.json):"
if [ -f "$SKILL/config.json" ]; then
  node -e 'const c=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log("  режим: "+c.mode+" | 21st Magic MCP: "+(c.magic_mcp?"да":"нет")+" | Magic Patterns 3D: "+(c.magicpatterns?"да":"нет")+" | Figma: "+c.figma+" | бренд: "+c.brand)' "$SKILL/config.json"
else
  fail "нет config.json: zsh $SKILL/scripts/setup.sh --mode full|lite"
fi
if command -v claude >/dev/null; then
  MCP=$(claude mcp list 2>/dev/null)
  echo "$MCP" | grep -qi "21st" && ok "MCP 21st есть в claude mcp list (работает ли — видно в чате по инструментам mcp__21st__*)" || warn "MCP 21st в claude mcp list не найден (нужен только для режима full)"
  echo "$MCP" | grep -qi "magic.\?patterns" && ok "MCP Magic Patterns есть в claude mcp list" || warn "Magic Patterns в claude mcp list нет: если подключён коннектором claude.ai — это нормально, проверьте в чате"
else
  warn "CLI claude не найден в PATH: проверку MCP делает агент в чате (инструменты mcp__21st__*, generate_image)"
fi
echo "Проверка PPTX в целевом приложении (по желанию, pptx_target_check.sh; приложение здесь не запускается):"
PPAPP="/Applications/Microsoft PowerPoint.app"
if [ "$(uname)" = Darwin ] && [ -f "$PPAPP/Contents/Info.plist" ]; then
  ok "Microsoft PowerPoint $(plutil -extract CFBundleShortVersionString raw "$PPAPP/Contents/Info.plist" 2>/dev/null) (экспорт в PDF через AppleScript; macOS может спросить разрешение на управление)"
else warn "Microsoft PowerPoint не найден"; fi
SOFFICE=$(command -v soffice || command -v libreoffice || { [ -x /Applications/LibreOffice.app/Contents/MacOS/soffice ] && echo /Applications/LibreOffice.app/Contents/MacOS/soffice; })
[ -n "$SOFFICE" ] && ok "LibreOffice: $SOFFICE" || warn "LibreOffice не найден (по желанию: brew install --cask libreoffice)"
miss=(); for t in pdfinfo pdftotext pdffonts pdfimages pdftoppm; do command -v $t >/dev/null || miss+=$t; done
[ ${#miss} = 0 ] && ok "poppler (pdftotext, pdffonts, pdfimages, pdftoppm): разбор PDF из приложения" \
  || warn "нет ${miss[*]}: без poppler приложение только откроет файл, а переносы, шрифты и картинки не проверятся (brew install poppler)"
{ [ -f "$PPAPP/Contents/Info.plist" ] || [ -n "$SOFFICE" ]; } || warn "ни PowerPoint, ни LibreOffice: в отчёте будет «не выполнялось»; ручной просмотр — pptx_target_check.sh manual"
echo "Ручные настройки (проверяет агент в чате):"
echo "  • Claude in Chrome или Computer Use — для просмотра Figma-референсов в планировщике (этап 0)"
exit $bad
