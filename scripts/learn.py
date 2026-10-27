# Этап 7. Обучение на оценках пользователя: хорошие слайды становятся эталонами, плохие — правилами.
#
#   learn.py sheet  <src-dir>                       контакт-лист out/review/sheet.png + вопросы для AskUserQuestion
#   learn.py record <src-dir> --ratings '<json>'    записать оценки в learnings/ и разложить PNG и код по галерее
#   learn.py digest                                 пересобрать learnings/LESSONS.md (читается на этапах 0, 3, 6)
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

SKILL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LEARN = os.environ.get('PITCH_LEARN_DIR') or os.path.join(SKILL, 'learnings')   # переменная — для тестов
REASONS = ['композиция', 'текст', 'данные', 'стиль']

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
            rec = {'date': today, 'deck': name, 'src': os.path.abspath(a.src), 'slide': int(n), 'fn': s['fn'],
                   'archetype': s['archetype'], 'title': s['title'], 'verdict': verdict,
                   'reasons': r.get('reasons', []), 'comment': r.get('comment', ''), 'png': gal}
            out.write(json.dumps(rec, ensure_ascii=False) + '\n')
            print(f"слайд {n} [{s['archetype']}]: {verdict} {', '.join(r.get('reasons', []))}")
    a.cmd = 'digest'

if a.cmd == 'digest':
    path = os.path.join(LEARN, 'ratings.jsonl')
    recs = [json.loads(l) for l in open(path, encoding='utf-8')] if os.path.isfile(path) else []
    by = defaultdict(list)
    for r in recs:
        by[r['archetype']].append(r)
    lines = ['# Уроки из оценок слайдов', '',
             f'Обновлено {dt.date.today().isoformat()}. Оценок: {len(recs)}. Источник: `learnings/ratings.jsonl`.',
             'Читать на этапах 0, 3 и 6. Эталоны — образцы для копирования, повторяющиеся причины — правила.', '']
    rules = []
    for arch in sorted(by, key=lambda k: -len(by[k])):
        rs = by[arch]
        good = [r for r in rs if r['verdict'] == 'good']
        bad = [r for r in rs if r['verdict'] == 'bad']
        reasons = Counter(x for r in bad for x in r['reasons'])
        lines.append(f'## {arch}: хорошо {len(good)}, плохо {len(bad)}')
        if good:
            lines.append('Эталоны:')
            lines += [f"- {r['deck']}, слайд {r['slide']} «{r['title'][:60]}» → `learnings/{os.path.relpath(r['png'], LEARN)}`" for r in good[-3:]]
        if bad:
            lines.append('Что не нравилось:')
            lines += [f"- {k}: {v}" for k, v in reasons.most_common()]
            lines += [f"  - «{r['comment']}» ({r['deck']}, слайд {r['slide']})" for r in bad if r.get('comment')][-5:]
        for k, v in reasons.items():
            if v >= 2:
                rules.append(f'- **{arch}**, «{k}» отмечено {v} раз(а): перенесите вывод в `reference/` или профиль бренда как правило.')
        lines.append('')
    if rules:
        lines += ['## Кандидаты в правила', ''] + rules + ['']
    # стартовые уроки — сразу после шапки: общие (SEED.md, идут в пакет) и локальные (SEED.local.md, не идут)
    for name in ('SEED.local.md', 'SEED.md'):
        seed = os.path.join(LEARN, name)
        if os.path.isfile(seed):
            lines[5:5] = [open(seed, encoding='utf-8').read().strip(), '']
    os.makedirs(LEARN, exist_ok=True)
    open(os.path.join(LEARN, 'LESSONS.md'), 'w', encoding='utf-8').write('\n'.join(lines))
    print(f'LESSONS.md: {len(recs)} оценок, {len(by)} архетипов, кандидатов в правила {len(rules)}')
