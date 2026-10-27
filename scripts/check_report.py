# Сводный отчёт проверок деки (reference/17-check-report.md): что проверено, чем, где границы каждой проверки.
#   check_report.py <src> [--xlsx модель.xlsx] [--compare <папка сравнения version_compare.py>]
# Запускает facts_check.py, brief_coverage.py, library_check.py, pptx_audit.py и pptx_target_check.py status, читает
# out*/render.json (переполнения и шрифт HTML-двойника), out/target_check.json (PPTX в PowerPoint / LibreOffice и ручной
# просмотр), data/visuals.json (происхождение картинок) и out/waivers.json (объяснения оставленных предупреждений).
# Пишет out/checks.md (раздел «Проверки» для REPORT.md) и out/checks.json. Разделы:
#   1. реестр фактов по источникам; 2. полнота относительно брифа; 3. переполнения, геометрия и библиотека (HTML-двойник
#   и структура PPTX); 4. PPTX в целевом приложении — отдельно от HTML: без него PPTX не называется проверенным;
#   5. предупреждения, оставленные с объяснением, и без объяснения.
# Плюс версия и коммит навыка; по каждому слайду компонент, почему выбран, входные данные, источник, ограничения и степень
# проверки (HTML / приложение / вручную); происхождение изображений по провайдерам; отличия от предыдущей сборки (--compare).
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


COV_ERR = None  # строки [ERR] полноты брифа: для таблицы по слайдам
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
        tagged(ln, 'ERR')
        + ([f'только в графике: {FR.get("graph_only", 0)} чисел (рисуют форму, без подписи; см. [INFO] facts_check)'] if FR.get('graph_only') else [])
        + ([f'читаются с периодом и единицей в одной подписи: {FR["labeled"]}; только число, без периода или единицы рядом: {FR.get("value_only", 0)}']
           if 'labeled' in FR else []))

# ── 2. полнота относительно брифа ──
if os.path.isfile(os.path.join(src, 'requirements.json')):
    rc, ln = run([PY, '-I', os.path.join(SKILL, 'scripts', 'brief_coverage.py'), 'check', '.'])
    COV_ERR = tagged(ln, 'ERR')
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
geo, gst, RENDER = [], 'passed', {}
for th, d in (('тёмная', 'out'), ('светлая', 'out-light')):
    r = load(os.path.join(src, d, 'render.json'))
    RENDER[th] = r
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
section('geometry', 'Переполнения, геометрия и библиотека', gst, 'render.sh (HTML-двойник в headless Chrome), pptx_audit.py (структура PPTX), library_check.py',
        'тексты в боксах, шрифт, сетка, поля, кегли PPTX, компонент библиотеки на каждом слайде', '; '.join(audits) or '—',
        'Переполнения меряются в HTML-двойнике в Chrome, а не в PowerPoint: перенос строк в PowerPoint может отличаться. Аудит видит '
        'геометрию PPTX, но не качество дизайна и не смысл.', geo)

# ── 4. PPTX в целевом приложении (pptx_target_check.py): отдельно от HTML-двойника ──
if os.path.isfile(os.path.join(out, 'target_status.json')):
    os.remove(os.path.join(out, 'target_status.json'))
rc, ln = run([PY, '-I', os.path.join(SKILL, 'scripts', 'pptx_target_check.py'), 'status', '.', '--json', 'out/target_status.json'])
TG = load(os.path.join(out, 'target_status.json')) or {'status': 'not_run', 'label': 'не выполнялось', 'themes': {}, 'slides': {}, 'items': []}
WARN += [('target', w) for w in tagged(ln, 'WARN')]
TST = {'passed': 'passed', 'failed': 'failed', 'partial': 'warning', 'not_run': 'not_run'}[TG['status']]
apps = sorted({f"{t['auto']['app']} {t['auto'].get('app_version') or ''}".strip() for t in TG['themes'].values()
               if t.get('auto') and not t['auto'].get('stale') and t['auto'].get('status') != 'not_run'}
              | {m.get('app') or '?' for t in TG['themes'].values() for m in t.get('manual', []) if not m.get('stale')})
section('target', 'Просмотр в PowerPoint и проверка PPTX в целевом приложении', TST,
        'pptx_target_check.py: ' + (', '.join(apps) if apps else 'приложение не запускалось'),
        'готовый PPTX в PowerPoint или LibreOffice: переносы против HTML-двойника, переполнения, выход за холст, изображения, '
        'подмена шрифта; ручной просмотр — по записанным темам и слайдам',
        f"PPTX в целевом приложении: {TG.get('label', 'не выполнялось')}",
        'Без этой проверки PPTX не считается проверенным: разделы 1–3 смотрят HTML-двойник в Chrome и структуру файла, а '
        'перенос строк, шрифт и автоподбор в PowerPoint могут отличаться. Автопроверка видит то, что приложение отдало в PDF: '
        'анимации, заметки и поведение при редактировании не проверяются. Ручной просмотр подтверждает только записанные слайды '
        'записанной темы (pptx_target_check.sh manual <src> --theme dark --slides 1,3,5). Результат после пересборки PPTX устаревает.',
        tagged(ln, 'ERR') + TG.get('items', []))

# ── происхождение изображений (data/visuals.json пишет visuals.py): провайдеры не смешиваются ──
PROV = {'magicpatterns': 'MagicPatterns (generate_image в Claude)', 'codex-imagegen': 'Codex imagegen (сторонний генератор, не MagicPatterns)',
        'user': 'Картинки пользователя', 'demo': 'Демо-объекты заготовки (не работа по этой деке)'}
SENT = {'none': 'нет', 'generalized': 'обобщённый промпт без чисел и названий брифа', None: 'не записано'}
VJ = load(os.path.join(src, 'data', 'visuals.json'))
d3 = os.path.join(src, 'img', '3d')
files3d = sorted(f for f in (os.listdir(d3) if os.path.isdir(d3) else [])
                 if not f.startswith('.') and not f.endswith('.json') and not re.search(r'_check\.png$', f) and os.path.isfile(os.path.join(d3, f)))
recs = (VJ or {}).get('images') or []
stem = lambda f: os.path.splitext(os.path.basename(f or ''))[0]
rec_stems = {stem(r.get('file')) for r in recs}
unrec = [f for f in files3d if stem(f) not in rec_stems]
have = {stem(f) for f in files3d}
for f in unrec:
    WARN.append(('visuals', f'img/3d/{f}: происхождение не записано (visuals.py fetch / import / record)'))
real = [r for r in recs if not r.get('demo')]
pc = (VJ or {}).get('provider_choice')
if real and not pc:
    WARN.append(('visuals', 'выбор провайдера изображений не записан (visuals.py choose), а картинки по деке есть'))
VL = ['### Происхождение изображений', '']
if VJ is None and not files3d:
    VL.append('Внешняя генерация изображений не использовалась: нет data/visuals.json и файлов в img/3d.')
else:
    if pc:
        VL.append(f"- Провайдер: {PROV.get(pc.get('provider'), pc.get('provider'))}" if pc.get('provider') != 'none' else '- Провайдер: внешняя генерация отключена')
        VL.append(f"- Выбор пользователя: {'да' if pc.get('chosen_by_user') else 'нет, не подтверждён пользователем'}"
                  + (f", {pc['when']}" if pc.get('when') else ''))
        VL.append(f"- Квота и стоимость: {pc.get('quota') or 'неизвестны (провайдер не сообщил)'}")
    else:
        VL.append('- Провайдер: выбор не записан')
    if (VJ or {}).get('note'):
        VL.append(f"- Примечание: {VJ['note']}")
    VL.append('- Состояние внешних сервисов отчёт не проверяет: доступность MagicPatterns или Codex видна только в чате, где шла генерация.')
    groups = {}
    for r in recs:
        groups.setdefault('demo' if r.get('demo') else r.get('provider') or '?', []).append(r)
    for g in ('magicpatterns', 'codex-imagegen', 'user', *sorted(set(groups) - {'magicpatterns', 'codex-imagegen', 'user', 'demo'}), 'demo'):
        if g not in groups:
            continue
        VL += ['', f'**{PROV.get(g, g)}**', '', '| Файл | Слайд | Инструмент | Источник | Создано | Данные брифа отправлены |', '|---|---|---|---|---|---|']
        for r in groups[g]:
            miss = '' if stem(r.get('file')) in have else ' (файла нет в img/3d)'
            srcu = re.sub(r'^https?://([^/]+)/.*', r'\1', r.get('source') or '') or '—'
            VL.append(f"| {r.get('file')}{miss} | {r.get('slide') or '—'} | {r.get('tool') or '—'} | {srcu} | {r.get('created') or '—'} | "
                      f"{SENT.get(r.get('data_sent'), r.get('data_sent'))} |")
    if unrec:
        VL += ['', f"**Происхождение не записано:** {', '.join('img/3d/' + f for f in unrec)}. Пока запись не сделана, такие картинки "
               'нельзя относить ни к MagicPatterns, ни к другому провайдеру.']
    VL.append('')
    VL.append('Картинка остаётся картинкой: тексты и числа слайдов собраны нативными фигурами PPTX, генератор их не рисовал.')

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
     f"- Собрано и проверено: {dt.datetime.now().strftime('%d.%m.%Y %H:%M')}; слайдов {len(MAN)}",
     '- HTML-двойник (превью в Chrome): ' + ('; '.join(f"{th} — переполнений {len(r.get('overflow') or [])}, шрифт {'есть' if r.get('font') else 'нет'}"
                                                      for th, r in RENDER.items() if r) or 'не рендерился') + '. Это проверка превью, не PPTX.',
     f"- PPTX в целевом приложении: {TG.get('label', 'не выполнялось')}"
     + ('' if TG.get('status') == 'passed' else ' — PPTX в PowerPoint или LibreOffice не подтверждён целиком, проверен только HTML-двойник и структура файла'
        if TG.get('status') == 'not_run' else ' — подтверждено не всё, см. раздел 4'), '',
     '| # | Проверка | Статус | Инструмент | Что охватывает | Итог |', '|---|---|---|---|---|---|']
for i, x in enumerate(S, 1):
    L.append(f"| {i} | {x['title']} | {ST[x['status']]} | {x['tool']} | {x['scope']} | {x['result'].replace('|', '/')} |")
L += ['', 'Не выполнявшаяся проверка не считается пройденной. Ни одна проверка не заменяет другую: реестр фактов без ошибок не значит, '
      'что в него попали все числа брифа, а полнота брифа не проверяет, верны ли числа.', '']
for i, x in enumerate(S, 1):
    L += [f"### {i}. {x['title']}: {ST[x['status']]}", '', f"**Граница проверки.** {x['bounds']}", '']
    L += [f'- {t}' for t in x['items'] if t]
    L.append('')
# ── по слайдам: компонент, почему выбран, входные данные, источник, ограничения, степень проверки ──
CAT = {}
for line_ in open(os.path.join(SKILL, 'components', 'README.md'), encoding='utf-8'):
    cells = [c.strip() for c in line_.strip().strip('|').split('|')]
    if len(cells) >= 4 and re.fullmatch(r'(?:`\w+`(?:\s*\+\s*)?)+', cells[1]):
        for comp in re.findall(r'`(\w+)`', cells[1]):
            CAT.setdefault(comp, (cells[0], cells[3]))
LIM = re.compile(r'(?:до|не больше|не более|максимум)\s+\d+(?:\s+(?:слов|символов|строк|пунктов|шагов|элементов))?|×\s?\d+(?:[–-]\d+)?|\d+[–-]\d+\s+(?:слов|пунктов|шагов|строк|колонок)|\b\d{1,2}[–-]\d{1,2}\b')
FACTS = load(os.path.join(out, 'facts.json')) or []
REQ = load(os.path.join(src, 'requirements.json'))
CMAP = load(os.path.join(out, 'coverage.json')) or {}
bad_req = {m.group(1) for e in (COV_ERR or []) for m in [re.match(r'(\S+?):', e)] if m}
TH = {'dark': 'тёмная', 'light': 'светлая'}
CMD = {}        # карта по слайдам из out/coverage.md (brief_coverage.py сам ищет требования в тексте слайдов)
if REQ is not None and COV_ERR is not None and os.path.isfile(os.path.join(out, 'coverage.md')):
    on = False
    for line_ in open(os.path.join(out, 'coverage.md'), encoding='utf-8'):
        on = on or line_.startswith('### Карта по слайдам')
        m = re.match(r'\|\s*(\d+)\s*\|.*\|\s*([^|]*)\|\s*$', line_) if on else None
        if m and m.group(2).strip() not in ('', '—'):
            CMD[int(m.group(1))] = m.group(2).strip()


def html_state(n):
    res = []
    for th, r in RENDER.items():
        if r is None:
            continue
        ov = [x for x in r.get('overflow') or [] if re.match(rf's{n}-', x)]
        unk = [x for x in r.get('overflow') or [] if not re.match(r's\d+-', x)]
        res.append(f"{th} {'переполнение' if ov else ('?' if unk else '✓')}")
    return ('HTML: ' + ', '.join(res)) if res else 'HTML: не рендерился'


def pptx_state(n):
    d = TG.get('slides', {}).get(str(n), {})
    res = []
    for th in TG.get('themes', {}):
        x = d.get(th, {})
        if x.get('auto') and x['auto'] != 'not_run':
            res.append(f"{TH[th]} {x.get('app') or 'приложение'}: {LBL[x['auto']]}")
        if x.get('manual'):
            res.append(f"{TH[th]} вручную: {LBL[x['manual']]}")
    return 'PPTX: ' + ('; '.join(res) if res else 'не выполнялось')


LBL = {'passed': 'пройдено', 'failed': 'ошибки', 'partial': 'частично', 'not_run': 'не выполнялось'}
ROWS = []
for sl in MAN:
    n, lib = sl['n'], sl.get('lib') or []
    comp = '+'.join(lib) or ('обложка' if sl.get('archetype') == 'cover' else 'своя раскладка' if sl.get('custom') else '—')
    if sl.get('why'):
        why = sl['why']
    elif lib:
        why = '; '.join(f'«{CAT[c][0]}»' for c in lib if c in CAT) or 'компонент вне каталога'
    elif sl.get('custom'):
        why = f"своя раскладка: {sl['custom']}"
    else:
        why = 'шапка и 3D-объект обложки' if sl.get('archetype') == 'cover' else 'причина не записана'
    fs_ = [f for f in FACTS if f.get('slide') == n]
    shown = sum(1 for f in fs_ if f.get('shown'))
    lab = sum(1 for f in fs_ if f.get('shown') and f.get('shown_as') == 'label')
    how = f': с периодом и единицей {lab}, только число {shown - lab}' if any('shown_as' in f for f in fs_) else ''
    data = [f'чисел {len(fs_)} (читаются {shown}{how}; только в графике {len(fs_) - shown})'] if fs_ else ['чисел нет']
    if REQ is None:
        data.append('бриф не размечен (requirements.json нет)')
    else:
        rq = sorted({it['id'] for it in CMAP.get('items', []) if it.get('slide') == n})
        if n in CMD:
            data.append('требования ' + CMD[n])
        elif rq:
            data.append('требования ' + ', '.join(r + (' ⚠' if r in bad_req else '') for r in rq))
    if sl.get('missing'):
        data.append('нет в брифе: ' + ', '.join(map(str, sl['missing'])))
    srcs = []
    for f in fs_:
        t = f.get('file') or {'derived': 'расчёт из других чисел'}.get(f.get('type'), f.get('type') or '?')
        t = os.path.basename(t) + (f" / {f['sheet']}" if f.get('sheet') else '')
        if t not in srcs:
            srcs.append(t)
    lim = sorted({m.group(0) for c in lib if c in CAT for m in LIM.finditer(CAT[c][1])})
    nw = sum(1 for _, w in WARN if re.search(rf'слайд {n}\b', w))
    cut = lambda t: t if len(t) <= 80 else t[:80].rsplit(' ', 1)[0].rstrip(',;') + '…'
    spec = '; '.join(cut(re.sub(r'`', '', CAT[c][1])) for c in lib if c in CAT)
    lims = ('; '.join(lim) if lim else (f'поля: {spec}' if spec else '—')) + (f'; предупреждений {nw}' if nw else '')
    ROWS.append({'n': n, 'title': sl.get('title') or '', 'component': comp, 'why': why, 'data': '; '.join(data),
                 'source': ', '.join(srcs[:3]) + (f' и ещё {len(srcs) - 3}' if len(srcs) > 3 else '') if srcs else '—',
                 'limits': lims, 'verified': f'{html_state(n)}; {pptx_state(n)}'})
cell = lambda t: str(t).replace('|', '/').replace('\n', ' ')
L += ['### Компоненты по слайдам', '',
      'Почему выбран — вопрос зрителя из каталога компонентов (components/README.md) или записанная причина своей раскладки. '
      'Данные — сколько чисел слайда в реестре и какие требования брифа он закрывает (⚠ — требование не выполнено). '
      'Ограничения — пределы компонента по каталогу. Проверка — HTML-двойник отдельно от PPTX в целевом приложении.', '',
      '| Слайд | Заголовок | Компонент | Почему выбран | Входные данные | Источник | Ограничения | Проверка |', '|---|---|---|---|---|---|---|---|']
L += [f"| {r['n']} | {cell(r['title'][:60])} | {cell(r['component'])} | {cell(r['why'])} | {cell(r['data'])} | {cell(r['source'])} | {cell(r['limits'])} | {cell(r['verified'])} |" for r in ROWS]
L += [''] + VL
L += ['', '### Отличия от предыдущей сборки', '']
if cmp:
    c = cmp['counts']
    L += [f"- Сравнение: {cmp['kind']} ({cmp['A']['label']} → {cmp['B']['label']}); пар слайдов {len(cmp['slides'])}: совпали {c['identical']}, "
          f"изменились {c['changed']}, нет в A {c['missing_in_A']}, нет в B {c['missing_in_B']}."]
    L += [f'- Не контрольное: {x}' for x in cmp.get('reasons_not_controlled', [])]
    cc_ = cmp.get('content_compare') or {}
    if cc_.get('comparable') is False:
        L.append(f"- Содержание не удалось сравнить: {cc_.get('reason') or 'причина не указана'}. Правки текста, заметок и компонентов не показаны, "
                 'и это не значит, что их не было.')
    else:
        ed = {k: v['changes'] for k, v in (cmp.get('content') or {}).items() if v and v.get('changes')}
        L += [f"- Слайд {k}: {'; '.join(v)} (правка содержания)" for k, v in ed.items()]
        if cc_.get('skipped'):
            L.append(f"- Не сравнивались: {', '.join(cc_['skipped'])}")
    L.append(f'- Полный отчёт и пары «до / после»: `{os.path.abspath(a.compare)}/report.md`')
else:
    L.append('Сравнение с предыдущей сборкой не выполнялось (version_compare.py run → compare, затем --compare <папка>).')
open(os.path.join(out, 'checks.md'), 'w', encoding='utf-8').write('\n'.join(L) + '\n')
json.dump({'skill': {'version': ver, 'commit': last(commit), 'dirty': bool(dirty)}, 'sections': S,
           'components': {s['n']: s.get('lib') or [] for s in MAN}, 'slides': ROWS, 'target': TG,
           'visuals': {'provider_choice': pc, 'images': recs, 'unrecorded': ['img/3d/' + f for f in unrec]}, 'compare': a.compare}, open(os.path.join(out, 'checks.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
for x in S:
    print(f"{ST[x['status']]:>16}  {x['title']}: {x['result'][:110]}")
print(f'\nотчёт: {os.path.join(out, "checks.md")}')
sys.exit(1 if any(x['status'] == 'failed' for x in S) else 0)
