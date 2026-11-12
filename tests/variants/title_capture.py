"""Integration test: semantic slide title is captured without chrome()."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]

class CaptureTitle(unittest.TestCase):
    def test_custom_title_and_standard_chrome(self):
        with tempfile.TemporaryDirectory(prefix='pitch-title-') as tmp:
            root = Path(tmp)
            src = root / 'deck'
            shutil.copytree(ROOT / 'templates/deck-starter', src, ignore=shutil.ignore_patterns('node_modules', 'out', 'out-light', '__pycache__'))
            (src / 'node_modules').symlink_to(ROOT / 'node_modules', target_is_directory=True)
            (src / 'slides.js').write_text('''
const L=require('./lib.js'), K=require('./components.js');
const source={type:'user',date:'2026-11-11',quote:'1 2 3'};
const chart=()=>K.barsTrend({x:1,y:2,w:10,h:4},{label:'Показатель',periods:['А','Б','В'],values:[1,2,3],growth:false},{src:source});
const S=[
()=>({els:[L.text(1,.4,10,.6,[{t:'Срок '},{t:'вырос'}],{size:30,id:`s${L.PAGE.n}-title`}),...chart()]}),
()=>({els:[...L.chrome({title:'Стандартный заголовок',panel:false}),...chart()]}),
()=>({els:[L.text(1,1,9,.5,'Обычный текст',{size:20}),...chart()]})
]; module.exports={S};
''')
            env={**os.environ,'PITCH_LEARN_DIR':str(root/'learn')}
            result=subprocess.run([sys.executable,'-I',str(ROOT/'scripts/variants.py'),'suggest',str(src),'--json'],env=env,capture_output=True,text=True)
            self.assertEqual(result.returncode,0,result.stdout+result.stderr)
            data,_=json.JSONDecoder().raw_decode(result.stdout.lstrip())
            titles=[slide['title'] for slide in data['slides']]
            self.assertEqual(titles,['Срок вырос','Стандартный заголовок',''])

if __name__ == '__main__':
    unittest.main()
