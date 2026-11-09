# Установка в Claude Code

Инструкция для новой локальной установки на macOS. Нужен Claude Code с доступом к терминалу и файлам компьютера. На Linux этот сценарий не проверен; Windows не поддерживается. Если скилл уже установлен, используйте [обновление](updating.md), чтобы сохранить настройки и уроки.

## 1. Подготовьте программы

Нужны Git с проверкой SSH-подписей (`git verify-tag`, Git 2.34+), OpenSSH (`ssh-keygen`), zsh, Node.js 18+ с npm, Python 3.11+, Google Chrome или Chromium, poppler, curl и Perl. На macOS утилиты `awk`, `shasum` и `mktemp` входят в систему. Python должен поддерживать создание `venv`.

Если Git отсутствует, выполните `xcode-select --install` и дождитесь завершения системного установщика. Остальные недостающие программы можно поставить через [Homebrew](https://brew.sh):

```bash
brew install node python@3.12 poppler
brew install --cask google-chrome
```

Homebrew нужен только для автоматической установки системных программ. Скрипт `python.sh` ищет подходящий Python в PATH, затем через `uv python find`. Python-пакеты будут установлены в `.venv` внутри скилла, Node-пакеты в `node_modules`.

## 2. Скачайте и проверьте релиз

Команды ниже устанавливают конкретный подписанный релиз v1.13.0. До запуска скриптов они сверяют отпечаток публичного ключа, подпись тега, коммит и версию. Ожидаемый отпечаток: `SHA256:GOJu1Mq/91ufd43Icikuj/NE4fLwiGqTEmMsOyL28VM`. При первой установке сверяйте его с автором по доверенному каналу: ключ из скачанного репозитория сам по себе не подтверждает автора.

Вставьте блок целиком в терминал. Существующая папка или ссылка не перезаписывается.

```bash
(
  set -eu
  PITCH_SKILL="$HOME/.claude/skills/pitch-deck-skill"
  if [ -e "$PITCH_SKILL" ] || [ -L "$PITCH_SKILL" ]; then
    echo "Папка уже существует: $PITCH_SKILL. Используйте инструкцию обновления."
    exit 1
  fi
  PITCH_VERIFY=$(mktemp -d)
  trap 'rm -rf "$PITCH_VERIFY"' EXIT

  git clone --no-checkout \
    https://github.com/aleksandrermolov87-cloud/pitch-deck-skill.git \
    "$PITCH_VERIFY/repo"
  git -C "$PITCH_VERIFY/repo" show v1.13.0:.github/release-signing-key.pub > "$PITCH_VERIFY/key.pub"
  PITCH_FINGERPRINT=$(ssh-keygen -lf "$PITCH_VERIFY/key.pub" | awk '{print $2}')
  test "$PITCH_FINGERPRINT" = 'SHA256:GOJu1Mq/91ufd43Icikuj/NE4fLwiGqTEmMsOyL28VM'
  printf '280332880+aleksandrermolov87-cloud@users.noreply.github.com namespaces="git" %s\n' \
    "$(cat "$PITCH_VERIFY/key.pub")" > "$PITCH_VERIFY/allowed_signers"
  git -C "$PITCH_VERIFY/repo" -c gpg.ssh.allowedSignersFile="$PITCH_VERIFY/allowed_signers" verify-tag v1.13.0
  test "$(git -C "$PITCH_VERIFY/repo" rev-parse 'v1.13.0^{commit}')" = '281b502b3c280a0402122b9cecd803e45ba9fc56'
  test "$(git -C "$PITCH_VERIFY/repo" show v1.13.0:VERSION)" = '1.13.0'
  git -C "$PITCH_VERIFY/repo" -c advice.detachedHead=false checkout --detach v1.13.0

  mkdir -p "$(dirname "$PITCH_SKILL")"
  mv "$PITCH_VERIFY/repo" "$PITCH_SKILL"
  echo "Подпись проверена. Релиз установлен в $PITCH_SKILL"
)
```

Если любая проверка завершилась ошибкой, остановитесь. Не запускайте `setup.sh` и не отключайте проверку подписи.

## 3. Установите зависимости и выполните самопроверку

Базовый вариант `lite` работает без ключа 21st. Команда ниже также отключает 3D и подключение MCP:

```bash
zsh ~/.claude/skills/pitch-deck-skill/scripts/setup.sh --mode lite --no-3d --selftest
zsh ~/.claude/skills/pitch-deck-skill/scripts/doctor.sh
```

`setup.sh` создаёт `config.json`, устанавливает Python-пакеты по `requirements.txt` и Node-пакеты по `package-lock.json` (`npm ci --ignore-scripts`). Рядом со скиллом он копирует `humanizer` и `taste-skill` из `vendor/`, только если их ещё нет. Также скачивает демонстрационные картинки с CDN Magic Patterns, собирает демо и галерею компонентов. Даже с `--no-3d` для установки нужен интернет.

Если системные программы ещё не установлены, добавьте `--system`: setup доставит недостающие через Homebrew. Для проверки PPTX через LibreOffice добавьте вместе с ним `--with-libreoffice`. Это необязательная установка приложения.

Самопроверка должна завершиться без сообщения «самопроверка не пройдена» и без ошибок аудита демо и галереи. `doctor.sh` возвращает ненулевой код, если нет обязательных зависимостей. Отсутствие фирменного шрифта, 3D и PowerPoint/LibreOffice допускается: диагностика отмечает их отдельно. Статус подписи не заменяет проверку сборки.

## 4. Откройте новый чат Claude Code

[Официальная документация Claude Code](https://code.claude.com/docs/en/skills) указывает `~/.claude/skills/<имя>/SKILL.md` для личных скиллов во всех локальных проектах. Дополнительные ссылки и копии не нужны. В новом чате вызовите `/pitch-deck-skill` или попросите:

> Используй pitch-deck-skill. Собери по приложенной таблице презентацию для управляющей компании, 8–10 слайдов, PowerPoint и PDF.

Этот сценарий предназначен для локального Claude Code, в том числе терминала или локального режима Code в приложении. Cowork и облачные чаты не используют эту локальную папку.

## Дополнительно: 3D и 21st

Для 3D через Magic Patterns на новой установке уберите `--no-3d` из шага 3. Setup регистрирует сервер через `claude mcp add --transport http --scope user`; если на компьютере есть CLI Codex, он пытается настроить сервер и там. В Claude Code откройте `/mcp`, выберите `magicpatterns` и выполните Authenticate. Доступ к сервису и условия тарифа проверяйте в своём аккаунте.

При повторной настройке после `--no-3d` сначала измените `config.json`: `image_provider` на `auto`, `magicpatterns` на `true`, затем повторите setup без `--no-3d`. Проверка подключения:

```bash
zsh ~/.claude/skills/pitch-deck-skill/scripts/mcp_setup.sh --check
```

Режим `full` использует также 21st Magic MCP. Для него повторите setup с `--mode full`, сохранив нужный выбор 3D, и зарегистрируйте ключ в своём терминале:

```bash
claude mcp add --transport http 21st https://21st.dev/api/mcp --header "x-api-key: ВАШ_КЛЮЧ" --scope user
```

Ключ берётся в аккаунте на [21st.dev](https://21st.dev/mcp). Не присылайте его в чат. Режим `lite` сохраняет библиотеку компонентов и проверки; 21st для него не нужен.

## Фирменный шрифт и обновление

Styrene A LC не входит в репозиторий. Если у вас есть лицензионный фирменный пакет, установите его:

```bash
zsh ~/.claude/skills/pitch-deck-skill/scripts/font.sh install "<папка, .zip или https-ссылка на .zip>"
```

До установки используется запасной шрифт. Дальше: [работа и проверки](usage.md), [обновление и откат](updating.md). Установка `impeccable` и расширения для браузера в этот сценарий не входит; выполняйте её отдельно, если она нужна.
