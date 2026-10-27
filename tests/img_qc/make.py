# Синтетические вырезанные объекты для tests/img_qc/run.sh: шар в палитре темы, синий шар, белая кайма, мыло, текст, дубли.
#   make.py <папка>
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT = Path(sys.argv[1])
OUT.mkdir(parents=True, exist_ok=True)
S, K = 400, 4                                     # рисуем в 4× и уменьшаем: сглаженный край как у настоящей вырезки


def sphere(color, box=(60, 60, 340, 340), name=None, fringe=False, blur=0, text=False):
    W = S * K
    im = Image.new('RGBA', (W, W), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    x0, y0, x1, y1 = (v * K for v in box)
    if fringe:                                    # недорезанный белый фон: светлое кольцо вокруг силуэта
        d.ellipse((x0 - 4 * K, y0 - 4 * K, x1 + 4 * K, y1 + 4 * K), fill=(250, 250, 250, 235))
    d.ellipse((x0, y0, x1, y1), fill=(*color, 255))
    im = im.resize((S, S), Image.LANCZOS)
    a = np.asarray(im, np.float64).copy()
    # светотень: темнее к правому низу, как у студийного света слева сверху
    yy, xx = np.mgrid[0:S, 0:S]
    cx, cy, r = (box[0] + box[2]) / 2, (box[1] + box[3]) / 2, (box[2] - box[0]) / 2
    shade = np.clip(1.15 - 0.55 * np.hypot(xx - cx + r * 0.35, yy - cy + r * 0.35) / r, 0.45, 1.1)
    body = np.hypot(xx - cx, yy - cy) < r - 1
    a[..., :3] = np.where(body[..., None], np.clip(a[..., :3] * shade[..., None], 0, 255), a[..., :3])
    im = Image.fromarray(a.astype(np.uint8))
    d = ImageDraw.Draw(im)
    # детали с жёстким краем: чёрный пояс и белые блики — как у глянцевого пластика
    d.rectangle((cx - r * 0.75, cy + r * 0.05, cx + r * 0.75, cy + r * 0.2), fill=(14, 14, 14, 255))
    d.rectangle((cx - r * 0.6, cy + r * 0.5, cx + r * 0.6, cy + r * 0.58), fill=(14, 14, 14, 255))
    d.ellipse((cx - r * 0.85, cy - r * 0.85, cx + r * 0.85, cy + r * 0.85), outline=(14, 14, 14, 255), width=5)
    for i in range(3):
        d.rectangle((cx - r * 0.5 + i * r * 0.3, cy - r * 0.55, cx - r * 0.38 + i * r * 0.3, cy - r * 0.3), fill=(250, 250, 250, 255))
    if text:
        d.text((cx - r * 0.7, cy + r * 0.3), 'POLICY 2025', fill=(250, 250, 250, 255), font=ImageFont.load_default(20))
    if blur:
        rgb = im.convert('RGB').filter(ImageFilter.GaussianBlur(blur))
        im = Image.fromarray(np.dstack([np.asarray(rgb), np.asarray(im)[..., 3]]))
    im = im.crop(im.getbbox())
    im.save(OUT / name)


RED, BLUE = (239, 49, 36), (36, 96, 239)
sphere(RED, name='red_sphere.png')
sphere(BLUE, name='blue_sphere.png')
sphere(RED, name='fringe.png', fringe=True)
sphere(RED, name='text.png', text=True)
# варианты одного объекта для rank: чистый, с каймой, мыльный
sphere(RED, name='obj_v1.png', fringe=True)
sphere(RED, name='obj_v2.png')
sphere(RED, name='obj_v3.png', blur=2.5)
# дубли: два разных «объекта» деки с тем же силуэтом и один другой формы
D = OUT / 'deck'
D.mkdir(exist_ok=True)
sphere(RED, name='deck/coin.png')
sphere((200, 200, 200), box=(40, 40, 360, 360), name='deck/globe.png')
bar = Image.new('RGBA', (360, 120), (0, 0, 0, 0))
ImageDraw.Draw(bar).rounded_rectangle((0, 0, 359, 119), 20, fill=(*RED, 255))
bar.save(D / 'card.png')
bar.resize((330, 120)).save(D / 'card_v2.png')                  # вариант того же объекта card: с ним не сравнивается
# белый фон, как отдаёт MagicPatterns: для cutout.py --qc
w = Image.new('RGB', (400, 400), (255, 255, 255))
ImageDraw.Draw(w).ellipse((100, 100, 300, 300), fill=RED)
ImageDraw.Draw(w).rectangle((140, 190, 260, 210), fill=(14, 14, 14))
w.save(OUT / 'white.jpg', quality=95)
