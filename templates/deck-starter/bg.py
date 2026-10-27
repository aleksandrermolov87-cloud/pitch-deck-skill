# Фоны слайдов по theme.json: тёмная основа, зернистые вертикальные полосы акцентного цвета у правого края,
# мягкое свечение под ключевым блоком. Светлая тема (bgL_*) — тот же рисунок на светлой основе.
# Запуск: python -I bg.py   (нужны numpy и pillow: venv скилла, см. scripts/setup.sh)
# Свечение на каждом слайде задаётся в GLOWS: имя файла → (cx, cy, rx, ry, сила) в долях холста.
import json
import os

import numpy as np
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
T = json.load(open(os.path.join(HERE, 'theme.json')))
W, H = 2560, 1440
OUT = os.path.join(HERE, 'img')
os.makedirs(OUT, exist_ok=True)
hexrgb = lambda h: np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], dtype=np.float32)
ACC = hexrgb(T['palette']['dark']['accent'])
DARK = hexrgb(T['palette']['dark']['bg'])
LIGHT = hexrgb(T['palette']['light']['bg'])

GLOWS = {
    'bg_cover.jpg': (0.80, 0.55, 0.30, 0.40, 0.16),
    'bg_s2.jpg': (0.18, 0.55, 0.25, 0.30, 0.12),
    'bg_s3.jpg': (0.88, 0.95, 0.22, 0.26, 0.18),
    'bg_s4.jpg': (0.70, 0.55, 0.25, 0.35, 0.10),
}


def base(seed):
    rng = np.random.default_rng(seed)
    x = np.linspace(0, 1, W, dtype=np.float32)
    y = np.linspace(0, 1, H, dtype=np.float32)[:, None]
    img = np.broadcast_to(DARK, (H, W, 3)).copy()
    img += (2.5 * np.sin(x * np.pi * 9 + 0.7) + 1.5 * np.sin(x * np.pi * 23))[None, :, None]   # едва заметные «шторы»
    mask = np.zeros(W, dtype=np.float32)
    for a, b, k in T['bg']['stripes']:
        mask = np.maximum(mask, k * ((x >= a) & (x < b)))
    m = Image.fromarray((mask * 255).astype(np.uint8)[None, :].repeat(8, 0)).filter(ImageFilter.GaussianBlur(radius=10))
    mask = np.asarray(m, dtype=np.float32)[0] / 255
    vfade = np.clip(1.05 - 0.75 * y, 0, 1) ** 1.4                    # сверху ярче, к низу гаснет
    grain = 0.35 + 0.9 * rng.random((H, W), dtype=np.float32) ** 1.6 if T['bg'].get('grain', True) else 1
    img += (mask[None, :] * vfade * grain * 0.82)[..., None] * ACC
    return img, rng


def glow(img, cx, cy, rx, ry, k):
    x = np.linspace(0, 1, W, dtype=np.float32)[None, :]
    y = np.linspace(0, 1, H, dtype=np.float32)[:, None]
    img += (k * np.exp(-(((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2) * 2.2))[..., None] * ACC


for seed, (name, g) in enumerate(GLOWS.items(), start=7):
    img, rng = base(seed * 13)
    glow(img, *g)
    img += (rng.random((H, W, 1), dtype=np.float32) - 0.5) * 5        # общее зерно против бандинга
    Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).save(os.path.join(OUT, name), quality=90)
    # светлая версия: доля акцента берётся из разницы каналов тёмного фона
    dark = np.clip(img, 0, 255)
    a = np.clip((dark[..., 0] - dark[..., 1] - 2) / max(ACC[0] - ACC[1], 1), 0, 1)[..., None] * 0.62
    Image.fromarray(np.clip(LIGHT * (1 - a) + ACC * a, 0, 255).astype(np.uint8)).save(os.path.join(OUT, 'bgL_' + name[3:]), quality=90)
print(sorted(f for f in os.listdir(OUT) if f.endswith('.jpg')))
