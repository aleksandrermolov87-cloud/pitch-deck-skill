#!/usr/bin/env python3
"""Bind supplied copy to a role-based composition seed; emit native geometry JSON.
No PDF/image is generated and no model, network, or project commands are invoked.
The renderer must measure actual fonts, check geometry and register factual numbers.
"""
import argparse
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PATTERNS = ('proof-boundary', 'evidence-rubric', 'offer-outcome')


def bind(pattern, values, width, height):
    if pattern not in PATTERNS:
        raise ValueError('unknown composition pattern')
    if not math.isfinite(width) or not math.isfinite(height) or width <= 0 or height <= 0 or abs(width / height - 16 / 9) > .002:
        raise ValueError('seeds support 16:9 only; recompose portrait documents')
    spec = json.loads((ROOT / 'templates/compositions' / f'{pattern}.json').read_text())
    required = set(spec['required_fields'])
    if not isinstance(values, dict) or set(values) != required:
        raise ValueError('supply exactly the declared fields; no missing or silently ignored copy')
    if any(not isinstance(v, str) or not v.strip() for v in values.values()):
        raise ValueError('each field needs real nonempty supplied text')
    scale = width / spec['canvas'][0]
    result = {'pattern': pattern, 'canvas': [width, height], 'texts': [], 'rects': [], 'edges': [],
              'relations': spec['relations'], 'limits': spec['limits']}
    for region in spec['texts']:
        text = dict(region)
        for key in ('x', 'y', 'w', 'h', 'font_size'):
            text[key] *= scale
        text['text'] = values[text['field']]
        result['texts'].append(text)
    for region in spec['rects']:
        rect = dict(region)
        for key in ('x', 'y', 'w', 'h', 'stroke_width'):
            rect[key] *= scale
        result['rects'].append(rect)
    for region in spec['edges']:
        edge = dict(region)
        edge['points'] = [[x * scale, y * scale] for x, y in edge['points']]
        edge['width'] *= scale
        result['edges'].append(edge)
    return result


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('pattern', choices=PATTERNS)
    p.add_argument('--data', required=True, type=Path)
    p.add_argument('--canvas', default='1920x1080')
    args = p.parse_args()
    try:
        width, height = map(float, args.canvas.lower().split('x'))
        result = bind(args.pattern, json.loads(args.data.read_text()), width, height)
    except (OSError, ValueError, TypeError) as error:
        p.exit(1, f'composition layout: {error}\n')
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
