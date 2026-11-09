# Выпуск версии

1. Изменения, `VERSION`, раздел `## X.Y.Z` в `CHANGELOG.md`, коммит.
2. `zsh scripts/release.sh X.Y.Z` — проверка на утечки, самопроверка, подписанный тег, пуш, релиз на GitHub с двумя установочными md (с Magic-MCP и без).

Подпись: отдельный SSH-ключ `~/.ssh/pitch_deck_signing_ed25519`, он же добавлен в GitHub как signing key, публичная часть — в `.github/allowed_signers`. Настройка в клоне: `git config gpg.format ssh`, `git config user.signingkey ~/.ssh/pitch_deck_signing_ed25519.pub`, `git config gpg.ssh.allowedSignersFile "$PWD/.github/allowed_signers"`. Смена ключа: новый ключ добавляется в `allowed_signers` релизом, подписанным старым ключом; если старый утерян, автор публикует и подтверждает новый отпечаток, а существующие установки проходят однократный проверенный переход ([инструкция перехода](signing-key-migration.md)).
