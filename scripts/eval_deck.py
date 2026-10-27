# Оценка качества деки числами (reference/20-eval.md): детерминированная карта метрик из артефактов сборки, без LLM и сети.
#   eval_deck.py score <src> [--log] [--evals файл] [--write-baseline json]   out/eval.json и out/eval.md; --log — строка в learnings/evals.jsonl
#   eval_deck.py trend [--deck имя] [--evals файл]               оценка и ключевые метрики по версиям навыка
#   eval_deck.py gate <src | eval.json> --baseline <json> [--tol 0.02]   код 1, если метрика упала больше чем на tol
# Метрики берутся из JSON проверок: facts_check.py, brief_coverage.py, pptx_audit.py, library_check.py, viz_suggest.py deck,
# smart_check.py, plan_check.py, out*/render.json, out/slides.json, data/visuals.json и img/3d. Каждая метрика — 0…1, больше —
# лучше. Итог — взвешенное среднее по измеренным метрикам (веса — WEIGHTS). Неизмеренная метрика («не измерялось») в итог
# не входит: ни 0, ни 1 за неё не ставятся. Запуск: $SKILL/.venv/bin/python -I eval_deck.py …
import argparse
import datetime as dt
import json
import os
import re
import statistics
import subprocess
import sys
import tempfile

SKILL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PY = sys.executable
EVALS = os.path.join(SKILL, 'learnings', 'evals.jsonl')
TITLE_MAX, WORDS_MAX = 10, 90      # слов в заголовке (SKILL.md) и в теле слайда (pptx_audit.py, TEXT_WORDS_MAX)

# веса итоговой оценки: сумма 1.0 (tests/eval/run.sh проверяет)
WEIGHTS = {
    'facts_match': 0.12, 'facts_labeled': 0.06, 'coverage': 0.14, 'audit': 0.10, 'overflow': 0.10, 'library': 0.08,
    'no_block': 0.10, 'visual_density': 0.10, 'words': 0.05, 'titles': 0.05, 'smart': 0.04, 'provenance': 0.03, 'plan': 0.03,
}
NAMES = {
    'facts_match': 'Числа сошлись с источником', 'facts_labeled': 'Числа с периодом и единицей в подписи',
    'coverage': 'Полнота брифа', 'audit': 'Аудит PPTX', 'overflow': 'Без переполнений', 'library': 'Доля библиотеки',
    'no_block': 'Без блоковых и простых слайдов', 'visual_density': 'Визуальная плотность', 'words': 'Объём текста',
    'titles': 'Короткие заголовки', 'smart': 'SMART-тезисы', 'provenance': 'Происхождение 3D записано', 'plan': 'План исполнен',
}
FORMULAS = {
    'facts_match': 'сошлось / (фактов + чисел без fact())  — facts_check.py',
    'facts_labeled': 'label / (label + value) среди читаемых чисел  — facts_check.py',
    'coverage': 'выполнено / (требований − исключено)  — brief_coverage.py check',
    'audit': 'среднее по PPTX тем: max(0, 1 − (ERR + 0.25·WARN) / слайдов)  — pptx_audit.py',
    'overflow': 'среднее по темам: max(0, 1 − переполнений / слайдов)  — out*/render.json',
    'library': 'содержательных слайдов из библиотеки / содержательных  — library_check.py',
    'no_block': '1 − слайдов «простой / блоковый / блочная раскладка» (аудит ∪ viz_suggest deck) / содержательных',
    'visual_density': f'содержательных с картинкой, диаграммой, схемой или графикой ≥ 2 / содержательных  — pptx_audit.py --json',
    'words': f'содержательных слайдов с ≤ {WORDS_MAX} слов / содержательных  — out/slides.json',
    'titles': f'слайдов с заголовком ≤ {TITLE_MAX} слов / слайдов с заголовком  — out/slides.json',
    'smart': 'SMART-пунктов / проверенных пунктов  — smart_check.py',
    'provenance': 'файлов img/3d с записью в data/visuals.json / файлов img/3d',
    'plan': 'пройдено / проверок  — plan_check.py',
}
KEY = ('facts_match', 'coverage', 'overflow', 'no_block', 'visual_density')   # колонки trend
BLOCK = re.compile(r'простой слайд|блоковый слайд|блочная раскладка')


def load(p):
    return json.load(open(p, encoding='utf-8')) if p and os.path.isfile(p) else None


def run_json(cmd, cwd, path):
    """Запускает проверку с --json <path>; возвращает JSON или None (код проверки не важен: важны числа)."""
    if os.path.exists(path):
        os.remove(path)
    subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
    return load(path)


def words(t):
    return [w for w in t.split() if re.search(r'\w', w)]


def visible_slides(man):
    return [s for s in man if not s.get('hidden')]


def content_slides(man):
    return [s for s in visible_slides(man) if s.get('archetype') != 'cover']


def pptx_files(src, name):
    up = os.path.dirname(src)
    dark = next((p for p in (os.path.join(up, f'{name}{x}.pptx') for x in ('', '_темная')) if os.path.isfile(p)), None)
    light = os.path.join(up, f'{name}_светлая.pptx')
    return {k: v for k, v in (('dark', dark), ('light', light if os.path.isfile(light) else None)) if v}


# ───────── сбор: запускает проверки и читает их JSON ─────────
def collect(src):
    out = os.path.join(src, 'out')
    man = load(os.path.join(out, 'slides.json'))
    if man is None:
        sys.exit(f'нет {out}/slides.json: соберите деку (node build.js) и отрендерьте (./render.sh)')
    deck = load(os.path.join(src, 'deck.json')) or {}
    name = deck.get('name', os.path.basename(src))
    R = {'name': name, 'manifest': man, 'pptx': pptx_files(src, name)}
    S = lambda s: os.path.join(SKILL, 'scripts', s)
    with tempfile.TemporaryDirectory() as tmp:
        T = lambda s: os.path.join(tmp, s)
        if os.path.isfile(os.path.join(out, 'facts.json')):
            cmd = [PY, '-I', S('facts_check.py'), 'out/facts.json', '--root', '.', '--json', T('facts.json')]
            if os.path.isfile(os.path.join(out, 'deck.html')):
                cmd += ['--html', 'out/deck.html']
            R['facts'] = run_json(cmd, src, T('facts.json'))
        dark = R['pptx'].get('dark')
        if os.path.isfile(os.path.join(src, 'requirements.json')) and os.path.isfile(os.path.join(out, 'coverage.json')) and dark:
            R['coverage'] = run_json([PY, '-I', S('brief_coverage.py'), 'check', '.', '--pptx', dark, '--json', T('cov.json')], src, T('cov.json'))
        R['audit'] = {th: run_json([PY, '-I', S('pptx_audit.py'), p, '--json', T(f'audit_{th}.json')], src, T(f'audit_{th}.json'))
                      for th, p in R['pptx'].items()}
        R['library'] = run_json([PY, '-I', S('library_check.py'), '.', '--json', T('lib.json')], src, T('lib.json'))
        if dark:
            p = subprocess.run([PY, '-I', S('viz_suggest.py'), 'deck', '.', '--json', '--pptx', dark], cwd=src, capture_output=True, text=True)
            try:
                R['viz'] = json.loads(p.stdout)
            except ValueError:
                R['viz'] = None
            R['smart'] = run_json([PY, '-I', S('smart_check.py'), dark, '--json', T('smart.json')], src, T('smart.json'))
        if os.path.isfile(os.path.join(src, 'deck.json')):
            R['plan'] = run_json([PY, '-I', S('plan_check.py'), '.', '--json', T('plan.json')], src, T('plan.json'))
    R['render'] = {th: load(os.path.join(src, d, 'render.json')) for th, d in (('dark', 'out'), ('light', 'out-light'))
                   if os.path.isdir(os.path.join(src, d))}
    # происхождение: то же сопоставление, что в check_report.py (по имени без расширения, без *_check.png и *.json)
    d3 = os.path.join(src, 'img', '3d')
    files = sorted(f for f in (os.listdir(d3) if os.path.isdir(d3) else [])
                   if not f.startswith('.') and not f.endswith('.json') and not re.search(r'_check\.png$', f) and os.path.isfile(os.path.join(d3, f)))
    stem = lambda f: os.path.splitext(os.path.basename(f or ''))[0]
    recs = {stem(r.get('file')) for r in ((load(os.path.join(src, 'data', 'visuals.json')) or {}).get('images') or [])}
    R['visuals'] = {'files': files, 'unrecorded': [f for f in files if stem(f) not in recs]}
    return R


# ───────── метрики: значение 0…1 или None с причиной ─────────
def metrics(R):
    V, D = {}, {}

    def put(k, v, raw=None, why=None):
        V[k] = None if v is None else round(max(0.0, min(1.0, v)), 4)
        D[k] = {'raw': raw or {}, **({'missing': why} if v is None else {})}

    man = R.get('manifest') or []
    content = content_slides(man)
    C = len(content)

    f = R.get('facts')
    if not f:
        put('facts_match', None, why='нет out/facts.json или facts_check.py не отдал JSON')
        put('facts_labeled', None, why='нет out/facts.json')
    else:
        den = f.get('total', 0) + len(f.get('unregistered') or [])
        put('facts_match', f.get('ok', 0) / den if den else None, {'ok': f.get('ok'), 'total': f.get('total'), 'unregistered': len(f.get('unregistered') or [])},
            why='в реестре нет фактов')
        lv = f.get('labeled', 0) + f.get('value_only', 0)
        put('facts_labeled', f.get('labeled', 0) / lv if lv else None, {'labeled': f.get('labeled'), 'value_only': f.get('value_only')},
            why='нет читаемых чисел с отметкой shown_as')

    c = R.get('coverage')
    if not c:
        put('coverage', None, why='нет requirements.json, карты out/coverage.json или PPTX')
    else:
        den = c['total'] - c['excluded']
        put('coverage', c['ok'] / den if den else None, {'ok': c['ok'], 'total': c['total'], 'excluded': c['excluded'], 'failed': c.get('failed', [])},
            why='все требования исключены')

    au = {th: x for th, x in (R.get('audit') or {}).items() if x}
    if not au:
        put('audit', None, why='PPTX рядом с проектом не найден')
    else:
        vals, raw = [], {}
        for th, x in au.items():
            n = len([s for s in x.get('slides', []) if not s.get('hidden')]) or 1
            vals.append(1 - (x['errors'] + 0.25 * x['warnings']) / n)
            raw[th] = {'errors': x['errors'], 'warnings': x['warnings'], 'slides': n}
        put('audit', sum(max(0.0, v) for v in vals) / len(vals), raw)

    rd = {th: x for th, x in (R.get('render') or {}).items() if x}
    if not rd:
        put('overflow', None, why='нет out*/render.json: ./render.sh не запускался')
    else:
        raw = {th: len(x.get('overflow') or []) for th, x in rd.items()}
        put('overflow', sum(max(0.0, 1 - raw[th] / (x.get('slides') or len(man) or 1)) for th, x in rd.items()) / len(rd), raw)

    lb = R.get('library')
    put('library', lb['share'] if lb and lb.get('slides') else None, {'library': (lb or {}).get('library'), 'slides': (lb or {}).get('slides')},
        why='library_check.py не отдал JSON или нет содержательных слайдов')

    a0 = next((x for x in (au.get('dark'), au.get('light')) if x), None)
    if a0 is None or not C:
        put('no_block', None, why='нет PPTX для аудита или содержательных слайдов')
        put('visual_density', None, why='нет PPTX для аудита или содержательных слайдов')
    else:
        cn = {s['n'] for s in content}
        bad = {i['slide'] for x in au.values() for i in x.get('issues', []) if i['level'] == 'ERR' and BLOCK.search(i['msg'])}
        bad |= {r['slide'] for r in (R.get('viz') or []) if r.get('block') and r.get('slide')}
        bad &= cn
        put('no_block', 1 - len(bad) / C, {'slides': sorted(bad), 'content': C})
        vis = {s['n'] for s in a0.get('slides', []) if s['n'] in cn and (s['images'] > 0 or s['graphics'] >= 2 or s['archetype'].startswith('scheme-'))}
        put('visual_density', len(vis) / C if a0.get('slides') else None, {'visual': len(vis), 'content': C, 'without': sorted(cn - vis)},
            why='pptx_audit.py без статистики по слайдам (старая версия)')

    if not C:
        put('words', None, why='нет содержательных слайдов')
    else:
        wc = {}
        for s in content:
            ts = [''.join(t.get('runs') or []) for t in s.get('texts', []) if not re.search(r'-src$', t.get('id') or '')]
            wc[s['n']] = sum(len(words(t)) for t in ts if len(t.strip()) > 1 and not re.fullmatch(r'\s*\d+\s*/\s*\d+\s*', t))
        put('words', sum(1 for v in wc.values() if v <= WORDS_MAX) / C,
            {'median': statistics.median(wc.values()), 'max': max(wc.values()), 'over': sorted(n for n, v in wc.items() if v > WORDS_MAX)})
    tl = {s['n']: len(words(s.get('title') or '')) for s in visible_slides(man) if (s.get('title') or '').strip()}
    put('titles', sum(1 for v in tl.values() if v <= TITLE_MAX) / len(tl) if tl else None,
        {'max': max(tl.values()) if tl else None, 'over': sorted(n for n, v in tl.items() if v > TITLE_MAX)}, why='у слайдов нет заголовков')

    sm = R.get('smart')
    put('smart', sm['smart'] / sm['checked'] if sm and sm.get('checked') else None, {'smart': (sm or {}).get('smart'), 'checked': (sm or {}).get('checked')},
        why='нет слайдов плана, роадмапа или целей с пунктами (smart_check.py)')

    vz = R.get('visuals') or {}
    nf = len(vz.get('files') or [])
    put('provenance', (nf - len(vz.get('unrecorded') or [])) / nf if nf else None, {'files': nf, 'unrecorded': vz.get('unrecorded') or []},
        why='в img/3d нет картинок')

    pl = R.get('plan')
    put('plan', pl['passed'] / pl['checks'] if pl and pl.get('checks') else None, {'errors': (pl or {}).get('errors', [])},
        why='нет deck.json или plan_check.py не отдал JSON')
    return V, D


def overall(V, weights=WEIGHTS):
    used = {k: w for k, w in weights.items() if V.get(k) is not None}
    tw = sum(used.values())
    return (round(sum(V[k] * w for k, w in used.items()) / tw, 4) if tw else None), sorted(k for k in weights if V.get(k) is None)


def skill_info():
    g = lambda *a: subprocess.run(['git', '-C', SKILL, *a], capture_output=True, text=True).stdout.strip()
    ver = open(os.path.join(SKILL, 'VERSION')).read().strip() if os.path.isfile(os.path.join(SKILL, 'VERSION')) else '?'
    return {'version': ver, 'commit': g('rev-parse', '--short=12', 'HEAD') or '?',
            'dirty': bool(g('status', '--porcelain', '--', 'templates', 'scripts', 'components'))}


def pct(v):
    return '—' if v is None else f'{v:.2f}'


def fmt(v):
    if isinstance(v, dict):
        return '; '.join(f'{a} {fmt(b)}' for a, b in v.items() if b not in (None, [], {}))
    if isinstance(v, list):
        return ', '.join(map(str, v[:8])) + (' …' if len(v) > 8 else '') if all(len(str(x)) <= 12 for x in v) else f'{len(v)} шт.'
    return str(v)


def report_md(E):
    L = [f"## Оценка деки: {E['deck']}", '',
         f"- Навык: pitch-deck-skill {E['skill']['version']}, коммит {E['skill']['commit']}" + (' (с незакоммиченными правками)' if E['skill']['dirty'] else ''),
         f"- Дата: {E['date']}; итог **{pct(E['score'])}** — взвешенное среднее по измеренным метрикам", '',
         '| Метрика | Значение | Вес | Формула | Данные |', '|---|---|---|---|---|']
    for k, w in WEIGHTS.items():
        d = E['details'][k]
        raw = fmt(d['raw']) or '—'
        val = pct(E['metrics'][k]) if E['metrics'][k] is not None else 'не измерялось'
        L.append(f"| {NAMES[k]} (`{k}`) | {val} | {w:.2f} | {FORMULAS[k]} | {raw.replace('|', '/')} |")
    L.append('')
    if E['not_measured']:
        L += ['### Не измерялось', '', 'Эти метрики не входят в итог: за них не ставится ни 0, ни 1.', '']
        L += [f"- {NAMES[k]} (`{k}`): {E['details'][k]['missing']}" for k in E['not_measured']]
        L.append('')
    L.append('Метрики детерминированы и не оценивают смысл и вкус: это тренд и защита от регрессий, а не оценка дизайна.')
    return '\n'.join(L) + '\n'


def score(src):
    R = collect(src)
    V, D = metrics(R)
    sc, miss = overall(V)
    return {'date': dt.datetime.now().strftime('%Y-%m-%d %H:%M'), 'skill': skill_info(), 'deck': R['name'], 'score': sc,
            'metrics': V, 'weights': WEIGHTS, 'not_measured': miss, 'details': D}


def vals(E):
    """Значения метрик из eval.json, строки evals.jsonl или эталона: {metric: float|None}."""
    m = E.get('metrics') or {}
    return {k: (v.get('value') if isinstance(v, dict) else v) for k, v in m.items()}


def gate(cur, base, tol):
    """Регрессии: метрика (и итог) ниже эталона больше чем на tol или пропала. Новые метрики не валят."""
    bad, rows = [], []
    C, B = vals(cur), vals(base)
    for k in list(WEIGHTS) + ['score']:
        b, c = (base.get('score'), cur.get('score')) if k == 'score' else (B.get(k), C.get(k))
        if b is None:
            rows.append((k, b, c, 'в эталоне не измерялось'))
            continue
        if c is None:
            bad.append(f'{k}: в эталоне {b:.4f}, сейчас не измерялось')
            rows.append((k, b, c, 'ПРОПАЛА'))
        elif c < b - tol:
            bad.append(f'{k}: {b:.4f} → {c:.4f} (−{b - c:.4f}, допуск {tol})')
            rows.append((k, b, c, 'РЕГРЕССИЯ'))
        else:
            rows.append((k, b, c, 'ok' if c <= b + tol else 'лучше'))
    return bad, rows


def vkey(v):
    return tuple(int(x) if x.isdigit() else 0 for x in re.split(r'[.\-]', v or '0'))


def trend(rows, deck=None):
    rows = [r for r in rows if not deck or r.get('deck') == deck]
    grp = {}
    for r in rows:
        grp.setdefault((r['skill']['version'], r['skill']['commit']), []).append(r)
    mean = lambda xs: (sum(xs) / len(xs)) if xs else None
    L = ['| Версия | Коммит | Прогонов | Деки | Итог | ' + ' | '.join(KEY) + ' |', '|---' * (5 + len(KEY)) + '|']
    for (v, c), rs in sorted(grp.items(), key=lambda x: (vkey(x[0][0]), min(r['date'] for r in x[1]))):
        km = [pct(mean([r['metrics'][k] for r in rs if r['metrics'].get(k) is not None])) for k in KEY]
        L.append(f"| {v} | {c[:8]} | {len(rs)} | {', '.join(sorted({r['deck'] for r in rs}))} | "
                 f"{pct(mean([r['score'] for r in rs if r.get('score') is not None]))} | " + ' | '.join(km) + ' |')
    return L


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('cmd', choices=['score', 'trend', 'gate'])
    ap.add_argument('src', nargs='?')
    ap.add_argument('--log', action='store_true', help='score: дописать строку в learnings/evals.jsonl')
    ap.add_argument('--write-baseline', metavar='JSON', help='score: записать эталон для gate (обновление эталона — осознанно, reference/20-eval.md)')
    ap.add_argument('--evals', default=EVALS, help='журнал оценок (по умолчанию learnings/evals.jsonl)')
    ap.add_argument('--deck', help='trend: только эта дека (deck.json → name)')
    ap.add_argument('--baseline', help='gate: эталон (eval.json или tests/kasko/eval_baseline.json)')
    ap.add_argument('--tol', type=float, default=0.02, help='gate: допустимое падение метрики')
    a = ap.parse_args()

    if a.cmd == 'trend':
        rows = [json.loads(l) for l in open(a.evals, encoding='utf-8') if l.strip()] if os.path.isfile(a.evals) else []
        if not rows:
            sys.exit(f'в {a.evals} нет оценок: eval_deck.py score <src> --log')
        print('\n'.join(trend(rows, a.deck)))
        return 0

    if not a.src:
        sys.exit('укажите папку проекта src-<тема>')
    src = os.path.abspath(a.src)
    if a.cmd == 'gate' and os.path.isfile(src):
        E = load(src)                         # готовая оценка (eval.json): без пересчёта
    else:
        E = score(src)
        json.dump(E, open(os.path.join(src, 'out', 'eval.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        open(os.path.join(src, 'out', 'eval.md'), 'w', encoding='utf-8').write(report_md(E))

    if a.cmd == 'score':
        for k in WEIGHTS:
            print(f"  {NAMES[k]:<40} {pct(E['metrics'][k]) if E['metrics'][k] is not None else 'не измерялось'}")
        print(f"\nитог {pct(E['score'])} ({E['deck']}, навык {E['skill']['version']} {E['skill']['commit']}); "
              f"не измерялось: {', '.join(E['not_measured']) or 'нет'}; отчёт: {os.path.join(src, 'out', 'eval.md')}")
        if a.log:
            os.makedirs(os.path.dirname(os.path.abspath(a.evals)), exist_ok=True)
            row = {k: E[k] for k in ('date', 'skill', 'deck', 'metrics', 'score')}
            open(a.evals, 'a', encoding='utf-8').write(json.dumps(row, ensure_ascii=False) + '\n')
            print(f'записано в {a.evals}')
        if a.write_baseline:
            json.dump({k: E[k] for k in ('deck', 'skill', 'date', 'score', 'metrics')}, open(a.write_baseline, 'w', encoding='utf-8'),
                      ensure_ascii=False, indent=1)
            open(a.write_baseline, 'a', encoding='utf-8').write('\n')
            print(f'эталон: {a.write_baseline}')
        return 0

    if not a.baseline or not os.path.isfile(a.baseline):
        sys.exit('gate: нужен --baseline <json>')
    bad, rows = gate(E, load(a.baseline), a.tol)
    for k, b, c, st in rows:
        print(f"  {k:<16} эталон {pct(b):>5}  сейчас {pct(c):>5}  {st}")
    if bad:
        print(f'\nрегрессия качества (допуск {a.tol}):\n' + '\n'.join(f'  - {x}' for x in bad))
        return 1
    print(f'\nрегрессий нет (допуск {a.tol}), итог {pct(E.get("score"))}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
