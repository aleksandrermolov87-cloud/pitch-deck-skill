"""A subjective card warning must not hide a measurable off-slide error."""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from pptx import Presentation
from pptx.enum.shapes import MSO_SHAPE
from pptx.util import Inches

SKILL = Path(__file__).resolve().parents[2]

class GeometryErrors(unittest.TestCase):
    def test_out_of_bounds_is_still_an_error(self):
        with tempfile.TemporaryDirectory(prefix='pitch-bounds-') as d:
            root = Path(d)
            prs = Presentation()
            slide = prs.slides.add_slide(prs.slide_layouts[6])
            slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, prs.slide_width - Inches(0.2), Inches(1), Inches(1), Inches(1))
            deck, report = root / 'overflow.pptx', root / 'audit.json'
            prs.save(deck)
            p = subprocess.run([sys.executable, '-I', str(SKILL / 'scripts/pptx_audit.py'), str(deck), '--json', str(report)], capture_output=True, text=True)
            issues = json.loads(report.read_text())['issues']
            self.assertNotEqual(p.returncode, 0)
            self.assertTrue(any(i['level'] == 'ERR' and 'выходит за холст' in i['msg'] for i in issues), issues)

if __name__ == '__main__':
    unittest.main()
