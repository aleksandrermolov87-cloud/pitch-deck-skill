"""Unrendered alternatives must not become negative preference feedback."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


SKILL = Path(__file__).resolve().parents[2]


class UnseenPicks(unittest.TestCase):
    def test_pick_without_demo_records_only_positive_feedback(self):
        with tempfile.TemporaryDirectory(prefix='pitch-unseen-') as tmp:
            root = Path(tmp)
            src, learn = root / 'src', root / 'learn'
            run = src / 'out' / 'variants' / 'r1'
            run.mkdir(parents=True)
            (src / 'deck.json').write_text('{"name":"Audit"}')
            candidates = [
                {'id': 'A', 'component': 'comparison', 'data': {}, 'opt': {}, 'status': 'годится'},
                {'id': 'B', 'component': 'heatmap', 'data': {}, 'opt': {}, 'status': 'годится'},
            ]
            (run / 'suggest.json').write_text(json.dumps({'slides': [
                {'n': 1, 'content_sha': 'audit', 'candidates': candidates}
            ]}))
            env = {**os.environ, 'PITCH_LEARN_DIR': str(learn)}
            result = subprocess.run(
                [sys.executable, '-I', str(SKILL / 'scripts/variants.py'), 'pick', str(src),
                 '--run', 'r1', '--slide', '1', '--variant', 'A', '--choice-source', 'user'],
                env=env, capture_output=True, text=True,
            )
            self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
            pick = json.loads((learn / 'picks.jsonl').read_text().splitlines()[0])
            self.assertFalse(pick['demo'])
            self.assertEqual(pick['shown'], [])
            prefs = json.loads((learn / 'prefs.json').read_text())['components']
            self.assertEqual(prefs['comparison']['picks'], 1)
            self.assertNotIn('heatmap', prefs)

    def test_digest_ignores_explicitly_unseen_legacy_alternatives(self):
        with tempfile.TemporaryDirectory(prefix='pitch-unseen-legacy-') as tmp:
            root = Path(tmp)
            (root / 'picks.jsonl').write_text(json.dumps({
                'src': '/audit', 'run': 'r1', 'slide': 1, 'chosen': 'comparison',
                'shown': ['comparison', 'heatmap'], 'demo': False,
            }) + '\n')
            result = subprocess.run(
                [sys.executable, '-I', str(SKILL / 'scripts/learn.py'), 'digest'],
                env={**os.environ, 'PITCH_LEARN_DIR': str(root)}, capture_output=True, text=True,
            )
            self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
            prefs = json.loads((root / 'prefs.json').read_text())['components']
            self.assertNotIn('comparison', prefs)
            self.assertNotIn('heatmap', prefs)


if __name__ == '__main__':
    unittest.main()
