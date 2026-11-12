"""A signed tag must win over a same-named unsigned branch in both client guides."""
from pathlib import Path
import os,re,shlex,subprocess,tempfile
ROOT=Path(__file__).resolve().parents[2]

def run(args,cwd=None,**kwargs):
    return subprocess.run(args,cwd=cwd,check=True,capture_output=True,text=True,**kwargs)

with tempfile.TemporaryDirectory(prefix='pitch bootstrap ') as directory:
    base=Path(directory);repo=base/'remote';repo.mkdir();key=base/'key';marker=base/'executed'
    run(['ssh-keygen','-q','-t','ed25519','-N','','-f',str(key)])
    fingerprint=run(['ssh-keygen','-lf',str(key)+'.pub']).stdout.split()[1]
    run(['git','init','-q','-b','main'],repo)
    for field,value in [('user.name','Fixture'),('user.email','fixture@example.invalid'),('commit.gpgsign','false'),('gpg.format','ssh'),('user.signingkey',str(key))]:run(['git','config',field,value],repo)
    (repo/'.github').mkdir();(repo/'.github/release-signing-key.pub').write_bytes(Path(str(key)+'.pub').read_bytes())
    (repo/'scripts').mkdir();setup=repo/'scripts/setup.sh'
    setup.write_text('#!/bin/sh\nprintf TAG > "$PITCH_BOOTSTRAP_MARKER"\n')
    run(['git','add','-A'],repo);run(['git','commit','-qm','Signed release'],repo)
    expected=run(['git','rev-parse','HEAD'],repo).stdout.strip()
    run(['git','tag','-s','v9.9.9','-m','Signed fixture'],repo)
    run(['git','switch','-q','-c','v9.9.9'],repo)
    setup.write_text('#!/bin/sh\nprintf BRANCH > "$PITCH_BOOTSTRAP_MARKER"\n')
    run(['git','add','-A'],repo);run(['git','commit','-qm','Unsigned branch'],repo)
    bin=base/'bin';bin.mkdir();curl=bin/'curl'
    curl.write_text('#!/bin/sh\nprintf \'{"tag_name":"v9.9.9"}\\n\'\n');curl.chmod(0o755)
    env=dict(os.environ,PATH=str(bin)+os.pathsep+os.environ['PATH'],PITCH_BOOTSTRAP_MARKER=str(marker))
    for client in ['codex','claude-code','zcode']:
        text=(ROOT/'docs'/('install-'+client+'.md')).read_text()
        script=re.search(r'```bash\n(.*?)\n```',text,re.S).group(1)
        target=base/client/'skill'
        script=re.sub(r'^  PITCH_SKILL=.*$','  PITCH_SKILL='+shlex.quote(str(target)),script,count=1,flags=re.M)
        script=script.replace('https://github.com/aleksandrermolov87-cloud/pitch-deck-skill.git',shlex.quote(str(repo)))
        script=script.replace('SHA256:GOJu1Mq/91ufd43Icikuj/NE4fLwiGqTEmMsOyL28VM',fingerprint)
        result=subprocess.run(['/bin/bash','-c',script],capture_output=True,text=True,env=env)
        assert result.returncode==0,result.stderr
        assert marker.read_text()=='TAG','Unsigned same-named branch setup was executed'
        assert run(['git','rev-parse','HEAD'],target).stdout.strip()==expected
        marker.unlink()
        print('PASS:',client,'installs only verified tag despite same-named unsigned branch')

    # An untrusted key file must not add a second allowed_signers principal.
    attacker=base/'attacker'
    run(['ssh-keygen','-q','-t','ed25519','-N','','-f',str(attacker)])
    injected=Path(str(key)+'.pub').read_text().strip()+'\n* namespaces="git" '+Path(str(attacker)+'.pub').read_text()
    (repo/'.github/release-signing-key.pub').write_text(injected)
    run(['git','add','-A'],repo);run(['git','commit','-qm','Injected signer'],repo)
    run(['git','-c','user.signingkey='+str(attacker),'tag','-s','v9.9.8','-m','Attacker fixture'],repo)
    curl.write_text('#!/bin/sh\nprintf \'{"tag_name":"v9.9.8"}\\n\'\n')
    for client in ['codex','claude-code','zcode']:
        text=(ROOT/'docs'/('install-'+client+'.md')).read_text()
        script=re.search(r'```bash\n(.*?)\n```',text,re.S).group(1)
        target=base/(client+'-injected')/'skill'
        script=re.sub(r'^  PITCH_SKILL=.*$','  PITCH_SKILL='+shlex.quote(str(target)),script,count=1,flags=re.M)
        script=script.replace('https://github.com/aleksandrermolov87-cloud/pitch-deck-skill.git',shlex.quote(str(repo)))
        script=script.replace('SHA256:GOJu1Mq/91ufd43Icikuj/NE4fLwiGqTEmMsOyL28VM',fingerprint)
        result=subprocess.run(['/bin/bash','-c',script],capture_output=True,text=True,env=env)
        assert result.returncode!=0,'Tag signed by an injected signer was accepted'
        assert not marker.exists(),'Setup executed before signer rejection'
        print('PASS:',client,'rejects an injected allowed_signers row')
