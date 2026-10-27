# Быстрая правка формулировок (reference/13-quick-copy-edit.md): найти, где живёт текст слайда, и заменить его в одном месте.
#   copy_edit.py list  <src> [--slide N]           тексты слайда по частям, у каждой — где она в исходниках
#   copy_edit.py apply <src> --edits edits.json     [{"slide": N, "old": "…", "new": "…", "why": "…", "where"?: "items[3].phase"}] → замены в исходниках
# Ищет в slides.js и data/*.json, data/*.js. data/*.md не правит: это вводные, по ним сверяются факты.
# Новое число в формулировке запрещено (числа только из источника и через fact()); --allow-numbers снимает запрет осознанно.
# Каждая правка пишется в $SKILL/learnings/copy_edits.jsonl: learn.py digest собирает из них правила голоса пользователя.
# Запуск: $SKILL/.venv/bin/python -I copy_edit.py …   Код 1, если правка не применилась.
import argparse
import datetime as dt
import glob
import json
import os
import re
import sys

SKILL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LEARN = os.environ.get('PITCH_LEARN_DIR') or os.path.join(SKILL, 'learnings')

ap = argparse.ArgumentParser()
ap.add_argument('cmd', choices=['list', 'apply'])
ap.add_argument('src')
ap.add_argument('--slide', type=int)
ap.add_argument('--edits')
ap.add_argument('--allow-numbers', action='store_true')
a = ap.parse_args()

man_path = os.path.join(a.src, 'out', 'slides.json')
if not os.path.isfile(man_path):
    sys.exit(f'нет {man_path}: соберите деку (node build.js)')
MAN = json.load(open(man_path, encoding='utf-8'))
FILES = [os.path.join(a.src, 'slides.js')] + sorted(glob.glob(os.path.join(a.src, 'data', '*.json'))) + sorted(glob.glob(os.path.join(a.src, 'data', '*.js')))
FILES = [f for f in FILES if os.path.isfile(f)]


SKIP_KEYS = {'quote', 'q', 'src', 'source_quote', 'file', 'object', 'screen', 'bg', 'id'}   # источники фактов и пути к файлам не правятся


def json_hits(obj, s, path=()):
    # строки-значения в JSON, где встречается фрагмент; ключи-источники пропускаются
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k not in SKIP_KEYS:
                yield from json_hits(v, s, path + (k,))
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            yield from json_hits(v, s, path + (i,))
    elif isinstance(obj, str) and s in obj:
        for _ in range(obj.count(s)):
            yield path


def fmt_path(p):
    return ''.join(f'[{x}]' if isinstance(x, int) else ('.' if i else '') + x for i, x in enumerate(p))


def where(s):
    hits = []
    for f in FILES:
        raw = open(f, encoding='utf-8').read()
        if f.endswith('.json'):
            for p in json_hits(json.loads(raw), s):
                hits.append({'file': f, 'path': p, 'loc': f'{os.path.relpath(f, a.src)} → {fmt_path(p)}'})
        else:
            for form in {s, s.replace("'", "\\'")}:
                start = 0
                while form and (i := raw.find(form, start)) >= 0:
                    hits.append({'file': f, 'pos': i, 'form': form, 'loc': f'{os.path.relpath(f, a.src)}:{raw.count(chr(10), 0, i) + 1}'})
                    start = i + len(form)
    return hits


def segments(s):
    # части строки между числами: «5 релизов в приложении за полгода дают» → «релизов в приложении за полгода дают»
    return [p.strip(' :,—–-') for p in re.split(r'\d[\d\s\u00a0.,]*', s) if len(p.strip(' :,—–-')) >= 4]


def nums(s):
    return set(re.findall(r'\d+(?:[.,]\d+)?', s.replace(' ', '').replace(' ', '')))


if a.cmd == 'list':
    for sl in MAN:
        if a.slide and sl['n'] != a.slide:
            continue
        print(f"\n— слайд {sl['n']} «{sl.get('title', '')[:60]}» [{sl.get('archetype')}{', ' + '+'.join(sl.get('lib') or []) if sl.get('lib') else ''}]")
        for k, t in enumerate(sl.get('texts', []), 1):
            runs = [r for r in t['runs'] if r.strip()]
            joined = ''.join(runs).strip()
            if not runs or len(joined) <= 4 or re.fullmatch(r'\d+\s*/\s*\d+', joined):
                continue   # знак бренда, номер страницы, подписи делений оси
            print(f"  [{sl['n']}.{k}] {' ⟂ '.join(r.strip() for r in runs)}")
            for r in runs:
                rs = r.strip()
                if re.fullmatch(r'[\d\s\u00a0.,%₽x×–+−/-]+', rs):
                    print(f'        «{rs[:40]}» — число (fact): правится в данных модели или в источнике, не формулировкой')
                    continue
                h = where(rs)
                if h:
                    print(f'        «{rs[:60]}» → ' + ', '.join(x['loc'] for x in h[:3]) + (f' (+{len(h) - 3})' if len(h) > 3 else ''))
                    continue
                parts = [(seg, where(seg)) for seg in segments(rs)]
                found = [(seg, hh) for seg, hh in parts if hh]
                if found:
                    for seg, hh in found:
                        print(f'        «{seg[:60]}» → ' + ', '.join(x['loc'] for x in hh[:3]))
                else:
                    print(f'        «{rs[:60]}» → собрано кодом или компонентом из шаблона строки')
    sys.exit(0)

E = json.load(open(a.edits, encoding='utf-8')) if a.edits and os.path.isfile(a.edits) else json.loads(a.edits or '[]')
done, failed, log = [], [], []
deck = json.load(open(os.path.join(a.src, 'deck.json'), encoding='utf-8')).get('name', os.path.basename(os.path.abspath(a.src))) if os.path.isfile(os.path.join(a.src, 'deck.json')) else os.path.basename(os.path.abspath(a.src))
for e in E:
    old, new = e['old'], e['new']
    extra = nums(new) - nums(old)
    if extra and not a.allow_numbers:
        failed.append(f"слайд {e.get('slide')}: в новом тексте появились числа {sorted(extra)} — число берётся из источника через fact(), не из формулировки")
        continue
    h = where(old)
    if e.get('where'):              # уточнение, если фрагмент встречается в нескольких местах: часть пути из `list`
        h = [x for x in h if e['where'] in x['loc']]
    if not h:
        failed.append(f"слайд {e.get('slide')}: «{old[:50]}» не найдено в исходниках (поля-источники фактов не правятся) — возьмите часть строки из `list` или правьте шаблон в slides.js")
        continue
    if len(h) > 1:
        locs = ', '.join(x['loc'] for x in h)
        failed.append(f"слайд {e.get('slide')}: «{old[:50]}» встречается {len(h)} раза ({locs}) — уточните фрагмент, чтобы он был единственным")
        continue
    x = h[0]
    f = x['file']
    raw = open(f, encoding='utf-8').read()
    if f.endswith('.json'):
        data = json.loads(raw)
        node = data
        for k in x['path'][:-1]:
            node = node[k]
        node[x['path'][-1]] = node[x['path'][-1]].replace(old, new, 1)
        ind = re.search(r'\n( +)"', raw)
        open(f, 'w', encoding='utf-8').write(json.dumps(data, ensure_ascii=False, indent=len(ind.group(1)) if ind else 1) + ('\n' if raw.endswith('\n') else ''))
    else:
        i, form = x['pos'], x['form']
        rep = new.replace("'", "\\'") if form != old else new
        open(f, 'w', encoding='utf-8').write(raw[:i] + rep + raw[i + len(form):])
    done.append(e.get('slide'))
    sl = next((s for s in MAN if s['n'] == e.get('slide')), {})
    log.append({'date': dt.date.today().isoformat(), 'deck': deck, 'slide': e.get('slide'), 'archetype': sl.get('archetype'),
                'old': old, 'new': new, 'why': e.get('why', ''), 'where': x['loc']})
    print(f"слайд {e.get('slide')}: {x['loc']}  «{old[:40]}» → «{new[:40]}»")

if log:
    os.makedirs(LEARN, exist_ok=True)
    with open(os.path.join(LEARN, 'copy_edits.jsonl'), 'a', encoding='utf-8') as out:
        for r in log:
            out.write(json.dumps(r, ensure_ascii=False) + '\n')
for m in failed:
    print('[ERR]', m)
ch = sorted({d for d in done if d})
print(f"\nприменено {len(done)}, не применено {len(failed)}" + (f"; пересобрать слайды: ONLY={ch[0]} node build.js, затем SLIDE='{' '.join(map(str, ch))}' ./render.sh" if ch else ''))
sys.exit(1 if failed else 0)
