# Этап 2. Компоненты (21st Magic MCP) и графика (MagicPatterns)

**Порядок источников обязателен: библиотека компонентов → 21st → сборка агентом.** Разметку слайда даёт компонент библиотеки (`components/README.md`). 21st Magic и генерация агента нужны только для слайда, которому в библиотеке ничего не подошло: такой слайд возвращает `custom: '<почему>'`, а `scripts/library_check.py` это проверяет. Референсы Figma дают только цветокор и фирменный стиль (правило пользователя от 26.10.2026). Вид блока из референса — это направление, а не образец для копирования.

## A. 21st Magic MCP: идея компонента

Инструменты: `mcp__21st__search`, `mcp__21st__get_inspiration`, `mcp__21st__get_component`.
Загрузка: `ToolSearch {query: "select:mcp__21st__search,mcp__21st__get_inspiration,mcp__21st__get_component"}`.

### Порядок
1. По каждому нетекстовому слайду сформулируй, что он показывает, и выбери архетип из `patterns/slide-archetypes.md`.
2. `mcp__21st__search {query, type: "component", limit: 5–8}`. Запросы пиши по-английски и по сути данных.
3. Если поиск пустой, вызови `mcp__21st__get_inspiration {query: "<подробное описание слайда>", limit: 6–8}`.
4. Открой 1–2 кандидата через `mcp__21st__get_component {id}`. Код читай как описание структуры.
5. Запиши в таблицу этапа 2: слайд → компонент (id, название) → что взято.

### Запросы, которые сработали
| Слайд | Запрос |
|-------|--------|
| роадмап по месяцам + столбики | `roadmap timeline gantt months`, `dark roadmap timeline with milestones and monthly bar chart` |
| гант пилотов | `gantt chart schedule bars`, `gantt timeline roadmap` |
| роадмап по кварталам | `roadmap timeline quarters milestones` |
| матрица продукты × каналы | `heatmap matrix table metrics` |
| структура КД по каналам | `stacked bar chart dark dashboard revenue breakdown` |
| схема ролей и связей | `relationship diagram of 4 departments: central hub node connected to 3 nodes, solid primary links and one dashed secondary link, edge labels, cards with bullet responsibilities` |
| процесс и конвейер | `process pipeline steps chevron flow with source channels and integration` |

Найденные и использованные: **Gantt Chart** (дорожки по каналам, раздельные полосы фаз), **Quarterly Roadmap Columns** (карточки, сгруппированные по периодам).

### Что переносить в PPTX
- **Берём:** структуру (дорожки, колонки, группы), иерархию (что крупно, что мелко), способ кодировать статус (полоса, точка, тон), подписи (где стоит значение, где легенда), порядок слоёв.
- **Не берём:** React, Tailwind-классы, тени и градиенты по умолчанию, ховеры и анимации, цвета компонента. Цвета всегда берутся из `theme.json`.
- Компонент пересобирается из примитивов `rect / text / line / oval`, так текст и числа остаются редактируемыми.

### Отказ каталога
Сообщение «catalog search failed» уже встречалось на целую сессию. Переподключи сервер один раз (`mcp__ccd_connectors__reconnect_session_connector`), затем повтори запрос. Если снова пусто, собирай по архетипу и запиши в отчёт: «21st не отвечал, компонент собран по архетипу X».

## B. MagicPatterns: 3D-объекты, стикеры, иллюстрации

Работа идёт в Magic OS. Это отдельная поверхность, и в редактор ничего не создаётся.
Загрузка: `ToolSearch {query: "magic patterns generate_image create_os list_os", max_results: 5}` — имя сервера зависит от подключения (`mcp__magicpatterns__…` после `setup.sh`, `mcp__<id>__…` у коннектора claude.ai), поэтому ищи по названиям инструментов. В Codex сервер `magicpatterns` подключает тот же `setup.sh` (`scripts/mcp_setup.sh`). Если инструментов нет: `zsh $SKILL/scripts/mcp_setup.sh` и вход пользователя (`/mcp` в Claude Code, `codex mcp login magicpatterns`).

1. `list_os`: если OS для этой деки уже есть, используй её.
2. Если нет, `create_os {name: "<Дека> — графика"}` и запомни `osId`.
3. `generate_image {osId, images: [{name, aspectRatio, prompt}, …]}` вызывается пачкой из 3–6 штук. Ответ содержит постоянные URL `https://cdn.magicpatterns.com/patterns/generated-images/<uuid>.jpg` и превью.
4. Скачай файлы в `src-<тема>/img/3d/` через `visuals.py fetch src-<тема> --url <url> --name <name> --slide <N>` (только `https://cdn.magicpatterns.com/` из ответа `generate_image` в этой сессии, до 20 МБ, с записью происхождения в `data/visuals.json`). Другие адреса не скачивай. В Codex вместо MagicPatterns работает встроенный `image_gen`: порядок в `reference/09-3d-objects.md`, раздел 5.
5. Вырежи фон: `$SKILL/.venv/bin/python -I $SKILL/scripts/cutout.py img/3d/<name>.jpg` даёт `<name>.png` с альфой. Проверь края на тёмном и светлом фоне (`--preview`).
6. Посмотри результат глазами. Если объект не тот по смыслу или палитре, перегенерируй с уточнённым промптом, а не бери «почти подходящий».

### Подбор объекта по смыслу
Объект показывает **содержание**, а не украшает. Правила из сессии «Статус по продуктам»:
- у продуктовой карточки объект продукта: модульное — пазл, ДМС — сердце с крестом и стетоскопом, встроенное страхование — карта со щитом, ОСАГО — машина со щитом, имущество — дом или витрина со щитом;
- у статуса объект статуса: риска нет — щит с галочкой, есть риск — песочные часы, риск сработал — треугольник с «!»;
- в блоке «Главное за неделю»: достижение — кубок, нужно решение — документ с ручкой и печатью, риск — знак предупреждения;
- если на карточке стоит объект продукта, статус передают точка, подпись и рамка, а не второй объект;
- не ставить один и тот же объект на все карточки подряд. Ракета, мишень и флажок без смысловой связи — это слоп.

### Шаблон промпта для объекта (проверен)
```
A single 3D rendered icon: <объект и деталь, которая передаёт смысл>, slightly tilted,
symbolizing <что означает на слайде>. Strict color palette: only <цвета бренда, напр. red, white
and glossy black accents>, no other colors, no gold, no blue. Premium fintech 3D illustration style,
smooth glossy plastic, soft studio lighting, subtle soft grey shadow beneath. Centered, generous
empty margin, isolated on a pure flat white background. No text, no letters, no numbers, no logos.
```
`aspectRatio: "1:1"`. Фон должен быть чисто белым и ровным, тогда вырезка чистая.

### Шаблон промпта для фоновой иллюстрации
```
Premium 3D fintech still life for a presentation background: <2–3 объекта по теме слайда>,
composition weighted to the right and bottom, objects partially cropped by the right edge,
soft studio lighting, gentle soft shadows. The entire background is one perfectly flat solid
<цвет фона слайда, hex> color with no gradient, no vignette, no floor line. Calm, elegant, minimal.
No text, no letters, no numbers, no logos.
```
`aspectRatio: "3:4"` для правой колонки или `"16:9"` для всего слайда. Фон промпта совпадает с фоном слайда, поэтому вырезка не нужна.

### Палитры для промптов
- Альфа, чёрно-красно-белый: `only red (#EF3124), white and glossy black`.
- Альфа, тёмный мир: `bright red and white objects, glossy black accents; designed to sit on a near-black background` (вырезать фон обязательно).
- Если бренд другой, подставь его 1–2 цвета и запрети остальные явным списком.

## C. Стикеры и плоская инфографика

Кроме 3D иногда нужны плоские элементы: стикер-плашка «NEW», бейдж «пилот», пиктограммы каналов.
- Простые геометрические стикеры собираются фигурами PPTX (пилюля, круг, скруглённый прямоугольник), так их можно править.
- Пиктограммы берутся из библиотеки (Phosphor, Tabler) в SVG, затем переводятся в PNG 4x нужного цвета. Самописные SVG-иконки не рисуй (taste-skill, 9.E).
- Фон слайда (полосы, зерно, свечение) генерирует `templates/deck-starter/bg.py`, нейросеть не нужна.

## D. Таблица этапа 2 (в `src-<тема>/components.md`)

| Слайд | Архетип | Кандидаты 21st (id, название), 2–3 | Выбран и почему | Что взято (структура, иерархия, подписи) | Как перекрашен в бренд | Генерация агента / MagicPatterns | Смысл объекта |
|-------|---------|-------------------------------------|-----------------|------------------------------------------|------------------------|-----------------------------------|---------------|
