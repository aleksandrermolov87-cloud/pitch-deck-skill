# Контрольное сравнение версий навыка (reference/16-version-compare.md).
#   version_compare.py run <src> --runs <папка> [--engine deck|skill|<git-тег>] [--label имя] [--themes dark,light] [--regen-bg]
#       собирает деку в новой папке <runs>/<время>_<метка>/: входы (slides.js, data/, theme.json, deck.json, img/) — из проекта,
#       сборщик и компоненты (build.js, lib.js, components.js, kit/, render.sh, bg.py) — из --engine:
#         deck  — как в проекте; skill — из текущей папки скилла; v1.5.0 (любой git-тег или коммит) — из этой версии скилла.
#       Пишет PPTX, PNG каждой темы и manifest.json: версии и среда, контрольные суммы входов, сборщика и результатов, проверки.
#   version_compare.py compare <прогон A> <прогон B> [--out папка] [--ppt-viewed "dark:3,5;light:2"] [--ppt-notes "…"]
#       пары PNG «A | B» и карта попиксельной разницы на каждый слайд каждой темы, что изменилось во входах и среде,
#       контрольное ли сравнение, статусы всех проверок; report.json и report.md. --ppt-viewed — слайды, которые человек
#       или агент открыл в PowerPoint в прогоне B (только они, это не проверка всей презентации).
# Ничего не перезаписывает: папка прогона и папка сравнения создаются новыми, существующая — ошибка.
# Запуск: $SKILL/.venv/bin/python -I version_compare.py …
import argparse
import datetime as dt
import hashlib
import importlib.metadata as md
import json
import os
import platform
import re
import shutil
import subprocess
import sys
import zipfile

SKILL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PY = os.path.join(SKILL, '.venv', 'bin', 'python')
ENGINE = ['build.js', 'lib.js', 'components.js', 'kit', 'render.sh', 'bg.py']
SKIP = {'out', 'out-light', 'node_modules', 'user-edits', '.DS_Store'}
# категория входа → человеческое имя; всё, что меняет картинку, делает сравнение неконтрольным
CATS = {'markup': 'разметка (slides.js)', 'data': 'бриф и данные (data/)', 'theme': 'тема (theme.json)',
        'deck': 'настройки деки (deck.json)', 'images': 'изображения (img/)', 'other': 'прочие входы',
        'builder': 'сборщик (build.js, lib.js, render.sh, bg.py)', 'components': 'компоненты (components.js, kit/)'}
ENV_SIGNIFICANT = ['os', 'node', 'pptxgenjs', 'chrome', 'fonts', 'render_scale']   # влияют на PPTX и PNG
ENV_CHECKS_ONLY = ['python', 'python_packages', 'checks_skill']                      # влияют только на проверки
# манифест содержания (manifest.json → content): формат и поля, которые сравниваются как правка, а не сборщик
CONTENT_FORMAT = 1
CONTENT_FIELDS = ['archetype', 'lib', 'custom', 'texts', 'notes']
FIELD_NAMES = {'archetype': 'архетип', 'lib': 'компоненты', 'custom': 'причина своего компонента (custom)', 'texts': 'тексты', 'notes': 'заметки'}
FIELD_TYPES = {'archetype': (str, type(None)), 'lib': list, 'custom': (str, type(None)), 'texts': list, 'notes': str}
DISCLAIMER = ('Попиксельное совпадение PNG сравнивает HTML-двойник слайдов, отрендеренный в headless Chrome. Оно не подтверждает, '
              'что PPTX так же откроется в PowerPoint (шрифты, переносы, автоподбор), и не является оценкой качества дизайна: '
              'одинаково плохой слайд совпадёт сам с собой. Изменение пикселей — повод посмотреть слайд, а не вердикт.')


def sha(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for b in iter(lambda: f.read(1 << 20), b''):
            h.update(b)
    return h.hexdigest()


def pptx_content_sha(path):
    # PPTX — zip с датами создания внутри (docProps/core.xml): хэш содержимого без них сравним между сборками
    h = hashlib.sha256()
    with zipfile.ZipFile(path) as z:
        for n in sorted(z.namelist()):
            if n == 'docProps/core.xml':
                continue
            h.update(n.encode()); h.update(hashlib.sha256(z.read(n)).digest())
    return h.hexdigest()


def sh(cmd, **kw):
    r = subprocess.run(cmd, capture_output=True, text=True, **kw)
    return r.returncode, (r.stdout or '') + (r.stderr or '')


def category(rel):
    top = rel.split('/')[0]
    if rel == 'slides.js':
        return 'markup'
    if top == 'data':
        return 'data'
    if rel == 'theme.json':
        return 'theme'
    if rel == 'deck.json':
        return 'deck'
    if top == 'img':
        return 'images'
    if top in ('components.js', 'kit'):
        return 'components'
    if top in ENGINE:
        return 'builder'
    return 'other'


def tree_hashes(root):
    out = {}
    for d, dirs, files in os.walk(root):
        dirs[:] = sorted(x for x in dirs if x not in SKIP)
        for f in sorted(files):
            if f in SKIP:
                continue
            p = os.path.join(d, f)
            if os.path.islink(p):
                continue
            rel = os.path.relpath(p, root).replace(os.sep, '/')
            out[rel] = {'sha256': sha(p), 'category': category(rel)}
    return out


def chrome():
    for c in ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
              os.path.expanduser('~/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),
              '/Applications/Chromium.app/Contents/MacOS/Chromium', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge']:
        if os.access(c, os.X_OK):
            return sh([c, '--version'])[1].strip()
    for c in ('google-chrome', 'chromium', 'chromium-browser'):
        p = shutil.which(c)
        if p:
            return sh([p, '--version'])[1].strip()
    return None


def font_files(family):
    files = []
    if shutil.which('fc-list'):
        _, o = sh(['fc-list', family, 'file', 'family'])
        # точное совпадение семейства: «Styrene A LC» не должен подхватить «Styrene A LC Thin» и наоборот
        files = [ln.split(':')[0].strip() for ln in o.splitlines()
                 if family.lower() in [x.strip().lower() for x in ln.split(':', 1)[-1].split(',')]]
    if not files:
        key = family.replace(' ', '').lower()
        for d in (os.path.expanduser('~/Library/Fonts'), '/Library/Fonts'):
            if os.path.isdir(d):
                files += [os.path.join(d, f) for f in os.listdir(d) if f.replace('-', '').replace('_', '').lower().startswith(key)]
    return {os.path.basename(f): sha(f) for f in sorted(set(files)) if os.path.isfile(f)}


def environment(src_theme):
    pkgs = {}
    for p in ('pillow', 'numpy', 'python-pptx', 'openpyxl'):
        try:
            pkgs[p] = md.version(p)
        except md.PackageNotFoundError:
            pkgs[p] = None
    nm = os.path.join(SKILL, 'node_modules')
    ver = lambda pkg: json.load(open(os.path.join(nm, pkg, 'package.json'))).get('version') if os.path.isfile(os.path.join(nm, pkg, 'package.json')) else None
    fams = {k: v for k, v in (src_theme.get('font') or {}).items() if isinstance(v, str)}
    _, skill_commit = sh(['git', '-C', SKILL, 'rev-parse', 'HEAD'])
    _, dirty = sh(['git', '-C', SKILL, 'status', '--porcelain'])
    return {
        'os': f"macOS {platform.mac_ver()[0]}" if platform.mac_ver()[0] else platform.platform(),
        'node': sh(['node', '-v'])[1].strip(),
        'pptxgenjs': ver('pptxgenjs'),
        'chrome': chrome(),
        'fonts': {fam: font_files(fam) for fam in sorted(set(fams.values()))},
        'render_scale': 1,
        'python': platform.python_version(),
        'python_packages': pkgs,
        'checks_skill': {'version': open(os.path.join(SKILL, 'VERSION')).read().strip(), 'commit': skill_commit.strip()[:12],
                         'dirty': bool(dirty.strip())},
    }


def check(cid, status, tool, scope, notes=''):
    return {'id': cid, 'status': status, 'tool': tool, 'scope': scope, 'notes': notes}


CHECKS_FROM = f"навык {open(os.path.join(SKILL, 'VERSION')).read().strip()}"   # проверки всегда из текущего навыка, сборщик — из прогона


# ═════ run ═════
def cmd_run(a):
    src = os.path.abspath(a.src)
    if not os.path.isfile(os.path.join(src, 'slides.js')):
        sys.exit(f'{src}: не проект деки (нет slides.js)')
    themes = [t.strip() for t in a.themes.split(',') if t.strip()]
    if any(t not in ('dark', 'light') for t in themes):
        sys.exit('--themes: dark, light')
    label = re.sub(r'[^\w.-]+', '_', a.label or a.engine)
    rid = f"{dt.datetime.now().strftime('%Y%m%d-%H%M%S')}_{label}"
    run = os.path.join(os.path.abspath(a.runs), rid)
    os.makedirs(os.path.dirname(run), exist_ok=True)
    os.makedirs(run)                                   # существует — FileExistsError: прошлые прогоны не перезаписываются
    work = os.path.join(run, 'src')
    shutil.copytree(src, work, symlinks=True, ignore=shutil.ignore_patterns(*SKIP))
    eng = {'source': a.engine}
    if a.engine == 'skill':
        for e in ENGINE:
            p, q = os.path.join(SKILL, 'templates', 'deck-starter', e), os.path.join(work, e)
            if os.path.isdir(q):
                shutil.rmtree(q)
            (shutil.copytree if os.path.isdir(p) else shutil.copy2)(p, q)
        _, c = sh(['git', '-C', SKILL, 'rev-parse', 'HEAD'])
        _, d = sh(['git', '-C', SKILL, 'status', '--porcelain', '--', 'templates/deck-starter'])
        eng.update(commit=c.strip()[:12], version=open(os.path.join(SKILL, 'VERSION')).read().strip(), dirty=bool(d.strip()))
    elif a.engine != 'deck':
        rc, c = sh(['git', '-C', SKILL, 'rev-parse', '--verify', f'{a.engine}^{{commit}}'])
        if rc:
            shutil.rmtree(run)
            sys.exit(f'нет версии {a.engine} в {SKILL} (git tag — список версий; git fetch --tags — подтянуть новые)')
        for e in ENGINE:
            q = os.path.join(work, e)
            if os.path.isdir(q):
                shutil.rmtree(q)
            elif os.path.exists(q):
                os.remove(q)
        arch = subprocess.run(['git', '-C', SKILL, 'archive', a.engine, '--'] + [f'templates/deck-starter/{e}' for e in ENGINE],
                              capture_output=True)
        tmp = os.path.join(run, '_engine')
        os.makedirs(tmp)
        subprocess.run(['tar', '-x', '-C', tmp], input=arch.stdout, check=True)
        for e in ENGINE:
            p = os.path.join(tmp, 'templates', 'deck-starter', e)
            if os.path.exists(p):
                shutil.move(p, os.path.join(work, e))
        shutil.rmtree(tmp)
        _, v = sh(['git', '-C', SKILL, 'show', f'{a.engine}:VERSION'])
        eng.update(commit=c.strip()[:12], version=v.strip() or None)
    nm = os.path.join(work, 'node_modules')
    if os.path.lexists(nm):
        os.remove(nm)
    os.symlink(os.path.join(SKILL, 'node_modules'), nm)
    theme = json.load(open(os.path.join(work, 'theme.json'), encoding='utf-8'))
    man = {'id': rid, 'label': label, 'created': dt.datetime.now().isoformat(timespec='seconds'), 'src': src,
           'themes': themes, 'engine': eng, 'environment': environment(theme), 'checks': [], 'slides': {}, 'outputs': {}}
    C = man['checks']
    if a.regen_bg:
        rc, o = sh([PY, '-I', 'bg.py'], cwd=work)
        C.append(check('bg', 'passed' if rc == 0 else 'failed', 'bg.py (версия сборщика из прогона)', 'подложки img/bg_*.jpg', o.strip()[-300:]))
    else:
        C.append(check('bg', 'skipped', 'bg.py', 'подложки img/bg_*.jpg', 'подложки взяты из img/ проекта как есть; --regen-bg перерисует их сборщиком прогона'))
    man['inputs'] = tree_hashes(work)                  # входы и сборщик — после подмены, ровно то, из чего собрано
    os.makedirs(os.path.join(run, 'pptx'))
    name = json.load(open(os.path.join(work, 'deck.json'), encoding='utf-8')).get('name', 'deck')
    for th in themes:
        out = 'out-light' if th == 'light' else 'out'
        pptx = os.path.join(run, 'pptx', f"{re.sub(r'[^\w.-]+', '_', name)}_{th}.pptx")
        rc, o = sh(['node', 'build.js'], cwd=work, env={**os.environ, 'THEME': th, 'OUTFILE': pptx})
        C.append(check(f'build-{th}', 'passed' if rc == 0 and os.path.isfile(pptx) else 'failed', 'node build.js (pptxgenjs)',
                       f'вся дека, тема {th}', o.strip().splitlines()[-1][:300] if o.strip() else ''))
        if rc:
            C.append(check(f'render-{th}', 'not_run', 'render.sh (headless Chrome)', f'тема {th}', 'сборка не удалась'))
            continue
        man['outputs'][f'pptx-{th}'] = {'file': os.path.relpath(pptx, run), 'sha256': sha(pptx), 'content_sha256': pptx_content_sha(pptx)}
        rc, o = sh(['zsh', './render.sh'], cwd=work, env={**os.environ, 'OUT': out})
        m = re.search(r'\{"slides".*\}', o)
        metr = json.loads(m.group(0)) if m else {}
        pngs = sorted((f for f in os.listdir(os.path.join(work, out, 'png')) if re.fullmatch(r's\d+\.png', f)), key=lambda f: int(f[1:-4])) \
            if os.path.isdir(os.path.join(work, out, 'png')) else []
        dst = os.path.join(run, 'png', th)
        os.makedirs(dst)
        for f in pngs:
            shutil.copy2(os.path.join(work, out, 'png', f), os.path.join(dst, f))
        man['slides'][th] = {f[:-4]: sha(os.path.join(dst, f)) for f in pngs}
        ok = rc == 0 and metr.get('slides') == len(pngs) and len(pngs) > 0
        C.append(check(f'render-{th}', 'passed' if ok else 'failed', 'render.sh (headless Chrome, 1920×1080)', f'{len(pngs)} слайдов, тема {th}',
                       '' if ok else f'код {rc}, слайдов в HTML {metr.get("slides")}, PNG {len(pngs)}'))
        C.append(check(f'font-{th}', 'passed' if metr.get('font') else 'failed' if metr else 'not_run', 'render.sh: document.fonts.check',
                       f'шрифт «{theme["font"]["regular"]}», тема {th}', '' if metr.get('font') else 'шрифт бренда не загрузился: рендер на запасном шрифте'))
        ov = metr.get('overflow')
        C.append(check(f'overflow-{th}', 'not_run' if ov is None else 'passed' if not ov else 'failed', 'render.sh: замер боксов',
                       f'все тексты, тема {th}', '' if not ov else '; '.join(ov)[:400]))
        rc, o = sh([PY, '-I', os.path.join(SKILL, 'scripts', 'pptx_audit.py'), pptx])
        last = o.strip().splitlines()[-1] if o.strip() else ''
        C.append(check(f'audit-{th}', 'passed' if rc == 0 and ', ошибок 0, предупреждений 0' in last else 'warning' if rc == 0 else 'failed',
                       f'pptx_audit.py, {CHECKS_FROM} (сетка, кегли, поля)', f'PPTX целиком, тема {th}', last[:300]))
    if any(c['id'].startswith('build-') and c['status'] == 'passed' for c in C):
        rc, o = sh([PY, '-I', os.path.join(SKILL, 'scripts', 'facts_check.py'), 'out/facts.json', '--root', '.', '--html', 'out/deck.html'], cwd=work)
        C.append(check('facts', 'passed' if rc == 0 else 'failed', f'facts_check.py, {CHECKS_FROM} (текстовые источники; модель xlsx не подключалась)',
                       'все числа деки', (o.strip().splitlines() or [''])[-1][:300]))
        rc, o = sh([PY, '-I', os.path.join(SKILL, 'scripts', 'library_check.py'), '.'], cwd=work)
        C.append(check('library', 'passed' if rc == 0 else 'failed', f'library_check.py, {CHECKS_FROM}', 'содержательные слайды',
                       (o.strip().splitlines() or [''])[-1][:300] + ('' if rc == 0 else '. Сборщик до 1.6.0 не помечает компоненты, у старых версий эта проверка не проходит по определению')))
    # содержание по слайдам: компоненты, тексты, заметки — чтобы сравнение отделило правки от сборщика.
    # Пишем только поля, которые сборщик отдал: отсутствующее поле ≠ пустое (сборщик до 1.6.0 не пишет тексты и компоненты)
    mp = os.path.join(work, 'out', 'slides.json')
    if os.path.isfile(mp):
        raw = json.load(open(mp, encoding='utf-8'))
        has = [f for f in CONTENT_FIELDS if all(f in x for x in raw)]
        man['content'] = {str(x['n']): {**{f: x[f] for f in has if f != 'texts'}, 'title': x.get('title', ''),
                                        **({'texts': [''.join(t['runs']) for t in x['texts']]} if 'texts' in has else {})} for x in raw}
        lost = [f for f in CONTENT_FIELDS if f not in has]
        man['content_manifest'] = {'format': CONTENT_FORMAT, 'source': 'out/slides.json', 'fields': has,
                                   'note': f"сборщик {eng.get('version') or eng['source']} не записал в out/slides.json: {', '.join(FIELD_NAMES[f] for f in lost)}" if lost else ''}
    else:
        man['content_manifest'] = {'format': CONTENT_FORMAT, 'source': None, 'fields': [],
                                   'note': 'нет out/slides.json: сборка не удалась или сборщик его не пишет'}
    if os.path.isfile(os.path.join(work, 'requirements.json')) and man['outputs']:
        cmap = os.path.join(src, 'out', 'coverage.json')
        if os.path.isfile(cmap):                       # карта покрытия лежит в out/ проекта: копия в прогоне, чтобы проверку можно было повторить
            shutil.copy2(cmap, os.path.join(run, 'coverage-map.json'))
            cmap = os.path.join(run, 'coverage-map.json')
            man['coverage_map'] = {'file': 'coverage-map.json', 'sha256': sha(cmap)}
        pp = os.path.join(run, man['outputs'][sorted(man['outputs'])[0]]['file'])
        cmd = [PY, '-I', os.path.join(SKILL, 'scripts', 'brief_coverage.py'), 'check', '.', '--pptx', pp] + (['--map', cmap] if os.path.isfile(cmap) else [])
        rc, o = sh(cmd, cwd=work)
        C.append(check('coverage', 'passed' if rc == 0 else 'failed', f'brief_coverage.py, {CHECKS_FROM}',
                       'требования брифа (requirements.json) на слайдах и в заметках', (o.strip().splitlines() or [''])[-1].split(' — ')[0][:300]
                       + ('' if os.path.isfile(cmap) else '; карты покрытия проекта нет (out/coverage.json)')))
    C.append(check('powerpoint', 'not_run', 'Microsoft PowerPoint', 'вся презентация', 'в этом прогоне PPTX в PowerPoint не открывался'))
    json.dump(man, open(os.path.join(run, 'manifest.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    bad = [c['id'] for c in C if c['status'] == 'failed']
    print(f"прогон: {run}\n  сборщик: {eng['source']} {eng.get('version') or ''} {eng.get('commit') or ''}".rstrip())
    print('  слайдов: ' + (', '.join(f'{th} {len(v)}' for th, v in man['slides'].items()) or 'нет PNG') + (f"; не прошли: {', '.join(bad)}" if bad else '; проверки без ошибок'))
    for c in C:
        if c['status'] == 'failed' and c['id'].startswith('build-'):
            print(f"  {c['id']}: {c['notes']}")
    return 0


# ═════ compare ═════
def label_font(size):
    from PIL import ImageFont
    for f in ('/System/Library/Fonts/Supplemental/Arial.ttf', '/Library/Fonts/Arial.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'):
        if os.path.isfile(f):
            return ImageFont.truetype(f, size)
    return ImageFont.load_default()


def pair_images(pa, pb, title, sub, out_pair, out_diff):
    from PIL import Image, ImageChops, ImageDraw
    blank = lambda: Image.new('RGB', (1920, 1080), (60, 60, 60))
    A = Image.open(pa).convert('RGB') if pa else blank()
    B = Image.open(pb).convert('RGB') if pb else blank()
    res = {}
    if pa and pb and A.size == B.size:
        d = ImageChops.difference(A, B)
        bbox = d.getbbox()
        mask = d.convert('L').point(lambda v: 255 if v else 0)
        changed = mask.histogram()[255]
        res = {'changed_pixels': changed, 'changed_share': round(changed / (A.width * A.height), 6), 'bbox': list(bbox) if bbox else None}
        base = B.convert('L').point(lambda v: int(v * 0.35)).convert('RGB')
        Image.composite(Image.new('RGB', B.size, (255, 0, 200)), base, mask).save(out_diff)
    elif pa and pb:
        res = {'size_mismatch': [list(A.size), list(B.size)]}
    tw = 960
    a2, b2 = A.copy(), B.copy()
    a2.thumbnail((tw, tw)); b2.thumbnail((tw, tw))
    h = max(a2.height, b2.height)
    sheet = Image.new('RGB', (tw * 2 + 24, h + 64), (32, 32, 32))
    sheet.paste(a2, (0, 64)); sheet.paste(b2, (tw + 24, 64))
    dr = ImageDraw.Draw(sheet)
    f = label_font(22)
    dr.text((8, 8), title[0], fill=(235, 235, 235), font=f)
    dr.text((tw + 32, 8), title[1], fill=(235, 235, 235), font=f)
    dr.text((8, 36), sub, fill=(255, 120, 200) if 'измен' in sub or 'нет' in sub else (150, 220, 150), font=label_font(18))
    sheet.save(out_pair)
    return res


def diff_maps(a, b):
    keys = sorted(set(a) | set(b))
    return [k for k in keys if a.get(k) != b.get(k)]


def legacy_fields(run, C):
    # прогон до формата манифеста: отсутствующие поля записаны пустыми. Какие поля сборщик на самом деле отдал —
    # по out/slides.json, сохранённому в src/ прогона; нет его — по самому содержанию (все пусты — значит, не записаны)
    try:
        raw = json.load(open(os.path.join(run, 'src', 'out', 'slides.json'), encoding='utf-8'))
        return [f for f in CONTENT_FIELDS if all(f in x for x in raw)]
    except (OSError, ValueError, TypeError):
        pass
    vals = [v for v in C.values() if isinstance(v, dict)] if isinstance(C, dict) else []
    drop = ({'lib', 'custom', 'texts'} if vals and not any(v.get('texts') for v in vals) else set()) | \
           ({'notes'} if vals and not any(v.get('notes') for v in vals) else set())
    return [f for f in CONTENT_FIELDS if f not in drop]


def content_side(M, run):
    # содержание одного прогона для сравнения. content None — сравнивать нечего; это не «пустое содержание»
    info, C = M.get('content_manifest'), M.get('content')
    side = {'format': None, 'fields': [], 'note': '', 'content': None, 'reason': None}
    if info is None:
        if C is None:
            return {**side, 'reason': 'в манифесте нет содержания слайдов (прогон без out/slides.json)'}
        side.update(format='до формата 1', fields=legacy_fields(run, C))
        lost = [FIELD_NAMES[f] for f in CONTENT_FIELDS if f not in side['fields']]
        side['note'] = f"старый манифест: сборщик {M['engine'].get('version') or M['engine']['source']} не записал {', '.join(lost)}" if lost else ''
    elif not isinstance(info, dict) or info.get('format') != CONTENT_FORMAT:
        fmt = info.get('format') if isinstance(info, dict) else info
        return {**side, 'format': fmt, 'reason': f'формат манифеста содержания {fmt} не поддерживается (эта версия читает {CONTENT_FORMAT})'}
    else:
        side.update(format=CONTENT_FORMAT, fields=[f for f in info.get('fields') or [] if f in CONTENT_FIELDS], note=info.get('note') or '')
        if C is None:
            return {**side, 'reason': side['note'] or 'манифест содержания объявлен, а содержания в нём нет'}
    if 'texts' not in side['fields']:
        return {**side, 'reason': side['note'] or 'в манифесте нет текстов слайдов'}
    if not isinstance(C, dict):
        return {**side, 'reason': 'частичная структура: content — не словарь слайдов'}
    for k, v in C.items():
        if not str(k).isdigit() or not isinstance(v, dict):
            return {**side, 'reason': f'частичная структура: запись «{k}» — не слайд'}
        miss = [FIELD_NAMES[f] for f in side['fields'] if f not in v]
        bad = [FIELD_NAMES[f] for f in side['fields'] if f in v and (not isinstance(v[f], FIELD_TYPES[f]) or
               isinstance(v[f], list) and not all(isinstance(t, str) for t in v[f]))]
        if miss or bad:
            return {**side, 'reason': f'частичная структура: слайд {k}' + (f", нет полей: {', '.join(miss)}" if miss else '')
                    + (f", поля не того типа: {', '.join(bad)}" if bad else '')}
    return {**side, 'content': C}


def cmd_compare(a):
    ra, rb = os.path.abspath(a.a), os.path.abspath(a.b)
    for r in (ra, rb):
        if not os.path.isfile(os.path.join(r, 'manifest.json')):
            sys.exit(f'{r}: не прогон version_compare.py run (нет manifest.json)')
    MA, MB = (json.load(open(os.path.join(r, 'manifest.json'), encoding='utf-8')) for r in (ra, rb))
    out = os.path.abspath(a.out or os.path.join(os.path.dirname(rb), f"compare_{MA['id']}__vs__{MB['id']}"))
    os.makedirs(out)                                   # существует — FileExistsError: прошлые сравнения не перезаписываются
    os.makedirs(os.path.join(out, 'pairs')); os.makedirs(os.path.join(out, 'diff'))
    # что изменилось во входах
    ia, ib = MA['inputs'], MB['inputs']
    changed_inputs = []
    for rel in sorted(set(ia) | set(ib)):
        x, y = ia.get(rel), ib.get(rel)
        if (x or {}).get('sha256') != (y or {}).get('sha256'):
            changed_inputs.append({'file': rel, 'category': (x or y)['category'], 'change': 'добавлен' if not x else 'удалён' if not y else 'изменён'})
    by_cat = {}
    for c in changed_inputs:
        by_cat.setdefault(c['category'], []).append(c['file'])
    # что изменилось в среде
    ea, eb = MA['environment'], MB['environment']
    env_changes = []
    for k in ENV_SIGNIFICANT + ENV_CHECKS_ONLY:
        if ea.get(k) != eb.get(k):
            if k == 'fonts':
                det = '; '.join(f'{fam}: файлы {", ".join(diff_maps(ea[k].get(fam, {}), eb[k].get(fam, {}))) or "—"}'
                                for fam in sorted(set(ea[k]) | set(eb[k])) if ea[k].get(fam) != eb[k].get(fam))
            elif isinstance(ea.get(k), dict):
                det = ', '.join(f'{kk}: {(ea.get(k) or {}).get(kk)} → {(eb.get(k) or {}).get(kk)}' for kk in diff_maps(ea.get(k) or {}, eb.get(k) or {}))
            else:
                det = f'{ea.get(k)} → {eb.get(k)}'
            env_changes.append({'item': k, 'significant': k in ENV_SIGNIFICANT, 'detail': det})
    # контрольное ли сравнение: меняться может только сборщик и компоненты (версия навыка)
    input_reasons = [f'{CATS[c]}: {", ".join(f[:6])}{" …" if len(f) > 6 else ""}' for c, f in by_cat.items() if c not in ('builder', 'components')]
    env_reasons = [f'{e["item"]}: {e["detail"]}' for e in env_changes if e['significant']]
    engine_changed = bool(set(by_cat) & {'builder', 'components'})
    controlled = not input_reasons and not env_reasons
    kind = ('контрольное сравнение версий навыка' if controlled and engine_changed else
            'контрольная повторная сборка (проверка воспроизводимости)' if controlled else 'неконтрольное сравнение')
    # слайды
    themes = sorted(set(MA['slides']) | set(MB['slides']), key=lambda t: ('dark', 'light').index(t))
    la = f"A: {MA['label']} ({MA['engine'].get('version') or MA['engine']['source']})"
    lb = f"B: {MB['label']} ({MB['engine'].get('version') or MB['engine']['source']})"
    rows = []
    for th in themes:
        sa, sb = MA['slides'].get(th, {}), MB['slides'].get(th, {})
        for k in sorted(set(sa) | set(sb), key=lambda s: int(s[1:])):
            pa = os.path.join(ra, 'png', th, f'{k}.png') if k in sa else None
            pb = os.path.join(rb, 'png', th, f'{k}.png') if k in sb else None
            status = 'missing_in_A' if not pa else 'missing_in_B' if not pb else 'identical' if sa[k] == sb[k] else 'changed'
            stem = f'{th}_{k}'
            sub = {'identical': 'совпадает попиксельно', 'missing_in_A': 'нет в A', 'missing_in_B': 'нет в B'}.get(status, 'изменился')
            res = pair_images(pa, pb, (la, lb), f'{th}, слайд {k[1:]}: {sub}', os.path.join(out, 'pairs', f'{stem}.png'), os.path.join(out, 'diff', f'{stem}.png'))
            if status == 'changed' and res.get('changed_pixels') == 0:
                status = 'identical'                   # PNG-файлы различаются метаданными, пиксели те же
            rows.append({'theme': th, 'slide': int(k[1:]), 'status': status, 'pair': f'pairs/{stem}.png',
                         'diff': f'diff/{stem}.png' if os.path.isfile(os.path.join(out, 'diff', f'{stem}.png')) else None, **res})
    # содержание слайдов: что поменяли правкой (компоненты, тексты, заметки), а не сборщиком
    # Наличие и формат манифеста проверяются отдельно от значений: нет сопоставимых данных с одной стороны — содержание
    # не сравнивается вовсе, ничего не считается добавленным или удалённым; вердикты по входам, пикселям, PPTX и среде не трогаем
    SA, SB = content_side(MA, ra), content_side(MB, rb)
    cok = SA['content'] is not None and SB['content'] is not None
    fields = [f for f in CONTENT_FIELDS if f in SA['fields'] and f in SB['fields']] if cok else []
    CA, CB = (SA['content'], SB['content']) if cok else ({}, {})
    comp = lambda v: '+'.join(v.get('lib') or []) or v.get('custom') or '—'
    content = {}
    for k in sorted(set(CA) | set(CB), key=int):
        x, y = CA.get(k), CB.get(k)
        ch = []
        if x is None or y is None:
            ch.append('слайд добавлен' if x is None else 'слайд удалён')
        else:
            if any(f in fields and x[f] != y[f] for f in ('lib', 'custom')):
                ch.append(f'компоненты: {comp(x)} → {comp(y)}')
            if 'archetype' in fields and x['archetype'] != y['archetype']:
                ch.append(f"архетип: {x['archetype']} → {y['archetype']}")
            gone, new = [t for t in x['texts'] if t not in y['texts']], [t for t in y['texts'] if t not in x['texts']]
            if gone or new:
                ch.append(f'текст: убрано {len(gone)}, добавлено {len(new)}')
            if 'notes' in fields and x['notes'] != y['notes']:
                ch.append('заметки изменены')
        content[k] = {'changes': ch, 'gone': [t for t in (x or {}).get('texts', []) if t not in (y or {}).get('texts', [])][:8],
                      'new': [t for t in (y or {}).get('texts', []) if t not in (x or {}).get('texts', [])][:8]}
    for r_ in rows:
        r_['content'] = content.get(str(r_['slide']), {}).get('changes', []) if cok else None
    edit_inputs = [c['file'] for c in changed_inputs if c['category'] not in ('builder', 'components')]
    content_cmp = {'comparable': cok, 'fields': fields, 'inputs_equal': not edit_inputs,
                   'reason': None if cok else '; '.join(f"{n}: {s['reason']}" for n, s in (('A', SA), ('B', SB)) if s['content'] is None),
                   'skipped': [f"{FIELD_NAMES[f]} (нет в {'A' if f not in SA['fields'] else 'B'})" for f in CONTENT_FIELDS if f not in fields] if cok else [],
                   **{n: {k: s[k] for k in ('format', 'fields', 'note', 'reason')} for n, s in (('A', SA), ('B', SB))}}
    cnt = {s: sum(1 for r in rows if r['status'] == s) for s in ('identical', 'changed', 'missing_in_A', 'missing_in_B')}
    # проверки: из обоих прогонов и проверки самого сравнения
    checks = [dict(c, run='A') for c in MA['checks']] + [dict(c, run='B') for c in MB['checks']]
    pix_status = 'passed' if cnt['changed'] == cnt['missing_in_A'] == cnt['missing_in_B'] == 0 else 'failed' if cnt['missing_in_A'] or cnt['missing_in_B'] else 'warning'
    checks.append(dict(check('pixels', pix_status, 'Pillow ImageChops.difference', f'{len(rows)} пар PNG ({", ".join(themes)})',
                             f"совпали {cnt['identical']}, изменились {cnt['changed']}, нет в A {cnt['missing_in_A']}, нет в B {cnt['missing_in_B']}"), run='A↔B'))
    checks.append(dict(check('control', 'passed' if controlled else 'failed', 'контрольные суммы входов и описание среды', 'входы, шрифты, браузер, node, pptxgenjs, ОС',
                             kind + ('' if controlled else ': ' + '; '.join(input_reasons + env_reasons))), run='A↔B'))
    pa_ = MA['outputs'].keys() & MB['outputs'].keys()
    same_pptx = [k for k in sorted(pa_) if MA['outputs'][k]['content_sha256'] == MB['outputs'][k]['content_sha256']]
    checks.append(dict(check('pptx-content', 'passed' if pa_ and len(same_pptx) == len(pa_) else 'warning' if pa_ else 'not_run',
                             'sha256 содержимого PPTX без docProps/core.xml', ', '.join(sorted(pa_)) or 'нет PPTX в обоих прогонах',
                             f"совпали: {', '.join(same_pptx) or 'нет'}" + ('' if len(same_pptx) == len(pa_) else '; XML слайдов различается: смотрите PowerPoint, PNG этого не покажут')), run='A↔B'))
    ned = sum(1 for v in content.values() if v['changes'])
    checks.append(dict(check('content', 'passed' if cok else 'not_run', 'манифест содержания (manifest.json → content из out/slides.json)',
                             'тексты, компоненты, архетипы и заметки по слайдам',
                             f"сравнены поля: {', '.join(FIELD_NAMES[f] for f in fields)}; слайдов с правкой {ned}"
                             + (f"; не сравнивались: {', '.join(content_cmp['skipped'])}" if content_cmp['skipped'] else '') if cok else
                             f"содержание не удалось сравнить: {content_cmp['reason']}"), run='A↔B'))
    if a.ppt_viewed:
        sel = {}
        for part in a.ppt_viewed.split(';'):
            th, _, nums = part.partition(':')
            sel[th.strip()] = sorted({int(n) for n in re.findall(r'\d+', nums)})
        total = {th: len(MB['slides'].get(th, {})) for th in sel}
        scope = '; '.join(f"тема {th}: слайды {', '.join(map(str, ns))} из {total[th]}" for th, ns in sel.items())
        checks = [c for c in checks if not (c['id'] == 'powerpoint' and c['run'] == 'B')]
        checks.append(dict(check('powerpoint', 'passed', 'Microsoft PowerPoint, просмотр вручную', f'прогон B, {scope}',
                                 (a.ppt_notes + '. ' if a.ppt_notes else '') + 'Просмотрены только перечисленные слайды; это не проверка всей презентации.'), run='B'))
    rep = {'created': dt.datetime.now().isoformat(timespec='seconds'), 'A': {k: MA[k] for k in ('id', 'label', 'engine')}, 'B': {k: MB[k] for k in ('id', 'label', 'engine')},
           'kind': kind, 'controlled': controlled, 'engine_changed': engine_changed, 'reasons_not_controlled': input_reasons + env_reasons,
           'changed_inputs': changed_inputs, 'environment_changes': env_changes, 'counts': cnt, 'slides': rows, 'checks': checks, 'disclaimer': DISCLAIMER,
           'content': content, 'content_compare': content_cmp,
           'components': {n: {k: v['lib'] or ([f"custom: {v['custom']}"] if v.get('custom') else []) for k, v in C_.items()} if 'lib' in fields else {}
                          for n, C_ in (('A', CA), ('B', CB))}}
    json.dump(rep, open(os.path.join(out, 'report.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    open(os.path.join(out, 'report.md'), 'w', encoding='utf-8').write(report_md(rep, ra, rb))
    print(f'сравнение: {out}\n  {kind}; пар {len(rows)}: совпали {cnt["identical"]}, изменились {cnt["changed"]}, '
          f'нет в A {cnt["missing_in_A"]}, нет в B {cnt["missing_in_B"]}')
    for r in rep['reasons_not_controlled']:
        print('  не контрольное:', r)
    if not cok:
        print('  содержание не удалось сравнить:', content_cmp['reason'])
    return 0


ST = {'passed': 'пройдена', 'failed': 'не пройдена', 'warning': 'есть замечания', 'skipped': 'пропущена', 'not_run': 'не выполнялась'}


def report_md(r, ra, rb):
    eng = lambda m: f"{m['engine']['source']}" + (f", версия {m['engine']['version']}" if m['engine'].get('version') else '') + \
        (f", коммит {m['engine']['commit']}" if m['engine'].get('commit') else '') + (' (с незакоммиченными правками)' if m['engine'].get('dirty') else '')
    c = r['counts']
    L = [f"# Сравнение прогонов: {r['A']['label']} → {r['B']['label']}", '',
         f"- **A:** `{r['A']['id']}` — сборщик {eng(r['A'])} (`{ra}`)",
         f"- **B:** `{r['B']['id']}` — сборщик {eng(r['B'])} (`{rb}`)", '',
         f"## Вывод: {r['kind']}", '']
    if r['controlled'] and c['changed']:
        L.append(f"Входы и среда совпадают, поэтому различия на {c['changed']} слайдах вызваны сборщиком или компонентами. "
                 'Это не автоматически регрессия: посмотрите пары и решите, намеренное ли это изменение.')
    elif r['controlled']:
        L.append('Входы и среда совпадают, все слайды совпали попиксельно.')
    else:
        L.append('Изменились входы или значимая среда, поэтому различия нельзя приписать версии навыка и нельзя считать регрессией навыка:')
        L += [f'- {x}' for x in r['reasons_not_controlled']]
    L += ['', '## Слайды', '', f"Пар: {len(r['slides'])}. Совпали попиксельно: {c['identical']}. Изменились: {c['changed']}. "
          f"Нет в A: {c['missing_in_A']}. Нет в B: {c['missing_in_B']}.", '',
          '| Тема | Слайд | Статус | Изменено пикселей | Содержание (правка, не сборщик) | Пара | Разница |', '|---|---|---|---|---|---|---|']
    cc_ = r.get('content_compare') or {}
    cmpc = cc_.get('comparable') is False             # отчёты до формата манифеста этого ключа не имеют
    sname = {'identical': 'совпадает', 'changed': '**изменился**', 'missing_in_A': '**нет в A**', 'missing_in_B': '**нет в B**'}
    for s in r['slides']:
        px = f"{s['changed_pixels']} ({s['changed_share'] * 100:.3f}%)" if 'changed_pixels' in s else ('размер разный' if s.get('size_mismatch') else '—')
        dl = f"[разница]({s['diff']})" if s.get('diff') else '—'
        cc = ('не сравнивалось' if cmpc else '—') if s.get('content') is None else '; '.join(s['content']) or 'не менялось'
        L.append(f"| {s['theme']} | {s['slide']} | {sname[s['status']]} | {px} | {cc} | [пара]({s['pair']}) | {dl} |")
    edited = sorted({s['slide'] for s in r['slides'] if s.get('content')})
    engine_only = sorted({s['slide'] for s in r['slides'] if s['status'] == 'changed' and s.get('content') == []})
    if r.get('content'):
        L += ['', f"Слайды с правкой содержания (тексты, компоненты, заметки): {', '.join(map(str, edited)) or 'нет'}. "
              f"Их различия — следствие правки, а не версии навыка. Изменились без правки содержания: {', '.join(map(str, engine_only)) or 'нет'}"
              + ('' if r['controlled'] else ' (сравнение неконтрольное: причиной может быть и тема, изображения или среда)') + '.']
    if cc_.get('skipped'):
        L += ['', f"Не сравнивались: {', '.join(cc_['skipped'])}. Их правка в отчёт не попадёт."]
    comp = r.get('components') or {}
    if comp.get('B'):
        L += ['', '## Компоненты по слайдам', '', '| Слайд | A | B |', '|---|---|---|']
        for k in sorted(set(comp.get('A', {})) | set(comp['B']), key=int):
            a_, b_ = '+'.join(comp.get('A', {}).get(k, [])) or '—', '+'.join(comp['B'].get(k, [])) or '—'
            L.append(f"| {k} | {a_} | {b_ if b_ == a_ else '**' + b_ + '**'} |")
    ed = {k: v for k, v in (r.get('content') or {}).items() if v['changes']}
    if cmpc:
        L += ['', '## Изменения содержания (редакционные)', '', f"Содержание не удалось сравнить: {cc_['reason']}.",
              '', 'Отсутствие данных не считается пустым содержанием: ни тексты, ни компоненты, ни заметки не помечены добавленными или '
              'удалёнными. Вердикты по входам, пикселям, содержимому PPTX и среде от этого не зависят.']
        if cc_.get('inputs_equal'):
            L.append('Входы проекта (разметка, данные, тема, настройки, изображения) совпадают по контрольным суммам: '
                     'редакционных правок между прогонами не было.')
    elif ed:
        L += ['', '## Изменения содержания (редакционные)', '']
        for k, v in ed.items():
            L.append(f"- **Слайд {k}:** {'; '.join(v['changes'])}")
            L += [f"  - убрано: «{t[:90]}»" for t in v['gone']] + [f"  - добавлено: «{t[:90]}»" for t in v['new']]
    L += ['', '## Что изменилось во входах', '']
    L += [f"- {CATS[x['category']]}: `{x['file']}` — {x['change']}" for x in r['changed_inputs']] or ['Ничего: все входы и сборщик совпадают по контрольным суммам.']
    L += ['', '## Что изменилось в среде', '']
    L += [f"- {x['item']}{'' if x['significant'] else ' (влияет только на проверки)'}: {x['detail']}" for x in r['environment_changes']] or ['Ничего: ОС, node, pptxgenjs, Chrome, шрифты и версии проверок совпадают.']
    L += ['', '## Проверки', '', 'Пропущенная или не выполнявшаяся проверка не считается пройденной.', '',
          '| Прогон | Проверка | Статус | Инструмент | Область | Замечания |', '|---|---|---|---|---|---|']
    for k in r['checks']:
        L.append(f"| {k['run']} | {k['id']} | {ST[k['status']]} | {k['tool']} | {k['scope']} | {(k['notes'] or '').replace('|', '/')} |")
    L += ['', '## Ограничения', '', r['disclaimer'], '']
    return '\n'.join(L)


ap = argparse.ArgumentParser()
sp = ap.add_subparsers(dest='cmd', required=True)
r = sp.add_parser('run')
r.add_argument('src'); r.add_argument('--runs', required=True); r.add_argument('--engine', default='deck')
r.add_argument('--label'); r.add_argument('--themes', default='dark,light'); r.add_argument('--regen-bg', action='store_true')
c = sp.add_parser('compare')
c.add_argument('a'); c.add_argument('b'); c.add_argument('--out'); c.add_argument('--ppt-viewed'); c.add_argument('--ppt-notes')
args = ap.parse_args()
try:
    sys.exit(cmd_run(args) if args.cmd == 'run' else cmd_compare(args))
except FileExistsError as e:
    sys.exit(f'папка уже есть, не перезаписываю: {e.filename}')
