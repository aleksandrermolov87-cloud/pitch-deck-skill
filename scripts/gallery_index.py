#!/usr/bin/env python3
"""List the runnable examples in the bundled slide gallery."""
import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ENTRY = re.compile(r"^[ \t]*slide\(\s*'((?:\\.|[^'\\])*)'\s*,\s*'((?:\\.|[^'\\])*)'\s*,\s*'((?:\\.|[^'\\])*)'", re.MULTILINE)


def index(root=ROOT):
    rows = []
    for path in sorted((root / 'components').glob('gallery*.js')):
        if path.name != 'gallery.js' and not path.name.startswith('gallery-'):
            continue
        source = path.read_text(encoding='utf-8')
        for ordinal, match in enumerate(ENTRY.finditer(source)):
            rows.append(dict(file='components/' + path.name, index=ordinal,
                             line=source.count('\n', 0, match.start()) + 1,
                             component=match.group(1), title=match.group(2),
                             description=match.group(3)))
    return rows


def figma_index(root=ROOT):
    folder = root / 'reference/alfa-figma-21'
    records = json.loads((folder / 'catalog.json').read_text(encoding='utf-8'))
    return [dict(file='reference/alfa-figma-21/originals.pptx', page=r['page'],
                 component=r['descriptor'], title=r['sourceTitle'], description=r['question'],
                 preview=f"reference/alfa-figma-21/previews/{r['page']:02d}.jpg")
            for r in records]


def alfa200_index(root=ROOT):
    records=json.loads((root/'reference/library-200/catalog-200.json').read_text(encoding='utf-8'))
    return [dict(file='reference/library-200/assets/alfa-200.pptx',page=r['id'],
                 component=r['pattern'],title=r['name'],description=r['question'],
                 category=r['category'],status=r['status'],
                 preview='reference/library-200/'+r['preview']) for r in records]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--search', default='', help='case-insensitive substring')
    parser.add_argument('--json', action='store_true')
    parser.add_argument('--library', choices=['gallery','figma','alfa200','all'], default='gallery',
                        help='runnable gallery, approved Figma references, native200 catalog, or all collections')
    args = parser.parse_args()
    rows = index() if args.library in ('gallery','all') else []
    if args.library in ('figma','all'):
        rows.extend(figma_index())
    if args.library in ('alfa200','all'):
        rows.extend(alfa200_index())
    needle = args.search.casefold()
    rows = [row for row in rows if needle in ' '.join(str(v) for v in row.values()).casefold()]
    if args.json:
        print(json.dumps(rows, ensure_ascii=False, indent=2))
    else:
        for row in rows:
            location = (f"{row['file']} p.{row['page']}" if 'page' in row else
                        f"{row['file']}:{row['line']} S[{row['index']}]")
            print(f"{location} | {row['component']} | {row['title']} | {row['description']}")
        print(f'Всего: {len(rows)}')


if __name__ == '__main__':
    main()
