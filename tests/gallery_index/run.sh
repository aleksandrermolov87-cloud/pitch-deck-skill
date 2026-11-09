#!/bin/zsh
set -eu
SKILL="${0:A:h:h:h}"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
python3 "$SKILL/scripts/gallery_index.py" --json > "$TMP/index.json"
python3 - "$SKILL" "$TMP" <<'PY'
import json, pathlib, shutil, subprocess, sys
skill, tmp = map(pathlib.Path, sys.argv[1:])
rows = json.loads((tmp/'index.json').read_text())
files = sorted((skill/'components').glob('gallery*.js'))
assert len(rows) > 100 and len({(x['file'],x['index']) for x in rows}) == len(rows)
assert len([x for x in rows if x['component']=='journeyMap']) == 3
project=tmp/'project'; shutil.copytree(skill/'templates/deck-starter',project)
(project/'node_modules').symlink_to(skill/'node_modules', target_is_directory=True)
for file in files: shutil.copy2(file,project/file.name)
counts=json.loads(subprocess.check_output(['node','-e',"const fs=require('fs');const p=process.argv[1];const r={};for(const f of fs.readdirSync(p).filter(x=>/^gallery(?:-.*)?\\.js$/.test(x)))r[f]=require(p+'/'+f).S.length;process.stdout.write(JSON.stringify(r))",str(project)],text=True))
for file in files:
    actual=[x for x in rows if x['file']=='components/'+file.name]
    assert len(actual)==counts[file.name], (file.name,len(actual),counts[file.name])
    assert [x['index'] for x in actual] == list(range(counts[file.name]))
    lines=file.read_text().splitlines()
    for x in actual: assert 'slide(' in lines[x['line']-1]
print(f"PASS: {len(rows)} индексных записей соответствуют исполнимым примерам в {len(files)} файлах; повторы различаются")
PY
python3 - "$SKILL" "$TMP/project" <<'PY'
import pathlib, sys
skill, project = map(pathlib.Path, sys.argv[1:])
cases = [
('gallery-textcore.js','selected-text.js', "slide('statementHero', 'Проверенный вывод', 'Новые данные', () => K.statementHero(B(0.3), {kicker:'Результат', thesis:'Новый текст проекта', accent:'Новый текст проекта'}), 'text-statement')"),
('gallery-orgs.js','selected-flow.js', "slide('arcHandoffs', 'Передача и возврат', 'Схема процесса', () => K.arcHandoffs(B(0.05,0.05), {units:[{id:'a',name:'Приём'},{id:'b',name:'Проверка'},{id:'c',name:'Решение'}], handoffs:[{from:'a',to:'b',weight:1},{from:'b',to:'c',weight:1},{from:'b',to:'a',weight:1,tag:'уточнение'}]}), 'scheme-arc-handoffs')")]
for original, output, entry in cases:
    prefix=(skill/'components'/original).read_text().split('const S = [',1)[0]
    prefix=prefix.replace('Компонент ${id} · данные вымышленные','Источник: тестовый бриф')
    (project/output).write_text(prefix+'const S = [\n'+entry+'\n];\nmodule.exports = { S };\n')
(project/'slides.js').write_text("module.exports = { S: [...require('./selected-text.js').S, ...require('./selected-flow.js').S] };\n")
PY
(cd "$TMP/project" && "$SKILL/.venv/bin/python" -I bg.py >/dev/null && node build.js >/dev/null)
python3 - "$TMP/project" <<'PY'
import json, pathlib, sys
p=pathlib.Path(sys.argv[1]); slides=json.loads((p/'out/slides.json').read_text()); html=(p/'out/deck.html').read_text()
assert len(slides)==2
for word in ['Новый текст проекта','Передача и возврат','уточнение']: assert word.casefold() in html.casefold(), word
for word in ['данные вымышленные','Страховку покупают','полиса']: assert word.casefold() not in html.casefold(), word
print('PASS: два готовых примера перенесены в проект, заполнены новыми данными и собраны; демонстрационные тексты отсутствуют')
PY
