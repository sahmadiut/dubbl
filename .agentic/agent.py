#!/usr/bin/env python3
"""Offline Markdown project controller. Python 3.10+, standard library only.
This program never executes application commands, calls an LLM or deploys software.
"""
import argparse
from collections import Counter
from contextlib import contextmanager
from datetime import datetime, timezone
import hashlib
import itertools
import json
import math
import os
from pathlib import Path
import re
import sys
import tempfile

STATES = {'todo', 'in_progress', 'review', 'done', 'blocked', 'skipped'}
CLOSED = {'done', 'skipped'}
ACTIVE = {'in_progress', 'review'}
PHASES = ['Foundation audit', 'CI and architecture guardrails', 'Money and FX hardening',
          'Locale foundation', 'RTL conversion', 'P1 capability gaps', 'Data and banking parity',
          'Translation completion', 'Release qualification', 'Production release', 'Maintenance']

class Invalid(ValueError):
    pass

def require(condition, message):
    if not condition:
        raise Invalid(message)

def now():
    return datetime.now(timezone.utc).isoformat(timespec='seconds')

def atomic_write(path, text):
    fd, name = tempfile.mkstemp(prefix='.' + path.name + '.', dir=path.parent)
    try:
        with os.fdopen(fd, 'w', encoding='utf-8', newline='\n') as f:
            f.write(text)
            f.flush()
            os.fsync(f.fileno())
        os.replace(name, path)
    finally:
        if os.path.exists(name):
            os.unlink(name)

@contextmanager
def lock(root):
    path = root / '.controller.lock'
    try:
        fd = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    except FileExistsError:
        raise Invalid('Controller lock exists. Check for a running writer; see docs/CONTROLLER.md for crash recovery.')
    try:
        with os.fdopen(fd, 'w') as f:
            f.write(json.dumps({'pid': os.getpid(), 'created_at': now()}))
        yield
    finally:
        path.unlink(missing_ok=True)

class Task:
    def __init__(self, path):
        self.path = path
        raw = path.read_text(encoding='utf-8')
        require(raw.startswith('---\n'), f'{path.name}: missing JSON front matter')
        parts = raw.split('\n---\n', 1)
        require(len(parts) == 2, f'{path.name}: unterminated metadata')
        try:
            self.meta = json.loads(parts[0][4:])
        except json.JSONDecodeError as exc:
            raise Invalid(f'{path.name}: invalid metadata: {exc}')
        require(isinstance(self.meta, dict), f'{path.name}: metadata must be an object')
        self.body = parts[1].lstrip('\n')

    @property
    def id(self):
        return self.meta['id']

    def checks(self):
        require('## Acceptance criteria\n' in self.body, f'{self.path.name}: missing acceptance section')
        section = self.body.split('## Acceptance criteria\n', 1)[1].split('\n## ', 1)[0]
        return re.findall(r'^- \[([ xX])\] (.+)$', section, flags=re.M)

    def event(self, text):
        require('\n' not in text and '\r' not in text, 'History note must be one line')
        self.body = self.body.rstrip() + f'\n- {now()} | {text}\n'

    def save(self):
        atomic_write(self.path, '---\n' + json.dumps(self.meta, indent=2, ensure_ascii=False) + '\n---\n\n' + self.body)

class Project:
    def __init__(self, root):
        self.root = root.resolve()
        require((self.root / 'tasks').is_dir(), 'Expected a .agentic directory containing tasks/')
        paths = sorted((self.root / 'tasks').rglob('*.md'))
        require(paths, 'No task files found')
        self.tasks = {}
        for path in paths:
            require(not path.is_symlink(), f'Symlink task refused: {path.name}')
            t = Task(path)
            self.schema(t)
            require(t.id not in self.tasks, f'Duplicate task ID: {t.id}')
            self.tasks[t.id] = t
        self.validate()

    def schema(self, t):
        m = t.meta
        required = {'id','title','phase','role','depends_on','source_pages','status','priority','optional',
                    'human_review','owner','block_reason','evidence','review','waiver'}
        require(required <= m.keys(), f'{t.path.name}: missing fields {sorted(required-m.keys())}')
        require(isinstance(m['id'], str) and re.fullmatch(r'[A-Z][A-Z0-9]*-[0-9]{3,}', m['id']), 'Invalid task ID')
        require(t.path.stem == m['id'], f'{t.path.name}: filename must equal ID')
        for key in ['title', 'role']:
            require(isinstance(m[key], str) and m[key].strip(), f'{t.id}: invalid {key}')
        require(re.fullmatch('[a-z]+', m['role']) and (self.root/'roles'/f"{m['role']}.md").is_file(), f'{t.id}: unknown role')
        require(type(m['phase']) is int and 0 <= m['phase'] < len(PHASES), f'{t.id}: invalid phase')
        require(type(m['priority']) is int and 0 <= m['priority'] <= 3, f'{t.id}: invalid priority')
        require(m['status'] in STATES, f'{t.id}: invalid status')
        for key in ['optional', 'human_review']:
            require(type(m[key]) is bool, f'{t.id}: {key} must be boolean')
        require(isinstance(m['depends_on'], list) and all(isinstance(x,str) for x in m['depends_on']), f'{t.id}: invalid dependencies')
        require(len(set(m['depends_on'])) == len(m['depends_on']), f'{t.id}: duplicate dependency')
        require(isinstance(m['source_pages'], list) and all(type(x) is int and 1<=x<=37 for x in m['source_pages']), f'{t.id}: invalid source pages')
        require(isinstance(m['evidence'],list) and all(isinstance(x,str) for x in m['evidence']), f'{t.id}: invalid evidence')
        require(m['owner'] is None or isinstance(m['owner'], str), f'{t.id}: invalid owner')
        require(m['block_reason'] is None or isinstance(m['block_reason'], str), f'{t.id}: invalid blocker')
        require(m['review'] is None or isinstance(m['review'],dict), f'{t.id}: invalid review')
        require(m['waiver'] is None or isinstance(m['waiver'],dict), f'{t.id}: invalid waiver')
        require(t.checks(), f'{t.id}: no acceptance checkboxes')
        require('## Handoff\n' in t.body and '## History\n' in t.body, f'{t.id}: missing handoff/history')
        if m['status'] in ACTIVE:
            require(bool(m['owner']), f'{t.id}: active task has no owner')
        if m['status'] == 'blocked':
            require(bool(m['block_reason']), f'{t.id}: blocked without reason')

    def evidence_path(self, value):
        p = Path(value)
        require(not p.is_absolute(), 'Evidence path must be relative to .agentic')
        target = (self.root / p).resolve()
        require(target.is_relative_to((self.root/'evidence').resolve()), 'Evidence must be inside .agentic/evidence/')
        require(target.suffix == '.md' and target.is_file(), f'Missing Markdown evidence: {value}')
        require(len(target.read_text(encoding='utf-8').strip()) >= 80, f'Evidence is too short: {value}')
        return target

    def digest(self,t,evidence_newlines='lf',evidence_hashes=None):
        content = {k:v for k,v in t.meta.items() if k not in {'status','owner','block_reason','review','waiver'}}
        content['body'] = t.body.split('## History\n',1)[0]
        hashes={}
        for x in ([] if evidence_hashes is not None else t.meta['evidence']):
            path=self.evidence_path(x)
            if evidence_newlines=='raw':
                data=path.read_bytes()
            else:
                # Git checkout changes LF/CRLF bytes without changing Markdown.
                # Normalize only newlines; retain all other content/whitespace.
                text=path.read_text(encoding='utf-8')
                if evidence_newlines=='crlf':text=text.replace('\n','\r\n')
                data=text.encode('utf-8')
            hashes[x]=hashlib.sha256(data).hexdigest()
        content['evidence_hashes'] = hashes if evidence_hashes is None else evidence_hashes
        return hashlib.sha256(json.dumps(content,sort_keys=True,ensure_ascii=False).encode()).hexdigest()

    def legacy_digest_matches(self,t,expected):
        # Historical reviews may have mixed LF/CRLF across evidence files.
        # Test only newline-equivalent hashes, never rewrite the approval.
        variants={}
        for x in t.meta['evidence']:
            path=self.evidence_path(x)
            text=path.read_text(encoding='utf-8')
            data=(path.read_bytes(),text.encode('utf-8'),text.replace('\n','\r\n').encode('utf-8'))
            variants[x]=sorted({hashlib.sha256(value).hexdigest() for value in data})
        require(math.prod(len(v) for v in variants.values())<=4096,
                f'{t.id}: too many legacy newline variants; submit/review using text-lf-v1')
        return any(expected==self.digest(t,evidence_hashes=dict(zip(variants,values)))
                   for values in itertools.product(*variants.values()))

    def prerequisites(self,t):
        return [x for x in t.meta['depends_on'] if self.tasks[x].meta['status'] not in CLOSED]

    def complete_checks(self,t):
        require(all(x.lower()=='x' for x,_ in t.checks()), f'{t.id}: unchecked acceptance criteria')
        require(t.meta['evidence'], f'{t.id}: evidence is required')
        for x in t.meta['evidence']:
            self.evidence_path(x)

    def approved(self,t):
        r=t.meta['review'] or {}
        require(r.get('result')=='approve' and r.get('reviewer') and r.get('at'), f'{t.id}: approval required')
        require(r.get('kind') in {'self','peer','human'},f'{t.id}: invalid reviewer kind')
        require(not t.meta['human_review'] or r.get('kind')=='human', f'{t.id}: actual human review required')
        self.evidence_path(r.get('evidence',''))
        version=r.get('digest_version')
        require(version in {None,'text-lf-v1'},f'{t.id}: unknown review digest version')
        matches=r.get('digest')==self.digest(t)
        if not matches and version is None:
            # Preserve old byte-based reviews without rewriting approvals or
            # evidence. Only exact raw/LF/CRLF representations are accepted.
            matches=self.legacy_digest_matches(t,r.get('digest'))
        require(matches, f'{t.id}: content/evidence changed since review; submit/review again')

    def validate(self):
        for t in self.tasks.values():
            for d in t.meta['depends_on']:
                require(d in self.tasks, f'{t.id}: missing dependency {d}')
        visiting, visited=set(),set()
        def visit(id):
            require(id not in visiting, f'Dependency cycle at {id}')
            if id in visited:return
            visiting.add(id)
            for d in self.tasks[id].meta['depends_on']:visit(d)
            visiting.remove(id);visited.add(id)
        for id in self.tasks:visit(id)
        active=[t.id for t in self.tasks.values() if t.meta['status'] in ACTIVE]
        require(len(active)<=1, f'Multiple active tasks: {active}')
        for t in self.tasks.values():
            s=t.meta['status']
            for e in t.meta['evidence']:self.evidence_path(e)
            if s in ACTIVE|{'done'}:
                require(not self.prerequisites(t), f'{t.id}: unresolved dependencies {self.prerequisites(t)}')
            if s in {'review','done'}:self.complete_checks(t)
            if s=='done':self.approved(t)
            if s=='skipped':
                w=t.meta['waiver'] or {}
                require(t.meta['optional'] and w.get('reason') and w.get('reviewer') and w.get('at'),f'{t.id}: invalid optional waiver')
                self.evidence_path(w.get('evidence',''))

    def ordered(self):
        return sorted(self.tasks.values(),key=lambda t:(t.meta['phase'],t.meta['priority'],t.id))

    def ready(self):
        return [t for t in self.ordered() if t.meta['status']=='todo' and not self.prerequisites(t)]

    def next(self):
        active=[t for t in self.ordered() if t.meta['status'] in ACTIVE]
        return (active or self.ready() or [None])[0]

    def brief(self,t):
        if t is None:return None
        return {**{k:t.meta[k] for k in ['id','title','status','role','phase','optional','human_review','owner']},
                'path':str(t.path.relative_to(self.root)), 'unmet_dependencies':self.prerequisites(t),
                'next_action': 'review' if t.meta['status']=='review' else 'resume' if t.meta['status']=='in_progress' else 'start'}

    def status(self):
        counts=Counter(t.meta['status'] for t in self.tasks.values())
        phases=[]
        for i,name in enumerate(PHASES):
            ts=[t for t in self.tasks.values() if t.meta['phase']==i]
            if ts:phases.append({'phase':i,'name':name,'counts':dict(Counter(t.meta['status'] for t in ts)),'total':len(ts)})
        open_tasks=[t for t in self.ordered() if t.meta['status'] not in CLOSED]
        return {'total':len(self.tasks),'counts':dict(counts),'done_percent':round(100*counts['done']/len(self.tasks),1),
                'note':'Task count, not effort or verified product feature completion. Skipped is not done.',
                'current_phase':PHASES[open_tasks[0].meta['phase']] if open_tasks else 'All tasks resolved',
                'next':self.brief(self.next()),'ready':[t.id for t in self.ready()],
                'blocked':[{'id':t.id,'reason':t.meta['block_reason']} for t in self.ordered() if t.meta['status']=='blocked'],
                'waiting':[{ 'id':t.id,'dependencies':self.prerequisites(t)} for t in self.ordered() if t.meta['status']=='todo' and self.prerequisites(t)],
                'phases':phases}

    def get(self,id):
        require(id in self.tasks,f'Unknown task: {id}')
        return self.tasks[id]

    def context(self,id=None):
        t=self.get(id) if id else self.next()
        parts=['# One-task execution context', 'Generated from current Markdown; refresh after any state change.']
        for f in ['START_HERE.md','docs/PROJECT.md','docs/REPOSITORY_MAP.md']:
            p=self.root/f
            if p.exists():parts += [f'\n## File: {f}\n',p.read_text(encoding='utf-8')]
        if t:
            parts += ['\n## Selected task metadata\n',json.dumps(self.brief(t),indent=2),
                      '\n## Role\n',(self.root/'roles'/f"{t.meta['role']}.md").read_text(encoding='utf-8'),
                      '\n## Full task\n',t.path.read_text(encoding='utf-8'),
                      '\n## Dependency evidence pointers\n',json.dumps({d:self.tasks[d].meta['evidence'] for d in t.meta['depends_on']},indent=2)]
        else:parts+=['No runnable task. Inspect status for blockers or completed scope. Never invent a task status.']
        return '\n'.join(parts)

    def mutate(self,a):
        if a.command=='start' and a.id is None:
            t=self.next();require(t is not None,'No runnable task')
        else:t=self.get(a.id)
        m=t.meta;s=m['status'];cmd=a.command
        if cmd=='start':
            require(s=='todo','Use the existing handoff/review for an active task; start only accepts todo')
            require(not any(x.meta['status'] in ACTIVE for x in self.tasks.values()),'Finish, review or block the active task first')
            require(not self.prerequisites(t),f'Unmet dependencies: {self.prerequisites(t)}')
            require(bool(a.owner.strip()),'Owner is required')
            m.update(status='in_progress',owner=a.owner)
            t.event(f'Started by {a.owner}')
        elif cmd=='check':
            require(s=='in_progress','Acceptance can be changed only in_progress')
            checks=t.checks();require(1<=a.number<=len(checks),'Acceptance number out of range')
            head,rest=t.body.split('## Acceptance criteria\n',1)
            section,tail=rest.split('\n## ',1)
            i=0
            def mark(match):
                nonlocal i
                i+=1
                return f"- [{' ' if a.undo else 'x'}] {match.group(2)}" if i==a.number else match.group(0)
            section=re.sub(r'^- \[([ xX])\] (.+)$',mark,section,flags=re.M)
            t.body=head+'## Acceptance criteria\n'+section+'\n## '+tail
            m['review']=None
            t.event(f'Acceptance {a.number}: {"unchecked" if a.undo else "checked"}; {a.note}')
        elif cmd=='submit':
            require(s in {'in_progress','review'},'Submit requires in_progress or review')
            for e in a.evidence:self.evidence_path(e)
            m['evidence']=list(dict.fromkeys(m['evidence']+a.evidence))
            self.complete_checks(t)
            m.update(status='review',review=None)
            t.event('Submitted for review')
        elif cmd=='review':
            require(s=='review','Review requires review state')
            self.evidence_path(a.evidence)
            require(bool(a.reviewer.strip()),'Reviewer is required')
            require(a.result!='approve' or not m['human_review'] or a.kind=='human','This task requires actual human approval')
            m['evidence']=list(dict.fromkeys(m['evidence']+[a.evidence]))
            m['review']={'result':a.result,'reviewer':a.reviewer,'kind':a.kind,'evidence':a.evidence,'at':now(),'digest':self.digest(t),'digest_version':'text-lf-v1'}
            if a.result=='reject':m['status']='in_progress'
            t.event(f'Review {a.result} by {a.reviewer} ({a.kind}); {a.evidence}')
        elif cmd=='done':
            require(s=='review','Done requires review state')
            self.complete_checks(t);self.approved(t)
            m['status']='done';t.event('Completed with acceptance and reviewed evidence')
        elif cmd=='block':
            require(s in {'todo','in_progress','review'},'Cannot block this state')
            require(bool(a.reason.strip()),'Block reason is required')
            m.update(status='blocked',block_reason=a.reason,review=None)
            t.event('Blocked: '+a.reason)
        elif cmd=='resume':
            require(s=='blocked','Resume requires blocked state')
            require(not any(x.meta['status'] in ACTIVE for x in self.tasks.values()),'An active task already exists')
            require(not self.prerequisites(t),'Dependencies are not resolved')
            require(bool(a.owner.strip()),'Owner required')
            m.update(status='in_progress',block_reason=None,owner=a.owner,review=None)
            t.event('Block resolved; '+a.note)
        elif cmd=='note':
            require(s in {'todo','in_progress','blocked','review'},'Closed task: reopen before changing work')
            t.event(a.note)
        elif cmd=='skip':
            require(m['optional'] and s in {'todo','blocked','in_progress'},'Only open optional tasks can be deferred')
            require(a.reason.strip() and a.reviewer.strip(),'Reason and actual scope approver required')
            self.evidence_path(a.evidence)
            m.update(status='skipped',block_reason=None,review=None,waiver={'reason':a.reason,'reviewer':a.reviewer,'evidence':a.evidence,'at':now()})
            m['evidence']=list(dict.fromkeys(m['evidence']+[a.evidence]))
            t.event(f'Optional scope deferred by {a.reviewer}: {a.reason}')
        elif cmd=='reopen':
            require(s in CLOSED,'Reopen requires done or skipped')
            downstream=set()
            def depends(id):
                for x in self.tasks.values():
                    if id in x.meta['depends_on'] and x.id not in downstream:
                        downstream.add(x.id);depends(x.id)
            depends(t.id)
            require(not any(self.tasks[x].meta['status'] in ACTIVE|{'done'} for x in downstream),'Reopen completed/active dependents first, in reverse dependency order')
            m.update(status='todo',review=None,waiver=None,owner=None,block_reason=None)
            t.event('Reopened: '+a.reason)
        else:raise Invalid('Unknown mutation')
        self.schema(t);self.validate();t.save()
        return self.brief(t)

def parser():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--root',type=Path,default=Path(__file__).resolve().parent,help='Path to .agentic (default: directory of this script)')
    p.add_argument('--json',action='store_true',help='Machine-readable output; place before subcommand')
    sub=p.add_subparsers(dest='command',required=True)
    for cmd in ['status','next','validate']:sub.add_parser(cmd)
    for cmd in ['show','context']:
        q=sub.add_parser(cmd);q.add_argument('id',nargs='?' if cmd=='context' else None)
    q=sub.add_parser('start');q.add_argument('id',nargs='?');q.add_argument('--owner',required=True)
    q=sub.add_parser('check');q.add_argument('id');q.add_argument('number',type=int);q.add_argument('--undo',action='store_true');q.add_argument('--note',required=True)
    q=sub.add_parser('submit');q.add_argument('id');q.add_argument('--evidence',action='append',required=True)
    q=sub.add_parser('review');q.add_argument('id');q.add_argument('--result',choices=['approve','reject'],required=True);q.add_argument('--reviewer',required=True);q.add_argument('--kind',choices=['self','peer','human'],required=True);q.add_argument('--evidence',required=True)
    q=sub.add_parser('done');q.add_argument('id')
    q=sub.add_parser('block');q.add_argument('id');q.add_argument('--reason',required=True)
    q=sub.add_parser('resume');q.add_argument('id');q.add_argument('--owner',required=True);q.add_argument('--note',required=True)
    q=sub.add_parser('note');q.add_argument('id');q.add_argument('--note',required=True)
    q=sub.add_parser('skip');q.add_argument('id');q.add_argument('--reason',required=True);q.add_argument('--reviewer',required=True);q.add_argument('--evidence',required=True)
    q=sub.add_parser('reopen');q.add_argument('id');q.add_argument('--reason',required=True)
    return p

def main(argv=None):
    a=parser().parse_args(argv)
    try:
        reads={'status','next','validate','show','context'}
        if a.command in reads:
            project=Project(a.root)
            if a.command=='status':out=project.status()
            elif a.command=='next':out=project.brief(project.next()) or {'next':None,'message':'No runnable task; inspect status blockers or completed scope.'}
            elif a.command=='validate':out={'valid':True,'task_count':len(project.tasks),'note':'Structural validation, not proof of implementation or review authenticity.'}
            elif a.command=='show':out=project.get(a.id).path.read_text(encoding='utf-8')
            else:out=project.context(a.id)
        else:
            with lock(a.root):out=Project(a.root).mutate(a)
        if a.json:print(json.dumps(out,indent=2,ensure_ascii=False))
        elif isinstance(out,str):print(out)
        elif a.command=='status':
            print(f"Phase: {out['current_phase']}\nTasks: {out['total']} | {out['counts']} | Done: {out['done_percent']}%")
            print(out['note'])
            print('Next: '+(f"{out['next']['id']} — {out['next']['title']} ({out['next']['next_action']})" if out['next'] else 'none'))
            print('Ready: '+(', '.join(out['ready']) or 'none'))
            for x in out['blocked']:print(f"BLOCKED {x['id']}: {x['reason']}")
            for x in out['phases']:print(f"{x['phase']:02} {x['name']}: {x['counts']}")
        else:print(json.dumps(out,indent=2,ensure_ascii=False))
        return 0
    except (Invalid,OSError,UnicodeError,TypeError,KeyError) as exc:
        if a.json:print(json.dumps({'error':str(exc)},ensure_ascii=False),file=sys.stderr)
        else:print('Error: '+str(exc),file=sys.stderr)
        return 2

if __name__=='__main__':
    raise SystemExit(main())
