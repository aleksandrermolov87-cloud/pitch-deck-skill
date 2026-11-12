# pitch-deck-skill {{VERSION}}: установка {{#full}}с 21st{{/full}}{{#lite}}без 21st{{/lite}}

Откройте локальный Codex, Claude Code или ZCode Agent, приложите этот файл и напишите: «Установи pitch-deck-skill по этому файлу». Ассистенту нужен доступ к терминалу и папке установки.

Скилл собирает PowerPoint и PDF из ваших материалов. Схемы и компоненты берутся из каталога, оформление определяется брифом и референсом, числа сверяются с источниками. Сохраняются исходники и отчёт проверок.

## Выберите инструкцию своего клиента

- [Codex]({{REPO}}/blob/v{{VERSION}}/docs/install-codex.md): новая установка в `~/.agents/skills/pitch-deck-skill`
- [Claude Code]({{REPO}}/blob/v{{VERSION}}/docs/install-claude-code.md): `~/.claude/skills/pitch-deck-skill`
- [ZCode Agent]({{REPO}}/blob/v{{VERSION}}/docs/install-zcode.md): `~/.zcode/skills/pitch-deck-skill`

Если скилл уже установлен, используйте штатный updater по текущему пути. Сохраняйте существующие настройки, уроки и локальные изменения; вторая копия не нужна.

## Порядок установки для ассистента

1. Определи клиент по текущей среде. Спроси только если это неизвестно
2. Проверь [системные программы]({{REPO}}/blob/v{{VERSION}}/docs/requirements.md): macOS или Linux, Git 2.34+ с OpenSSH, Node.js 18+, Python 3.11+, zsh, Bash, Perl, Chrome/Chromium и Poppler
3. Если GitHub доступен, установи подписанный релиз `v{{VERSION}}` по инструкции клиента. Проверь отпечаток ключа и подпись до запуска скриптов
4. Если GitHub недоступен, используй архив из этого файла по процедуре ниже
5. Запусти setup в режиме `{{MODE}}` с `--no-mcp --selftest`. Этот шаг не требует добавления внешних MCP-серверов
6. Открой итоговые превью, проверь отчёт и сообщи результат. Новая сессия клиента должна видеть `SKILL.md`

Не переспрашивай известные параметры. Внешние сервисы подключай по потребности пользователя; команды клиента находятся в [настройках]({{REPO}}/blob/v{{VERSION}}/docs/configuration.md). Ключи пользователь вводит локально в своём клиенте или терминале.

## Установка из вложенного архива

Сверьте SHA-256 с независимым источником: [страницей релиза]({{REPO}}/releases/tag/v{{VERSION}}) или сообщением автора. Хэш внутри этого файла позволяет выявить порчу, но сам по себе не подтверждает автора.

Укажите полный путь к этому MD в `PITCH_FILE`, а в `PITCH_SKILL` — папку выбранного клиента. Пример ниже для Codex; для Claude Code используйте `$HOME/.claude/skills/pitch-deck-skill`, для ZCode — `$HOME/.zcode/skills/pitch-deck-skill`.

```bash
(
  set -eu
  PITCH_FILE="/полный/путь/к/этому-установщику.md"
  PITCH_SKILL="$HOME/.agents/skills/pitch-deck-skill"
  if [ -e "$PITCH_SKILL" ] || [ -L "$PITCH_SKILL" ]; then
    echo "Скилл уже установлен. Используйте updater по текущему пути."
    exit 1
  fi
  PITCH_TMP=$(mktemp -d)
  trap 'rm -rf "$PITCH_TMP"' EXIT
  python3 -I - "$PITCH_FILE" "$PITCH_TMP" <<'PY'
import base64, hashlib, io, pathlib, sys, tarfile
text = pathlib.Path(sys.argv[1]).read_text(encoding='utf-8')
payload = text.split('PITCHDECK-PAYLOAD-BEGIN\n', 1)[1].split('\nPITCHDECK-PAYLOAD-END', 1)[0]
archive = base64.b64decode(''.join(payload.split()), validate=True)
if hashlib.sha256(archive).hexdigest() != '{{SHA256}}':
    raise ValueError('SHA-256 mismatch')
with tarfile.open(fileobj=io.BytesIO(archive), mode='r:gz') as source:
    for member in source.getmembers():
        path = pathlib.PurePosixPath(member.name)
        if path.is_absolute() or not path.parts or path.parts[0] != 'pitch-deck-skill' or '..' in path.parts:
            raise ValueError('Invalid archive path')
        if not (member.isfile() or member.isdir()):
            raise ValueError('Links and special files are not allowed')
    source.extractall(sys.argv[2])
print('SHA-256 verified: {{SHA256}}')
PY
  mkdir -p "$(dirname "$PITCH_SKILL")"
  mkdir "$PITCH_SKILL"
  cp -R "$PITCH_TMP/pitch-deck-skill/." "$PITCH_SKILL/"
  zsh "$PITCH_SKILL/scripts/setup.sh" --mode {{MODE}} --no-mcp --selftest
)
```

`python3` здесь используется для стандартных операций с архивом. Сам setup выбирает Python 3.11+ через `scripts/python.sh` и создаёт отдельное окружение.

## После установки

Откройте новую сессию и приложите материалы. Для Codex и ZCode: `$pitch-deck-skill`; для Claude Code: `/pitch-deck-skill`. В ZCode сначала обновите список Settings → Skills → Refresh и проверьте, что навык включён.

Пример: «Собери презентацию на 8 слайдов, 16:9, PDF. Сохрани условия из файла, по одному выводу на слайд. Используй приложенный референс».

[Шрифты, 21st и 3D]({{REPO}}/blob/v{{VERSION}}/docs/configuration.md) · [Обновление]({{REPO}}/blob/v{{VERSION}}/docs/updating.md)

Styrene A LC не входит в пакет. Для него нужен собственный лицензированный файл; до установки используется запасной шрифт.

## Архив

Версия {{VERSION}} · файлов {{FILES}} · архив {{SIZE_KB}} КБ · SHA-256 `{{SHA256}}`.

```text
PITCHDECK-PAYLOAD-BEGIN
{{PAYLOAD}}
PITCHDECK-PAYLOAD-END
```
