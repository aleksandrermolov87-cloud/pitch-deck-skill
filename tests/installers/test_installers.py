"""Execute generated installers without running setup or changing real client folders."""
import base64
import hashlib
import io
import json
import os
from pathlib import Path
import re
import shlex
import subprocess
import sys
import tarfile
import tempfile

SKILL = Path(__file__).resolve().parents[2]
BEGIN = 'PITCHDECK-PAYLOAD-BEGIN\n'
END = '\nPITCHDECK-PAYLOAD-END'


def installer_script(text, file, target):
    blocks = re.findall(r'```bash\n(.*?)\n```', text, re.S)
    script = next(block for block in blocks if 'PITCH_FILE=' in block)
    script = re.sub(r'^  PITCH_FILE=.*$', '  PITCH_FILE=' + shlex.quote(str(file)), script, count=1, flags=re.M)
    return re.sub(r'^  PITCH_SKILL=.*$', '  PITCH_SKILL=' + shlex.quote(str(target)), script, count=1, flags=re.M)


def run_install(file, target, env):
    script = installer_script(file.read_text(), file, target)
    return subprocess.run(['/bin/bash', '-c', script], capture_output=True, text=True, env=env)


def replace_archive(text, archive):
    before, payload = text.split(BEGIN, 1)
    old_payload, after = payload.split(END, 1)
    old = base64.b64decode(''.join(old_payload.split()), validate=True)
    old_hash = hashlib.sha256(old).hexdigest()
    new_hash = hashlib.sha256(archive).hexdigest()
    return (before + BEGIN + base64.encodebytes(archive).decode().strip() + END + after).replace(old_hash, new_hash)


with tempfile.TemporaryDirectory(prefix='pitch installers ') as directory:
    root = Path(directory)
    dist = root / 'dist'
    subprocess.run(['zsh', str(SKILL / 'scripts/package.sh'), str(dist)], check=True, stdout=subprocess.DEVNULL)
    stub = root / 'bin'
    stub.mkdir()
    zsh = stub / 'zsh'
    zsh.write_text('#!/bin/sh\nprintf "%s\\n" "$@" > "$PITCH_SETUP_LOG"\n')
    zsh.chmod(0o755)
    env = dict(os.environ, PATH=str(stub) + os.pathsep + os.environ['PATH'], PYTHONOPTIMIZE='1')
    for mode, name in [('full', 'pitch-deck-skill — установка (с Magic-MCP).md'), ('lite', 'pitch-deck-skill — установка (без Magic-MCP).md')]:
        file = dist / name
        for client, folder in [('codex', '.agents'), ('claude', '.claude'), ('zcode', '.zcode')]:
            target = root / (mode + '-' + client) / folder / 'skills/pitch-deck-skill'
            log = root / (mode + '-' + client + '.log')
            env['PITCH_SETUP_LOG'] = str(log)
            result = run_install(file, target, env)
            assert result.returncode == 0, result.stderr
            assert (target / 'SKILL.md').is_file()
            assert (target / 'VERSION').read_text() == (SKILL / 'VERSION').read_text()
            for relative in ['components/fields.json', 'components/README.md', 'templates/deck-starter/SLIDE-CATALOG.md', 'templates/deck-starter/components.js', 'templates/deck-starter/kit/orgs.js', 'config.default.json']:
                assert (target / relative).is_file(), relative
            rows = json.loads(subprocess.check_output([sys.executable, '-I', str(target / 'scripts/gallery_index.py'), '--json'], cwd=root, text=True))
            assert len(rows) >= 100
            assert len({x['file'] for x in rows}) == len(list((target / 'components').glob('gallery*.js')))
            assert all((target / x['file']).is_file() for x in rows)
            rows200=json.loads(subprocess.check_output([sys.executable,'-I',str(target/'scripts/gallery_index.py'),'--library','alfa200','--json'],cwd=root,text=True))
            assert len(rows200)==200 and all((target/x['preview']).is_file() for x in rows200)
            assert (target/'reference/library-200/source/collection200.js').is_file()
            assert not list((target/'reference/library-200').rglob('*.otf'))
            assert log.read_text().splitlines() == [str(target / 'scripts/setup.sh'), '--mode', mode, '--no-mcp', '--selftest']
            sentinel = target / 'config.json'
            sentinel.write_bytes(b'preserve existing settings')
            log.unlink()
            again = run_install(file, target, env)
            assert again.returncode != 0 and sentinel.read_bytes() == b'preserve existing settings'
            assert not log.exists()
            print('PASS:', mode, client, 'extracts into chosen folder and refuses existing installation')
    original = (dist / 'pitch-deck-skill — установка (без Magic-MCP).md').read_text()
    before, payload = original.split(BEGIN, 1)
    encoded, after = payload.split(END, 1)
    damaged = root / 'damaged.md'
    damaged.write_text(before + BEGIN + ('A' if encoded[0] != 'A' else 'B') + encoded[1:] + END + after)
    target = root / 'bad-checksum'
    result = run_install(damaged, target, env)
    assert result.returncode != 0 and 'SHA-256 mismatch' in result.stderr and not target.exists()
    for kind in ['traversal', 'symlink']:
        archive = io.BytesIO()
        with tarfile.open(fileobj=archive, mode='w:gz') as tar:
            member = tarfile.TarInfo('pitch-deck-skill/../escape' if kind == 'traversal' else 'pitch-deck-skill/link')
            if kind == 'symlink':
                member.type = tarfile.SYMTYPE
                member.linkname = '/outside'
                tar.addfile(member)
            else:
                member.size = 1
                tar.addfile(member, io.BytesIO(b'x'))
        file = root / (kind + '.md')
        file.write_text(replace_archive(original, archive.getvalue()))
        target = root / ('bad-' + kind)
        result = run_install(file, target, env)
        assert result.returncode != 0 and not target.exists() and not (root / 'escape').exists(), result.stderr
    print('PASS: checksum, traversal and symlink rejection with PYTHONOPTIMIZE=1')
print('PASS: generated installer commands; setup is stubbed, real HOME is unchanged')
