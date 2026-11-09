#!/bin/bash
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
PY=${PITCH_PYTHON:-python3}
"$PY" -I - "$ROOT" <<'PY'
import sys, tempfile, pathlib, json, hashlib, subprocess, copy
root=pathlib.Path(sys.argv[1]); tool=root/'scripts/composition_check.py'
with tempfile.TemporaryDirectory() as d:
 p=pathlib.Path(d); (p/'render.png').write_bytes(b'fixture image bytes')
 h=hashlib.sha256((p/'render.png').read_bytes()).hexdigest()
 v={'id':'A','atoms':{'x':'Return to checks'},'relations':[['waiting','checks','retry']], 'render':'render.png','render_sha256':h}
 m={'slides':[{'id':'s1','atoms':v['atoms'],'relations':v['relations'],'tasks':['trace_retry'],'candidates':[v], 'selected':'A','selection_reason':'retry endpoint is readable', 'reviews':[{'candidate':'A','reviewer':'judge-1','render_sha256':h,'tasks':{'trace_retry':'correct'},'finding':'retry reaches checks'}]}]}
 def run(doc,good):
  (p/'m.json').write_text(json.dumps(doc))
  r=subprocess.run([sys.executable,'-I',str(tool),str(p/'m.json')],capture_output=True,text=True)
  assert (r.returncode==0)==good,(r.returncode,r.stdout,r.stderr)
 run(m,True)
 for label in ['text loss','edge loss','render drift','stale review','wrong answer','missing review']:
  x=copy.deepcopy(m);s=x['slides'][0];c=s['candidates'][0]
  if label=='text loss':c['atoms']={}
  if label=='edge loss':c['relations']=[]
  if label=='render drift':c['render_sha256']='0'*64
  if label=='stale review':s['reviews'][0]['render_sha256']='0'*64
  if label=='wrong answer':s['reviews'][0]['tasks']['trace_retry']='wrong'
  if label=='missing review':s['reviews']=[]
  run(x,False)
 x=copy.deepcopy(m);x['slides'][0].pop('selected');x['slides'][0]['reviews']=[];run(x,True)
 # Protect source files on parse failure and through hardlinks.
 for source_name, invalid, alias in [('m.json',True,False),('m.json',False,True),('render.png',False,True)]:
  (p/'m.json').write_text('{broken' if invalid else json.dumps(m))
  source=p/source_name;before=source.read_bytes();out=source
  if alias:
   out=p/'alias.json'
   if out.exists():out.unlink()
   out.hardlink_to(source)
  r=subprocess.run([sys.executable,'-I',str(tool),str(p/'m.json'),'--out',str(out)],capture_output=True)
  assert r.returncode!=0 and source.read_bytes()==before,'output destroyed input'
print('PASS: parity, relation loss, render drift, stale review, wrong/missing answers, review-ready state')
PY
