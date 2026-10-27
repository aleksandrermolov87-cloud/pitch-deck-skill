# Генерация 3D через двух провайдеров и происхождение картинок деки (reference/09-3d-objects.md, раздел 5).
#   visuals.py choose <src> --provider magicpatterns|codex-imagegen|none [--quota "<лимит/стоимость>"]
#       ответ пользователя на обязательный вопрос планировщика «Нужны 3D-генерации?», пишется в data/visuals.json
#   visuals.py fetch  <src> --url <https://cdn.magicpatterns.com/…> --name <имя> --slide N [--payload prompts3d.json]
#       MagicPatterns (Claude): скачать ответ generate_image в img/3d/<имя>.jpg и записать происхождение
#   visuals.py import <src> --file <$CODEX_HOME/generated_images/…png> --name <имя> --slide N [--payload prompts3d.json]
#       Codex imagegen: скопировать картинку image_gen из папки Codex в img/3d/<имя>.png и записать происхождение
#   visuals.py record <src> --file img/3d/<файл> --slide N    — картинка пользователя (provider user)
#   visuals.py list   <src>                                   — таблица картинок и предупреждения
# В записи только хэш промпта: промпт обобщённый (prompt3d.py), числа и названия из брифа в него не попадают.
import argparse
import datetime
import hashlib
import json
import os
import re
import shutil
import sys
import urllib.request
from pathlib import Path

PROVIDERS = {'magicpatterns': 'generate_image', 'codex-imagegen': 'image_gen', 'user': None}
MP_CDN = 'https://cdn.magicpatterns.com/'
MAX = 20_000_000
MAGIC = {b'\x89PNG\r\n\x1a\n': '.png', b'\xff\xd8\xff': '.jpg', b'RIFF': '.webp'}

ap = argparse.ArgumentParser()
ap.add_argument('cmd', choices=['choose', 'fetch', 'import', 'record', 'list'])
ap.add_argument('src')
ap.add_argument('--provider', choices=['magicpatterns', 'codex-imagegen', 'none'])
ap.add_argument('--quota')
ap.add_argument('--url')
ap.add_argument('--file')
ap.add_argument('--name')
ap.add_argument('--slide', type=int)
ap.add_argument('--payload', help='вывод prompt3d.py --out: промпт ищется по --name')
a = ap.parse_args()

SRC = Path(a.src).resolve()
F = SRC / 'data' / 'visuals.json'
now = lambda: datetime.datetime.now().astimezone().isoformat(timespec='seconds')
die = lambda m: sys.exit(f'[ERR] {m}')


def load():
    return json.loads(F.read_text(encoding='utf-8')) if F.exists() else {'provider_choice': None, 'images': []}


def save(V):
    F.parent.mkdir(parents=True, exist_ok=True)
    F.write_text(json.dumps(V, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')


def kind(head):
    return next((ext for m, ext in MAGIC.items() if head.startswith(m) and (m != b'RIFF' or head[8:12] == b'WEBP')), None)


def prompt_sha():
    if not a.payload:
        return None
    P = json.loads(Path(a.payload).read_text(encoding='utf-8'))
    items = [i for b in P.get('batches', []) for i in b['images']] + P.get('calls', [])
    hit = next((i for i in items if i['name'] == a.name), None)
    if not hit:
        die(f'в {a.payload} нет промпта «{a.name}»')
    return hashlib.sha256(hit['prompt'].encode()).hexdigest()


def need(V, provider):
    ch = (V.get('provider_choice') or {}).get('provider')
    if ch != provider:
        die(f'провайдер «{provider}» не выбран пользователем (выбран: {ch or "ничего"}). Сначала спросите и запишите: visuals.py choose')


def add(V, rec, provider):
    V['images'] = [i for i in V['images'] if i['file'] != rec['file']] + [rec]
    save(V)
    print('ok', rec['file'], provider)


V = load()
if a.cmd in ('fetch', 'import') and not (a.name and re.fullmatch(r'[A-Za-z0-9_-]+', a.name)):
    die('--name: буквы, цифры, «_», «-»')
if a.cmd in ('fetch', 'import', 'record') and a.slide is None:
    die('--slide: номер слайда, который объясняет картинка')

if a.cmd == 'choose':
    if not a.provider:
        die('--provider magicpatterns | codex-imagegen | none')
    V['provider_choice'] = {'provider': a.provider, 'chosen_by_user': True, 'when': now(), 'quota': a.quota}
    save(V)
    print('ok: провайдер', a.provider)

elif a.cmd == 'fetch':
    # только постоянные адреса CDN Magic Patterns из ответа generate_image этой сессии
    if not (a.url or '').startswith(MP_CDN) or '..' in a.url:
        die(f'скачивание только с {MP_CDN}')
    need(V, 'magicpatterns')
    req = urllib.request.Request(a.url, headers={'User-Agent': 'pitch-deck-skill'})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            if not r.geturl().startswith(MP_CDN):
                die(f'переадресация за пределы CDN: {r.geturl()}')
            body = r.read(MAX + 1)
    except OSError as e:
        die(f'не скачалось: {e}')
    if len(body) > MAX:
        die('файл больше 20 МБ')
    ext = kind(body[:12]) or die('ответ не PNG/JPEG/WebP')
    dst = SRC / 'img' / '3d' / f'{a.name}{ext}'
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_bytes(body)
    add(V, {'file': str(dst.relative_to(SRC)), 'slide': a.slide, 'provider': 'magicpatterns', 'tool': 'generate_image',
            'prompt_sha': prompt_sha(), 'source': a.url, 'created': now(), 'data_sent': 'generalized'}, 'magicpatterns')

elif a.cmd == 'import':
    # image_gen в Codex сохраняет картинки в $CODEX_HOME/generated_images; другие пути не принимаем
    need(V, 'codex-imagegen')
    home = Path(os.environ.get('CODEX_HOME', Path.home() / '.codex')).resolve() / 'generated_images'
    p = Path(a.file or '').resolve()
    if not p.is_file() or home not in p.parents:
        die(f'--file: картинка image_gen из {home}')
    if p.stat().st_size > MAX:
        die('файл больше 20 МБ')
    ext = kind(p.read_bytes()[:12]) or die('файл не PNG/JPEG/WebP')
    dst = SRC / 'img' / '3d' / f'{a.name}{ext}'
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(p, dst)
    add(V, {'file': str(dst.relative_to(SRC)), 'slide': a.slide, 'provider': 'codex-imagegen', 'tool': 'image_gen',
            'prompt_sha': prompt_sha(), 'source': None, 'created': now(), 'data_sent': 'generalized'}, 'codex-imagegen')

elif a.cmd == 'record':
    p = (SRC / (a.file or '')).resolve()
    if not p.is_file() or SRC not in p.parents:
        die('--file: путь внутри проекта, например img/3d/photo.png')
    add(V, {'file': str(p.relative_to(SRC)), 'slide': a.slide, 'provider': 'user', 'tool': None,
            'prompt_sha': None, 'source': None, 'created': now(), 'data_sent': 'none'}, 'user')

else:
    ch = V.get('provider_choice') or {}
    print(f"провайдер: {ch.get('provider', 'не выбран')}" + (f" (квота: {ch['quota']})" if ch.get('quota') else ''))
    print('| Файл | Слайд | Провайдер | Инструмент |\n|---|---|---|---|')
    for i in sorted(V['images'], key=lambda i: (i['slide'], i['file'])):
        print(f"| {i['file']} | {i['slide']} | {i['provider']} | {i['tool'] or '—'} |")
    known = {Path(i['file']).stem.removesuffix('_check') for i in V['images']}
    for f in sorted((SRC / 'img' / '3d').glob('*')) if (SRC / 'img' / '3d').is_dir() else []:
        if f.suffix.lower() in ('.png', '.jpg', '.jpeg', '.webp') and not f.stem.endswith('_check') and f.stem not in known:
            print(f'[WARN] {f.relative_to(SRC)}: происхождение не записано')
