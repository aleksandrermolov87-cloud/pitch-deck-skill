#!/usr/bin/env python3
"""Check fixed-content render comparisons, not artistic quality.
python -I composition_check.py comparison.json [--out report.json]
All file paths resolve relative to the manifest; no commands or network are used.
"""
import argparse
import hashlib
import json
from pathlib import Path


def check(data, root):
    errors, results = [], []
    slides = data.get('slides', [])
    if not slides:
        return {'status': 'failed', 'errors': ['slides missing'], 'slides': []}
    seen = set()
    for slide in slides:
        sid = slide.get('id')
        if not sid or sid in seen:
            errors.append('missing/duplicate slide id')
        seen.add(sid)
        candidates = slide.get('candidates', [])
        ids, hashes = set(), {}
        atoms, relations = slide.get('atoms'), slide.get('relations')
        if not isinstance(atoms, dict) or not atoms or not all(isinstance(v, str) and v for v in atoms.values()):
            errors.append(f'{sid}: nonempty text atoms required')
        if not isinstance(relations, list):
            errors.append(f'{sid}: relations list required (empty allowed)')
        if not candidates:
            errors.append(f'{sid}: candidates missing')
        for candidate in candidates:
            cid = candidate.get('id')
            prefix = f'{sid}/{cid}'
            if not cid or cid in ids:
                errors.append(f'{prefix}: missing/duplicate candidate id')
            ids.add(cid)
            if candidate.get('atoms') != atoms:
                errors.append(f'{prefix}: text atoms differ')
            # Relation order is irrelevant; repeated or changed edges are not.
            try:
                if sorted(map(tuple, candidate.get('relations', []))) != sorted(map(tuple, relations)):
                    errors.append(f'{prefix}: relations differ')
            except (TypeError, ValueError):
                errors.append(f'{prefix}: malformed relations')
            path = root / candidate.get('render', '')
            if not path.is_file():
                errors.append(f'{prefix}: render missing')
                continue
            digest = hashlib.sha256(path.read_bytes()).hexdigest()
            hashes[cid] = digest
            if digest != candidate.get('render_sha256'):
                errors.append(f'{prefix}: render changed or hash missing')
        tasks = slide.get('tasks', [])
        if not tasks or len(tasks) != len(set(tasks)):
            errors.append(f'{sid}: unique reading tasks required')
        reviews = slide.get('reviews', [])
        reviewer_ids = set()
        for review in reviews:
            cid, reviewer = review.get('candidate'), review.get('reviewer')
            if cid not in ids or not reviewer or (cid, reviewer) in reviewer_ids:
                errors.append(f'{sid}: invalid/duplicate review identity')
            reviewer_ids.add((cid, reviewer))
            if review.get('render_sha256') != hashes.get(cid):
                errors.append(f'{sid}/{cid}: review belongs to another render')
            outcomes = review.get('tasks', {})
            if set(outcomes) != set(tasks) or any(v not in ['correct', 'unclear', 'wrong'] for v in outcomes.values()):
                errors.append(f'{sid}/{cid}: every reading task needs an outcome')
            if not review.get('finding'):
                errors.append(f'{sid}/{cid}: review needs concrete evidence')
        selected = slide.get('selected')
        if selected is not None:
            chosen_reviews = [r for r in reviews if r.get('candidate') == selected]
            if selected not in ids or not chosen_reviews or not slide.get('selection_reason'):
                errors.append(f'{sid}: selected candidate needs review and reason')
            if any(v != 'correct' for r in chosen_reviews for v in r.get('tasks', {}).values()):
                errors.append(f'{sid}: selected candidate has unresolved reading tasks')
        results.append({'id': sid, 'candidates': len(ids), 'reviews': len(reviews), 'selected': selected})
    return {'status': 'failed' if errors else 'checked', 'errors': errors, 'slides': results,
            'limits': 'Checks declared content parity, local render hashes and review completeness. Does not inspect image semantics, prove reviewer independence, measure human reading time or score taste.'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('manifest', type=Path)
    parser.add_argument('--out', type=Path)
    args = parser.parse_args()
    def same_input(path):
        return args.out and (args.out.resolve() == path.resolve() or
                             (args.out.exists() and path.exists() and args.out.samefile(path)))
    if same_input(args.manifest):
        parser.error('report output must not replace manifest')
    try:
        data = json.loads(args.manifest.read_text())
        protected = {args.manifest.resolve()}
        protected.update((args.manifest.resolve().parent / c['render']).resolve() for s in data.get('slides', []) for c in s.get('candidates', []) if c.get('render'))
        if args.out and any(same_input(path) for path in protected):
            parser.error('report output must not replace manifest or candidate render')
        result = check(data, args.manifest.resolve().parent)
    except (OSError, ValueError, TypeError, AttributeError) as error:
        result = {'status': 'failed', 'errors': [str(error)]}
    text = json.dumps(result, ensure_ascii=False, indent=2)
    if args.out:
        args.out.write_text(text + '\n')
    print(text)
    return 1 if result['status'] == 'failed' else 0


if __name__ == '__main__':
    raise SystemExit(main())
