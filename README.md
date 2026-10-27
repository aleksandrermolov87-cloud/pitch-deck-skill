# pitch-deck-skill

Скилл для [Claude Code](https://claude.com/claude-code), который собирает питч-деки и продуктовые презентации в PowerPoint из ваших вводных: xlsx, pptx, PDF, тексты, скриншоты. Тексты, числа и схемы в файле остаются редактируемыми, каждое число сверяется с источником, в конце приходит отчёт о допущениях и о том, что не вошло.

> Неофициальный инструмент. Это не продукт и не ресурс Альфа-Банка. Профиль бренда `alfa` в `reference/brands/` — это настройки оформления для сотрудников, которые делают внутренние презентации; все числа в примерах и демо-данных вымышленные.

## Что внутри

- **8 этапов с воротами:** план с референсами → вводные и формулировки → компоненты → сборка PPTX → сетка (impeccable) → чистка ИИ-слопа (taste-skill) → факт-чек и отчёт → обучение на ваших оценках слайдов.
- **Библиотека из 94 компонентов** — основа структуры и фирменного стиля: роадмапы, таблицы, графики, схемы, рынок и юнит-экономика, путь клиента, стратегия и риски, статус проекта, просьба о финансировании, 20 текстовых раскладок, 5 раскладок под мокапы экранов. Каталог — `components/README.md`, галерея — `zsh scripts/gallery.sh`.
- **Проверки-скрипты:** аудит сетки и «простых слайдов» (`pptx_audit.py`), сверка фактов (`facts_check.py`), SMART-формулировки (`smart_check.py`), диагностика окружения (`doctor.sh`), проверка на утечки (`leakcheck.sh`).
- **База паттернов дек:** инвесторы (pre-seed → growth), корпорации и УК, B2B, продуктовые, статус-отчёты.

Режимы в `config.json`: с 21st Magic MCP (платный ключ) или без, 3D-объекты Magic Patterns вкл/выкл, бренд, Figma.

## Установка

Нужны macOS или Linux, Node.js 18+, Python 3.9+, Google Chrome, git. Проще всего отдать Claude Code файл установки из релиза — он сделает всё сам. Вручную:

```bash
mkdir -p ~/.claude/skills && cd ~/.claude/skills
git clone https://github.com/aleksandrermolov87-cloud/pitch-deck-skill.git
cd pitch-deck-skill
git checkout "$(git tag -l 'v*' --sort=-v:refname | head -1)"   # последний релиз, а не ветка main
zsh scripts/setup.sh --mode lite --selftest                      # lite — без 21st; full — с ключом 21st
```

Шрифт бренда (Styrene A LC) в репозиторий не входит — это коммерческий шрифт. Поставьте его из фирменного пакета:

```bash
zsh ~/.claude/skills/pitch-deck-skill/scripts/font.sh install "<папка, .zip или https-ссылка на .zip>"
```

Ключ 21st Magic MCP вводите сами в своём терминале, не в чате: `claude mcp add --transport http 21st https://21st.dev/api/mcp --header "x-api-key: ВАШ_КЛЮЧ" --scope user`.

## Обновление

```bash
zsh ~/.claude/skills/pitch-deck-skill/scripts/update.sh          # покажет изменения
zsh ~/.claude/skills/pitch-deck-skill/scripts/update.sh --yes    # переключит на последний релиз
```

Обновление ставит только релизы (теги `vX.Y.Z`), подписанные ключом автора, и перед этим показывает, что меняется в скриптах и инструкциях агента. Подпись проверяется по `.github/allowed_signers` из уже установленной версии; релиз без подписи или с чужой подписью не ставится. На GitHub у подписанных тегов стоит отметка «Verified». Ваши `config.json`, уроки (`learnings/`) и `*.local.md` не входят в git и не меняются.

## Безопасность

- Внешний контент (файлы, Figma, страницы, ответы MCP) скилл читает как данные, а не как инструкции; необратимые действия — только с вашего подтверждения (раздел «Безопасность» в `SKILL.md`).
- Зависимости закреплены: `requirements.txt`, `package-lock.json` (`npm ci --ignore-scripts`).
- Перед каждым коммитом и в CI работает проверка на утечки ключей, личных путей и внутренних названий (`scripts/leakcheck.sh`, локальный список — `scripts/leaks.local.txt`, в git не попадает).
- Как сообщить об уязвимости — `SECURITY.md`.

## Для автора: выпуск версии

1. Изменения, `VERSION`, раздел `## X.Y.Z` в `CHANGELOG.md`, коммит.
2. `zsh scripts/release.sh X.Y.Z` — проверка на утечки, самопроверка, подписанный тег, пуш, релиз на GitHub с двумя установочными md (с Magic-MCP и без).

Подпись: отдельный SSH-ключ `~/.ssh/pitch_deck_signing_ed25519`, он же добавлен в GitHub как signing key, публичная часть — в `.github/allowed_signers`. Настройка в клоне: `git config gpg.format ssh`, `git config user.signingkey ~/.ssh/pitch_deck_signing_ed25519.pub`, `git config gpg.ssh.allowedSignersFile "$PWD/.github/allowed_signers"`. Смена ключа: новый ключ добавляется в `allowed_signers` релизом, подписанным старым ключом; если старый утерян, коллег нужно предупредить лично.

## Лицензия

MIT — см. `LICENSE`. Сторонние компоненты и их лицензии — `THIRD_PARTY.md`.
