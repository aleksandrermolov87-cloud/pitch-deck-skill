"""Native ZCode installation and a relocated, offline Alfa catalog."""
from pathlib import Path
import json, os, re, shutil, subprocess, sys, tempfile, unittest

ROOT=Path(__file__).resolve().parents[2]

class ZCodeCompatibility(unittest.TestCase):
    def test_zcode_mcp_check_does_not_probe_or_modify_other_clients(self):
        with tempfile.TemporaryDirectory(prefix='zcode mcp ') as tmp:
            base=Path(tmp);bin=base/'bin';bin.mkdir();marker=base/'other-client-ran'
            for name in ['codex','claude']:
                f=bin/name;f.write_text('#!/bin/sh\ntouch "'+str(marker)+'"\n');f.chmod(0o755)
            config=base/'.zcode/cli/config.json';config.parent.mkdir(parents=True)
            data=json.dumps({'otherSetting':7,'mcp':{'servers':{'magicpatterns':{'url':'https://mcp.magicpatterns.com/mcp','type':'http'}}}})
            config.write_text(data)
            env=dict(os.environ,HOME=tmp,PATH=str(bin)+os.pathsep+os.environ['PATH'])
            p=subprocess.run(['zsh',str(ROOT/'scripts/mcp_setup.sh'),'--check','--client','zcode'],env=env,text=True,capture_output=True)
            self.assertEqual(p.returncode,0,p.stdout+p.stderr)
            self.assertFalse(marker.exists(),'A different client CLI was invoked')
            self.assertEqual(config.read_text(),data)
            config.unlink()
            p=subprocess.run(['zsh',str(ROOT/'scripts/mcp_setup.sh'),'--check','--client','zcode'],env=env,text=True,capture_output=True)
            self.assertNotEqual(p.returncode,0)
            self.assertIn('ZCode',p.stdout)
            self.assertFalse(marker.exists())

    def test_native_installation_guide_and_installer(self):
        guide=ROOT/'docs/install-zcode.md'
        self.assertTrue(guide.is_file(),'Native ZCode installation guide is missing')
        text=guide.read_text()
        self.assertIn('$HOME/.zcode/skills/pitch-deck-skill',text)
        self.assertIn('verify-tag "$PITCH_TAG_REF"',text)
        self.assertIn('$pitch-deck-skill',text)
        self.assertIn('--no-mcp --selftest',text)
        self.assertIn('install-zcode.md',(ROOT/'templates/install/INSTALL.md.tpl').read_text())

    def test_library_index_exposes_all_200_native_pages(self):
        p=subprocess.run([sys.executable,'-I',str(ROOT/'scripts/gallery_index.py'),'--library','alfa200','--json'],text=True,capture_output=True)
        self.assertEqual(p.returncode,0,p.stderr)
        rows=json.loads(p.stdout)
        self.assertEqual([r['page'] for r in rows],list(range(1,201)))
        for row in rows:
            self.assertTrue((ROOT/row['file']).is_file(),row)
            self.assertTrue((ROOT/row['preview']).is_file(),row)

    def test_approved_components_run_after_relocation(self):
        source=ROOT/'reference/library-200/source'
        self.assertTrue((source/'collection200.js').is_file(),'Parameterized source is not bundled')
        with tempfile.TemporaryDirectory(prefix='alfa relocated ') as tmp:
            target=Path(tmp)/'source';shutil.copytree(source,target)
            shutil.copy2(ROOT/'reference/library-200/approval.json',target.parent/'approval.json')
            code="""const fs=require('fs'),path=require('path');
const src=process.argv[1];const {S,compose}=require(path.join(src,'collection200.js'));
if(S.length!==48)throw Error('48 compositions required');
for(const s of S){const slide=compose(s.id);if(s.status!=='approved'||slide.notes.includes('Не утверждён'))throw Error('status '+s.id);
for(const e of slide.els)if(e.t==='image'&&!fs.existsSync(path.join(src,'img',e.file)))throw Error(e.file);
if(slide.bg&&!fs.existsSync(path.join(src,'img',slide.bg)))throw Error(slide.bg);}
let locked=false;try{compose(169,{'c169.brand':'bad'})}catch(e){locked=true}if(!locked)throw Error('Mutable brand');
console.log('PASS:48approved compositions,all local images,locked brand');"""
            p=subprocess.run(['node','-e',code,str(target)],cwd=tmp,text=True,capture_output=True)
            self.assertEqual(p.returncode,0,p.stdout+p.stderr)

    def test_public_library_links_and_font_policy(self):
        folder=ROOT/'reference/library-200'
        self.assertFalse(list(folder.rglob('*.otf')),'Commercial font files must remain local')
        self.assertNotRegex((folder/'INDEX.md').read_text(),r'/Users/|/home/')
        for rel in ['catalog-200.json','approved-153-200.json']:
            rows=json.loads((folder/rel).read_text())
            for row in rows:
                self.assertTrue((folder/row['preview']).is_file(),row['preview'])
                if row['id']>=153:self.assertTrue((folder/row['source']).is_file(),row['source'])
        for target in re.findall(r'\]\(([^)]+)\)',(folder/'INDEX.md').read_text()):
            if not target.startswith(('https://','#')):self.assertTrue((folder/target.split("#",1)[0]).is_file(),target)

if __name__=='__main__':unittest.main(verbosity=2)
