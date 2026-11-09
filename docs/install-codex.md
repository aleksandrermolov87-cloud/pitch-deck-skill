# Установка в Codex

Персональная папка скиллов Codex: `~/.agents/skills/pitch-deck-skill`. Это [стандартное расположение по документации клиента](https://learn.chatgpt.com/docs/build-skills).

Если скилл уже установлен в `~/.codex/skills` или связан с папкой Claude Code, обновляйте существующую установку. Вторая копия не нужна.

Сначала установите [необходимые программы](requirements.md). Для установки через ассистента отправьте ему ссылку на эту страницу и просьбу: «Установи pitch-deck-skill по этой инструкции».

## Установка через терминал

Блок выполняется в Bash или zsh.

Команда получает последний опубликованный релиз, сверяет отпечаток ключа, проверяет подпись и запускает настройку. Если папка уже существует, установка останавливается.

```bash
(
  set -eu
  PITCH_SKILL="$HOME/.agents/skills/pitch-deck-skill"
  if [ -e "$PITCH_SKILL" ] || [ -L "$PITCH_SKILL" ]; then
    echo "Скилл уже установлен. Используйте инструкцию обновления."
    exit 1
  fi
  PITCH_TMP=$(mktemp -d)
  trap 'rm -rf "$PITCH_TMP"' EXIT
  PITCH_TAG=$(curl -qfsS https://api.github.com/repos/aleksandrermolov87-cloud/pitch-deck-skill/releases/latest \
    | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).tag_name')
  [[ "$PITCH_TAG" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]
  mkdir -p "$(dirname "$PITCH_SKILL")"
  git clone --no-checkout --single-branch --branch "$PITCH_TAG" \
    https://github.com/aleksandrermolov87-cloud/pitch-deck-skill.git "$PITCH_SKILL"
  git -C "$PITCH_SKILL" show "$PITCH_TAG:.github/release-signing-key.pub" > "$PITCH_TMP/key.pub"
  PITCH_FINGERPRINT=$(ssh-keygen -lf "$PITCH_TMP/key.pub" | awk '{print $2}')
  test "$PITCH_FINGERPRINT" = 'SHA256:GOJu1Mq/91ufd43Icikuj/NE4fLwiGqTEmMsOyL28VM'
  printf '280332880+aleksandrermolov87-cloud@users.noreply.github.com namespaces="git" %s\n' \
    "$(cat "$PITCH_TMP/key.pub")" > "$PITCH_TMP/allowed_signers"
  git -C "$PITCH_SKILL" -c gpg.ssh.allowedSignersFile="$PITCH_TMP/allowed_signers" verify-tag "$PITCH_TAG"
  git -C "$PITCH_SKILL" checkout --detach "$PITCH_TAG"
  zsh "$PITCH_SKILL/scripts/setup.sh" --mode lite --no-mcp --selftest
)
```

`lite` использует встроенную библиотеку. `--no-mcp` оставляет подключение внешних MCP-сервисов отдельным шагом. Самопроверка собирает демо и галерею в двух темах; это может занять несколько минут.

## Первый запуск

Откройте новую сессию Codex, приложите исходные файлы и отправьте:

```text
$pitch-deck-skill Собери PDF-презентацию на 8 слайдов по приложенным материалам.
```

Укажите формат, число слайдов, референс и обязательные условия. Для коммерческого шрифта используйте [свой пакет шрифтов](configuration.md#шрифт).

## Обновление

Ниже путь новой установки. Если скилл уже стоял в другой папке, используйте её текущий путь.

```bash
zsh "$HOME/.agents/skills/pitch-deck-skill/scripts/update.sh" --yes
```

Для установок до смены ключа сначала выполните [однократный переход](updating.md#переход-на-новый-ключ-в-1130). Настройка [21st и 3D](configuration.md) выполняется отдельно.

Если скилл не появился, проверьте наличие `SKILL.md` в выбранной папке, откройте новую сессию и запустите `scripts/doctor.sh` из этой установки.

[На главную](../README.md)
