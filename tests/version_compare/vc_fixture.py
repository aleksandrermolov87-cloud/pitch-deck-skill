# Синтетические прогоны version_compare.py для регрессионных тестов сравнения содержания (tests/version_compare/run.sh).
#   vc_fixture.py build <case.json> <папка>    создаёт <папка>/A и <папка>/B: manifest.json, png/<тема>/s<N>.png, src/out/slides.json
#   vc_fixture.py expect <case.json> <папка сравнения>   сверяет report.json и report.md с ожиданиями кейса; код 1 при расхождении
# Ни сборки, ни Chrome: прогоны собираются из fixtures/base.json и описания стороны в кейсе.
import copy
import hashlib
import json
import os
import sys
from io import BytesIO

HERE = os.path.dirname(os.path.abspath(__file__))
BASE = json.load(open(os.path.join(HERE, 'fixtures', 'base.json'), encoding='utf-8'))


def sha(b):
    return hashlib.sha256(b).hexdigest()


def png(seed):
    # одинаковое зерно — байт в байт одинаковый PNG
    from PIL import Image, ImageDraw
    h = hashlib.sha256(seed.encode()).digest()
    im = Image.new('RGB', (192, 108), (h[0], h[1], h[2]))
    ImageDraw.Draw(im).rectangle((20, 20, 20 + h[3] % 120, 60), fill=(h[4], h[5], h[6]))
    buf = BytesIO()
    im.save(buf, 'PNG')
    return buf.getvalue()


def side(spec, run, name):
    m = copy.deepcopy(BASE['manifest'])
    m.update(id=f'case_{name}', label=name, engine=spec.get('engine', BASE['engines']['new']))
    if isinstance(m['engine'], str):
        m['engine'] = BASE['engines'][m['engine']]
    for rel, seed in {**BASE['inputs'], **spec.get('inputs', {})}.items():
        cat = 'markup' if rel == 'slides.js' else 'builder' if rel == 'build.js' else 'components' if rel == 'components.js' else 'data'
        m['inputs'][rel] = {'sha256': sha(seed.encode()), 'category': cat}
    m['outputs'] = {f'pptx-{th}': {'file': f'pptx/deck_{th}.pptx', 'sha256': sha(f"{name}{th}".encode()),
                                   'content_sha256': sha(f"{spec.get('pptx', 'same')}{th}".encode())} for th in m['themes']}
    seeds = {**BASE['png'], **spec.get('png', {})}
    for th in m['themes']:
        os.makedirs(os.path.join(run, 'png', th))
        m['slides'][th] = {}
        for k, seed in seeds.items():
            b = png(f'{seed}/{th}')
            open(os.path.join(run, 'png', th, f'{k}.png'), 'wb').write(b)
            m['slides'][th][k] = sha(b)
    c = spec.get('content', 'full')
    if c is not None:
        c = copy.deepcopy(BASE['content'][c] if isinstance(c, str) else c)
        for k, f, v in spec.get('patch', []):
            if v == '__del__':
                c[k].pop(f, None)
            else:
                c[k][f] = v
        m['content'] = c
    cm = spec.get('content_manifest', 'full')
    if cm is not None:
        m['content_manifest'] = BASE['content_manifest'][cm] if isinstance(cm, str) else cm
    sj = spec.get('src_slides_json')
    if sj:
        os.makedirs(os.path.join(run, 'src', 'out'))
        json.dump(BASE['slides_json'][sj], open(os.path.join(run, 'src', 'out', 'slides.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    json.dump(m, open(os.path.join(run, 'manifest.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


def build(case, out):
    C = json.load(open(case, encoding='utf-8'))
    for n in ('A', 'B'):
        os.makedirs(os.path.join(out, n))
        side(C[n], os.path.join(out, n), n)


def expect(case, cmp_):
    E = json.load(open(case, encoding='utf-8'))['expect']
    R = json.load(open(os.path.join(cmp_, 'report.json'), encoding='utf-8'))
    md = open(os.path.join(cmp_, 'report.md'), encoding='utf-8').read()
    errs = []
    cc = R.get('content_compare') or {}
    if 'comparable' in E and cc.get('comparable') is not E['comparable']:
        errs.append(f"содержание сравнимо: {cc.get('comparable')}, ожидалось {E['comparable']} ({cc.get('reason')})")
    if 'reason' in E and E['reason'] not in (cc.get('reason') or ''):
        errs.append(f"причина «{cc.get('reason')}» без «{E['reason']}»")
    if 'kind' in E and E['kind'] != R['kind']:
        errs.append(f"вывод «{R['kind']}», ожидался «{E['kind']}»")
    for cid, st in E.get('checks', {}).items():
        got = [c['status'] for c in R['checks'] if c['id'] == cid and c['run'] == 'A↔B']
        if got != [st]:
            errs.append(f'проверка {cid}: {got}, ожидалась {st}')
    for k, ch in E.get('changes', {}).items():
        got = (R['content'].get(k) or {}).get('changes')
        if got != ch:
            errs.append(f'слайд {k}: изменения {got}, ожидались {ch}')
    if E.get('no_changes'):
        got = {k: v['changes'] for k, v in R['content'].items() if v['changes']}
        rows = [r['content'] for r in R['slides'] if r['content']]
        if got or rows:
            errs.append(f'ожидалось без правок содержания, а есть: {got or rows}')
    for s in E.get('md_has', []):
        if s not in md:
            errs.append(f'в report.md нет «{s}»')
    for s in E.get('md_not', []):
        if s in md:
            errs.append(f'в report.md лишнее «{s}»')
    for e in errs:
        print('    ' + e)
    return 1 if errs else 0


if __name__ == '__main__':
    cmd, case, out = sys.argv[1:4]
    sys.exit(build(case, out) if cmd == 'build' else expect(case, out))
