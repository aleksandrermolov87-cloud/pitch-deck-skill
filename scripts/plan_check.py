# Ответы на обязательные вопросы планировщика (SKILL.md, этап 0) и их исполнение в собранной деке.
# deck.json → plan: { "topic": "<тема>", "slides": <число> | "auto", "3d": true | false, "slides_why"?: "<почему отклонились>" }
# Проверяет: все три ответа записаны; при точном числе слайдов видимых слайдов ровно столько (иначе нужна причина
# slides_why, согласованная с пользователем); при «без 3D» в деке нет сгенерированных картинок; при «с 3D» записан провайдер.
# Запуск: $SKILL/.venv/bin/python -I plan_check.py <src-проекта>   код 1 при ошибке
import argparse
import json
import sys
from pathlib import Path

ap = argparse.ArgumentParser()
ap.add_argument('src')
a = ap.parse_args()
SRC = Path(a.src)
errors, warns = [], []
deck = json.loads((SRC / 'deck.json').read_text(encoding='utf-8'))
P = deck.get('plan') or {}

topic, slides, d3 = P.get('topic'), P.get('slides'), P.get('3d')
if not (isinstance(topic, str) and topic.strip()):
    errors.append('нет ответа «тема»: deck.json → plan.topic')
if not (slides == 'auto' or (isinstance(slides, int) and not isinstance(slides, bool) and slides > 0)):
    errors.append('нет ответа «количество слайдов»: deck.json → plan.slides — число или "auto" (решит агент)')
if not isinstance(d3, bool):
    errors.append('нет ответа «нужны 3D-генерации»: deck.json → plan["3d"] — true или false')

man = SRC / 'out' / 'slides.json'
visible = None
if man.exists():
    visible = sum(1 for s in json.loads(man.read_text(encoding='utf-8')) if not s.get('hidden'))
    if isinstance(slides, int) and visible != slides:
        (warns if P.get('slides_why') else errors).append(
            f'просили {slides} слайдов, в деке {visible}' + (f' — причина: {P["slides_why"]}' if P.get('slides_why')
                                                             else ': уберите лишние / добавьте или запишите plan.slides_why, согласовав с пользователем'))
else:
    warns.append('нет out/slides.json: число слайдов сверится после node build.js')

V = json.loads((SRC / 'data' / 'visuals.json').read_text(encoding='utf-8')) if (SRC / 'data' / 'visuals.json').exists() else {}
made = [i for i in V.get('images', []) if not i.get('demo') and i.get('provider') != 'user']
prov = (V.get('provider_choice') or {}).get('provider')
if d3 is False and made:
    errors.append(f'ответ «без 3D», но в деке сгенерированные картинки: {", ".join(i["file"] for i in made)}')
if d3 is False and prov not in (None, 'none'):
    errors.append(f'ответ «без 3D», а в data/visuals.json провайдер {prov}: visuals.py choose --provider none')
if d3 is True and prov in (None, 'none'):
    warns.append('3D нужны, а провайдер не записан: visuals.py choose src --provider <magicpatterns|codex-imagegen>')

print(f'тема: {topic or "—"} | слайдов: {slides if slides is not None else "—"}' + (f' (в деке {visible})' if visible is not None else '')
      + f' | 3D: {"да" if d3 is True else "нет" if d3 is False else "—"}' + (f', провайдер {prov}' if prov else ''))
for w in warns:
    print('[WARN]', w)
for e in errors:
    print('[ERR]', e)
sys.exit(1 if errors else 0)
