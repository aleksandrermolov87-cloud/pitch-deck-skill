# Приоритет библиотеки компонентов (SKILL.md, этап 2): тело каждого содержательного слайда собирает компонент
# из components.js. Своя раскладка допустима только с причиной (slide → custom: '…'), и её не должно быть там,
# где в библиотеке есть компонент того же архетипа.
# Запуск: $SKILL/.venv/bin/python -I library_check.py <src-проекта> [--json report.json]
# Читает out/slides.json (пишет build.js) и каталог $SKILL/components/README.md. Код 1 при любой ошибке.
import argparse
import json
import os
import re
import sys

SKILL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXEMPT = {'cover'}            # обложку собирает шапка и 3D-объект: компонента обложки в библиотеке нет

ap = argparse.ArgumentParser()
ap.add_argument('src')
ap.add_argument('--json')
a = ap.parse_args()

man = os.path.join(a.src, 'out', 'slides.json')
if not os.path.isfile(man):
    sys.exit(f'нет {man}: соберите деку (node build.js)')
slides = [s for s in json.load(open(man, encoding='utf-8')) if not s.get('hidden')]

# каталог: строка таблицы «| вопрос | `компонент` [+ `компонент`] | `архетип` | …»
by_arch = {}
for line in open(os.path.join(SKILL, 'components', 'README.md'), encoding='utf-8'):
    m = re.match(r'\|[^|]+\|\s*((?:`\w+`(?:\s*\+\s*)?)+)\s*\|\s*`([\w-]+)`\s*\|', line)
    if m:
        for comp in re.findall(r'`(\w+)`', m.group(1)):
            by_arch.setdefault(m.group(2), []).append(comp)

errors, warns, rows = [], [], []
content = [s for s in slides if s.get('archetype') not in EXEMPT]
for s in slides:
    n, arch, lib, why = s['n'], s.get('archetype'), s.get('lib') or [], (s.get('custom') or '').strip()
    have = by_arch.get(arch, [])
    if arch in EXEMPT:
        rows.append((n, arch, 'исключение', ''))
        continue
    if lib:
        rows.append((n, arch, '+'.join(lib), ''))
        continue
    if not why:
        hint = f'в библиотеке для «{arch}» есть {", ".join(have)}' if have else 'подберите компонент по вопросу зрителя в components/README.md'
        errors.append(f'слайд {n} «{s.get("title", "")[:50]}»: собран без компонента библиотеки и без причины ({hint}). Используйте компонент или верните custom: «почему не подошёл»')
        rows.append((n, arch, '—', 'нет причины'))
    elif have:
        warns.append(f'слайд {n}: своя раскладка, хотя для «{arch}» в библиотеке есть {", ".join(have)}. Причина: «{why}». Если причина в виде, сделайте новый компонент (components/README.md → «Как пополнять библиотеку»)')
        rows.append((n, arch, 'своя', why))
    else:
        rows.append((n, arch, 'своя', why))

covered = sum(1 for s in content if s.get('lib'))
share = covered / len(content) if content else 1.0
for r in rows:
    print(f'  слайд {r[0]:>2} {r[1]:<22} {r[2]}' + (f' — {r[3]}' if r[3] else ''))
for w in warns:
    print('[WARN]', w)
for e in errors:
    print('[ERR]', e)
print(f'\nсодержательных слайдов {len(content)}, из библиотеки {covered} ({share:.0%}), своих с причиной {len(content) - covered - len(errors)}, без причины {len(errors)}')
if a.json:
    json.dump({'slides': len(content), 'library': covered, 'share': share, 'errors': errors, 'warnings': warns}, open(a.json, 'w'), ensure_ascii=False, indent=1)
sys.exit(1 if errors else 0)
