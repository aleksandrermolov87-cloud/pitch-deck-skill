"""Preference records must represent confirmed user choices, not agent decisions."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

SKILL = Path(__file__).resolve().parents[2]

class PreferenceProvenance(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.src = self.root / 'deck'
        self.learn = self.root / 'learn'
        self.run = self.src / 'out/variants/r1'
        self.run.mkdir(parents=True)
        (self.src / 'deck.json').write_text('{"name":"example"}')
        candidates = [{'id': x, 'component': c, 'data': {}, 'opt': {}, 'status': 'ok'} for x, c in [('A', 'comparison'), ('B', 'heatmap')]]
        (self.run / 'suggest.json').write_text(json.dumps({'slides': [{'n': 1, 'content_sha': 'x', 'candidates': candidates}]}))
        (self.run / 'demo.json').write_text(json.dumps({'slides': {'1': {'A': {'component': 'comparison', 'state': 'ok'}, 'B': {'component': 'heatmap', 'state': 'ok'}}}}))
        self.env = {**os.environ, 'PITCH_LEARN_DIR': str(self.learn)}

    def call(self, script, *args):
        p = subprocess.run([sys.executable, '-I', str(SKILL / 'scripts' / script), *map(str, args)], env=self.env, capture_output=True, text=True)
        self.assertEqual(p.returncode, 0, p.stdout + p.stderr)
        return p

    def pick(self, *extra):
        return self.call('variants.py', 'pick', self.src, '--run', 'r1', '--slide', '1', '--variant', 'A', *extra)

    def test_default_agent_pick_makes_project_artifact_without_global_preference(self):
        self.pick()
        self.assertTrue((self.src / 'data/variants.json').exists())
        self.assertFalse((self.learn / 'picks.jsonl').exists())
        self.assertFalse((self.learn / 'prefs.json').exists())

    def test_user_pick_is_explicit_and_only_selected_is_positive(self):
        self.pick('--choice-source', 'user')
        event = json.loads((self.learn / 'picks.jsonl').read_text())
        self.assertEqual(event['choice_source'], 'user')
        prefs = json.loads((self.learn / 'prefs.json').read_text())['components']
        self.assertEqual(prefs['comparison']['picks'], 1)
        # Generating a demo does not prove it was shown to the user.
        self.assertNotIn('heatmap', prefs)

    def test_explicitly_shown_alternatives_can_be_counted(self):
        self.pick('--choice-source', 'user', '--shown-to-user')
        prefs = json.loads((self.learn / 'prefs.json').read_text())['components']
        self.assertEqual(prefs['comparison']['picks'], 1)
        self.assertEqual(prefs['heatmap']['rejects'], 1)

    def test_old_preference_cache_is_not_silently_used(self):
        self.learn.mkdir()
        fields = json.loads((SKILL / 'components/fields.json').read_text())
        (self.learn / 'prefs.json').write_text(json.dumps({'components': {name: {'mean': 1.0, 'n': 100} for name in fields if name != '_'}}))
        p = self.call('variants.py', 'suggest', self.src, '--content', SKILL / 'tests/variants/content.json', '--lib', 'skill', '--json')
        data, _ = json.JSONDecoder().raw_decode(p.stdout.lstrip())
        candidates = [c for slide in data['slides'] for c in slide.get('candidates', [])]
        self.assertTrue(candidates)
        self.assertTrue(all(c['pref'] == 0 for c in candidates))

    def test_shown_flag_rejects_agent_and_missing_demo_before_writing(self):
        args = [sys.executable, '-I', str(SKILL / 'scripts/variants.py'), 'pick', str(self.src), '--run', 'r1', '--slide', '1', '--variant', 'A']
        p = subprocess.run(args + ['--shown-to-user'], env=self.env, capture_output=True, text=True)
        self.assertNotEqual(p.returncode, 0)
        self.assertFalse((self.src / 'data/variants.json').exists())
        (self.run / 'demo.json').unlink()
        p = subprocess.run(args + ['--choice-source', 'user', '--shown-to-user'], env=self.env, capture_output=True, text=True)
        self.assertNotEqual(p.returncode, 0)
        self.assertFalse((self.learn / 'picks.jsonl').exists())

    def test_legacy_unknown_is_excluded_without_mutating_log_or_ratings(self):
        self.learn.mkdir()
        old = json.dumps({'src': '/old', 'run': 'r', 'slide': 1, 'chosen': 'heatmap', 'shown': ['heatmap'], 'demo': True}) + '\n'
        (self.learn / 'picks.jsonl').write_text(old)
        rating = {'archetype': 'test', 'verdict': 'good', 'lib': ['comparison'], 'reasons': [], 'date': '2026-01-01', 'deck': 'test', 'slide': 1, 'title': 'test', 'png': str(self.learn / 'example.png'), 'fn': 'f'}
        (self.learn / 'ratings.jsonl').write_text(json.dumps(rating) + '\n')
        self.call('learn.py', 'digest')
        prefs = json.loads((self.learn / 'prefs.json').read_text())['components']
        self.assertEqual(prefs['comparison']['good'], 1)
        self.assertNotIn('heatmap', prefs)
        self.assertEqual((self.learn / 'picks.jsonl').read_text(), old)

if __name__ == '__main__':
    unittest.main()
