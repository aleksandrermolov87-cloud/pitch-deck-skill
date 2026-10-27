# pitch-deck-skill

Скилл для [Claude Code](https://claude.com/claude-code), который собирает питч-деки и продуктовые презентации в PowerPoint из ваших вводных: xlsx, pptx, PDF, тексты, скриншоты. Тексты, числа и схемы в файле остаются редактируемыми, каждое число сверяется с источником, в конце приходит отчёт о допущениях и о том, что не вошло.

> **Как установить:** отправьте Claude Code ссылку на этот репозиторий и напишите «Установи pitch-deck-skill». Claude сделает всё по разделу «Установка через Claude Code» ниже и спросит вас только о ключах, шрифте и режиме.

> Неофициальный инструмент. Это не продукт и не ресурс Альфа-Банка. Профиль бренда `alfa` в `reference/brands/` — это настройки оформления для сотрудников, которые делают внутренние презентации; все числа в примерах и демо-данных вымышленные.

Без доступа к GitHub: в каждом [релизе](https://github.com/aleksandrermolov87-cloud/pitch-deck-skill/releases/latest) есть самоустанавливающиеся файлы `pitch-deck-skill-install-lite.md` (без Magic-MCP) и `pitch-deck-skill-install-full.md` (с Magic-MCP): отправьте файл Claude Code с просьбой «Установи по этому файлу».

## Что внутри

- **8 этапов с воротами:** план с референсами → вводные и формулировки → компоненты → сборка PPTX → сетка (impeccable) → чистка ИИ-слопа (taste-skill) → факт-чек и отчёт → обучение на ваших оценках слайдов.
- **Библиотека из 94 компонентов** — основа структуры и фирменного стиля: роадмапы, таблицы, графики, схемы, рынок и юнит-экономика, путь клиента, стратегия и риски, статус проекта, просьба о финансировании, 20 текстовых раскладок, 5 раскладок под мокапы экранов. Каталог — `components/README.md`, галерея — `zsh scripts/gallery.sh`.
- **Проверки-скрипты:** аудит сетки и «простых слайдов» (`pptx_audit.py`), сверка фактов (`facts_check.py`), SMART-формулировки (`smart_check.py`), диагностика окружения (`doctor.sh`), проверка на утечки (`leakcheck.sh`).
- **База паттернов дек:** инвесторы (pre-seed → growth), корпорации и УК, B2B, продуктовые, статус-отчёты.

Режимы в `config.json`: с 21st Magic MCP (платный ключ) или без, 3D-объекты Magic Patterns вкл/выкл, бренд, Figma.

## Установка через Claude Code

Этот раздел — инструкция для Claude Code. Пользователь прислал ссылку на репозиторий и попросил установить: выполняй шаги по порядку, команды запускай сам, места с 👤 делает пользователь. Заведи список задач по шагам. Ничего не коммить и не пушь в этот репозиторий.

**Шаг 1. Предупреди.** Одной фразой: ставится скилл pitch-deck-skill в `~/.claude/skills/pitch-deck-skill`, займёт 3–5 минут, понадобятся git, Node.js 18+, Python 3.9+, Google Chrome. Работает на macOS (на Linux не проверялось, Windows не поддерживается).

**Шаг 2. Проверь окружение.**
```bash
for c in git node python3 zsh; do command -v $c >/dev/null && echo "ok $c" || echo "НЕТ $c"; done; node -v
ls "/Applications/Google Chrome.app" >/dev/null 2>&1 && echo "ok chrome" || echo "НЕТ chrome"
```
Чего нет — предложи пользователю команду установки (`brew install node`, `xcode-select --install`, `brew install --cask google-chrome`) и ставь только после его согласия.

**Шаг 3. Спроси режим** одним вопросом с вариантами:
- «Без Magic-MCP (Recommended)» — ничего платного, компоненты из встроенной библиотеки;
- «С Magic-MCP» — нужен платный ключ 21st.dev, его пользователь введёт сам.
И второй вопрос: подключать ли 3D-объекты Magic Patterns (нужен аккаунт Magic Patterns) — «Да» / «Нет, без 3D».

**Шаг 4. Получи последний подписанный релиз** (не ветку `main`):
```bash
mkdir -p ~/.claude/skills && cd ~/.claude/skills
if [ -d pitch-deck-skill/.git ]; then
  zsh pitch-deck-skill/scripts/update.sh          # уже стоит из git: покажет изменения, дальше --yes по согласию пользователя
else
  [ -e pitch-deck-skill ] && mv pitch-deck-skill pitch-deck-skill.old   # старая установка из md-файла
  git clone https://github.com/aleksandrermolov87-cloud/pitch-deck-skill.git pitch-deck-skill
  cd pitch-deck-skill && TAG=$(git tag -l 'v*' --sort=-v:refname | head -1) && git -c advice.detachedHead=false checkout "$TAG"
  git -c gpg.ssh.allowedSignersFile=.github/allowed_signers verify-tag "$TAG" && echo "подпись релиза $TAG проверена"
fi
```
Если была папка `pitch-deck-skill.old`, перенеси из неё в новую `config.json`, папку `learnings/` и файлы `*.local.md` (если они есть), затем скажи пользователю, что старую папку можно удалить.

**Шаг 5. Установка и самопроверка** (`full` или `lite` по ответу из шага 3, `--no-3d` если 3D не нужно):
```bash
zsh ~/.claude/skills/pitch-deck-skill/scripts/setup.sh --mode lite --selftest
```
Ожидается: «Демо.pptx … ошибок 0», «фактов 28, сошлось 28», «Галерея_компонентов … ошибок 0». Если что-то упало — покажи вывод пользователю и разберись по сообщению.

**Шаг 6. 👤 Ключ 21st** — только в режиме «С Magic-MCP». Ключ берётся на https://21st.dev/mcp. Попроси пользователя выполнить в **своём** терминале (не присылать ключ в чат):
```bash
claude mcp add --transport http 21st https://21st.dev/api/mcp --header "x-api-key: ВАШ_КЛЮЧ" --scope user
```

**Шаг 7. 👤 Magic Patterns** — только если нужны 3D. В claude.ai: Settings → Connectors → Magic Patterns, или в терминале: `claude mcp add --transport http magic-patterns https://mcp.magicpatterns.com/mcp --scope user` и вход в браузере.

**Шаг 8. Шрифт Styrene A LC.** `zsh ~/.claude/skills/pitch-deck-skill/scripts/font.sh check`. Если не установлен — 👤 спроси, где лежит фирменный пакет шрифтов (папка, zip или https-ссылка), и поставь: `zsh ~/.claude/skills/pitch-deck-skill/scripts/font.sh install "<путь>"`. Пакета нет — ничего страшного, деки соберутся на Arial.

**Шаг 9. По желанию.** Детектор impeccable для чистки сетки: `npx -y impeccable install` — он добавляет свои хуки в настройки Claude Code, поэтому ставь только после согласия пользователя. Для Figma-референсов нужен Claude in Chrome (https://claude.ai/chrome) или Computer Use в приложении Claude.

**Шаг 10. Итог.**
```bash
zsh ~/.claude/skills/pitch-deck-skill/scripts/doctor.sh
```
Скажи пользователю коротко: что стоит, что осталось сделать ему (ключ, шрифт, Magic Patterns), и что скилл появится в **новой** сессии Claude Code. Пример первого запроса: «Собери презентацию для УК по вложенному xlsx, 8–10 слайдов». Обновление потом: «обнови pitch-deck-skill» (`scripts/update.sh`).

## Установка вручную

Нужны macOS или Linux, Node.js 18+, Python 3.9+, Google Chrome, git.

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
