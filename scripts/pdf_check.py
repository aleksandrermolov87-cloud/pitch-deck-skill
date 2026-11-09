#!/usr/bin/env python3
"""PDF checks using Python stdlib + Poppler; no authoring dependencies.

Usage: python3 -I pdf_check.py INPUT.pdf --out CHECK_DIR [options]
  --expected-pages N         Require exactly N pages.
  --expected-size WIDTHxHEIGHT   Require every page size in PDF points (±0.5pt).
  --require-text TEXT         Require substring in extracted text; repeatable.
  --forbid-text TEXT          Reject substring; repeatable.
  --require-font NAME         Require font-name substring; repeatable.
  --dpi N                    Render every page at N DPI (default 96).
  --allow-empty-text          Permit image-only/blank PDFs (default: reject).
  --overwrite                 Replace artifacts in a nonempty CHECK_DIR.
Exit 0: measured checks passed. Exit 1: failed checks/tool error; see check.json.
Exit 2: invalid CLI or protected output. check.json records explicit limits:
rendering does not prove visual quality, fact accuracy, coverage or font licensing.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('pdf', type=Path)
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--expected-pages', type=int)
    parser.add_argument('--expected-size', help='WIDTHxHEIGHT in PDF points')
    parser.add_argument('--require-text', action='append', default=[])
    parser.add_argument('--forbid-text', action='append', default=[])
    parser.add_argument('--require-font', action='append', default=[])
    parser.add_argument('--dpi', type=int, default=96)
    parser.add_argument('--allow-empty-text', action='store_true')
    parser.add_argument('--overwrite', action='store_true')
    args = parser.parse_args()
    if args.dpi <= 0 or (args.expected_pages is not None and args.expected_pages <= 0):
        parser.error('dpi and expected-pages must be positive')
    expected_size = None
    if args.expected_size:
        match = re.fullmatch(r'(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)', args.expected_size)
        if not match or min(map(float, match.groups())) <= 0:
            parser.error('expected-size must be positive WIDTHxHEIGHT in PDF points')
        expected_size = tuple(map(float, match.groups()))
    pdf = args.pdf.resolve()
    out = args.out.absolute()
    if out.is_symlink() or (out.exists() and not out.is_dir()):
        parser.error('output must be a directory, not a symlink or file')
    if out.exists() and any(out.iterdir()) and not args.overwrite:
        parser.error('output directory is not empty; use --overwrite')
    artifacts = [out / 'check.json', out / 'text.txt', out / 'fonts.txt', *out.glob('page-*.png')]
    # Never consume the input as one of our own overwritten output artifacts.
    if any(pdf == path.resolve() for path in artifacts):
        parser.error('input overlaps output artifacts')
    out.mkdir(parents=True, exist_ok=True)
    if args.overwrite:
        for path in artifacts:
            if path.is_dir():
                parser.error('artifact path is a directory: ' + str(path))
            if path.exists() or path.is_symlink():
                path.unlink()
    result = {
        'status': 'failed', 'pdf': str(pdf), 'sha256': None,
        'pages': [], 'fonts': [], 'renders': [], 'checks': {}, 'errors': [], 'warnings': [],
        'limits': {
            'visual_review': 'not_performed',
            'geometry': 'page dimensions only; no text-box, clipping or overlap analysis',
            'text': 'Poppler extraction; images and outlined text may not be searchable',
            'fonts': 'PDF font table only; embedding does not prove glyph coverage, no substitution or licensing',
            'facts_and_coverage': 'not verified; required substrings do not prove semantic completeness',
            'render': 'all pages rasterized; PNG existence does not establish visual quality',
        },
        'commands': [],
    }
    env = dict(os.environ, LC_ALL='C')

    def run(command):
        result['commands'].append(command)
        completed = subprocess.run(command, capture_output=True, text=True, env=env, timeout=120)
        if completed.returncode:
            raise RuntimeError(command[0] + ': ' + completed.stderr.strip())
        return completed.stdout

    try:
        for tool in ('pdfinfo', 'pdftotext', 'pdffonts', 'pdftoppm'):
            if not shutil.which(tool):
                raise RuntimeError('missing Poppler tool: ' + tool)
        result['sha256'] = hashlib.sha256(pdf.read_bytes()).hexdigest()
        info = run(['pdfinfo', str(pdf)])
        match = re.search(r'^Pages:\s+(\d+)', info, re.M)
        if not match:
            raise RuntimeError('pdfinfo did not report page count')
        count = int(match[1])
        result['checks']['page_count'] = {'actual': count, 'expected': args.expected_pages}
        if args.expected_pages is not None and count != args.expected_pages:
            result['errors'].append('page count: expected %s, got %s' % (args.expected_pages, count))
        for number in range(1, count + 1):
            page_info = run(['pdfinfo', '-f', str(number), '-l', str(number), str(pdf)])
            size = re.search(r'^(?:Page\s+\d+\s+size|Page size):\s+([\d.]+) x ([\d.]+) pts', page_info, re.M)
            if not size:
                raise RuntimeError('pdfinfo did not report page size for page ' + str(number))
            width, height = map(float, size.groups())
            result['pages'].append({'number': number, 'width_pt': width, 'height_pt': height})
            if expected_size and any(abs(a - b) > 0.5 for a, b in zip((width, height), expected_size)):
                result['errors'].append('page size: page %s expected %s, got %sx%s' % (number, args.expected_size, width, height))
        text = run(['pdftotext', '-layout', str(pdf), '-'])
        (out / 'text.txt').write_text(text, encoding='utf-8')
        result['checks']['text'] = {'characters': len(text.strip()), 'required': args.require_text, 'forbidden': args.forbid_text}
        if not text.strip() and not args.allow_empty_text:
            result['errors'].append('no extractable text (use --allow-empty-text only if intentional)')
        # Whitespace normalization lets a phrase span line/page wrapping, without ignoring case.
        normalized = ' '.join(text.split())
        for required in args.require_text:
            if ' '.join(required.split()) not in normalized:
                result['errors'].append('required text missing: ' + required)
        for forbidden in args.forbid_text:
            if ' '.join(forbidden.split()) in normalized:
                result['errors'].append('forbidden text present: ' + forbidden)
        font_text = run(['pdffonts', str(pdf)])
        (out / 'fonts.txt').write_text(font_text, encoding='utf-8')
        for line in font_text.splitlines()[2:]:
            if line.strip():
                fields = line.split()
                result['fonts'].append({
                    'name': fields[0], 'embedded': fields[-5] == 'yes',
                    'subset': fields[-4] == 'yes', 'unicode_map': fields[-3] == 'yes',
                    'poppler_row': line,
                })
        unembedded = [font['name'] for font in result['fonts'] if not font['embedded']]
        result['checks']['fonts'] = {'count': len(result['fonts']), 'unembedded': unembedded}
        if unembedded:
            result['warnings'].append('fonts not embedded: ' + ', '.join(unembedded))
        for font in args.require_font:
            if not any(font in entry['name'] for entry in result['fonts']):
                result['errors'].append('required font missing: ' + font)
        run(['pdftoppm', '-r', str(args.dpi), '-png', str(pdf), str(out / 'page')])
        result['renders'] = [str(path) for path in sorted(out.glob('page-*.png'))]
        if len(result['renders']) != count:
            result['errors'].append('render count differs from page count')
        result['checks']['render'] = {'expected': count, 'actual': len(result['renders']), 'dpi': args.dpi}
    except (OSError, RuntimeError, subprocess.TimeoutExpired) as error:
        result['errors'].append(str(error))
    result['status'] = 'failed' if result['errors'] else 'passed'
    (out / 'check.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'status': result['status'], 'report': str(out / 'check.json'), 'errors': result['errors']}, ensure_ascii=False))
    return 1 if result['errors'] else 0


if __name__ == '__main__':
    sys.exit(main())
