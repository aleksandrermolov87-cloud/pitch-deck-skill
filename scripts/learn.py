# Этап 7. Обучение на оценках пользователя: хорошие слайды становятся эталонами, плохие — правилами.
#
#   learn.py sheet  <src-dir>                       контакт-лист out/review/sheet.png + вопросы для AskUserQuestion
#   learn.py record <src-dir> --ratings '<json>'    записать оценки в learnings/ и разложить PNG и код по галерее
#   learn.py digest                                 пересобрать learnings/LESSONS.md (читается на этапах 0, 3, 6) и prefs.json
#
# Модель: доля хороших у архетипа и компонента — Beta-Binomial с априорным Beta(1,1). Компонент получает вердикт слайда
# (поле lib из out/slides.json) и выборы variants.py pick (learnings/picks.jsonl): выбранный +1 к хорошим, показанный
# рядом и не выбранный +0,5 к плохим. Интервал 80% и P(доля > 0,5) — по выборке numpy с фиксированным зерном.
# Кандидат в правило — только если P(доля плохих по причине > 0,5) ≥ 0,8: 2 из 10 не правило, 3 из 3 — правило.
#
# ratings: {"2": {"verdict": "good"}, "3": {"verdict": "bad", "reasons": ["композиция"], "comment": "пусто справа"}}
# Запуск: $SKILL/.venv/bin/python -I learn.py …
import argparse
import datetime as dt
import json
import os
import re
import shutil
import sys
from collections import Counter, defaultdict

import numpy as np

SKILL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LEARN = os.environ.get('PITCH_LEARN_DIR') or os.path.join(SKILL, 'learnings')   # переменная — для тестов
REASONS = ['композиция', 'текст', 'данные', 'стиль']
SEED, DRAWS = 7, 40000   # выборка из апостериорного Beta: фиксированное зерно — одинаковый LESSONS.md на тех же данных
SOFT = 0.5               # показан в variants.py, но не выбран: мягкий отказ
RULE_P = 0.8             # порог кандидата в правило: P(доля плохих > 0,5)

ap = argparse.ArgumentParser()
ap.add_argument('cmd', choices=['sheet', 'record', 'digest'])
ap.add_argument('src', nargs='?')
ap.add_argument('--ratings')
ap.add_argument('--out', default='out', help='каталог темы с png/ и slides.json')
a = ap.parse_args()


def manifest(src):
    m = os.path.join(src, 'out', 'slides.json')
    if not os.path.isfile(m):
        sys.exit(f'нет {m}: соберите деку (node build.js)')
    return [s for s in json.load(open(m)) if not s.get('hidden')]


def skill_version():
    try:
        return open(os.path.join(SKILL, 'VERSION')).read().strip()
    except OSError:
        return '?'


def post(k, f):
    """Beta(1,1) + k успехов и f неудач (дробные — мягкие отказы) → среднее, 80% интервал, P(доля > 0,5)."""
    a, b = 1 + k, 1 + f
    x = np.random.default_rng(SEED).beta(a, b, DRAWS)
    lo, hi = np.quantile(x, [0.1, 0.9])
    return {'mean': round(a / (a + b), 3), 'lo': round(float(lo), 3), 'hi': round(float(hi), 3), 'p_hi': round(float((x > 0.5).mean()), 3)}


def ru(x, d=2):
    return f'{x:.{d}f}'.replace('.', ',')


def deck_name(src):
    return json.load(open(os.path.join(src, 'deck.json'))).get('name', os.path.basename(os.path.abspath(src)))


if a.cmd == 'sheet':
    from PIL import Image, ImageDraw, ImageFont
    sl = manifest(a.src)
    png = os.path.join(a.src, a.out, 'png')
    cols, tw_, th_ = 3, 640, 360
    rows = (len(sl) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * (tw_ + 24) + 24, rows * (th_ + 64) + 24), (40, 40, 40))
    d = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 30)
    except OSError:
        font = ImageFont.load_default()
    for i, s in enumerate(sl):
        x, y = 24 + (i % cols) * (tw_ + 24), 24 + (i // cols) * (th_ + 64)
        p = os.path.join(png, f"s{s['n']}.png")
        if os.path.isfile(p):
            sheet.paste(Image.open(p).convert('RGB').resize((tw_, th_)), (x, y + 44))
        d.text((x, y), f"{s['n']}  {s['archetype']}", fill=(255, 255, 255), font=font)
    os.makedirs(os.path.join(a.src, 'out', 'review'), exist_ok=True)
    dst = os.path.join(a.src, 'out', 'review', 'sheet.png')
    sheet.save(dst)
    # вопросы пачками по 4 слайда: в одном вызове AskUserQuestion максимум 4 вопроса по 4 варианта
    batches = []
    for k in range(0, len(sl), 4):
        batches.append([{
            'question': f"Слайд {s['n']} «{(s['title'] or s['archetype'])[:60]}»: как он?",
            'header': f"Слайд {s['n']}",
            'multiSelect': True,
            'options': [
                {'label': 'Хорошо', 'description': 'В эталоны: этот макет и приёмы повторять'},
                {'label': 'Плохо: композиция', 'description': 'Сетка, пустоты, слипания, иерархия'},
                {'label': 'Плохо: текст', 'description': 'Формулировки, длина, ИИ-звучание'},
                {'label': 'Плохо: данные', 'description': 'Числа, смысл, не тот акцент'},
            ],
        } for s in sl[k:k + 4]])
    print(json.dumps({'sheet': dst, 'slides': len(sl), 'batches': batches}, ensure_ascii=False, indent=1))

elif a.cmd == 'record':
    sl = {str(s['n']): s for s in manifest(a.src)}
    R = json.loads(a.ratings)
    name = deck_name(a.src)
    code = open(os.path.join(a.src, 'slides.js'), encoding='utf-8').read()
    os.makedirs(os.path.join(LEARN, 'gallery', 'good'), exist_ok=True)
    os.makedirs(os.path.join(LEARN, 'gallery', 'bad'), exist_ok=True)
    today = dt.date.today().isoformat()
    with open(os.path.join(LEARN, 'ratings.jsonl'), 'a', encoding='utf-8') as out:
        for n, r in R.items():
            s = sl.get(str(n))
            if not s:
                print(f'нет слайда {n} в манифесте, пропускаю')
                continue
            verdict = r['verdict']
            if verdict not in ('good', 'bad'):
                sys.exit(f'слайд {n}: verdict должен быть good или bad, получено {verdict!r}')
            safe = re.sub(r'[^\w-]+', '_', name)
            stem = f"{today}__{safe}__s{n}__{s['archetype']}"
            png = os.path.join(a.src, a.out, 'png', f's{n}.png')
            gal = os.path.join(LEARN, 'gallery', verdict, stem + '.png')
            if os.path.isfile(png):
                shutil.copyfile(png, gal)
            if verdict == 'good':
                # код функции слайда — готовый образец для следующей деки
                m = re.search(rf'function {re.escape(s["fn"])}\(.*?\n}}\n', code, re.S)
                if m:
                    open(os.path.join(LEARN, 'gallery', 'good', stem + '.js'), 'w', encoding='utf-8').write(m.group(0))
            # lib — компоненты библиотеки на слайде: по ним учится подбор variants.py (prefs.json)
            rec = {'date': today, 'deck': name, 'src': os.path.abspath(a.src), 'slide': int(n), 'fn': s['fn'],
                   'archetype': s['archetype'], 'title': s['title'], 'verdict': verdict,
                   'reasons': r.get('reasons', []), 'comment': r.get('comment', ''), 'png': gal,
                   'lib': s.get('lib') or [], 'skill': skill_version()}
            out.write(json.dumps(rec, ensure_ascii=False) + '\n')
            print(f"слайд {n} [{s['archetype']}]: {verdict} {', '.join(r.get('reasons', []))}")
    a.cmd = 'digest'

if a.cmd == 'digest':
    path = os.path.join(LEARN, 'ratings.jsonl')
    recs = [json.loads(l) for l in open(path, encoding='utf-8')] if os.path.isfile(path) else []
    # выборы variants.py pick: на слайд прогона считается последний выбор (передумал — верен последний)
    pp = os.path.join(LEARN, 'picks.jsonl')
    picks = {}
    for l in (open(pp, encoding='utf-8') if os.path.isfile(pp) else []):
        p = json.loads(l)
        picks[(p.get('src') or p.get('deck'), p['slide'], p.get('run'))] = p
    picks = list(picks.values())
    by = defaultdict(list)
    for r in recs:
        by[r['archetype']].append(r)
    # компонент получает вердикт слайда; оценки без lib (до появления поля) идут только в архетипы
    cnt = defaultdict(lambda: {'good': 0, 'bad': 0, 'picks': 0, 'rejects': 0})
    for r in recs:
        for c in r.get('lib') or []:
            cnt[c][r['verdict']] += 1
    for p in picks:
        cnt[p['chosen']]['picks'] += 1
        for c in set(p.get('shown') or []) - {p['chosen']}:
            cnt[c]['rejects'] += 1
    comps = {}
    for c, v in sorted(cnt.items()):
        k, f = v['good'] + v['picks'], v['bad'] + SOFT * v['rejects']
        comps[c] = {**v, 'n': k + f, **post(k, f)}
    archs = {}
    for arch, rs in by.items():
        g = sum(r['verdict'] == 'good' for r in rs)
        archs[arch] = {'good': g, 'bad': len(rs) - g, 'n': len(rs), **post(g, len(rs) - g)}

    def ci(p):
        return f"{ru(p['mean'])} [{ru(p['lo'])}–{ru(p['hi'])}]"

    lines = ['# Уроки из оценок слайдов', '',
             f'Обновлено {dt.date.today().isoformat()}. Оценок: {len(recs)}, выборов вариантов: {len(picks)}. '
             'Источник: `learnings/ratings.jsonl`, `learnings/picks.jsonl`; модель — `learnings/prefs.json`.',
             'Читать на этапах 0, 3 и 6. Эталоны — образцы для копирования, устойчивые причины — правила.', '']
    # что работает: доля хороших по компоненту с интервалом; n < 2 — шум, в таблицу не идёт
    top = sorted(((c, p) for c, p in comps.items() if p['n'] >= 2), key=lambda x: (-x[1]['mean'], -x[1]['n'], x[0]))[:8]
    lines += ['## Что работает у вас', '',
              'Доля хороших: Beta(1,1) + оценки слайдов и выборы в `variants.py` (не выбранный рядом — полминуса). '
              'В скобках интервал 80%: широкий — данных мало. `variants.py suggest` учитывает это в подборе.', '']
    if top:
        lines += ['| Компонент | хорошо | плохо | выбран | не выбран | доля хороших [80%] |', '|---|---|---|---|---|---|']
        lines += [f"| {c} | {p['good']} | {p['bad']} | {p['picks']} | {p['rejects']} | {ci(p)} |" for c, p in top]
    else:
        lines.append('Пока мало данных: ни у одного компонента нет двух оценок или выборов. '
                     'Оценки без поля `lib` (записаны до появления поля) учитываются только по архетипам.')
    lines.append('')
    rules = []
    for arch in sorted(by, key=lambda k: -len(by[k])):
        rs, A = by[arch], archs[arch]
        good = [(i, r) for i, r in enumerate(recs) if r['archetype'] == arch and r['verdict'] == 'good']
        bad = [r for r in rs if r['verdict'] == 'bad']
        reasons = Counter(x for r in bad for x in r['reasons'])
        lines.append(f"## {arch}: хорошо {A['good']}, плохо {A['bad']} · доля хороших {ci(A)}")
        if good:
            # эталоны: сначала слайды на компонентах, которые вам чаще нравятся, затем свежие
            def rank(ir):
                lib = [comps[c]['mean'] for c in ir[1].get('lib') or [] if c in comps]
                return (round(sum(lib) / len(lib), 3) if lib else 0.5, ir[0])
            lines.append('Эталоны:')
            lines += [f"- {r['deck']}, слайд {r['slide']} «{r['title'][:60]}»" + (f" [{'+'.join(r['lib'])}]" if r.get('lib') else '')
                      + f" → `learnings/{os.path.relpath(r['png'], LEARN)}`" for _, r in sorted(good, key=rank, reverse=True)[:3]]
        if bad:
            lines.append('Что не нравилось:')
            hit = []
            for k, v in reasons.most_common():
                p = post(v, len(rs) - v)
                lines.append(f"- {k}: {v} из {len(rs)}, P(чаще половины) = {ru(p['p_hi'])}")
                if p['p_hi'] >= RULE_P:
                    hit.append(k)
                    rules.append(f"- **{arch}**, «{k}»: {v} из {len(rs)}, P(доля > 0,5) = {ru(p['p_hi'])}: "
                                 'перенесите вывод в `reference/` или профиль бренда как правило.')
            lines += [f"  - «{r['comment']}» ({r['deck']}, слайд {r['slide']})" for r in bad if r.get('comment')][-5:]
            if not hit and 1 - A['p_hi'] >= RULE_P:
                rules.append(f"- **{arch}**: плохо {A['bad']} из {A['n']}, P(доля плохих > 0,5) = {ru(1 - A['p_hi'])}, причины разные: "
                             'разберите `learnings/gallery/bad/` и смените раскладку архетипа.')
        lines.append('')
    for c, p in comps.items():
        if 1 - p['p_hi'] >= RULE_P:
            rules.append(f"- Компонент **{c}**: доля хороших {ci(p)}, P(< 0,5) = {ru(1 - p['p_hi'])}: "
                         '`variants.py` уже понижает его; проверьте лимиты в `components/fields.json` или замените в эталонах.')
    os.makedirs(LEARN, exist_ok=True)
    json.dump({'model': 'Beta-Binomial, априорное Beta(1,1); выбор = +1 хороший, показан и не выбран = +0,5 плохого; '
                        'mean — апостериорное среднее доли хороших, lo/hi — интервал 80%, p_hi — P(доля > 0,5)',
               'updated': dt.date.today().isoformat(), 'ratings': len(recs), 'picks': len(picks),
               'components': comps, 'archetypes': dict(sorted(archs.items()))},
              open(os.path.join(LEARN, 'prefs.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    # как пользователь правит формулировки (copy_edit.py): последние правки — образцы голоса, частые замены — правила
    ce = os.path.join(LEARN, 'copy_edits.jsonl')
    edits = [json.loads(l) for l in open(ce, encoding='utf-8')] if os.path.isfile(ce) else []
    if edits:
        lines += ['## Как пользователь правит формулировки', '',
                  f'Правок: {len(edits)}. Применяй тот же голос в новых текстах до показа, а не после.', '']
        lines += [f"- «{e['old'][:70]}» → «{e['new'][:70]}»" + (f" ({e['why']})" if e.get('why') else '') for e in edits[-8:]]
        words = Counter()
        for e in edits:
            ow, nw = set(re.findall(r'\w+', e['old'].lower())), set(re.findall(r'\w+', e['new'].lower()))
            words.update(f'«{w}»' for w in ow - nw if len(w) > 3)
        frequent = [w for w, c in words.most_common() if c >= 2]
        if frequent:
            lines += ['', 'Слова, которые пользователь убирает чаще всего (не используй их): ' + ', '.join(frequent[:12])]
            rules.append('- Повторяющиеся замены формулировок: добавьте убираемые слова в стоп-лист `reference/01-brief-and-copy.md`.')
        lines.append('')
    # как пользователь правит подложки (bg_edit.py): частые приёмы — значения по умолчанию для новой деки
    be = os.path.join(LEARN, 'bg_edits.jsonl')
    bg_edits = [json.loads(l) for l in open(be, encoding='utf-8')] if os.path.isfile(be) else []
    if bg_edits:
        moves = Counter(m for e in bg_edits for m in e['moves'])
        by_arch = Counter((e.get('archetype'), m) for e in bg_edits for m in e['moves'])
        lines += ['## Как пользователь правит подложки', '',
                  f"Правок: {len(bg_edits)}. Приёмы: " + ', '.join(f'{m} ×{c}' for m, c in moves.most_common(8)), '']
        lines += [f'- **{a}**: {m} ×{c}' for (a, m), c in by_arch.most_common(6) if c >= 2]
        for m, c in moves.items():
            if c >= 3:
                rules.append(f'- Подложки: «{m}» применялся {c} раз(а) — перенесите в `theme.json → bg` новой деки как значение по умолчанию.')
        lines.append('')
    if rules:
        lines += ['## Кандидаты в правила', ''] + rules + ['']
    # стартовые уроки — сразу после шапки: общие (SEED.md, идут в пакет) и локальные (SEED.local.md, не идут)
    for name in ('SEED.local.md', 'SEED.md'):
        seed = os.path.join(LEARN, name)
        if os.path.isfile(seed):
            lines[5:5] = [open(seed, encoding='utf-8').read().strip(), '']
    open(os.path.join(LEARN, 'LESSONS.md'), 'w', encoding='utf-8').write('\n'.join(lines))
    print(f'LESSONS.md: {len(recs)} оценок, {len(picks)} выборов, {len(by)} архетипов, компонентов {len(comps)}, кандидатов в правила {len(rules)}')
