#!/bin/zsh
# MagicPatterns MCP для 3D-объектов: подключение в Claude Code и Codex (reference/09-3d-objects.md).
#   zsh mcp_setup.sh            — проверить и подключить, где не подключён
#   zsh mcp_setup.sh --check    — только проверить (код 1, если 3D-генератора нет ни в одной среде)
# Сервер: https://mcp.magicpatterns.com/mcp (HTTP, вход через браузер по OAuth). Ключи скрипт не спрашивает и не хранит:
# вход пользователь делает сам — в Claude Code командой /mcp, в Codex командой codex mcp login magicpatterns.
URL="https://mcp.magicpatterns.com/mcp"
CHECK=0; [ "$1" = "--check" ] && CHECK=1
ok()   { print -P "  %F{green}✓%f $1"; }
warn() { print -P "  %F{yellow}•%f $1"; }
found=0

if command -v claude >/dev/null; then
  L=$(perl -e 'alarm 60; exec @ARGV' claude mcp list 2>/dev/null)
  if echo "$L" | grep -q "mcp.magicpatterns.com"; then
    if echo "$L" | grep "mcp.magicpatterns.com" | grep -qi "connected"; then ok "Claude: Magic Patterns подключён"; found=1
    else warn "Claude: Magic Patterns добавлен, но вход не выполнен — в Claude Code: /mcp → magicpatterns → Authenticate"; fi
  elif [ $CHECK = 1 ]; then
    warn "Claude: Magic Patterns не подключён — zsh $0 (или в приложении Claude: Settings → Connectors → Magic Patterns)"
  else
    claude mcp add --transport http --scope user magicpatterns "$URL" >/dev/null 2>&1 \
      && ok "Claude: Magic Patterns добавлен (scope user). Войдите один раз: в Claude Code /mcp → magicpatterns → Authenticate" \
      || warn "Claude: не удалось добавить — claude mcp add --transport http --scope user magicpatterns $URL"
  fi
else
  warn "CLI claude не найден: в приложении Claude подключите Settings → Connectors → Magic Patterns"
fi

if command -v codex >/dev/null; then
  L=$(perl -e 'alarm 60; exec @ARGV' codex mcp list 2>/dev/null)
  if echo "$L" | grep -q "mcp.magicpatterns.com"; then
    if echo "$L" | grep "mcp.magicpatterns.com" | grep -qi "not logged in"; then
      warn "Codex: Magic Patterns добавлен, вход не выполнен — в Терминале: codex mcp login magicpatterns"
    else ok "Codex: Magic Patterns подключён"; fi
  elif [ $CHECK = 1 ]; then
    warn "Codex: Magic Patterns не подключён — zsh $0; 3D в Codex рисует встроенный image_gen, Magic Patterns — вариант на выбор"
  else
    # codex mcp add пишет сервер в config.toml и сразу начинает вход через браузер; вход — дело пользователя,
    # поэтому ждём 20 с, прерываем и проверяем запись по codex mcp list
    perl -e 'alarm 20; exec @ARGV' codex mcp add magicpatterns --url "$URL" </dev/null >/dev/null 2>&1
    if perl -e 'alarm 60; exec @ARGV' codex mcp list 2>/dev/null | grep -q "mcp.magicpatterns.com"; then
      ok "Codex: Magic Patterns добавлен. Войдите один раз в Терминале: codex mcp login magicpatterns"
    else warn "Codex: не удалось добавить — codex mcp add magicpatterns --url $URL"; fi
  fi
  ok "Codex: встроенный image_gen (скилл imagegen) — провайдер 3D по умолчанию, ключ не нужен"; found=1
fi
[ $CHECK = 0 ] || [ $found = 1 ]
