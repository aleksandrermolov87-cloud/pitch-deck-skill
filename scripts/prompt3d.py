# Промпты 3D-объектов для MagicPatterns generate_image из брифа контекста (reference/09-3d-objects.md).
# Запуск: $SKILL/.venv/bin/python -I prompt3d.py data/objects3d.json --theme theme.json [--variants 2] [--out payload.json]
# Печатает {"images": [...]} пачками по 5 (лимит одного вызова generate_image) и таблицу трассировки; код 1, если бриф не прошёл проверку.
import argparse
import json
import re
import sys

ap = argparse.ArgumentParser()
ap.add_argument('brief')
ap.add_argument('--theme', required=True)
ap.add_argument('--variants', type=int, default=2)
ap.add_argument('--out')
a = ap.parse_args()

B = json.load(open(a.brief, encoding='utf-8'))
T = json.load(open(a.theme, encoding='utf-8'))
P3 = T.get('prompt3d') or {}
PALETTE = P3.get('palette', 'only bright red (#EF3124), white and glossy black accents, no other colors, no gold, no blue')
STYLE = P3.get('style', 'Premium fintech 3D illustration style, smooth glossy plastic and soft matte materials, soft studio lighting from the upper left, subtle soft grey shadow beneath')
BG = P3.get('bg', T['palette']['dark']['bg'])

GENERIC = r'\b(rocket|light ?bulb|target|bullseye|handshake|gear|cog|globe|puzzle|magnif\w*|chess|cloud|brain|abstract|sphere|cube|person|people|character)\b'
FRAMING = {
    'card': ('1:1', 'three-quarter view, slightly tilted, centered, generous empty margin'),
    'hero': ('1:1', 'three-quarter close-up view, centered, generous empty margin'),
    'row': ('1:1', 'front view, centered, same scale as a set of matching icons, generous empty margin'),
    'sticker': ('1:1', 'front view, centered, compact silhouette, generous empty margin'),
    'bg': ('16:9', 'still life composition weighted to the right and bottom, objects partially cropped by the right edge'),
}

errors, seen, images, trace = [], {}, [], []
for o in B['objects']:
    nm = o.get('name', '?')
    for f in ('entity', 'facts', 'object', 'details', 'meaning', 'placement', 'trace'):
        if not o.get(f):
            errors.append(f'{nm}: нет поля «{f}»')
    if o.get('placement') not in FRAMING:
        errors.append(f"{nm}: placement «{o.get('placement')}» не из {list(FRAMING)}")
        continue
    if len(o.get('facts', [])) < 1 or len(o.get('details', [])) < 1:
        errors.append(f'{nm}: нужен хотя бы один признак из данных (facts) и одна деталь (details)')
    text = ' '.join([o.get('object', '')] + o.get('details', []))
    g = re.search(GENERIC, text, re.I)
    if g and not o.get('allow_generic'):
        errors.append(f'{nm}: дженерик-объект «{g.group(0)}» без allow_generic с причиной')
    key = re.sub(r'\W+', ' ', o.get('object', '').lower()).strip()
    if key in seen:
        errors.append(f'{nm}: тот же объект, что у {seen[key]}: у каждой сущности свой объект')
    seen[key] = nm
    ratio, frame = FRAMING[o['placement']]
    details = '; '.join(o['details'])
    if o['placement'] == 'bg':
        prompt = (f"Premium 3D still life for a presentation slide background: {o['object']}, with {details}, "
                  f"symbolizing {o['meaning']}. {frame}. Strict color palette: {PALETTE}. {STYLE}. "
                  f"The entire background is one perfectly flat solid color (hex {BG}) with no gradient, no vignette, no floor line. "
                  f"No text, no letters, no numbers, no logos, no user interface labels.")
    else:
        # объект вырезается и ложится на тёмный фон: падающая тень дала бы светлое пятно, поэтому без неё
        prompt = (f"A single 3D rendered object: {o['object']}, with {details}, symbolizing {o['meaning']}. "
                  f"{frame}. Strict color palette: {PALETTE}. {STYLE}. The object floats with no cast shadow, no floor, no reflection. "
                  f"Isolated on a pure flat white background. "
                  f"No text, no letters, no numbers, no logos, no user interface labels.")
    for v in range(1, a.variants + 1):
        images.append({'name': f'{nm}_v{v}', 'aspectRatio': ratio, 'prompt': prompt})
    trace.append(f"| {o.get('slide', '')} | {o.get('entity', '')} | {'; '.join(o.get('facts', []))} | {o.get('object', '')} | {o.get('trace', '')} |")

if errors:
    for e in errors:
        print('[ERR]', e)
    sys.exit(1)
batches = [images[i:i + 5] for i in range(0, len(images), 5)]
payload = {'batches': [{'images': b} for b in batches]}
if a.out:
    json.dump(payload, open(a.out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(json.dumps(payload, ensure_ascii=False, indent=1))
print(f'\n{len(B["objects"])} объектов × {a.variants} варианта = {len(images)} картинок, вызовов generate_image: {len(batches)}')
print('\n| Слайд | Сущность | Признаки из данных | Объект | Источник |\n|---|---|---|---|---|')
print('\n'.join(trace))
