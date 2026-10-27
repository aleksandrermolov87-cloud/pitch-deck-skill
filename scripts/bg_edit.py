# Быстрая правка подложки (фона слайда) из чата (reference/13-quick-copy-edit.md, раздел «Подложка»).
#   bg_edit.py show  <src> [--slide N]                      какая подложка у слайда и её параметры
#   bg_edit.py apply <src> --slide N|all --do приём[,приём]  применить приёмы, пересобрать подложку и слайд, «было → стало»
# Приёмы: stripes-softer, stripes-stronger, no-stripes, stripes-normal, glow-off, glow-softer, glow-stronger,
#         glow-left, glow-center, glow-right, glow-top, glow-bottom, grain-off, grain-on, same-as:<M>
# --slide N меняет только этот слайд: если его подложку делят другие слайды, создаётся своя копия bg_n<N>.jpg
# (deck.json → bg_override). --slide all меняет подложки всех слайдов. Каждая правка пишется в learnings/bg_edits.jsonl.
# Запуск: $SKILL/.venv/bin/python -I bg_edit.py …   Код 1, если приём не применился.
import argparse
import copy
import datetime as dt
import json
import os
import shutil
import subprocess
import sys

SKILL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LEARN = os.environ.get('PITCH_LEARN_DIR') or os.path.join(SKILL, 'learnings')
PY = os.path.join(SKILL, '.venv', 'bin', 'python')
SPOTS = {'left': (0.18, 0.55), 'center': (0.5, 0.55), 'right': (0.72, 0.55), 'top': (0.45, 0.12), 'bottom': (0.45, 0.95)}
DEFAULT_GLOW = [0.45, 0.6, 0.28, 0.32, 0.12]

ap = argparse.ArgumentParser()
ap.add_argument('cmd', choices=['show', 'apply'])
ap.add_argument('src')
ap.add_argument('--slide', default='')
ap.add_argument('--do', default='')
ap.add_argument('--theme', choices=['dark', 'light', 'both'], default='dark', help='какую тему отрендерить для «было → стало»')
ap.add_argument('--no-render', action='store_true')
a = ap.parse_args()

src = os.path.abspath(a.src)
man_p, theme_p, deck_p = (os.path.join(src, 'out', 'slides.json'), os.path.join(src, 'theme.json'), os.path.join(src, 'deck.json'))
if not os.path.isfile(man_p):
    sys.exit(f'нет {man_p}: соберите деку (node build.js)')
MAN = json.load(open(man_p, encoding='utf-8'))
THEME = json.load(open(theme_p, encoding='utf-8'))
DECK = json.load(open(deck_p, encoding='utf-8')) if os.path.isfile(deck_p) else {}
BG = THEME.setdefault('bg', {})
SL = BG.setdefault('slides', {})
used = {}
for s in MAN:
    used.setdefault(s.get('bg'), []).append(s['n'])


def params(name):
    p = SL.get(name, {})
    return {'glow': p.get('glow'), 'stripes': p.get('stripes', 1.0), 'grain': p.get('grain', BG.get('grain', True))}


if a.cmd == 'show':
    print(f"общее: полосы ×{BG.get('stripes_strength', 1.0)}, зерно {'да' if BG.get('grain', True) else 'нет'}")
    for s in MAN:
        if a.slide and str(s['n']) != a.slide:
            continue
        p = params(s.get('bg'))
        g = p['glow']
        print(f"слайд {s['n']:>2} {s.get('bg')}: полосы ×{p['stripes']}, свечение {'нет' if not g else f'в ({g[0]:.2f}, {g[1]:.2f}), сила {g[4]:.2f}'}, зерно {'да' if p['grain'] else 'нет'}"
              + (f"; делят слайды {used.get(s.get('bg'))}" if len(used.get(s.get('bg'), [])) > 1 else ''))
    sys.exit(0)

targets = [s['n'] for s in MAN] if a.slide == 'all' else [int(a.slide)] if a.slide.isdigit() else []
if not targets:
    sys.exit('--slide N или --slide all')
moves = [m.strip() for m in a.do.split(',') if m.strip()]
if not moves:
    sys.exit('--do: приём или список через запятую (см. шапку скрипта)')
over = DECK.setdefault('bg_override', {})
names, log, errors = set(), [], []
for n in targets:
    s = next(x for x in MAN if x['n'] == n)
    name = s.get('bg')
    for m in moves:
        if m.startswith('same-as:'):
            other = next((x for x in MAN if str(x['n']) == m.split(':', 1)[1]), None)
            if not other:
                errors.append(f'слайд {n}: нет слайда {m}')
                continue
            over[str(n)] = other.get('bg')
            name = other.get('bg')
            continue
    # своя копия подложки, если правим один слайд, а файл общий
    if a.slide != 'all' and any(not m.startswith('same-as:') for m in moves) and len(used.get(name, [])) > 1:
        new = f'bg_n{n}.jpg'
        SL[new] = copy.deepcopy(SL.get(name, {}))
        over[str(n)] = new
        name = new
    p = SL.setdefault(name, {})
    for m in ([] if name in names else moves):   # общий файл при --slide all меняется один раз, иначе «мягче» сложится дважды
        g = list(p.get('glow') or DEFAULT_GLOW)
        if m == 'stripes-softer':
            p['stripes'] = round(p.get('stripes', 1.0) * 0.6, 3)
        elif m == 'stripes-stronger':
            p['stripes'] = round(min(p.get('stripes', 1.0) * 1.35, 1.6), 3)
        elif m == 'no-stripes':
            p['stripes'] = 0
        elif m == 'stripes-normal':
            p['stripes'] = 1.0
        elif m == 'glow-off':
            p['glow'] = None
        elif m == 'glow-softer':
            g[4] = round(g[4] * 0.6, 3); p['glow'] = g
        elif m == 'glow-stronger':
            g[4] = round(min(g[4] * 1.5, 0.3), 3); p['glow'] = g
        elif m.startswith('glow-') and m[5:] in SPOTS:
            g[0], g[1] = SPOTS[m[5:]]; p['glow'] = g
        elif m == 'grain-off':
            p['grain'] = False
        elif m == 'grain-on':
            p['grain'] = True
        elif m.startswith('same-as:'):
            pass
        else:
            errors.append(f'неизвестный приём «{m}»')
            continue
    names.add(name)
    if a.slide != 'all':
        log.append({'date': dt.date.today().isoformat(), 'deck': DECK.get('name', os.path.basename(src)), 'slide': n,
                    'archetype': s.get('archetype'), 'bg': name, 'moves': moves, 'scope': 'slide'})
if a.slide == 'all':   # правка всей деки — одна запись, чтобы уроки не считали её по числу слайдов
    log.append({'date': dt.date.today().isoformat(), 'deck': DECK.get('name', os.path.basename(src)), 'slide': 'all',
                'archetype': None, 'bg': sorted(names), 'moves': moves, 'scope': 'deck'})

if errors:
    for e in errors:
        print('[ERR]', e)
    sys.exit(1)
json.dump(THEME, open(theme_p, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
open(theme_p, 'a', encoding='utf-8').write('\n')
json.dump(DECK, open(deck_p, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
open(deck_p, 'a', encoding='utf-8').write('\n')
os.makedirs(LEARN, exist_ok=True)
with open(os.path.join(LEARN, 'bg_edits.jsonl'), 'a', encoding='utf-8') as out:
    for r in log:
        out.write(json.dumps(r, ensure_ascii=False) + '\n')
print(f"подложки: {', '.join(sorted(names))}; слайды: {targets}; приёмы: {', '.join(moves)}")
if a.no_render:
    sys.exit(0)

# пересборка: только изменённые подложки, PPTX и PNG только затронутых слайдов, картинка «было → стало»
review = os.path.join(src, 'out', 'review')
os.makedirs(review, exist_ok=True)
themes = ['dark', 'light'] if a.theme == 'both' else [a.theme]
for th in themes:
    png = os.path.join(src, 'out' + ('-light' if th == 'light' else ''), 'png')
    for n in targets:
        if os.path.isfile(os.path.join(png, f's{n}.png')):
            shutil.copyfile(os.path.join(png, f's{n}.png'), os.path.join(review, f'bg_before_{th}_s{n}.png'))
subprocess.run([PY, '-I', 'bg.py', '--only', ','.join(sorted(n for n in names if n))], cwd=src, check=True, stdout=subprocess.DEVNULL)
env = dict(os.environ)
for th in themes:
    subprocess.run(['node', 'build.js'], cwd=src, check=True, stdout=subprocess.DEVNULL, env={**env, 'THEME': th, **({} if a.slide == 'all' else {'ONLY': str(targets[0])})})
    r = subprocess.run(['zsh', './render.sh'], cwd=src, check=True, capture_output=True, text=True,
                       env={**env, 'OUT': 'out-light' if th == 'light' else 'out', 'SLIDE': ' '.join(map(str, targets[:12]))})
    print(f'{th}: {r.stdout.splitlines()[0] if r.stdout else ""}')
from PIL import Image   # noqa: E402  (pillow есть в venv скилла)
for th in themes:
    png = os.path.join(src, 'out' + ('-light' if th == 'light' else ''), 'png')
    for n in targets[:12]:
        b, aft = os.path.join(review, f'bg_before_{th}_s{n}.png'), os.path.join(png, f's{n}.png')
        if os.path.isfile(b) and os.path.isfile(aft):
            im1, im2 = Image.open(b).convert('RGB'), Image.open(aft).convert('RGB')
            im1.thumbnail((960, 540)); im2.thumbnail((960, 540))
            sheet = Image.new('RGB', (im1.width + im2.width + 20, max(im1.height, im2.height)), (128, 128, 128))
            sheet.paste(im1, (0, 0)); sheet.paste(im2, (im1.width + 20, 0))
            sheet.save(os.path.join(review, f'bg_{th}_s{n}.png'))
            print(f'было → стало: {os.path.join(review, f"bg_{th}_s{n}.png")}')
