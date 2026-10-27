# Оценка качества деки числами

Проверки отчёта (`reference/17-check-report.md`) отвечают «пройдено или нет». `scripts/eval_deck.py` переводит те же
артефакты в метрики 0…1 и итоговую оценку: так видно, лучше или хуже стала дека после правки и навык после новой версии.
Без LLM и сети, только JSON проверок и файлы сборки. Метрики не оценивают смысл и вкус: это тренд и защита от регрессий.

```bash
PY="$SKILL/.venv/bin/python -I"
$PY $SKILL/scripts/eval_deck.py score src-<тема> [--log]          # out/eval.json, out/eval.md; --log — строка в learnings/evals.jsonl
$PY $SKILL/scripts/eval_deck.py trend [--deck <имя>]               # итог и ключевые метрики по версиям навыка
$PY $SKILL/scripts/eval_deck.py gate src-<тема> --baseline <json> [--tol 0.02]   # код 1, если метрика упала больше tol
```
Перед `score`: обе темы собраны и отрендерены, карта `out/coverage.json` заполнена, как для `check_report.py`.

## Метрики и веса

Больше — лучше. «Содержательные» — видимые слайды кроме обложки.

| Метрика | Формула | Источник | Вес |
|---|---|---|---|
| `facts_match` | сошлось / (фактов + чисел без `fact()`) | `facts_check.py --json` | 0.12 |
| `facts_labeled` | `label` / (`label` + `value`) среди читаемых чисел | `facts_check.py --json` | 0.06 |
| `coverage` | выполнено / (требований − исключено) | `brief_coverage.py check --json` | 0.14 |
| `audit` | среднее по PPTX тем: max(0, 1 − (ERR + 0,25·WARN) / слайдов) | `pptx_audit.py --json` | 0.10 |
| `overflow` | среднее по темам: max(0, 1 − переполнений / слайдов) | `out/render.json`, `out-light/render.json` | 0.10 |
| `library` | содержательных из библиотеки / содержательных | `library_check.py --json` | 0.08 |
| `no_block` | 1 − (простые, блоковые и блочные слайды аудита ∪ блоковые `viz_suggest.py deck`) / содержательных | аудит, `viz_suggest.py --json` | 0.10 |
| `visual_density` | содержательных с картинкой (3D, экран), нативной диаграммой, схемой или графикой ≥ 2 / содержательных | `pptx_audit.py --json` → `slides` | 0.10 |
| `words` | содержательных с ≤ 90 словами / содержательных; в данных медиана и максимум | `out/slides.json` (без строки источника и номера) | 0.05 |
| `titles` | слайдов с заголовком ≤ 10 слов / слайдов с заголовком | `out/slides.json` | 0.05 |
| `smart` | SMART-пунктов / проверенных | `smart_check.py --json` | 0.04 |
| `provenance` | файлов `img/3d` с записью в `data/visuals.json` / файлов `img/3d` | как в `check_report.py` | 0.03 |
| `plan` | пройдено / проверок (три ответа, число слайдов, исполнение ответа про 3D) | `plan_check.py --json` | 0.03 |

Веса — словарь `WEIGHTS` в `eval_deck.py`, сумма 1,0 (проверяет `tests/eval/run.sh`). Итог — взвешенное среднее по
измеренным метрикам: Σ wᵢ·mᵢ / Σ wᵢ. Метрика, которую нечем измерить (нет PPTX, нет `requirements.json` или карты, нет
слайдов плана для SMART, нет картинок в `img/3d`), получает `null` и строку в разделе «Не измерялось» с причиной. Ни 0,
ни 1 за неё не ставится, и в итог она не входит. Итоги дек с разным набором измеренных метрик сравнивайте по метрикам, а
не только по итогу.

## Журнал и тренд

`score --log` дописывает в `learnings/evals.jsonl` (локальный, в `.gitignore`) строку `{date, skill: {version, commit,
dirty}, deck, metrics, score}`. `trend` группирует строки по версии и коммиту навыка и печатает среднее итога и
`facts_match`, `coverage`, `overflow`, `no_block`, `visual_density`; `--deck` оставляет одну деку. Сравнивать версии честно
на одной и той же деке: приёмочной `tests/kasko` или своей эталонной.

## Gate и эталон

`gate` пересчитывает оценку (или берёт готовый `eval.json`, если передан файл) и сравнивает с эталоном. Код 1, если
метрика или итог ниже эталона больше чем на `--tol` (по умолчанию 0,02), или метрика была измерена в эталоне, а сейчас нет.
Рост и метрики, которых не было в эталоне, не валят. Приёмочный тест `tests/kasko/run.sh` (критерий 7) сравнивает вариант
`fixed` с `tests/kasko/eval_baseline.json`, поэтому регрессия качества останавливает `release.sh`.

Эталон обновляют осознанно, только когда изменение метрик ожидаемо (улучшили компонент, поменяли формулу или вес):
```bash
zsh $SKILL/tests/kasko/run.sh                                       # папка прогона: $SKILL/.acceptance/kasko-<время>
$PY $SKILL/scripts/eval_deck.py gate $SKILL/.acceptance/kasko-<время>/src-fixed --baseline $SKILL/tests/kasko/eval_baseline.json   # что изменилось
$PY $SKILL/scripts/eval_deck.py score $SKILL/.acceptance/kasko-<время>/src-fixed --write-baseline $SKILL/tests/kasko/eval_baseline.json
```
В коммите с новым эталоном и в CHANGELOG пишут, какие метрики сдвинулись и почему. Понижать эталон, чтобы пропустить
регрессию, нельзя: сначала исправляют причину.
