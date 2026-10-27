# Фоны слайдов (подложки) по theme.json: тёмная основа, зернистые вертикальные полосы акцентного цвета у правого края,
# мягкое свечение под ключевым блоком. Светлая тема (bgL_*) — тот же рисунок на светлой основе.
# Запуск: python -I bg.py [--only bg_s2.jpg,bg_n4.jpg]   (numpy и pillow: venv скилла, см. scripts/setup.sh)
# Параметры подложек — theme.json → bg:
#   stripes [[от, до, яркость] …] в долях ширины, stripes_strength (общий множитель), grain (зерно), curtains («шторы»);
#   slides { "bg_s2.jpg": { "glow": [cx, cy, rx, ry, сила] | null, "stripes": множитель (0 — без полос), "grain": bool } }.
# Быстро править подложку из чата: scripts/bg_edit.py (reference/13-quick-copy-edit.md, раздел «Подложка»).
import argparse
import json
import os
import re

import numpy as np
from PIL import Image, ImageFilter

ap = argparse.ArgumentParser()
ap.add_argument('--only', default='', help='имена файлов через запятую: пересобрать только их')
a = ap.parse_args()

HERE = os.path.dirname(os.path.abspath(__file__))
T = json.load(open(os.path.join(HERE, 'theme.json')))
BG = T['bg']
W, H = 2560, 1440
OUT = os.path.join(HERE, 'img')
os.makedirs(OUT, exist_ok=True)
hexrgb = lambda h: np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], dtype=np.float32)
ACC = hexrgb(T['palette']['dark']['accent'])
DARK = hexrgb(T['palette']['dark']['bg'])
LIGHT = hexrgb(T['palette']['light']['bg'])
SLIDES = BG.get('slides') or {}
only = [n.strip() for n in a.only.split(',') if n.strip()]
for n in only:
    if not re.fullmatch(r'bg_[A-Za-z0-9_-]+\.jpg', n):
        raise SystemExit(f'--only: имя подложки вида bg_<имя>.jpg ({n})')
    if n not in SLIDES:
        raise SystemExit(f'--only: {n} нет в theme.json → bg.slides')


def base(seed, p):
    rng = np.random.default_rng(seed)
    x = np.linspace(0, 1, W, dtype=np.float32)
    y = np.linspace(0, 1, H, dtype=np.float32)[:, None]
    img = np.broadcast_to(DARK, (H, W, 3)).copy()
    if p.get('curtains', BG.get('curtains', True)):
        img += (2.5 * np.sin(x * np.pi * 9 + 0.7) + 1.5 * np.sin(x * np.pi * 23))[None, :, None]   # едва заметные «шторы»
    k = BG.get('stripes_strength', 1.0) * p.get('stripes', 1.0)
    if k > 0:
        mask = np.zeros(W, dtype=np.float32)
        for lo, hi, br in BG['stripes']:
            mask = np.maximum(mask, br * ((x >= lo) & (x < hi)))
        m = Image.fromarray((mask * 255).astype(np.uint8)[None, :].repeat(8, 0)).filter(ImageFilter.GaussianBlur(radius=10))
        mask = np.asarray(m, dtype=np.float32)[0] / 255
        vfade = np.clip(1.05 - 0.75 * y, 0, 1) ** 1.4                # сверху ярче, к низу гаснет
        grain = 0.35 + 0.9 * rng.random((H, W), dtype=np.float32) ** 1.6 if p.get('grain', BG.get('grain', True)) else 1
        img += (mask[None, :] * vfade * grain * 0.82 * min(k, 1.6))[..., None] * ACC
    return img, rng


def glow(img, cx, cy, rx, ry, k):
    x = np.linspace(0, 1, W, dtype=np.float32)[None, :]
    y = np.linspace(0, 1, H, dtype=np.float32)[:, None]
    img += (k * np.exp(-(((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2) * 2.2))[..., None] * ACC


for name, p in SLIDES.items():
    if only and name not in only:
        continue
    seed = sum(ord(c) for c in name) * 13                              # одно имя — один рисунок при любой пересборке
    img, rng = base(seed, p)
    if p.get('glow'):
        glow(img, *p['glow'])
    img += (rng.random((H, W, 1), dtype=np.float32) - 0.5) * 5        # общее зерно против бандинга
    Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).save(os.path.join(OUT, name), quality=90)
    # светлая версия: доля акцента берётся из разницы каналов тёмного фона
    dark = np.clip(img, 0, 255)
    al = np.clip((dark[..., 0] - dark[..., 1] - 2) / max(ACC[0] - ACC[1], 1), 0, 1)[..., None] * 0.62
    Image.fromarray(np.clip(LIGHT * (1 - al) + ACC * al, 0, 255).astype(np.uint8)).save(os.path.join(OUT, 'bgL_' + name[3:]), quality=90)
print(sorted(only) if only else sorted(f for f in os.listdir(OUT) if f.endswith('.jpg')))
