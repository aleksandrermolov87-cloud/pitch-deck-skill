# Библиотека компонентов

138 готовых компонентов тела слайда: роадмапы, таблицы, графики, 43 схемы, рынок, продукт, стратегия, статус, просьба,
20 текстовых раскладок и 5 мокапов экранов. Базовые 19 лежат в `templates/deck-starter/components.js`, ещё 119 — в модулях `templates/deck-starter/kit/*.js` (из них 43 схемы); всё и копируется в каждый проект `new_deck.sh` как `src-<тема>/components.js`.
Библиотека — основа структуры и фирменного стиля, и её приоритет обязателен: сначала компонент из библиотеки,
21st (если включён) и сборка агентом — только для слайда, которому в библиотеке ничего не подошло, с записанной причиной
(`custom: '…'` в слайде). Проверяет `scripts/library_check.py`: компоненты помечают свои элементы, сборка пишет их имена
в `out/slides.json`. Референсы оценивает агент-оценщик, но при конфликте выигрывает библиотека (`reference/00b-references.md`).

Каждый компонент:
- принимает `box = { x, y, w, h }` в дюймах холста 13,333 × 7,5 (обычно тело под шапкой `chrome()`), `data` и `opt`;
- красится только токенами `theme.json`, поэтому работает в любом бренде и в обеих темах;
- регистрирует каждое показанное число через `fact()`: источник из `item.src`, иначе из `opt.src`. Без источника сборка падает с ошибкой — это правило «цифры только из источника»;
- обходится без рамок, зебры и карточек (`reference/10-beyond-blocks.md`), закрывает бан простых слайдов и проходит `pptx_audit.py` и impeccable без замечаний на демо-данных.

## Как вызвать

```js
const K = require('./components.js');
const body = { x: M, y: T.canvas.bodyTop + 0.3, w: W - 2 * M, h: T.canvas.bodyBottom - T.canvas.bodyTop - 0.45 };
function channels() {
  const els = chrome({ title: 'Приложение даёт 72% дохода', sub: 'млн ₽ без НДС', source: 'Источник: модель, лист «Каналы»', panel: false });
  els.push(...K.tableEditorial(body, { cols: [...], rows: [...], total: {...}, highlight: 'kd' }, { src: { type: 'xlsx', sheet: 'Каналы', cells: ['D20'] } }));
  return { bg: 'bg_s2.jpg', archetype: 'table-editorial', els };
}
```

Образец вызова каждого компонента с данными — `components/gallery.js`.
Галерея с PNG в обеих темах и контакт-листом: `zsh $SKILL/scripts/gallery.sh` → `components/.gallery/sheet.png`, `sheet-light.png`.

## Каталог: вопрос зрителя → компонент

| Вопрос зрителя | Компонент | Архетип | Данные | Структура взята из |
|----------------|-----------|---------|--------|--------------------|
| Что и когда выходит? | `timelineAxis` | `timeline-axis` | `ticks`, `now {at, note}`, `items [{at, name, value?, unit?, note, src}]` | 21st 29956, 28298 |
| Кто что делает параллельно? | `ganttLanes` | `gantt-lanes` | `periods`, `today`, `groups [{name, lanes [{name, bars [{from, to, label, tone}], milestones}]}]` | 21st 38523, 632 |
| Что сейчас, что следом, что потом? | `nowNextLater` | `now-next-later` | `cols [{head, items [{t, d?}]}] ×3` | 21st 28420 |
| Куда идём за 2–3 года? | `quarterHorizon` | `roadmap-quarters` | `years [{name, quarters}]`, `rows [{name, marks, open?, accent?}]` | эталон roadmap-quarters |
| Кто лучше по многим показателям? Как идут каналы? | `tableEditorial` | `table-editorial` | `cols [{key, label, w, type: text/num/bar/trend}]`, `rows`, `total`, `highlight` | 21st 29454, 29470, 7475 |
| Сколько в каждой ячейке продукт × канал? | `heatmap` | `heatmap-matrix` | `rows`, `cols`, `values [[…]]`, итоги считаются как derived sum | эталон heatmap-matrix |
| Что выбрать из вариантов? | `comparison` | `comparison` | `options [{name, note, recommended}]`, `rows [{name, values: true/false/текст}]` | 21st 26827, 21218 |
| Какое одно главное число? | `kpiHero` | `kpi-hero` | `value, unit, label, caption, series?` | — |
| Какие ещё числа рядом с главным? | `kpiList` | `kpi-hero` | `items [{value, unit, label, caption}]` | — |
| Как меняется во времени? | `barsTrend` | `bars-trend` | `label, periods, values`; рост «×N» — derived ratio | — |
| Из чего складывается целое? | `stackedShare` | `stacked-share` | `label, parts [{name, value}]`; доли — derived ratio. `shareDigits` — знаки доли отдельно от значений, `display: 'share' \| 'value' \| 'both'`, `rest: {type: 'known' \| 'computed' \| 'unknown'}` — остаток только явно, сумма сверяется с целым | — |
| Выполнен ли план? | `bulletChart` | `plan-fact` | `rows [{name, plan, fact, target?}]`; отклонение — derived diff | — |
| Что дало прирост и что съело? | `waterfall` | `waterfall` | `start`, `steps [{name, value ±}]`, `end`; итог — derived sum | — |
| Где теряем клиентов? | `funnel` | `funnel` | `stages [{name, value}]`; конверсия — derived ratio, % | — |
| Что изменилось между двумя датами? | `slope` | `slope` | `left, right, items [{name, a, b}]` | — |
| Насколько велика одна доля? | `pictoGrid` | `picto-grid` | `value` из 100, `caption` | — |
| Как проходит процесс? | `processSteps` | `process-steps` | `steps [{head, body, object?}]`: с 3D — `place3d`, без — узлы на линии | — |
| Кто за что отвечает? | `hubDiagram` | `hub-diagram` | `center`, `nodes [{name, items, link, edge}]` до 4 | — |
| Где мы среди игроков? | `matrix2x2` | `competition-2x2` | оси `x`, `y`, `points [{name, x, y, us}]`, `quadrants` | — |

## Расширения (kit/): ещё 76 сценариев (схемы — отдельным разделом ниже)

Код лежит в `templates/deck-starter/kit/<группа>.js`, `components.js` подключает модули сам: вызов тот же, `K.<имя>(box, data, opt)`.
Образцы данных — `components/gallery-<группа>.js`. Галерея одной группы: `zsh $SKILL/scripts/gallery.sh <группа>`.

### Рынок и деньги (`kit/market.js`)

| Вопрос зрителя | Компонент | Архетип | Данные |
|----------------|-----------|---------|--------|
| Насколько большой рынок? | `marketTam` | `market-tam` | `unit`, `levels [{key, name, value, calc [{value, unit, note}]}] ×3` |
| Окупается ли клиент? | `unitEconomics` | `unit-economics` | `cac, ltv, margin, months {value, note}`, `extra?`; LTV/CAC и окупаемость — derived |
| Из чего складывается выручка? | `revenueFormula` | `revenue-formula` | `factors [{name, value, unit, from}] 3–4`, `result` — факт с источником |
| Как держатся клиенты по когортам? | `cohortGrid` | `cohort-retention` | `cohorts [{name, size}]`, `values [[…]]` треугольником; среднее — derived |
| Сколько стоит и что входит? | `pricingTiers` | `pricing-tiers` | `unit`, `tiers [{name, price?, note, recommended}]`, `features [{name, values}]`, `noPrice?`; без цен — режим покрытия и условий |
| Что двигает рост, что тянет вниз? | `driversDiverging` | `drivers-diverging` | `label, unit, items [{name, value ±}]`, `total`; итог — derived sum |
| Какой прогноз и насколько он уверен? | `scenarioRange` | `scenario-range` | `periods`, `rows [{lo?, base, hi?}]`, `names?` |
| Когда выйдем в плюс? | `breakEven` | `break-even` | `values` — накопленный результат по месяцам, `every`; месяц безубыточности — derived count |
| Как меняются несколько рядов? | `lineChart` | `line-chart` | `periods`, `series [{name, values, main?}]` 2–4, подписи на концах |
| Как меняется состав во времени? | `stackedColumns` | `stacked-columns` | `periods`, `parts [{name, values}]` 2–4; итог — derived sum |

### Нативные диаграммы PowerPoint (`kit/charts.js`)

По выбору, когда данные будут править в PowerPoint: в PPTX настоящая диаграмма со встроенной книгой («Изменить данные»),
HTML-двойник рисует ту же геометрию фигурами. Остальные графики библиотеки остаются фигурами. Образец — `components/gallery-charts.js`.

| Вопрос зрителя | Компонент | Архетип | Данные |
|----------------|-----------|---------|--------|
| Как меняется во времени? Кто больше? (с правкой данных в PowerPoint) | `nativeChart` | по виду: `bars-trend`, `line-trend`, `ranking-bars`, `plan-fact` | `type: col/line/bar`, `label, unit?, digits?`, `periods` или `cats`, `values` или `series [{name, values, src?}]`, `source?, highlight?, labels?, unitOnLabels?, min?, max?`; `opt.native: false` — только фигуры |

### Продукт и клиент (`kit/product.js`)

| Вопрос зрителя | Компонент | Архетип | Данные |
|----------------|-----------|---------|--------|
| Где клиенту плохо на пути? | `journeyMap` | `journey-map` | `stages [{name, note?, mood? −2…2, pain?: {t, value?, unit?}}]`; без `mood` — путь без кривой |
| Что важно какому сегменту? | `featureDots` | `feature-dots` | `segments`, `features [{name, note?, values [0…3]}]`, `levels?` |
| Что изменилось после запуска? | `beforeAfter` | `before-after` | `before/after {head, note}`, `metrics [{name, a, b, unit?, better}]`; разница — derived diff |
| Как это выглядит в продукте? | `screenCallouts` | `screen-callouts` | `file?` (экран в img/, иначе схема телефона), `callouts [{at [fx, fy], head, body?, value?}]` |
| Для кого продукт? | `personaCard` | `persona-card` | `name, role, context`, `stat {…}`, `cols [{head, items}] ×3` |
| Какую проблему решаем? | `problemSolution` | `problem-solution` | `problem/solution {value, unit, label, caption, head, body}`; эффект — derived diff |
| Чем пользуются чаще всего? | `usageRanking` | `usage-ranking` | `label`, `items [{name, value 0…100}]`, `highlight?`; среднее — derived |
| Насколько клиенты нас рекомендуют? | `npsBar` | `nps-bar` | `detractors, passives, promoters`, `prev?`, `n?`; NPS — derived diff |
| Что говорит клиент? | `quoteHero` | `quote-hero` | `quote, author, role?`, `metric? {value, unit, label, caption}` |
| Какой результат у клиента? | `caseStudy` | `case-study` | `task/solution {head, body, items?}`, `result {metrics [1–2]}` |

### Стратегия и решения (`kit/strategy.js`)

| Вопрос зрителя | Компонент | Архетип | Данные |
|----------------|-----------|---------|--------|
| Какие сильные и слабые стороны? | `swot` | `swot` | `s, w, o, t: [строка или {t, d?, value?}]`, `heads?`, `axes?` |
| Как цель раскладывается на результаты? | `okrTree` | `okr-tree` | `objective {t, d?}`, `pace?`, `krs [{name, value, target, unit?}]` |
| Кто за что отвечает в команде? | `orgChart` | `org-chart` | `root {name, role}`, `units [{name, role, size?, team [{name, role, open?}]}]` |
| Кто что делает в проекте? | `raciMatrix` | `raci-matrix` | `roles`, `tasks [{name, group?, cells ['R'/'A'/'C'/'I'/'']}]` |
| Какие риски главные? | `riskMatrix` | `risk-matrix` | `risks [{name, p 1–3, i 1–3, measure, owner?}]` |
| Что делать первым? | `bubble2x2` | `priority-bubbles` | `x, y {label, lo, hi}`, `items [{name, x, y, value}]`, `quadrants?` |
| Какой вариант утвердить? | `decisionOptions` | `decision-options` | `options [{name, cost, time, pros, cons, recommended?}]`, `ask` |
| На чём держится стратегия? | `strategyPillars` | `strategy-pillars` | `goal {t}`, `pillars [{name, body, value, unit?, label}]`, `base {label, t}` |
| Где создаётся ценность? | `valueChain` | `value-chain` | `label, unit`, `links [{name, note?, value}]`; доли — derived ratio |
| Как устроена архитектура? | `systemsLayers` | `systems-layers` | `layers [{name, systems [{name, isNew?, col?}]}]`, `links [{from, to, dashed?}]` |

### Сроки и статус (`kit/progress.js`)

| Вопрос зрителя | Компонент | Архетип | Данные |
|----------------|-----------|---------|--------|
| Как шёл проект? | `milestonesVertical` | `milestones-vertical` | `current`, `items [{date, title, note?, value?, unit?}]` |
| Что с каждым направлением? | `statusBoard` | `status-board` | `rows [{name, status: done/work/risk, owner, due, note?, onTime?}]`; «N из M в срок» — derived count |
| Успеваем ли к сроку? | `burndown` | `burndown` | `scope, days, perTick, ticks, fact [остаток], deadline`; отставание — derived |
| Насколько выполнены цели? | `progressBars` | `progress-bars` | `rows [{name, fact, plan, unit?}]`; «% из плана» — derived ratio |
| Когда пиковая нагрузка? | `calendarHeat` | `calendar-heat` | `rows`, `cols`, `groups [{name, from}]`, `values [[…]]`, `unit` |
| Какие этапы и критерии перехода? | `phaseGate` | `phase-gate` | `current`, `phases [{name ≤14 знаков}]`, `gates [{name, date?, criteria [{t, value?}]}]` |
| Сколько осталось до запуска? | `deadlineStrip` | `deadline-countdown` | `weeks`, `today`, `launch {day, label, date}`, `points [{day, label, date}]` |
| Что главное за неделю? | `weeklyHighlights` | `weekly-highlights` | `items [{name, note, value, prev, unit?, series}]` 3–4 |
| Где копится работа? | `kanbanFlow` | `kanban-flow` | `cols [{name, count, wip?, days?}]`; превышение лимита — derived diff |
| Как этот год против прошлого? | `pairedColumns` | `paired-columns` | `periods`, `prev {name, values}`, `cur {name, values}`; итоги — derived sum |

### Сравнения, распределения, просьба (`kit/numbers.js`)

| Вопрос зрителя | Компонент | Архетип | Данные |
|----------------|-----------|---------|--------|
| Насколько сдвинулось по каждой категории? | `dumbbell` | `dumbbell` | `label, from, to, unit, rows [{name, a, b}]`; сдвиг — derived diff |
| Где мы относительно рынка? | `dotPlot` | `dot-plot` | `rows [{name, us, avg, others [v…]}]`, `axis` |
| Как распределены значения? | `histogram` | `histogram` | `bins [{from, to, count}]`, `median`; итог — derived sum |
| Есть ли связь между показателями? | `scatterLabeled` | `scatter-labeled` | `x, y {label, unit}`, `trend`, `points [{x, y, name?, note?, us?}]` |
| Какие сегменты больше и чья в них доля? | `marimekko` | `marimekko` | `players [до 4]`, `us`, `segments [{name, values}]` |
| Как делится целое на много частей? | `treemap` | `treemap` | `items [{name, value}]`, `opt.maxItems, minShare`; «Прочие» — derived sum |
| Как идут ключевые метрики? | `kpiGrid` | `kpi-grid` | `vs, items [{label, value, prev, unit, better, series}]` ×4–6 |
| Сколько просим и на что? | `askFunds` | `ask-funds` | `amount, unit, uses [{name, value}]`, `milestones ×3`; доли — derived ratio |
| Насколько стало лучше? | `bigCompare` | `big-compare` | `before/after {when, value, unit, caption}`, `mode: ratio/diff`; кегль подбирается, `opt.minPt, maxPt, unitLine, fit` |
| Кто в лидерах? | `rankingList` | `ranking-list` | `rows [{name, value, prev?, us?}]`, `noData?`; изменение места — derived diff, без `prev` — «нет данных» |

### Текст: тезисы и смысл (`kit/textcore.js`)

Только текст, архетип `text-…`: бан простых слайдов на них не действует, аудит вместо него следит, чтобы в теле было не больше 90 слов.
Числа внутри фразы пишутся как `{n}` и регистрируются через `num()` из полей пункта; короткие предлоги приклеиваются к следующему слову.

| Вопрос зрителя | Компонент | Архетип | Данные |
|----------------|-----------|---------|--------|
| Какой главный вывод? | `statementHero` | `text-statement` | `kicker?`, `thesis`, `accent?`, `proof {value, unit, label, text, source?}` |
| О чём встреча и сколько займёт? | `agendaTimed` | `text-agenda` | `total?`, `items [{time, dur?, name, goal, current?}]` 4–6 |
| Что в этом разделе? | `sectionDivider` | `text-section` | `sections?`, `current?`, `title`, `inside`, `questions [3–4]` |
| Что главное в деке? | `executiveSummary` | `text-executive-summary` | `items [{value?, unit?, head, d}]` 3–5 |
| Что унести с встречи? | `keyTakeaways` | `text-takeaways` | `lead?`, `accent?`, `items [{head, d}] ×3` |
| По каким правилам работаем? | `principles` | `text-principles` | `items [{name, d, accent?}]` 4–6, `opt.cols` |
| Что значат термины? | `glossary` | `text-glossary` | `items [{term, d, accent?}]` 5–8 |
| Какие вопросы зададут? | `faqPairs` | `text-faq` | `items [{q, a}]` 3–4 |
| Что говорят клиенты и эксперты? | `quoteWall` | `text-quotes` | `items [{q, who, role?, main?}]` 2–3 |
| Какие аргументы за и против? | `prosCons` | `text-pros-cons` | `pros`, `cons [{t, d?}]`, `verdict {t}` |

### Текст: решения и работа (`kit/textops.js`)

| Вопрос зрителя | Компонент | Архетип | Данные |
|----------------|-----------|---------|--------|
| Что делаем дальше? | `nextStepsText` | `text-next-steps` | `steps [{action, note?, due, owner, role?, now?}]` 3–4 |
| Что вы просите утвердить? | `askStatement` | `text-ask` | `lead?`, `decision`, `terms [{label, value? или t, unit?}]` 2–3, `ifNot` |
| На каких допущениях держится расчёт? | `assumptionsList` | `text-assumptions` | `items [{name, value, unit?, source, key?}]` 4–6 |
| Что может пойти не так? | `risksText` | `text-risks` | `items [{risk, note?, level: high/mid/low, measure, owner}]` 3–4 |
| Кто в команде проекта? | `teamContacts` | `text-team` | `groups [{name, people [{name, role, area, lead?}]}]` или `people` 4–8 |
| Куда мы идём? | `visionStatement` | `text-vision` | `text` до 25 слов, `accent?`, `pillars [{name, note}] ×3` |
| Чему научил пилот? | `lessonsLearned` | `text-lessons` | `worked`, `failed`, `change [{t, d?}]` по 2–3 |
| Что делаем и чего не делаем? | `dosDonts` | `text-dos-donts` | `dos`, `donts [{t, d?}]` по 3–5 |
| Почему это важно сейчас? | `storyArc` | `text-story-arc` | `steps [{head?, lead, t}] ×3` (ситуация → осложнение → решение) |
| Как считали и откуда данные? | `methodNotes` | `text-method` | `method [{t, d?, key?}]` 3–5, `sources [{name, date}]` |

### Мокапы экранов (`kit/screens.js`)

Экран продукта — PNG из Figma или скриншот в `img/` проекта (`screen: 'screens/app-home.png'`). Рамка устройства подстраивается
под пропорции файла и не заходит в зону фирменных полос. Нет файла — рисуется заглушка `[экран: что должно быть]`, сборка
предупреждает, а аудит даёт «мокап экрана не вставлен»: дека не уйдёт с пустым экраном. Демо-экраны для галереи:
`components/demo-screens/` (вымышленные, генератор `make.py`).

| Вопрос зрителя | Компонент | Архетип | Данные |
|----------------|-----------|---------|--------|
| Как это выглядит у клиента? | `phoneHero` | `phone-hero` | `screen`, `what`, `side?`, `points [{value, unit, label, head, body}]` 2–3 |
| Как клиент проходит сценарий? | `phoneFlow` | `phone-flow` | `steps [{screen, what?, head, body}]` 3–4 |
| Что видит менеджер или клиент в вебе? | `desktopShowcase` | `desktop-showcase` | `screen`, `what`, `url?`, `callouts [{at [fx, fy], head, body?, value?}]` 3–4 |
| Что изменилось в интерфейсе? | `screensBeforeAfter` | `screens-before-after` | `before/after {screen, head}`, `changes [{name, a, b, unit?, better}]`; разница — derived diff |
| Как работает во всех каналах? | `multiDevice` | `multi-device` | `web {screen, url?}`, `phone {screen}`, `points [{value?, unit, label, head, body}]` 2–3 |

## Схемы (под-скилл «Схемы»): 43 схемы

Участники и связи, процессы по дорожкам, деревья, циклы, контуры и потоки. Каталог по вопросам, правила хорошей схемы,
детектор `scripts/viz_suggest.py` и замены блоковых слайдов — `reference/19-schemes.md`. У всех архетип `scheme-…`:
узлы-карточки схемы соединены связями, поэтому аудит не считает их блоками. Образцы данных — `components/gallery-<группа>.js`,
галерея: `zsh $SKILL/scripts/gallery.sh schemes radial trees lanes layered exchange orgs`.

### Связи и роли (`kit/schemes.js`)

| Вопрос зрителя | Компонент | Архетип | Данные |
|----------------|-----------|---------|--------|
| Кто с кем и о чём взаимодействует? | `schemeMap` | `scheme-map` | `nodes [{id?, name, items?, kind?: hub/node/note, icon?, at?}]`, `edges [{from, to, tag?, text?, kind?: solid/dashed, route?, pill?}]`, `zones?`, `footnote?`; без `at` раскладка сама |
| Кто вокруг центра и что каждый с ним делает? | `hubSpoke` | `scheme-hub-spoke` | `center {name, note?, items?}`, `nodes [{name, items?, tag?, text?, kind?}]` 3–8 |
| С кем и чем обменивается система? | `contextDiagram` | `scheme-context` | `system {name, items?}`, `boundary?`, `users [{name, items?, tag?, text?}]`, `external […]` |
| Что делаем сами, что отдаём наружу? | `contourMap` | `scheme-contour` | `inside`, `outside?`, `nodes [{id, name, items?, zone: in/out, hub?}]`, `edges` |
| Как запрос проходит через систему? | `archFlows` | `scheme-arch-flows` | `layers [{name, blocks [{id, name, note?, hub?}]}]`, `flows [{from, to, tag?, text?, kind?}]` |

### Вокруг центра и циклы (`kit/radial.js`)

| Вопрос зрителя | Компонент | Архетип | Данные |
|----------------|-----------|---------|--------|
| Кто вокруг центра и что идёт по каждой связи? | `radialHub` | `scheme-radial-hub` | `center {name, note?}`, `nodes [{name, items?, tag?, text?, kind?}]` 4–8 |
| Как этапы повторяются по кругу? | `cycleLoop` | `scheme-cycle-loop` | `steps [{name, d?, via?}]` 4–6, `center?` |
| Что раскручивает рост? | `flywheel` | `scheme-flywheel` | `center {name, note?}`, `steps [{name, d?, boost?}]` 3–5 |
| Кто ближе к ядру, кто на периферии? | `orbitRings` | `scheme-orbit-rings` | `core {name}`, `rings [{name, items}]` 2–3 |
| Что получает каждая из трёх сторон? | `partnerTriangle` | `scheme-partner-triangle` | `nodes` ×3, `edges [{from, to, tag?, text?, kind?}]`, `center?` |
| Где зоны ответственности совпадают? | `vennOverlap` | `scheme-venn-overlap` | `sets [{name, items?}]` 2–3, `overlap {name, items?}` |

### Деревья (`kit/trees.js`)

| Вопрос зрителя | Компонент | Архетип | Данные |
|----------------|-----------|---------|--------|
| Что делать в каждом случае? | `decisionTree` | `scheme-decision-tree` | `root {name, note?}`, `children [{edge, name, note?, tone?: good/bad, link?, children?}]` до 3 уровней, до 6 листьев |
| Из чего складывается цель и кто тянет каждый рычаг? | `driverTree` | `scheme-driver-tree` | `root {name, note?}`, `children [{name, note?, owner?, children [{name, note?, owner?}]}]` |
| Кто принимает решения и как часто? | `governanceTree` | `scheme-governance-tree` | `levels?`, `root {name, meta?, items?}`, `children [{name, meta?, items?, children?}]` |
| Из каких направлений состоит тема? | `mindMap` | `scheme-mind-map` | `center {name, note?}`, `branches [{name, items?, link?}]` 4–8 |

### Процессы по дорожкам (`kit/lanes.js`)

| Вопрос зрителя | Компонент | Архетип | Данные |
|----------------|-----------|---------|--------|
| Кто что делает на каждом шаге и где решение? | `swimlaneFlow` | `scheme-swimlane-flow` | `lanes`, `steps [{id, lane, col, name, kind?: start/end/decision}]`, `links [{from, to, label?, kind?}]` |
| Что видит клиент и что происходит за сценой? | `serviceBlueprint` | `scheme-service-blueprint` | `stages`, `lanes`, `lines? [{after, name, accent?}]`, `steps [{lane, stage, name}]`, `links [{from: [lane, stage], to: [lane, stage]}]` |
| Кто кому что передаёт и в каком порядке? | `sequenceDiagram` | `scheme-sequence-diagram` | `actors`, `messages [{from, to, text, kind?: reply}]` до 8 |
| Кто когда работает и где передаёт работу дальше? | `handoffTimeline` | `scheme-handoff-timeline` | `ticks`, `lanes`, `bars [{lane, from, to, name, accent?}]`, `handoffs [{at, from, to, text}]` |
| Куда идёт вопрос, если на уровне не решили, и как быстро? | `escalationLadder` | `scheme-escalation-ladder` | `levels [{name, who?, sla?, items?}]` 2–5, `conditions` между уровнями |

### Графы слева направо (`kit/layered.js`)

| Вопрос зрителя | Компонент | Архетип | Данные |
|----------------|-----------|---------|--------|
| Через какие статусы проходит объект и что их меняет? | `stateMachine` | `scheme-state-machine` | `states [{id, name, note?, kind?: start/end/bad}]`, `transitions [{from, to, label?}]`; возвраты — под схемой |
| Что нужно сделать раньше, чтобы запустить следующее? | `dependencyGraph` | `scheme-dependency-graph` | `waves`, `items [{id, wave, name, owner?, note?}]`, `deps [{from, to, kind?}]` |
| Откуда приходят данные, где собираются и кому уходят? | `dataFlow` | `scheme-data-flow` | `sources [{id, name, note?}]`, `core {id, name, items?}`, `consumers`, `flows [{from, to, tag?, text?, kind?}]` |
| Через какие метрики инициатива даёт эффект? | `impactChain` | `scheme-impact-chain` | `cols [3–4]`, `nodes [{id, col, name, note?}]`, `links [{from, to, main?, text?}]` |

### Обмен и структура (`kit/exchange.js`)

| Вопрос зрителя | Компонент | Архетип | Данные |
|----------------|-----------|---------|--------|
| Какие системы и как подключены к общей шине? | `busIntegration` | `scheme-bus-integration` | `bus {name, note?}`, `top [{name, note?, link?, kind?}]`, `bottom […]` по 1–4 |
| Что во что переходит? | `bridgeMapping` | `scheme-bridge-mapping` | `left {head, items [{id, name, note?}]}`, `right {…}`, `links [{from, to, kind?: main/dashed}]` |
| Что каждая сторона даёт и получает? | `valueExchange` | `scheme-value-exchange` | `a {name, items?}`, `b {name, items?}`, `flows [{dir: ab/ba, tag?, text?, kind?}]` 2–6 |
| Кого соединяет платформа и что получает каждая сторона? | `platformTwoSided` | `scheme-platform-two-sided` | `left {name, items}`, `platform {name, items?}`, `right {name, items}`, `flows {left [{dir: in/out, tag?, text}], right […]}` |
| Кто ведёт и кто участвует на пересечении направлений и функций? | `matrixOrg` | `scheme-matrix-org` | `rows [{name, note?}]`, `cols [{name, note?}]`, `cells [{r, c, mark: lead/part, note?}]` |
| Из-за чего возникает проблема? | `causeEffect` | `scheme-cause-effect` | `effect {name, note?}`, `bones [{name, causes [строки] до 3}]` 4–6 |

### Оргструктуры и связи подразделений (`kit/orgs.js`)

Как выбрать — `reference/19-schemes.md`, раздел 7. Штат, вакансии и точки — факты с источником, суммы и доли — derived.

| Вопрос зрителя | Компонент | Архетип | Данные |
|----------------|-----------|---------|--------|
| Кто кому подчиняется в департаменте и сколько людей в каждом звене? | `deptTree` | `scheme-dept-tree` | `levels?`, `root {name, lead?, size?, open?}`, `children [{name, lead?, size?, open?, vacant?, children?}]` до 3 уровней, до 8 листьев |
| Как устроен департамент и сколько людей и вакансий в каждом звене? | `orgOutline` | `scheme-org-outline` | `cols [{key, name, unit?, bar?, accent?}]` 1–3, `root {name, lead?, <key>}`, `children [{name, lead?, <key>, children?}]` до 14 строк |
| У кого из руководителей слишком много или мало прямых подчинённых? | `spanOfControl` | `span-of-control` | `norm [от, до]`, `unit?`, `managers [{name, unit?, span}]` 3–10 |
| Кому подразделения подчиняются административно и кому функционально? | `dualReporting` | `scheme-dual-reporting` | `root {name, note?}`, `units [{name, lead?, func? [id]}]` 3–6, `functions [{id, name, note?}]` 2–4 |
| Из каких подразделений состоит блок и какого они размера? | `orgNest` | `scheme-org-nest` | `unit?`, `units [{name, size, lead?, children? [{name, size}]}]` 2–6; opt.highlight — имя плитки акцентом |
| Как команды выстроены вокруг потоков ценности и как взаимодействуют? | `teamTopology` | `scheme-team-topology` | `streams [{id, name, note?}]` 2–4, `platform {id, name, note?, items?}`, `enabling? [{id, name, note?}]`, `subsystems? [{id, name, note?}]`, `links [{from, to, mode: collab/service/facilitate}]` |
| Как продуктовые команды и профессиональные сообщества пересекаются в agile-модели? | `tribeChapters` | `scheme-tribe-chapters` | `tribes [{name, squads [{name, note?, chapters? [номер]}]}]` 2–3, до 9 сквадов, `chapters [{name, lead?}]` 2–5, `guild? {name, squads?}` |
| Как меняется оргструктура: что объединяем, делим, переводим и упраздняем? | `orgTransition` | `scheme-org-transition` | `before {head, units [{id, name, size?}]}`, `after {head, units [{id, name, size?, isNew?}]}`, `moves [{from, to, tag?}]` до 8 строк |
| Как устроена сеть: центр, региональные дирекции и сколько у каждой точек? | `regionNetwork` | `scheme-region-network` | `center {name, note?}`, `unit?`, `regions [{name, note?, points?, lead?}]` 3–8 |
| Сколько людей на каждом уровне управления? | `gradePyramid` | `grade-pyramid` | `unit?`, `levels [{name, size, note?}]` 3–6 сверху вниз; opt.highlight — номер уровня |
| Кто с кем работает теснее всего? | `relationshipWeb` | `scheme-relationship-web` | `nodes [{id, name, note?, hub?}]` 4–9, `links [{from, to, weight? 1–3, kind?, tag?}]` |
| Какие подразделения от каких зависят в работе и насколько плотно? | `interactionMatrix` | `scheme-interaction-matrix` | `units [{name, short}]` 4–8, `cells [{from, to, level 1–3}]`, `levels?`, `colsHead?` |
| Где работа переходит между подразделениями и где возвращается назад? | `arcHandoffs` | `scheme-arc-handoffs` | `units [{id, name, note?}]` 4–7 по порядку процесса, `handoffs [{from, to, weight? 1–3, tag?}]` |

## Помощники

Вспомогательные (`kit/util.js`, доступны и через `K.*`): `wrap()` и `lines()` — число строк при переносе по словам, `fitPt()` — наибольший кегль, при котором строка встаёт в ширину, `known()` — значение известно (конечное число), `seg()` — линия под углом, `knock()` — подложка под подпись на линии, `spread()` — раздвинуть подписи по вертикали, `sparkline(x, y, w, h, values)` для мини-тренда в строке или под KPI, `diamond()` для вех, `num()` для
регистрации числа с источником.

## Правила использования

- **Знаки «×» и «=».** В Styrene A LC они нарисованы наоборот при табличных цифрах; HTML-двойник их больше не включает, но в подписях надёжнее писать «в 7 раз» и рисовать знаки линиями, как `revenueFormula`.
- **Белый текст на акценте** — только жирный от 12 pt, иначе impeccable даёт low-contrast.
- **Деления осей без чисел.** Числа на осях — тоже факты; если у них нет источника, подписывай значения на концах линий и у ключевых точек.

- **Подбирай по вопросу, а не по виду.** Сначала сформулируй, на какой вопрос отвечает слайд, затем бери строку каталога.
- **Компонент не меняется под деку.** Настройка идёт данными и `opt` (`labelW`, `rowH`, `done`, `optical`). Если нужен другой вид, сделай новый компонент.
- **Один главный компонент на слайд.** Второй допускается, если он подчинён первому (`kpiHero` + `kpiList`).
- **3D-объекты** ставятся только через `place3d` у якоря; `processSteps` сам сужает тело до зоны фирменных полос.
- **Тексты в данных** проходят humanizer и SMART так же, как заголовки (`reference/01-brief-and-copy.md`).
- **Числа графика — тоже факты.** Каждое число из данных, которое компонент превратил в форму, попадает в реестр фактов, даже без подписи (`auto`); источник — `item.src`, `data.src` или `opt.src`. `build.js` отмечает, читается ли число на слайде (`shown`).
- **`opt.show` у любого компонента**: числа, которые бриф требует показать читаемо. `{ show: [51.4] }`, `{ show: ['2024'] }` или `{ show: [{ match: '2024', label: 'Коэффициент выплат за 2024 год' }], unit: '%' }`. Точная ссылка на точку ряда: `{ show: [{ ref: 'series[0].values[5]' }] }` или `{ series: 'КАСКО', period: '2024' }`; вложенные периоды (`kpiHero.series.periods`) находятся. Видимым факт считается только по связанной подписи с периодом и единицей, а не по совпадению числа где-то на слайде. Если компонент сам не подписал число, под графиком появляется строка «подпись: значение» (бокс компонента уменьшается на 0,4″). Подробно: `reference/17-check-report.md`.

## Неполные данные и подбор кегля

- **Нет данных — допустимое состояние.** Значение известно, только если это конечное число. `null`, `undefined` и `'unknown'` —
  «нет данных», строка вместо числа — причина, её и видно («вне топ-10», «по запросу», «не опрашивали»). Такое значение
  не рисуется формой, не участвует в расчётах и не попадает в реестр фактов: никаких нулей и выдуманных прошлых мест.
  - `rankingList`: `prev` необязателен. В колонке «нет данных» (`data.noData`) или причина, без стрелки и сдвига. Ни одного
    прошлого места — колонка скрыта, полосы шире (`opt.change: true` — показать).
  - `journeyMap`: `mood` необязателен. Нет ни у одного этапа — без шкалы и кривой, этапы на линии пути со стрелкой, боли под ними.
    Есть у части — шкала остаётся, кривая рвётся на пропусках: пустая точка на середине и «нет данных» (или причина из `mood`).
  - `pricingTiers`: `price` необязателен. Цены нет у части тарифов — на её месте `noPrice` или строка из `price`; нет ни у одного —
    режим покрытия: название крупнее, условия (`note`) полнее, состав выше. `'unknown'` в возможности — пустой кружок «нет данных».
- **`bigCompare` подбирает кегль до раскладки.** Число с единицей ищет наибольший кегль от `opt.maxPt` (120) до `opt.minPt` (56)
  в ширину колонки; если одной строкой выходит на 15% мельче, единица встаёт отдельной строкой под числом (`opt.unitLine`:
  `'auto'`, `true`, `false`; «%» всегда при числе). Единица не пропадает и не сокращается, обе колонки одного кегля, полосы и
  подписи опускаются под блок. Кратность или разница в середине — от 48 до 28 pt. Ниже порога сборка падает с советом:
  меньше `digits`, единица в подпись, уже `opt.midW` или другой компонент (`kpiHero`, `dumbbell`, `barsTrend`);
  `opt.fit: 'warn'` — только предупреждение. Итог подбора — `els.fit = { pt, unitPt, unitLine, midPt }`. Отрицательное значение —
  с типографским минусом, полоса по модулю; кратность только для положительных значений (иначе `mode: 'diff'`).
  Число остаётся редактируемым текстом. Примеры: `components/gallery-numbers.js`.

## Как пополнять библиотеку

Компонент, собранный агентом для деки и оценённый пользователем как «хорошо» (этап 7), предлагается в библиотеку:
1. Функция в подходящем модуле `templates/deck-starter/kit/<группа>.js` (или новом модуле) по образцу: `(box, data, opt) → els`, числа через `num()`, цвета из `C`.
2. Слайд с вымышленными данными в `components/gallery-<группа>.js`.
3. `zsh $SKILL/scripts/gallery.sh <группа>`, затем общая `gallery.sh`: обе темы без переполнений, `pptx_audit.py` без ошибок и предупреждений.
4. Строка в каталог выше и запись в `CHANGELOG.md`.
