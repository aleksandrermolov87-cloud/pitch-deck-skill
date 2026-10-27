# Сводный отчёт проверок деки (reference/17-check-report.md): что проверено, чем, где границы каждой проверки.
#   check_report.py <src> [--xlsx модель.xlsx] [--compare <папка сравнения version_compare.py>]
# Запускает facts_check.py, brief_coverage.py, library_check.py и pptx_audit.py, читает out*/render.json (переполнения,
# шрифт), out/powerpoint.json (просмотр в PowerPoint) и out/waivers.json (объяснения оставленных предупреждений).
# Пишет out/checks.md (раздел «Проверки» для REPORT.md) и out/checks.json. Разделы:
#   1. реестр фактов по источникам; 2. полнота относительно брифа; 3. переполнения, геометрия и библиотека;
#   4. просмотр в PowerPoint; 5. предупреждения, оставленные с объяснением, и без объяснения.
# Плюс версия и коммит навыка, компоненты по слайдам и отличия от предыдущей сборки (если передан --compare).
# Код 1, если хоть одна проверка не пройдена. Запуск: $SKILL/.venv/bin/python -I check_report.py …
import argparse
import datetime as dt
import json
import os
import re
import subprocess
import sys

SKILL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PY = sys.executable
ap = argparse.ArgumentParser()
ap.add_argument('src')
ap.add_argument('--xlsx')
ap.add_argument('--compare', help='папка сравнения version_compare.py compare (report.json): отличия от предыдущей сборки')
a = ap.parse_args()
src = os.path.abspath(a.src)
out = os.path.join(src, 'out')
for need in ('slides.json', 'facts.json'):
    if not os.path.isfile(os.path.join(out, need)):
        sys.exit(f'нет out/{need}: соберите деку (node build.js) и отрендерьте (./render.sh)')
MAN = json.load(open(os.path.join(out, 'slides.json'), encoding='utf-8'))
DECK = json.load(open(os.path.join(src, 'deck.json'), encoding='utf-8')) if os.path.isfile(os.path.join(src, 'deck.json')) else {}
name = DECK.get('name', os.path.basename(src))
load = lambda p: json.load(open(p, encoding='utf-8')) if os.path.isfile(p) else None


def run(cmd):
    p = subprocess.run(cmd, cwd=src, capture_output=True, text=True)
    lines = (p.stdout + p.stderr).strip().splitlines()
    return p.returncode, lines


def tagged(lines, tag):
    return [l[len(tag) + 3:] for l in lines if l.startswith(f'[{tag}]')]


def last(lines):
    return next((l for l in reversed(lines) if l.strip()), '')


S = []          # разделы: {id, title, status, tool, scope, result, bounds, items}
WARN = []       # (проверка, текст) — все предупреждения для раздела 5


def section(sid, title, status, tool, scope, result, bounds, items=()):
    S.append({'id': sid, 'title': title, 'status': status, 'tool': tool, 'scope': scope, 'result': result, 'bounds': bounds, 'items': list(items)})


# ── 1. реестр фактов ──
cmd = [PY, '-I', os.path.join(SKILL, 'scripts', 'facts_check.py'), 'out/facts.json', '--root', '.', '--json', 'out/facts_report.json']
if os.path.isfile(os.path.join(out, 'deck.html')):
    cmd += ['--html', 'out/deck.html']
if a.xlsx:
    cmd += ['--xlsx', a.xlsx]
rc, ln = run(cmd)
FR = load(os.path.join(out, 'facts_report.json')) or {}
WARN += [('facts', w) for w in tagged(ln, 'WARN')]
section('facts', 'Реестр фактов по источникам', 'passed' if rc == 0 else 'failed',
        'facts_check.py' + (f' + модель {os.path.basename(a.xlsx)}' if a.xlsx else ' (модель xlsx не подключалась)'),
        'числа, зарегистрированные через fact(), и числа, которые компоненты нарисовали без подписи (auto)', last(ln),
        'Проверяет только зарегистрированные числа: каждое совпало со своим источником. Не проверяет, что в реестр попали все '
        'числа брифа, и не проверяет, что число можно прочитать на слайде, — это раздел 2. Числа, вписанные строкой, ловит только '
        'с deck.html (предупреждение «вписано без fact()»).',
        tagged(ln, 'ERR') + [f'только в графике: {FR.get("graph_only", 0)} чисел (рисуют форму, без подписи; см. [INFO] facts_check)'] if FR.get('graph_only') else tagged(ln, 'ERR'))

# ── 2. полнота относительно брифа ──
if os.path.isfile(os.path.join(src, 'requirements.json')):
    rc, ln = run([PY, '-I', os.path.join(SKILL, 'scripts', 'brief_coverage.py'), 'check', '.'])
    WARN += [('coverage', w) for w in tagged(ln, 'WARN')]
    section('coverage', 'Полнота относительно брифа', 'passed' if rc == 0 else 'failed', 'brief_coverage.py + карта сабагента out/coverage.json',
            'требования брифа из requirements.json: на слайде, только в заметках, только в графике, нет', last(ln).split('; карта')[0],
            'Проверяет требования, выписанные в requirements.json: если требование не выписано, проверка о нём не знает. Числа и ключи '
            'ищутся в тексте готового PPTX; смысл выводов без чисел и ключей подтверждает только сабагент по PNG. Карта по группам и по '
            'слайдам — out/coverage.md.', tagged(ln, 'ERR'))
else:
    section('coverage', 'Полнота относительно брифа', 'not_run', 'brief_coverage.py', 'требования брифа', 'нет requirements.json',
            'Без списка требований полнота не проверялась: отсутствие ошибок в других разделах не означает, что всё из брифа есть на слайдах.')

# ── 3. переполнения, геометрия, библиотека ──
geo, gst = [], 'passed'
for th, d in (('тёмная', 'out'), ('светлая', 'out-light')):
    r = load(os.path.join(src, d, 'render.json'))
    if r is None:
        if os.path.isdir(os.path.join(src, d)):
            geo.append(f'{th}: render.json нет — ./render.sh не запускался после сборки'); gst = 'failed' if gst != 'failed' else gst
        continue
    if r.get('overflow'):
        gst = 'failed'; geo += [f'{th}: переполнение {x}' for x in r['overflow']]
    if not r.get('font'):
        gst = 'failed'; geo.append(f'{th}: шрифт бренда не загрузился при рендере')
    geo.append(f"{th}: {r.get('slides')} слайдов, переполнений {len(r.get('overflow') or [])}, шрифт {'есть' if r.get('font') else 'нет'}")
audits = []
for suffix in ('', '_темная', '_светлая'):
    p = os.path.join(os.path.dirname(src), f'{name}{suffix}.pptx')
    if os.path.isfile(p):
        rc, ln = run([PY, '-I', os.path.join(SKILL, 'scripts', 'pptx_audit.py'), p])
        audits.append(last(ln))
        WARN += [('audit', f'{os.path.basename(p)}: {w}') for w in tagged(ln, 'WARN')]
        geo += [f'{os.path.basename(p)}: {e}' for e in tagged(ln, 'ERR')]
        if rc or tagged(ln, 'ERR'):
            gst = 'failed'
if not audits:
    geo.append('PPTX рядом с проектом не найден: pptx_audit не запускался'); gst = 'failed'
rc, ln = run([PY, '-I', os.path.join(SKILL, 'scripts', 'library_check.py'), '.'])
WARN += [('library', w) for w in tagged(ln, 'WARN')]
geo += tagged(ln, 'ERR') + [last(ln)]
if rc:
    gst = 'failed'
section('geometry', 'Переполнения, геометрия и библиотека', gst, 'render.sh (headless Chrome), pptx_audit.py, library_check.py',
        'тексты в боксах, шрифт, сетка, поля, кегли PPTX, компонент библиотеки на каждом слайде', '; '.join(audits) or '—',
        'Переполнения меряются в HTML-двойнике в Chrome, а не в PowerPoint: перенос строк в PowerPoint может отличаться. Аудит видит '
        'геометрию PPTX, но не качество дизайна и не смысл.', geo)

# ── 4. просмотр в PowerPoint ──
pp = load(os.path.join(out, 'powerpoint.json'))
if pp and pp.get('viewed'):
    total = len(MAN)
    scope = '; '.join(f"{v.get('theme', 'dark')}: слайды {', '.join(map(str, v.get('slides', [])))} из {total} ({v.get('by', '?')})" for v in pp['viewed'])
    full = all(len(set(v.get('slides', []))) >= total for v in pp['viewed'])
    section('powerpoint', 'Просмотр в PowerPoint', 'passed' if full else 'warning', 'Microsoft PowerPoint, глазами', scope,
            pp.get('notes', ''), 'Подтверждает только перечисленные слайды перечисленных тем.' + ('' if full else ' Остальные слайды в PowerPoint не открывались.'))
else:
    section('powerpoint', 'Просмотр в PowerPoint', 'not_run', 'Microsoft PowerPoint', 'вся презентация', 'не выполнялся',
            'Файл в PowerPoint не открывался: шрифт, переносы и автоподбор в PowerPoint не подтверждены. Запишите просмотр в '
            'out/powerpoint.json: {"viewed": [{"theme": "dark", "slides": [1, 2], "by": "агент через Computer Use"}], "notes": "…"}.')

# ── 5. предупреждения: с объяснением и без ──
waivers = load(os.path.join(out, 'waivers.json')) or []
expl, open_ = [], []
for chk, w in WARN:
    wv = next((x for x in waivers if x.get('match') and x['match'] in w and x.get('check', chk) == chk), None)
    (expl if wv else open_).append((chk, w, wv['why'] if wv else ''))
section('warnings', 'Предупреждения', 'passed' if not open_ else 'warning', 'out/waivers.json',
        'все [WARN] проверок выше', f'с объяснением {len(expl)}, без объяснения {len(open_)}',
        'Предупреждение не ошибка, но каждое оставленное должно иметь причину в out/waivers.json: [{"check": "audit", "match": "часть текста", "why": "…"}].',
        [f'{c}: {w} — {why}' for c, w, why in expl] + [f'БЕЗ ОБЪЯСНЕНИЯ — {c}: {w}' for c, w, _ in open_])

# ── шапка, компоненты, отличия от предыдущей сборки ──
_, commit = run(['git', '-C', SKILL, 'rev-parse', '--short=12', 'HEAD'])
_, dirty = run(['git', '-C', SKILL, 'status', '--porcelain', '--', 'templates', 'scripts'])
ver = open(os.path.join(SKILL, 'VERSION')).read().strip()
cmp = load(os.path.join(a.compare, 'report.json')) if a.compare else None
ST = {'passed': 'пройдена', 'failed': 'НЕ пройдена', 'warning': 'есть замечания', 'not_run': 'не выполнялась'}
L = [f'## Проверки: {name}', '',
     f"- Навык: pitch-deck-skill {ver}, коммит {last(commit) or '?'}" + (' (с незакоммиченными правками)' if dirty else ''),
     f"- Собрано и проверено: {dt.datetime.now().strftime('%d.%m.%Y %H:%M')}; слайдов {len(MAN)}", '',
     '| # | Проверка | Статус | Инструмент | Что охватывает | Итог |', '|---|---|---|---|---|---|']
for i, x in enumerate(S, 1):
    L.append(f"| {i} | {x['title']} | {ST[x['status']]} | {x['tool']} | {x['scope']} | {x['result'].replace('|', '/')} |")
L += ['', 'Не выполнявшаяся проверка не считается пройденной. Ни одна проверка не заменяет другую: реестр фактов без ошибок не значит, '
      'что в него попали все числа брифа, а полнота брифа не проверяет, верны ли числа.', '']
for i, x in enumerate(S, 1):
    L += [f"### {i}. {x['title']}: {ST[x['status']]}", '', f"**Граница проверки.** {x['bounds']}", '']
    L += [f'- {t}' for t in x['items'] if t]
    L.append('')
L += ['### Компоненты по слайдам', '', '| Слайд | Заголовок | Компоненты |', '|---|---|---|']
L += [f"| {s['n']} | {(s.get('title') or '')[:70]} | {'+'.join(s.get('lib') or []) or ('custom: ' + s['custom'] if s.get('custom') else '—')} |" for s in MAN]
L += ['', '### Отличия от предыдущей сборки', '']
if cmp:
    c = cmp['counts']
    L += [f"- Сравнение: {cmp['kind']} ({cmp['A']['label']} → {cmp['B']['label']}); пар слайдов {len(cmp['slides'])}: совпали {c['identical']}, "
          f"изменились {c['changed']}, нет в A {c['missing_in_A']}, нет в B {c['missing_in_B']}."]
    L += [f'- Не контрольное: {x}' for x in cmp.get('reasons_not_controlled', [])]
    ed = {k: v['changes'] for k, v in (cmp.get('content') or {}).items() if v['changes']}
    L += [f"- Слайд {k}: {'; '.join(v)} (правка содержания)" for k, v in ed.items()]
    L.append(f'- Полный отчёт и пары «до / после»: `{os.path.abspath(a.compare)}/report.md`')
else:
    L.append('Сравнение с предыдущей сборкой не выполнялось (version_compare.py run → compare, затем --compare <папка>).')
open(os.path.join(out, 'checks.md'), 'w', encoding='utf-8').write('\n'.join(L) + '\n')
json.dump({'skill': {'version': ver, 'commit': last(commit), 'dirty': bool(dirty)}, 'sections': S,
           'components': {s['n']: s.get('lib') or [] for s in MAN}, 'compare': a.compare}, open(os.path.join(out, 'checks.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
for x in S:
    print(f"{ST[x['status']]:>16}  {x['title']}: {x['result'][:110]}")
print(f'\nотчёт: {os.path.join(out, "checks.md")}')
sys.exit(1 if any(x['status'] == 'failed' for x in S) else 0)
