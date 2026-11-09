# Переход на новый ключ в 1.13.0

Прежний закрытый ключ недоступен. Автор подтверждает новый ключ для релизов начиная с **v1.13.0**:

- Новый отпечаток: `SHA256:GOJu1Mq/91ufd43Icikuj/NE4fLwiGqTEmMsOyL28VM`
- Прежний отпечаток: `SHA256:QlmHo++nW9hGgOpaCQOCjk6tKX6NxskuMDwUsLnWELw`
- Публичная часть: [release-signing-key.pub](../.github/release-signing-key.pub); ключ также зарегистрирован в GitHub как signing key автора

Новые установки из релиза уже содержат оба публичных ключа. Установкам предыдущих версий нужен однократный переход: сверить новый отпечаток с автором, проверить подпись тега и только затем обновиться. Старый публичный ключ сохранён для проверки исторических релизов.

Ниже команда для обычного git-клона и установки из архива. Укажите свою папку в `PITCH_SKILL`: для Codex это может быть `$HOME/.agents/skills/pitch-deck-skill` или прежний путь `$HOME/.codex/skills/pitch-deck-skill`. В git-клоне рабочее дерево должно быть чистым; собственные изменения предварительно сохраните. Настройки `config.json`, `learnings/` и `*.local.md` сохраняет штатный updater.

```bash
(
  set -eu
  PITCH_SKILL="$HOME/.claude/skills/pitch-deck-skill"
  test -f "$PITCH_SKILL/scripts/update.sh"
  PITCH_VERIFY=$(mktemp -d)
  trap 'rm -rf "$PITCH_VERIFY"' EXIT

  git init --quiet "$PITCH_VERIFY/repo"
  git -C "$PITCH_VERIFY/repo" fetch --quiet \
    https://github.com/aleksandrermolov87-cloud/pitch-deck-skill.git \
    'refs/tags/v*:refs/tags/v*'
  git -C "$PITCH_VERIFY/repo" show v1.13.0:.github/release-signing-key.pub > "$PITCH_VERIFY/key.pub"
  PITCH_FINGERPRINT=$(ssh-keygen -lf "$PITCH_VERIFY/key.pub" | awk '{print $2}')
  test "$PITCH_FINGERPRINT" = 'SHA256:GOJu1Mq/91ufd43Icikuj/NE4fLwiGqTEmMsOyL28VM'
  printf '280332880+aleksandrermolov87-cloud@users.noreply.github.com namespaces="git" %s\n' \
    "$(cat "$PITCH_VERIFY/key.pub")" > "$PITCH_VERIFY/allowed_signers"
  git -C "$PITCH_VERIFY/repo" -c gpg.ssh.allowedSignersFile="$PITCH_VERIFY/allowed_signers" verify-tag v1.13.0
  test "$(git -C "$PITCH_VERIFY/repo" show v1.13.0:VERSION)" = '1.13.0'

  PITCH_ORIGIN=https://github.com/aleksandrermolov87-cloud/pitch-deck-skill.git
  if [ -d "$PITCH_SKILL/.git" ]; then
    PITCH_ORIGIN=$(git -C "$PITCH_SKILL" remote get-url origin)
  fi
  export GIT_CONFIG_COUNT=1
  export GIT_CONFIG_KEY_0="url.$PITCH_VERIFY/repo.insteadOf"
  export GIT_CONFIG_VALUE_0="$PITCH_ORIGIN"
  if [ -d "$PITCH_SKILL/.git" ]; then
    test "$(git -C "$PITCH_SKILL" remote get-url origin)" = "$PITCH_VERIFY/repo"
  fi
  PDS_REMOTE="$PITCH_VERIFY/repo" \
    zsh "$PITCH_SKILL/scripts/update.sh" --yes --allow-unsigned v1.13.0
)
```

`--allow-unsigned` здесь нужен старой версии updater для смены доверенного ключа. Команда предварительно проверяет подпись нового тега и направляет updater только в проверенную локальную копию; постоянный `origin` не меняется. При несовпадении отпечатка или подписи обновление не запускается. После перехода используйте обычный `update.sh --yes` без этого флага.

После перехода запустите обычный `update.sh --yes`, чтобы получить актуальную версию.
