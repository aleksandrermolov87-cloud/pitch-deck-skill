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


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--search', default='', help='case-insensitive substring')
    parser.add_argument('--json', action='store_true')
    args = parser.parse_args()
    rows = index()
    needle = args.search.casefold()
    rows = [row for row in rows if needle in ' '.join(str(v) for v in row.values()).casefold()]
    if args.json:
        print(json.dumps(rows, ensure_ascii=False, indent=2))
    else:
        for row in rows:
            print(f"{row['file']}:{row['line']} S[{row['index']}] | {row['component']} | {row['title']} | {row['description']}")
        print(f'Всего: {len(rows)}')


if __name__ == '__main__':
    main()
