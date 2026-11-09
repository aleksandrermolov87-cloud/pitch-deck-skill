# Установка в Codex

Инструкция для новой локальной установки на macOS. Нужен Codex с доступом к терминалу и файлам компьютера. На Linux этот сценарий не проверен; Windows не поддерживается. Если скилл уже установлен, используйте [обновление](updating.md), чтобы сохранить настройки и уроки.

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
  PITCH_SKILL="$HOME/.codex/skills/pitch-deck-skill"
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
zsh ~/.codex/skills/pitch-deck-skill/scripts/setup.sh --mode lite --no-3d --selftest
zsh ~/.codex/skills/pitch-deck-skill/scripts/doctor.sh
```

`setup.sh` создаёт `config.json`, устанавливает Python-пакеты по `requirements.txt` и Node-пакеты по `package-lock.json` (`npm ci --ignore-scripts`). Рядом со скиллом он копирует `humanizer` и `taste-skill` из `vendor/`, только если их ещё нет. Также скачивает демонстрационные картинки с CDN Magic Patterns, собирает демо и галерею компонентов. Даже с `--no-3d` для установки нужен интернет.

Если системные программы ещё не установлены, добавьте `--system`: setup доставит недостающие через Homebrew. Для проверки PPTX через LibreOffice добавьте вместе с ним `--with-libreoffice`. Это необязательная установка приложения.

Самопроверка должна завершиться без сообщения «самопроверка не пройдена» и без ошибок аудита демо и галереи. `doctor.sh` возвращает ненулевой код, если нет обязательных зависимостей. Отсутствие фирменного шрифта, 3D и PowerPoint/LibreOffice допускается: диагностика отмечает их отдельно. Статус подписи не заменяет проверку сборки.

## 4. Подключите скиллы к Codex

[Официальная документация OpenAI](https://learn.chatgpt.com/docs/build-skills) указывает `~/.agents/skills` как пользовательскую папку и поддерживает символические ссылки. Релиз v1.13.0 в `SKILL.md` использует путь `~/.codex/skills`, поэтому файлы установлены туда; ссылки ниже добавляют их в актуальную папку обнаружения Codex. Копировать скилл в папку Claude не нужно.

```bash
(
  set -eu
  mkdir -p "$HOME/.agents/skills"
  for PITCH_NAME in pitch-deck-skill humanizer taste-skill; do
    PITCH_SOURCE="$HOME/.codex/skills/$PITCH_NAME"
    PITCH_LINK="$HOME/.agents/skills/$PITCH_NAME"
    test -f "$PITCH_SOURCE/SKILL.md"
    if [ -e "$PITCH_LINK" ] || [ -L "$PITCH_LINK" ]; then
      if [ -L "$PITCH_LINK" ] && [ "$(readlink "$PITCH_LINK")" = "$PITCH_SOURCE" ]; then
        continue
      fi
      echo "Уже существует: $PITCH_LINK. Проверьте установленную версию; ссылка не заменена."
      exit 1
    fi
    ln -s "$PITCH_SOURCE" "$PITCH_LINK"
  done
)
```

Начните новый чат Codex. В CLI проверьте наличие навыка через `/skills` или `$`. Первый запрос:

> Используй $pitch-deck-skill. Собери по приложенной таблице презентацию для управляющей компании, 8–10 слайдов, PowerPoint и PDF.

Если скилл не появился, перезапустите Codex и проверьте ссылки, ограничения среды и список отключённых навыков.

## Дополнительно: 3D

Если в вашей среде Codex доступен `image_gen`, скилл может использовать его. Наличие инструмента нужно проверить в текущей сессии; установка этого репозитория его не добавляет. Чтобы оставить 3D включённым без автоматической регистрации MCP, на новой установке вместо `--no-3d` используйте `--no-mcp` в шаге 3. При повторной настройке после `--no-3d` измените `config.json`: `image_provider` на `auto`, `magicpatterns` на `true`.

Для Magic Patterns повторите setup без `--no-3d` и `--no-mcp`, затем выполните:

```bash
codex mcp login magicpatterns
zsh ~/.codex/skills/pitch-deck-skill/scripts/mcp_setup.sh --check
```

Setup пытается зарегистрировать сервер в обеих средах, если CLI `codex` и `claude` есть на компьютере. Вход OAuth пользователь выполняет в браузере. [Команды MCP в официальной документации OpenAI](https://learn.chatgpt.com/docs/extend/mcp?surface=cli).

## Фирменный шрифт и обновление

Styrene A LC не входит в репозиторий. Если у вас есть лицензионный фирменный пакет, установите его:

```bash
zsh ~/.codex/skills/pitch-deck-skill/scripts/font.sh install "<папка, .zip или https-ссылка на .zip>"
```

До установки используется запасной шрифт. Дальше: [работа и проверки](usage.md), [обновление и откат](updating.md). Установка `impeccable` и расширения для браузера в этот сценарий не входит; выполняйте её отдельно, если она нужна.
