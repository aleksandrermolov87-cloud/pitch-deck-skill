# Вырезка белого фона у сгенерированного 3D-объекта: заливка от краёв по светлым пикселям, мягкая альфа по краю.
# PNG с готовой прозрачностью (image_gen в Codex) не вырезается: только обрезка полей, fill и превью.
# Запуск: $SKILL/.venv/bin/python -I cutout.py <img.jpg> [--out img.png] [--tol 18] [--preview] [--qc [--theme theme.json]]
# --preview дополнительно пишет <img>_check.png: объект на тёмном и на светлом фоне, чтобы проверить ореол.
# --qc после вырезки печатает img_qc.py check: палитра, кайма, край, текст, резкость. Тема — ближайший theme.json выше
# картинки или --theme. Код 1, если есть FAIL (файл всё равно записан).
import argparse
import os
import subprocess
import sys
from collections import deque

import numpy as np
from PIL import Image, ImageFilter

ap = argparse.ArgumentParser()
ap.add_argument('src')
ap.add_argument('--out')
ap.add_argument('--tol', type=int, default=18, help='насколько пиксель может отличаться от фона, 0–255')
ap.add_argument('--preview', action='store_true')
ap.add_argument('--qc', action='store_true', help='проверить результат img_qc.py check')
ap.add_argument('--theme', help='theme.json для --qc; по умолчанию ближайший выше картинки')
ap.add_argument('--shadow', choices=['keep', 'dark'], default='keep',
                help='dark: светлая серая тень становится полупрозрачной чёрной. Может задеть белые части объекта: проверять --preview. Лучше генерировать без тени')
a = ap.parse_args()

src = Image.open(a.src)
# картинка уже с прозрачным фоном (image_gen в Codex): фон не вырезаем, только обрезка полей, fill и превью
ready = src.mode in ('RGBA', 'LA', 'PA') or 'transparency' in src.info
if ready:
    src = src.convert('RGBA')
    ready = (np.asarray(src)[..., 3] < 16).mean() > 0.01
img = src.convert('RGB')
px = np.asarray(img, dtype=np.int16)
h, w, _ = px.shape
# цвет фона — медиана по рамке в 4 пикселя
border = np.concatenate([px[:4].reshape(-1, 3), px[-4:].reshape(-1, 3), px[:, :4].reshape(-1, 3), px[:, -4:].reshape(-1, 3)])
bgc = np.median(border, axis=0)
dist = np.abs(px - bgc).max(axis=2)
near = (dist <= a.tol) & (not ready)          # готовая альфа: заливки нет

# заливка от краёв: фон — только связная с краем светлая область (белые блики внутри объекта не трогаем)
bg = np.zeros((h, w), bool)
q = deque((y, x) for y in range(h) for x in (0, w - 1) if near[y, x])
q.extend((y, x) for x in range(w) for y in (0, h - 1) if near[y, x])
for y, x in q:
    bg[y, x] = True
while q:
    y, x = q.popleft()
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        ny, nx = y + dy, x + dx
        if 0 <= ny < h and 0 <= nx < w and not bg[ny, nx] and near[ny, nx]:
            bg[ny, nx] = True
            q.append((ny, nx))

# тень: нейтральные серые пиксели светлее 120, связанные с фоном, — не объект, а тень на «полу»
shadow = np.zeros((h, w), bool)
if a.shadow == 'dark':
    luma = px.mean(axis=2)
    neutral = (px.max(axis=2) - px.min(axis=2) < 12) & (luma >= 120) & (luma < bgc.mean() - 2) & ~bg
    q = deque()
    for y, x in zip(*np.nonzero(neutral)):
        if any(0 <= y + dy < h and 0 <= x + dx < w and bg[y + dy, x + dx] for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1))):
            shadow[y, x] = True
            q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and neutral[ny, nx] and not shadow[ny, nx]:
                shadow[ny, nx] = True
                q.append((ny, nx))

# мягкий край: альфа растёт с удалением от цвета фона в полосе 2 tol
alpha = np.where(bg, 0, 255).astype(np.uint8)
edge = np.asarray(Image.fromarray(alpha).filter(ImageFilter.MaxFilter(5)), dtype=np.uint8) != np.asarray(Image.fromarray(alpha).filter(ImageFilter.MinFilter(5)), dtype=np.uint8)
soft = np.clip((dist - a.tol * 0.5) / (a.tol * 1.5) * 255, 0, 255).astype(np.uint8)
alpha = np.where(edge & ~bg, np.maximum(soft, 0), alpha)
alpha = np.asarray(Image.fromarray(alpha).filter(ImageFilter.GaussianBlur(0.8)))
# снимаем белый ореол: в полупрозрачных пикселях вычитаем вклад фона
af = alpha[..., None].astype(np.float32) / 255
rgb = np.where(af > 0.02, (px - bgc * (1 - af)) / np.maximum(af, 0.02), px).clip(0, 255).astype(np.uint8)
if shadow.any():                                   # тень: чёрный цвет, прозрачность по глубине тени
    depth = np.clip((bgc.mean() - px.mean(axis=2)) / max(bgc.mean() - 120, 1), 0, 1)
    alpha = np.where(shadow, (depth * 150).astype(np.uint8), alpha)
    rgb = np.where(shadow[..., None], 0, rgb).astype(np.uint8)
out = src if ready else Image.fromarray(np.dstack([rgb, alpha]))
bbox = out.getbbox()
if bbox:
    pad = 8
    out = out.crop((max(bbox[0] - pad, 0), max(bbox[1] - pad, 0), min(bbox[2] + pad, w), min(bbox[3] + pad, h)))
dst = a.out or a.src.rsplit('.', 1)[0] + '.png'
out.save(dst)
# доля видимых пикселей: по ней place3d() выравнивает оптический размер объектов серии
fill = float((np.asarray(out)[..., 3] > 128).mean())
import json
json.dump({'w': out.width, 'h': out.height, 'fill': round(fill, 4)}, open(dst.rsplit('.', 1)[0] + '.json', 'w'))
print('ok', dst, out.size, f'fill {fill:.2f}')
if a.preview:
    tile = Image.new('RGB', (out.width * 2 + 30, out.height + 20), (128, 128, 128))
    for i, c in enumerate([(6, 6, 6), (244, 244, 243)]):
        bgimg = Image.new('RGB', out.size, c)
        bgimg.paste(out, (0, 0), out)
        tile.paste(bgimg, (10 + i * (out.width + 10), 10))
    p = dst.rsplit('.', 1)[0] + '_check.png'
    tile.save(p)
    print('preview', p)
if a.qc:
    theme = a.theme
    d = os.path.dirname(os.path.abspath(dst))
    while not theme and d != os.path.dirname(d):
        theme = os.path.join(d, 'theme.json') if os.path.isfile(os.path.join(d, 'theme.json')) else None
        d = os.path.dirname(d)
    here = os.path.dirname(os.path.abspath(__file__))
    cmd = [sys.executable, '-I', os.path.join(here, 'img_qc.py'), 'check', dst] + (['--theme', theme] if theme else [])
    sys.stdout.flush()
    sys.exit(subprocess.run(cmd).returncode)
