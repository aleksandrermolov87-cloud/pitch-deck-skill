import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

SKILL = Path(__file__).resolve().parents[2]


class ProviderGate(unittest.TestCase):
    def check_plan(self, provider):
        with tempfile.TemporaryDirectory(prefix='pds-provider-') as tmp:
            root = Path(tmp)
            (root / 'out').mkdir()
            (root / 'data').mkdir()
            (root / 'deck.json').write_text(json.dumps({
                'plan': {'topic': 'Audit', 'slides': 1, '3d': True},
            }))
            (root / 'out/slides.json').write_text('[{"n":1}]')
            if provider is not None:
                (root / 'data/visuals.json').write_text(json.dumps({
                    'provider_choice': {'provider': provider, 'chosen_by_user': True},
                    'images': [],
                }))
            report = root / 'result.json'
            proc = subprocess.run(
                [sys.executable, '-I', str(SKILL / 'scripts/plan_check.py'),
                 tmp, '--json', str(report)], capture_output=True, text=True,
            )
            return proc, json.loads(report.read_text())

    def test_3d_requires_supported_generation_provider(self):
        for provider in [None, 'none', 'does-not-exist']:
            with self.subTest(provider=provider):
                proc, report = self.check_plan(provider)
                self.assertEqual(proc.returncode, 1, proc.stdout + proc.stderr)
                self.assertTrue(report['errors'])
                self.assertLess(report['passed'], report['checks'])

    def test_supported_providers_can_pass_before_images_are_generated(self):
        for provider in ['magicpatterns', 'codex-imagegen']:
            with self.subTest(provider=provider):
                proc, report = self.check_plan(provider)
                self.assertEqual(proc.returncode, 0, proc.stdout + proc.stderr)
                self.assertEqual(report['errors'], [])
                self.assertEqual(report['passed'], report['checks'])


if __name__ == '__main__':
    unittest.main()
