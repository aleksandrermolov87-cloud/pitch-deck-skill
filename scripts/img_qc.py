# Измеримый контроль качества вырезанных 3D-объектов (reference/09-3d-objects.md, раздел 5, «Выбор варианта»).
#   img_qc.py check <img.png…> [--theme theme.json] [--json]   метрики по каждой картинке: PASS / WARN / FAIL
#   img_qc.py rank  <вариант.png…> [--theme …] [--json]         общий балл вариантов одного объекта, рекомендация и почему
#   img_qc.py dupes <папка img/3d> [--json]                     похожие силуэты разных объектов (dHash 64 бита)
# Метрики советуют, решают агент и пользователь: после rank — чек-лист глазами. Текст на картинке ищется эвристикой
# (дешёвый признак, не OCR): WARN, никогда не FAIL. Пороги — в словаре T ниже, откалиброваны на демо-объектах заготовки.
# Запуск: $SKILL/.venv/bin/python -I img_qc.py …   Код 1 — есть FAIL (check, dupes) или ошибка входа.
import argparse
import json
import re
import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

SKILL = Path(__file__).resolve().parent.parent
THEME = SKILL / 'templates' / 'deck-starter' / 'theme.json'

# Пороги: (граница PASS, граница WARN); хуже второй — FAIL. Направление сравнения — в METRICS.
T = {
    'sat_chroma': 18,          # C* (CIELAB) выше — пиксель «цветной» и проверяется по палитре; ниже — белый/серый/чёрный
    'opaque': 200,             # альфа выше — пиксель тела объекта
    'de_kl': 2.0,              # ΔE2000 с kL=2 (текстильный вариант): светотень меняет L* сильнее, чем цвет, это не ошибка палитры
    'de_max': 20.0,            # ΔE2000 до ближайшего цвета темы ниже — пиксель «в палитре»
    'palette': (0.85, 0.65),   # доля цветных пикселей в палитре: PASS ≥ 0.85, WARN ≥ 0.65
    'hue_tol': 30,             # градусов тона h° от ближайшего хроматического цвета темы
    'hue_off': (0.05, 0.15),   # доля цветных пикселей чужого тона (синий, золото, зелень): PASS ≤ 5%, WARN ≤ 15%
    'halo': (14, 24),          # средний избыток L* внешнего кольца 2 px на тёмном фоне над телом рядом: PASS ≤ 14, WARN ≤ 24.
                               # блик-обводка глянцевого чёрного даёт ~10 (демо step_catalog 11,7), белая кайма вырезки — 30+
    'edge_w': (3.5, 7.0),      # средняя ширина полупрозрачного края, px (полутона альфы / периметр): мягкий ореол, дымка тени
    'specks': (3, 10),         # крошки: отдельные пятнышка альфы < 0,05% площади, остатки фона
    'fill': (0.35, 0.20),      # доля видимых пикселей в рамке: меньше — объект «дырявый», place3d() раздует рамку
    'fill_max': 0.97,          # больше — фон, скорее всего, не вырезан (прямоугольник)
    'aspect': (2.4, 3.5),      # max(w/h, h/w) рамки: вытянутый объект плохо садится в тайл
    'text': (0, 1),            # строк «глифов» (эвристика): 0 — PASS, 1+ — WARN
    'sharp': (150, 50),        # дисперсия лапласиана L* на 10% самых контрастных пикселей тела (объект уменьшен до 512 px):
                               # демо 211–1536; размытие σ≈1 px роняет до 17–90. По всему телу мерить нельзя: гладкое стекло «мылит»
    'dupe': (8, 4),            # dHash силуэта: Хэмминг ≤ 8 из 64 — WARN, ≤ 4 — FAIL (одна сущность — один объект).
                               # Хэш грубый: разные «широкие» объекты демо дают 11–30, поэтому порог ниже 12
}
# rank: веса общего балла (сумма 1). Палитра и ореол видны сразу на тёмном слайде, текст и мыло — при приближении.
W = {'palette': 0.22, 'hue_off': 0.13, 'halo': 0.20, 'edge_w': 0.10, 'text': 0.12, 'sharp': 0.13, 'fill': 0.05, 'aspect': 0.05}
# имя → (порог в T, больше-лучше?, подпись)
METRICS = {
    'palette': ('palette', True, 'цветные пиксели в палитре темы (ΔE2000)'),
    'hue_off': ('hue_off', False, 'цветные пиксели чужого тона'),
    'halo': ('halo', False, 'светлая кайма на тёмном фоне, ΔL*'),
    'edge_w': ('edge_w', False, 'ширина полупрозрачного края, px'),
    'specks': ('specks', False, 'крошки альфы вне объекта'),
    'fill': ('fill', True, 'заполнение рамки'),
    'aspect': ('aspect', False, 'вытянутость рамки'),
    'text': ('text', False, 'строки похожих на буквы штрихов (эвристика)'),
    'sharp': ('sharp', True, 'резкость: дисперсия лапласиана'),
}


# --- цвет ---------------------------------------------------------------------------------------------------------
def to_lab(rgb):
    """sRGB 0–255 (…, 3) → CIELAB D65."""
    c = np.asarray(rgb, np.float64) / 255
    c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    xyz = c @ np.array([[0.4124564, 0.2126729, 0.0193339], [0.3575761, 0.7151522, 0.1191920], [0.1804375, 0.0721750, 0.9503041]])
    xyz /= np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 216 / 24389, np.cbrt(xyz), (24389 / 27 * xyz + 16) / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def de2000(a, b, kL=1.0):
    """ΔE2000 между (N, 3) и (M, 3) → (N, M)."""
    L1, a1, b1 = (a[:, None, i] for i in range(3))
    L2, a2, b2 = (b[None, :, i] for i in range(3))
    C1, C2 = np.hypot(a1, b1), np.hypot(a2, b2)
    Cm7 = ((C1 + C2) / 2) ** 7
    G = 0.5 * (1 - np.sqrt(Cm7 / (Cm7 + 25 ** 7)))
    a1p, a2p = a1 * (1 + G), a2 * (1 + G)
    C1p, C2p = np.hypot(a1p, b1), np.hypot(a2p, b2)
    h1p, h2p = np.degrees(np.arctan2(b1, a1p)) % 360, np.degrees(np.arctan2(b2, a2p)) % 360
    dLp, dCp = L2 - L1, C2p - C1p
    dh = h2p - h1p
    dh = np.where(dh > 180, dh - 360, np.where(dh < -180, dh + 360, dh))
    dh = np.where(C1p * C2p == 0, 0, dh)
    dHp = 2 * np.sqrt(C1p * C2p) * np.sin(np.radians(dh / 2))
    Lm, Cm = (L1 + L2) / 2, (C1p + C2p) / 2
    hs = h1p + h2p
    hm = np.where(C1p * C2p == 0, hs, np.where(np.abs(h1p - h2p) <= 180, hs / 2, np.where(hs < 360, (hs + 360) / 2, (hs - 360) / 2)))
    Tt = 1 - 0.17 * np.cos(np.radians(hm - 30)) + 0.24 * np.cos(np.radians(2 * hm)) + 0.32 * np.cos(np.radians(3 * hm + 6)) \
        - 0.20 * np.cos(np.radians(4 * hm - 63))
    SL = 1 + 0.015 * (Lm - 50) ** 2 / np.sqrt(20 + (Lm - 50) ** 2)
    SC, SH = 1 + 0.045 * Cm, 1 + 0.015 * Cm * Tt
    RT = -2 * np.sqrt(Cm ** 7 / (Cm ** 7 + 25 ** 7)) * np.sin(np.radians(60 * np.exp(-((hm - 275) / 25) ** 2)))
    return np.sqrt((dLp / (kL * SL)) ** 2 + (dCp / SC) ** 2 + (dHp / SH) ** 2 + RT * (dCp / SC) * (dHp / SH))


def theme_colors(path):
    """Разрешённые цвета: все hex палитр темы, hex из prompt3d.palette, белый и чёрный. И тёмный фон для каймы."""
    th = json.load(open(path, encoding='utf-8'))
    hexes = {'FFFFFF', '000000'}
    for pal in th.get('palette', {}).values():
        hexes |= {v.upper() for v in pal.values() if isinstance(v, str) and re.fullmatch(r'[0-9A-Fa-f]{6}', v)}
    p3 = th.get('prompt3d', {})
    hexes |= {h.upper() for h in re.findall(r'#([0-9A-Fa-f]{6})\b', str(p3.get('palette', '')))}
    bg = p3.get('bg') or th.get('palette', {}).get('dark', {}).get('bg', '060606')
    rgb = np.array([[int(h[i:i + 2], 16) for i in (0, 2, 4)] for h in sorted(hexes)], float)
    return sorted(hexes), to_lab(rgb), np.array([int(bg[i:i + 2], 16) for i in (0, 2, 4)], float)


# --- морфология и компоненты без scipy ---------------------------------------------------------------------------
def morph(mask, size, grow):
    im = Image.fromarray(mask.astype(np.uint8) * 255)
    return np.asarray(im.filter(ImageFilter.MaxFilter(size) if grow else ImageFilter.MinFilter(size))) > 127


def box(a, r):
    """Сумма по окну (2r+1)² через интегральное изображение."""
    p = np.pad(a, ((r + 1, r), (r + 1, r))).cumsum(0).cumsum(1)
    n = 2 * r + 1
    return p[n:, n:] - p[:-n, n:] - p[n:, :-n] + p[:-n, :-n]


def components(mask):
    """4-связные компоненты: список (y0, x0, y1, x1, площадь)."""
    seen = np.zeros_like(mask, bool)
    h, w = mask.shape
    out = []
    for y, x in zip(*np.nonzero(mask)):
        if seen[y, x]:
            continue
        seen[y, x] = True
        q = deque([(y, x)])
        y0, x0, y1, x1, n = y, x, y, x, 0
        while q:
            cy, cx = q.popleft()
            n += 1
            y0, y1, x0, x1 = min(y0, cy), max(y1, cy), min(x0, cx), max(x1, cx)
            for ny, nx in ((cy + 1, cx), (cy - 1, cx), (cy, cx + 1), (cy, cx - 1)):
                if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    q.append((ny, nx))
        out.append((y0, x0, y1, x1, n))
    return out


def load(path, cap=1024):
    im = Image.open(path).convert('RGBA')
    if max(im.size) > cap:
        k = cap / max(im.size)
        im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    return im


# --- метрики -----------------------------------------------------------------------------------------------------
def measure(path, allowed_lab, bg):
    im = load(path)
    a = np.asarray(im, np.float64)
    rgb, al = a[..., :3], a[..., 3]
    m = {}
    vis = al > 128
    if (al < 16).mean() < 0.01:                           # прозрачности нет: фон не вырезан
        m['no_alpha'] = True
    bbox = Image.fromarray(vis.astype(np.uint8) * 255).getbbox()
    if not bbox:
        return {'empty': True}
    x0, y0, x1, y1 = bbox
    bw, bh = x1 - x0, y1 - y0
    m['fill'] = float(vis[y0:y1, x0:x1].mean())
    m['aspect'] = float(max(bw / bh, bh / bw))
    lab = to_lab(rgb)
    L = lab[..., 0]

    # палитра: цветные непрозрачные пиксели против разрешённых цветов темы
    op = al > T['opaque']
    C = np.hypot(lab[..., 1], lab[..., 2])
    sat = op & (C > T['sat_chroma'])
    px = lab[sat]
    m['sat_share'] = float(sat.sum() / max(op.sum(), 1))
    if len(px):
        if len(px) > 40000:
            px = px[np.random.default_rng(0).choice(len(px), 40000, replace=False)]
        d = de2000(px, allowed_lab, T['de_kl']).min(1)
        m['palette'] = float((d < T['de_max']).mean())
        chrom = allowed_lab[np.hypot(allowed_lab[:, 1], allowed_lab[:, 2]) > T['sat_chroma']]
        if len(chrom):
            hp = np.degrees(np.arctan2(px[:, 2], px[:, 1]))[:, None]
            ha = np.degrees(np.arctan2(chrom[:, 2], chrom[:, 1]))[None, :]
            dh = np.abs((hp - ha + 180) % 360 - 180).min(1)
            m['hue_off'] = float((dh > T['hue_tol']).mean())
        else:
            m['hue_off'] = 1.0
    else:
        m['palette'], m['hue_off'] = 1.0, 0.0           # монохром: белое, серое, чёрное — всё в палитре

    # светлая кайма: внешнее кольцо 2 px, сведённое на тёмный фон, против тела в 3–7 px внутрь рядом
    clear = al <= 16
    near_clear = morph(clear, 5, True)
    ring = ~clear & near_clear
    inner = op & morph(clear, 15, True) & ~morph(clear, 7, True)
    af = al[..., None] / 255
    Lc = to_lab(rgb * af + bg * (1 - af))[..., 0]
    r = 7
    s, n = box(np.where(inner, L, 0), r), box(inner.astype(float), r)
    ok = ring & (n > 0)
    local = np.where(n > 0, s / np.maximum(n, 1), 0)
    m['halo'] = float(np.clip(Lc[ok] - local[ok], 0, None).mean()) if ok.any() else 0.0

    # край: полутона альфы на пиксель периметра и крошки
    mid = (al > 16) & (al < 240)
    perim = (vis & morph(~vis, 3, True)).sum()
    m['edge_w'] = float(mid.sum() / max(perim, 1))
    k = 384 / max(im.size)
    small = np.asarray(Image.fromarray(al.astype(np.uint8)).resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.BILINEAR)) > 16
    comps = components(small)
    tiny = small.size * 0.0005
    m['specks'] = sum(1 for c in comps if c[4] < tiny)

    # резкость: объект уменьшен до 512 px по длинной стороне, лапласиан L* на самых контрастных пикселях тела (силуэт не считается)
    crop = Image.fromarray(np.dstack([rgb, al]).astype(np.uint8)).crop(bbox)
    k = min(1.0, 512 / max(crop.size))                 # только уменьшение: апскейл сам «мылит»
    crop = np.asarray(crop.resize((max(3, round(crop.width * k)), max(3, round(crop.height * k))), Image.LANCZOS), np.float64)
    Ls = to_lab(crop[..., :3])[..., 0]
    body = morph(crop[..., 3] > 250, 7, False)[1:-1, 1:-1]
    lap = (Ls[:-2, 1:-1] + Ls[2:, 1:-1] + Ls[1:-1, :-2] + Ls[1:-1, 2:] - 4 * Ls[1:-1, 1:-1])
    g = np.hypot(Ls[1:-1, 2:] - Ls[1:-1, :-2], Ls[2:, 1:-1] - Ls[:-2, 1:-1])
    det = body & (g >= np.percentile(g[body], 90)) if body.sum() > 50 else body
    m['sharp'] = float(lap[det].var()) if det.sum() > 20 else 0.0

    # текст (эвристика): мелкие контрастные штрихи в теле, выстроенные в строку одинаковой высоты
    m['text'], m['glyphs'] = text_lines(L, op, bw, bh)
    return m


def text_lines(L, op, bw, bh):
    body = morph(op, 7, False)
    r = 4
    mean = box(L, r) / (2 * r + 1) ** 2
    hmax = max(6, 0.08 * min(bw, bh))
    g = []
    # тёмные и светлые штрихи раздельно: иначе просвет между буквами склеивает слово в одно пятно
    for sign, stroke in enumerate((body & (L < mean - 12), body & (L > mean + 12))):
        for y0, x0, y1, x1, n in components(stroke):
            h, w = y1 - y0 + 1, x1 - x0 + 1
            if 5 <= h <= hmax and 2 <= w <= 2.5 * h and n >= 8 and 0.15 <= n / (h * w) <= 0.75:
                g.append(((y0 + y1) / 2, x0, x1, h, sign))
    # строка: соседи одной полярности по горизонтали с той же средней линией и высотой, рядом, но не друг на друге
    # (тёмная обводка и светлый блик одной детали перекрываются — это не буквы)
    parent = list(range(len(g)))

    def root(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i
    for i, (cy, xa, xb, h, sg) in enumerate(g):
        for j in range(i + 1, len(g)):
            cy2, xa2, xb2, h2, sg2 = g[j]
            gap = max(xa, xa2) - min(xb, xb2)
            if sg == sg2 and abs(cy - cy2) < 0.3 * max(h, h2) and 0.7 <= h / h2 <= 1.43 and -0.2 * min(h, h2) <= gap <= 1.2 * max(h, h2):
                parent[root(i)] = root(j)
    sizes = {}
    for i in range(len(g)):
        sizes[root(i)] = sizes.get(root(i), 0) + 1
    return sum(1 for v in sizes.values() if v >= 4), len(g)


def grade(name, v):
    key, higher, _ = METRICS[name]
    p, w = T[key]
    if higher:
        return 'PASS' if v >= p else 'WARN' if v >= w else 'FAIL'
    if name == 'text':
        return 'PASS' if v <= p else 'WARN'             # эвристика: максимум WARN
    return 'PASS' if v <= p else 'WARN' if v <= w else 'FAIL'


def check(path, allowed_lab, bg):
    m = measure(path, allowed_lab, bg)
    rows = []
    if m.get('empty'):
        return {'file': str(path), 'status': 'FAIL', 'metrics': {}, 'rows': [('alpha', 'FAIL', 0, 'картинка пустая: нет видимых пикселей')]}
    if m.get('no_alpha'):
        rows.append(('alpha', 'FAIL', 0, 'нет прозрачности: фон не вырезан (cutout.py)'))
    for name in METRICS:
        rows.append((name, grade(name, m[name]), m[name], METRICS[name][2]))
    if m['fill'] > T['fill_max']:
        rows.append(('fill_max', 'FAIL', m['fill'], f'рамка залита > {T["fill_max"]}: похоже, фон не вырезан'))
    st = 'FAIL' if any(r[1] == 'FAIL' for r in rows) else 'WARN' if any(r[1] == 'WARN' for r in rows) else 'PASS'
    return {'file': str(path), 'status': st, 'metrics': m, 'rows': rows}


def sub(name, v):
    """0–1: 1 на границе PASS и лучше, 0 на границе WARN и хуже."""
    key, higher, _ = METRICS[name]
    p, w = T[key]
    if name == 'text':
        return 1.0 if v <= p else 0.0
    x = (v - w) / (p - w) if higher else (w - v) / (w - p)
    return float(min(1, max(0, x)))


def fmt(v):
    return f'{v:.3f}' if isinstance(v, float) else str(v)


def thr(name):
    key, higher, _ = METRICS[name]
    p, w = T[key]
    return f'{"≥" if higher else "≤"}{p}' + ('' if name == 'text' else f', WARN {"≥" if higher else "≤"}{w}')


def print_check(r):
    print(f'{r["status"]}  {r["file"]}')
    for name, st, v, label in r['rows']:
        tail = f' (PASS {thr(name)})' if name in METRICS else ''
        print(f'  {st:4} {name:8} {fmt(v):>7}  {label}{tail}')


def phash(path):
    """dHash 64 бита по силуэту (альфа), картинка дополнена до квадрата — пропорции учитываются."""
    al = Image.open(path).convert('RGBA').getchannel('A')
    bb = al.getbbox() or (0, 0, al.width, al.height)
    al = al.crop(bb)
    s = max(al.size)
    sq = Image.new('L', (s, s), 0)
    sq.paste(al, ((s - al.width) // 2, (s - al.height) // 2))
    g = np.asarray(sq.resize((9, 8), Image.LANCZOS), np.int16)
    bits = (g[:, 1:] > g[:, :-1]).flatten()
    return int(''.join('1' if b else '0' for b in bits), 2)


def base(p):
    return re.sub(r'_v\d+$', '', Path(p).stem)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('cmd', choices=['check', 'rank', 'dupes'])
    ap.add_argument('paths', nargs='+')
    ap.add_argument('--theme', default=str(THEME))
    ap.add_argument('--json', action='store_true')
    a = ap.parse_args()

    if a.cmd == 'dupes':
        files = []
        for p in a.paths:
            p = Path(p)
            files += sorted(f for f in p.glob('*.png') if not f.stem.endswith('_check')) if p.is_dir() else [p]
        hs = {str(f): phash(f) for f in files}
        pairs = []
        keys = list(hs)
        for i, f in enumerate(keys):
            for g in keys[i + 1:]:
                if base(f) == base(g):                  # варианты одного объекта (_v1, _v2) не сравниваются
                    continue
                d = bin(hs[f] ^ hs[g]).count('1')
                st = 'FAIL' if d <= T['dupe'][1] else 'WARN' if d <= T['dupe'][0] else 'PASS'
                pairs.append({'a': f, 'b': g, 'dist': d, 'status': st})
        pairs.sort(key=lambda x: x['dist'])
        bad = [x for x in pairs if x['status'] != 'PASS']
        if a.json:
            print(json.dumps({'files': len(files), 'pairs': pairs}, ensure_ascii=False, indent=1))
        else:
            for x in pairs:
                print(f'  {x["status"]:4} {x["dist"]:2}/64  {Path(x["a"]).name} ~ {Path(x["b"]).name}')
            worst = 'FAIL' if any(x['status'] == 'FAIL' for x in bad) else 'WARN' if bad else 'PASS'
            print(f'{worst}: {len(files)} объект(ов), похожих пар {len(bad)} (порог Хэмминга ≤ {T["dupe"][0]})'
                  + ('. Каждой сущности — свой объект: перегенерируйте похожий с другой метафорой' if bad else ''))
        sys.exit(1 if any(x['status'] == 'FAIL' for x in pairs) else 0)

    names, allowed, bg = theme_colors(a.theme)
    res = [check(Path(p), allowed, bg) for p in a.paths]

    if a.cmd == 'check':
        if a.json:
            print(json.dumps([{**r, 'rows': [dict(zip(('metric', 'status', 'value', 'label'), x)) for x in r['rows']]} for r in res],
                             ensure_ascii=False, indent=1))
        else:
            for r in res:
                print_check(r)
        sys.exit(1 if any(r['status'] == 'FAIL' for r in res) else 0)

    # rank: FAIL-ы опускают вариант вниз, внутри — по баллу 0–100
    for r in res:
        m = r['metrics']
        r['subs'] = {k: sub(k, m[k]) for k in W} if m and not m.get('empty') else {k: 0.0 for k in W}
        r['score'] = round(100 * sum(W[k] * r['subs'][k] for k in W), 1)
        r['fails'] = sum(1 for x in r['rows'] if x[1] == 'FAIL')
    order = sorted(res, key=lambda r: (r['fails'], -r['score']))
    best = order[0]
    why = []
    for r in order[1:]:
        loss = sorted(((W[k] * (best['subs'][k] - r['subs'][k]), k) for k in W), reverse=True)
        top = [f'{k} ({fmt(r["metrics"].get(k, 0))} против {fmt(best["metrics"].get(k, 0))})' for d, k in loss[:2] if d > 0.005]
        why.append({'file': r['file'], 'score': r['score'], 'fails': r['fails'], 'loses_on': top})
    if a.json:
        print(json.dumps({'weights': W, 'recommended': best['file'],
                          'ranking': [{'file': r['file'], 'score': r['score'], 'fails': r['fails'], 'status': r['status'],
                                       'metrics': r['metrics']} for r in order], 'why': why}, ensure_ascii=False, indent=1))
    else:
        print('вес: ' + ', '.join(f'{k} {v}' for k, v in W.items()))
        for i, r in enumerate(order, 1):
            bad = [f'{x[0]} {x[1]}' for x in r['rows'] if x[1] != 'PASS']
            print(f'  {i}. {r["score"]:5.1f}  {r["status"]:4} {Path(r["file"]).name}' + (f'  ({", ".join(bad)})' if bad else ''))
        print(f'рекомендую: {Path(best["file"]).name} — балл {best["score"]}' + (f', FAIL: {best["fails"]}' if best['fails'] else ''))
        for w in why:
            print(f'  {Path(w["file"]).name} уступает: ' + ('; '.join(w['loses_on']) or 'почти равны, решает глаз')
                  + (f'; FAIL: {w["fails"]}' if w['fails'] else ''))
        if best['fails']:
            print('у всех вариантов есть FAIL: уточните details и сгенерируйте заново')
        print('дальше: чек-лист глазами (смысл в 1,2″, детали, стиль набора) — метрики советуют, решают агент и пользователь')


if __name__ == '__main__':
    main()
