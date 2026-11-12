# Шрифты, 21st и 3D

Сначала задайте текущую папку скилла. Пример для новой установки Codex:

```bash
PITCH_SKILL="$HOME/.agents/skills/pitch-deck-skill"
```

Для Claude Code используйте `$HOME/.claude/skills/pitch-deck-skill`; для ZCode — `$HOME/.zcode/skills/pitch-deck-skill`; для прежней установки укажите её реальный путь.

## Режим

`lite` использует встроенный каталог. `full` добавляет возможность обращаться к 21st Magic MCP, когда библиотека не закрывает задачу. Ключ и доступ к сервису настраиваются отдельно. Полнота проверки не зависит от выбора lite/full.

```bash
zsh "$PITCH_SKILL/scripts/setup.sh" --mode full --no-mcp
```

Глубина работы хранится в `config.json → quality_profile`: `deep` для новой презентации, `refine` для доработки, `quick` для точных правок. Пользовательский бриф и утверждённый референс определяют оформление.

## 21st в Codex

В локальном `~/.codex/config.toml` добавьте сервер. Для ключа из переменной окружения используется [env_http_headers](https://learn.chatgpt.com/docs/extend/mcp?surface=cli):

```toml
[mcp_servers."21st"]
url = "https://21st.dev/api/mcp"
env_http_headers = { "x-api-key" = "TWENTY_FIRST_API_KEY" }
```

Переменная `TWENTY_FIRST_API_KEY` должна быть доступна процессу Codex. Для запуска CLI из Bash можно ввести ключ без записи значения в историю:

```bash
printf 'Ключ 21st: '
read -r -s TWENTY_FIRST_API_KEY
printf '\n'
export TWENTY_FIRST_API_KEY
codex
```

В настольном Codex окружение задаётся при запуске приложения. Другой поддержанный вариант — поле `http_headers` в локальной конфигурации с ключом, введённым на своём компьютере. Не добавляйте такой файл с ключом в репозиторий. Проверка сервера: `codex mcp list`.

## 21st в Claude Code

Выполните из Bash; ключ вводится в терминале:

```bash
printf 'Ключ 21st: '
read -r -s PITCH_21ST_KEY
printf '\n'
claude mcp add --transport http --scope user 21st https://21st.dev/api/mcp \
  --header "x-api-key: $PITCH_21ST_KEY"
unset PITCH_21ST_KEY
claude mcp list
```

Документация сервиса: [21st Magic MCP](https://21st.dev/mcp). Условия доступа определяет сервис.

## 3D

Генерация изображений используется, когда она нужна по брифу и доступна в текущей среде. Наличие инструмента генерации в Codex зависит от среды; один `config.json` его не добавляет.

Для Magic Patterns подключите сервер только в нужном клиенте:

```bash
# Codex
codex mcp add magicpatterns --url https://mcp.magicpatterns.com/mcp
codex mcp login magicpatterns
```

```bash
# Claude Code
claude mcp add --transport http --scope user magicpatterns https://mcp.magicpatterns.com/mcp
```

В Claude Code завершите вход через `/mcp`. Для сервиса нужен собственный аккаунт с доступом к генерации. Провайдер выбирается в `config.json → image_provider`: `auto`, `codex-imagegen`, `magicpatterns` или `none`. Схемы можно собрать векторными средствами без генератора изображений.

## MCP в ZCode Agent

В Settings → MCP Servers → New MCP Server выберите User и HTTP. Для 21st используйте `https://21st.dev/api/mcp`, заголовок `x-api-key` задайте локально в Headers. Для MagicPatterns используйте `https://mcp.magicpatterns.com/mcp`; если сервис требует OAuth, включите его и завершите Open authorization. Ключи и вход не входят в пакет навыка.

ZCode принимает конфигурацию через Full configuration. Пример без секретов:

```json
{
  "mcpServers": {
    "magicpatterns": {"type": "http", "url": "https://mcp.magicpatterns.com/mcp"}
  }
}
```

Нативная пользовательская конфигурация: `~/.zcode/cli/config.json` → `mcp.servers`; проектная: `.zcode/config.json`. Настройки Codex и Claude Code при этом не меняются. Проверьте статус сервера в Settings → MCP и фактические инструменты в чате. Наличие записи не подтверждает генерацию. Read-only проверка записи MagicPatterns:

```bash
zsh "$PITCH_SKILL/scripts/mcp_setup.sh" --check --client zcode
```

[Официальная документация ZCode MCP](https://zcode.z.ai/en/docs/mcp-services). В ZCode выбирайте `image_provider: "magicpatterns"`, если этот генератор доступен; при работе без генерации — `"none"`. Режим `auto` выбирает только инструмент, реально доступный в текущем чате. Вызовы Codex `image_gen` не предполагаются в ZCode.

## Шрифт

Styrene A LC не распространяется с репозиторием. Установите шрифт из своего лицензированного пакета:

```bash
zsh "$PITCH_SKILL/scripts/font.sh" install "/путь/к/папке-или-архиву"
zsh "$PITCH_SKILL/scripts/font.sh" check
```

До установки используется запасной шрифт. Профиль `alfa` — отдельный пример оформления; проект не связан с Альфа-Банком. Референс пользователя имеет приоритет над этим профилем.

[На главную](../README.md)
