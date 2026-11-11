#!/bin/bash
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
PY=${PITCH_PYTHON:-python3}
"$PY" -I - "$ROOT" <<'PY'
import pathlib,sys,tempfile,json,subprocess,collections,math
r=pathlib.Path(sys.argv[1]);tool=r/'scripts/composition_layout.py'
with tempfile.TemporaryDirectory() as d:
 p=pathlib.Path(d)/'data.json'
 def call(pattern,data,ok,canvas='1920x1080'):
  p.write_text(json.dumps(data));z=subprocess.run([sys.executable,'-I',str(tool),pattern,'--data',str(p),'--canvas',canvas],capture_output=True,text=True)
  assert (z.returncode==0)==ok,(z.returncode,z.stderr,z.stdout)
  return json.loads(z.stdout) if ok else None
 for pattern in ['proof-boundary','evidence-rubric','offer-outcome']:
  spec=json.loads((r/'templates/compositions'/f'{pattern}.json').read_text())
  data={k:f'SOURCE_MARKER_{pattern}_{i}' for i,k in enumerate(spec['required_fields'])}
  out=call(pattern,data,True);assert out['canvas']==[1920,1080] and out['relations']==spec['relations']
  assert collections.Counter(t['text'] for t in out['texts'])==collections.Counter(data.values())
  assert all(math.isfinite(t[k]) for t in out['texts'] for k in ['x','y','w','h','font_size'])
  assert all(math.isfinite(v) for e in out['edges'] for point in e['points'] for v in point)
  small=call(pattern,data,True,'1280x720');assert abs(small['texts'][0]['x']/out['texts'][0]['x']-2/3)<1e-6
  x=dict(data);x.pop(next(iter(x)));call(pattern,x,False)
  x=dict(data);x[next(iter(x))]='';call(pattern,x,False)
  call(pattern,{**data,'made_up_field':'do not silently ignore'},False)
  call(pattern,data,False,'595x842')
  call(pattern,data,False,'nanx1080')
  call(pattern,data,False,'infx1080')
 call('unknown-pattern',{},False)
print('PASS: three role layouts, supplied fields only, exact relations, proportional scaling, portrait rejection')
PY
