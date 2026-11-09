import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

SKILL = Path(__file__).resolve().parents[2]


class LibraryGate(unittest.TestCase):
    def check_manifest(self, slides):
        with tempfile.TemporaryDirectory(prefix='pds-library-') as tmp:
            root = Path(tmp)
            (root / 'out').mkdir()
            (root / 'out/slides.json').write_text(json.dumps(slides))
            report = root / 'result.json'
            proc = subprocess.run(
                [sys.executable, '-I', str(SKILL / 'scripts/library_check.py'),
                 tmp, '--json', str(report)], capture_output=True, text=True,
            )
            return proc, json.loads(report.read_text())

    def test_unknown_component_cannot_pass_or_inflate_library_share(self):
        for lib in [['doesNotExistInLibrary'], ['comparison', 'doesNotExistInLibrary']]:
            with self.subTest(lib=lib):
                proc, report = self.check_manifest([
                    {'n': 1, 'archetype': 'audit', 'title': 'Audit', 'lib': lib},
                ])
                self.assertEqual(proc.returncode, 1, proc.stdout + proc.stderr)
                self.assertTrue(any('doesNotExistInLibrary' in e for e in report['errors']))
                self.assertEqual(report['library'], 0)
                self.assertEqual(report['share'], 0)

    def test_all_catalog_components_still_pass(self):
        fields = json.loads((SKILL / 'components/fields.json').read_text())
        components = [name for name in fields if not name.startswith('_')]
        slides = [{'n': n, 'archetype': 'audit', 'title': name, 'lib': [name]}
                  for n, name in enumerate(components, 1)]
        proc, report = self.check_manifest(slides)
        self.assertEqual(proc.returncode, 0, proc.stdout + proc.stderr)
        self.assertEqual(report['library'], len(components))
        self.assertEqual(report['share'], 1)

    def test_custom_reason_and_cover_and_hidden_slides_remain_supported(self):
        proc, report = self.check_manifest([
            {'n': 1, 'archetype': 'cover', 'title': 'Cover', 'lib': []},
            {'n': 2, 'archetype': 'custom-flow', 'title': 'Custom', 'lib': [],
             'custom': 'A bespoke flow absent from the catalog'},
            {'n': 3, 'archetype': 'audit', 'title': 'Hidden', 'lib': [], 'hidden': True},
        ])
        self.assertEqual(proc.returncode, 0, proc.stdout + proc.stderr)
        self.assertEqual(report['slides'], 1)
        self.assertEqual(report['library'], 0)


if __name__ == '__main__':
    unittest.main()
