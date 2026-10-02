"""Meaningful controller regression tests. All evidence/review identities are synthetic.
Tests operate only on temporary copies, never the real task states.
"""
import contextlib
import importlib.util
import io
import json
import re
from pathlib import Path
import shutil
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('agent_controller', ROOT/'agent.py')
agent=importlib.util.module_from_spec(spec)
spec.loader.exec_module(agent)

class ControllerTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name)/'.agentic'
        shutil.copytree(ROOT,self.root,ignore=shutil.ignore_patterns('__pycache__','.controller.lock'))
        # Progress in the real backlog must not change the synthetic test graph.
        # Reset only temporary tasks; preserve dependencies and review gates.
        for task_path in (self.root/'tasks').glob('*.md'):
            task=agent.Task(task_path)
            task.meta.update(status='todo', owner=None, block_reason=None,
                             evidence=[], review=None, waiver=None)
            task.body=re.sub(r'^- \[[xX]\] ', '- [ ] ', task.body, flags=re.M)
            task.save()

    def runcli(self,*args,ok=True):
        output=io.StringIO()
        with contextlib.redirect_stdout(output),contextlib.redirect_stderr(output):
            code=agent.main(['--root',str(self.root),'--json',*args])
        if ok:self.assertEqual(code,0,output.getvalue())
        else:self.assertEqual(code,2,output.getvalue())
        return json.loads(output.getvalue())

    def editmeta(self,id,**fields):
        t=agent.Task(self.root/'tasks'/f'{id}.md')
        t.meta.update(fields);t.save()

    def evidence(self,name='fixture.md'):
        path=self.root/'evidence'/name
        path.write_text('# Synthetic controller test evidence\n\nThis is an artificial test fixture, not actual product implementation, testing or human approval. Expected outcome: controller behavior only.\n',encoding='utf-8')
        return 'evidence/'+name

    def submit(self,id='AUD-001'):
        self.runcli('start',id,'--owner','synthetic-test')
        t=agent.Task(self.root/'tasks'/f'{id}.md')
        for i in range(1,len(t.checks())+1):self.runcli('check',id,str(i),'--note','Synthetic fixture criterion')
        e=self.evidence(id+'-evidence.md')
        self.runcli('submit',id,'--evidence',e)
        return e

    def finish(self,id='AUD-001',kind='self'):
        e=self.submit(id)
        self.runcli('review',id,'--result','approve','--reviewer','synthetic-test','--kind',kind,'--evidence',e)
        self.runcli('done',id)

    def test_initial_graph_has_one_ready_task(self):
        task_count=len(list((self.root/'tasks').glob('*.md')))
        state=self.runcli('status')
        self.assertEqual(state['ready'],['AUD-001'])
        self.assertEqual(state['total'],task_count)
        self.assertEqual(state['counts'],{'todo':task_count})

    def test_dependency_start_rejected_without_mutation(self):
        before=(self.root/'tasks/AUD-002.md').read_bytes()
        self.runcli('start','AUD-002','--owner','test',ok=False)
        self.assertEqual(before,(self.root/'tasks/AUD-002.md').read_bytes())

    def test_active_task_resumed_by_selection(self):
        self.runcli('start','--owner','test')
        self.assertEqual(self.runcli('next')['next_action'],'resume')

    def test_completion_unlocks_dependencies(self):
        self.finish()
        self.assertEqual(self.runcli('status')['ready'],['AUD-002','AUD-003'])

    def test_single_active_slot(self):
        self.finish()
        self.runcli('start','AUD-002','--owner','test')
        self.runcli('start','AUD-003','--owner','other',ok=False)

    def test_cannot_submit_unchecked_work(self):
        self.runcli('start','--owner','test')
        self.runcli('submit','AUD-001','--evidence',self.evidence(),ok=False)
        self.assertEqual(self.runcli('next')['status'],'in_progress')

    def test_cannot_complete_without_review(self):
        self.submit()
        self.runcli('done','AUD-001',ok=False)
        self.assertEqual(self.runcli('next')['next_action'],'review')

    def test_missing_evidence_rejected(self):
        self.runcli('start','--owner','test')
        self.runcli('submit','AUD-001','--evidence','evidence/missing.md',ok=False)

    def test_external_evidence_rejected(self):
        outside=self.root.parent/'outside.md'
        outside.write_text('x'*100)
        self.runcli('start','--owner','test')
        self.runcli('submit','AUD-001','--evidence','../outside.md',ok=False)

    def test_symlink_evidence_escape_rejected(self):
        outside=self.root.parent/'outside.md';outside.write_text('x'*100)
        try:
            (self.root/'evidence/escape.md').symlink_to(outside)
        except OSError as exc:
            if getattr(exc,'winerror',None)==1314:
                self.skipTest('Windows account lacks symlink privilege; Linux CI must execute this test')
            raise
        self.runcli('start','--owner','test')
        self.runcli('submit','AUD-001','--evidence','evidence/escape.md',ok=False)

    def test_human_review_gate(self):
        self.editmeta('AUD-001',human_review=True)
        e=self.submit()
        self.runcli('review','AUD-001','--result','approve','--reviewer','test-model','--kind','self','--evidence',e,ok=False)
        self.runcli('review','AUD-001','--result','approve','--reviewer','synthetic-human-fixture','--kind','human','--evidence',e)
        self.runcli('done','AUD-001')

    def test_stale_evidence_invalidates_review(self):
        e=self.submit()
        self.runcli('review','AUD-001','--result','approve','--reviewer','test','--kind','self','--evidence',e)
        with (self.root/e).open('a') as f:f.write('\nChanged after review.\n')
        self.runcli('done','AUD-001',ok=False)
        self.runcli('submit','AUD-001','--evidence',e)
        self.runcli('review','AUD-001','--result','approve','--reviewer','test','--kind','self','--evidence',e)
        self.runcli('done','AUD-001')

    def test_stale_task_content_invalidates_review(self):
        e=self.submit()
        self.runcli('review','AUD-001','--result','approve','--reviewer','test','--kind','self','--evidence',e)
        t=agent.Task(self.root/'tasks/AUD-001.md');t.body=t.body.replace('## Handoff','Changed scope.\n\n## Handoff');t.save()
        self.runcli('done','AUD-001',ok=False)

    def test_new_review_survives_evidence_checkout_line_endings(self):
        e=self.submit()
        self.runcli('review','AUD-001','--result','approve','--reviewer','test','--kind','self','--evidence',e)
        t=agent.Task(self.root/'tasks/AUD-001.md')
        self.assertEqual(t.meta['review']['digest_version'],'text-lf-v1')
        path=self.root/e
        text=path.read_text(encoding='utf-8')
        path.write_bytes(text.replace('\n','\r\n').encode('utf-8'))
        self.runcli('done','AUD-001')
        path.write_bytes(text.encode('utf-8'))
        self.runcli('validate')
        path.write_bytes((text+'Actual content edit.\n').encode('utf-8'))
        self.runcli('validate',ok=False)

    def test_legacy_review_survives_windows_to_linux_checkout(self):
        e=self.submit()
        path=self.root/e
        text=path.read_text(encoding='utf-8')
        path.write_bytes(text.replace('\n','\r\n').encode('utf-8'))
        self.runcli('review','AUD-001','--result','approve','--reviewer','test','--kind','self','--evidence',e)
        t=agent.Task(self.root/'tasks/AUD-001.md')
        t.meta['review'].pop('digest_version')
        t.meta['review']['digest']=agent.Project(self.root).digest(t,'raw')
        t.save()
        self.runcli('done','AUD-001')
        path.write_bytes(text.encode('utf-8'))
        self.runcli('validate')
        path.write_bytes(text.replace('artificial','modified').encode('utf-8'))
        self.runcli('validate',ok=False)

    def test_legacy_review_survives_linux_to_windows_checkout(self):
        e=self.submit()
        self.runcli('review','AUD-001','--result','approve','--reviewer','test','--kind','self','--evidence',e)
        t=agent.Task(self.root/'tasks/AUD-001.md')
        t.meta['review'].pop('digest_version')
        t.save()
        path=self.root/e
        text=path.read_text(encoding='utf-8')
        path.write_bytes(text.replace('\n','\r\n').encode('utf-8'))
        self.runcli('done','AUD-001')
        self.runcli('validate')

    def test_unknown_digest_version_is_rejected(self):
        e=self.submit()
        self.runcli('review','AUD-001','--result','approve','--reviewer','test','--kind','self','--evidence',e)
        t=agent.Task(self.root/'tasks/AUD-001.md')
        t.meta['review']['digest_version']='unknown'
        t.save()
        self.runcli('done','AUD-001',ok=False)

    def test_legacy_mixed_evidence_line_endings_survive_checkout(self):
        e=self.submit()
        other=self.evidence('second.md')
        path=self.root/other
        text=path.read_text(encoding='utf-8')
        path.write_bytes(text.replace('\n','\r\n').encode('utf-8'))
        self.runcli('submit','AUD-001','--evidence',e,'--evidence',other)
        self.runcli('review','AUD-001','--result','approve','--reviewer','test','--kind','self','--evidence',e)
        t=agent.Task(self.root/'tasks/AUD-001.md')
        t.meta['review'].pop('digest_version')
        t.meta['review']['digest']=agent.Project(self.root).digest(t,'raw')
        t.save()
        path.write_bytes(text.encode('utf-8'))
        self.runcli('done','AUD-001')
        self.runcli('validate')
        path.write_bytes((text+'Changed evidence.\n').encode('utf-8'))
        self.runcli('validate',ok=False)

    def test_review_rejection_returns_to_implementation(self):
        e=self.submit()
        self.runcli('review','AUD-001','--result','reject','--reviewer','test','--kind','self','--evidence',e)
        self.assertEqual(self.runcli('next')['status'],'in_progress')

    def test_block_and_resume(self):
        self.runcli('start','--owner','test')
        self.runcli('block','AUD-001','--reason','Synthetic missing input')
        self.assertIsNone(self.runcli('status')['next'])
        self.runcli('resume','AUD-001','--owner','test','--note','Fixture input available')
        self.assertEqual(self.runcli('next')['status'],'in_progress')

    def test_required_task_cannot_be_skipped(self):
        self.runcli('skip','AUD-001','--reason','test','--reviewer','test','--evidence',self.evidence(),ok=False)

    def test_optional_task_can_be_deferred_with_evidence(self):
        self.runcli('skip','PAR-006','--reason','Synthetic scope deferral','--reviewer','synthetic-owner','--evidence',self.evidence())
        status=self.runcli('status')
        self.assertEqual(status['counts']['skipped'],1)
        self.assertEqual(status['done_percent'],0)

    def test_cycle_is_rejected(self):
        self.editmeta('AUD-001',depends_on=['AUD-002'])
        result=self.runcli('validate',ok=False)
        self.assertIn('cycle',result['error'])

    def test_missing_dependency_rejected(self):
        self.editmeta('AUD-001',depends_on=['BAD-999'])
        self.runcli('validate',ok=False)

    def test_bad_metadata_rejected(self):
        self.editmeta('AUD-001',optional='false')
        self.runcli('validate',ok=False)

    def test_duplicate_id_filename_rejected(self):
        shutil.copy(self.root/'tasks/AUD-001.md',self.root/'tasks/COPY-001.md')
        self.runcli('validate',ok=False)

    def test_done_cannot_be_fabricated_by_status_alone(self):
        self.editmeta('AUD-001',status='done')
        self.runcli('validate',ok=False)

    def test_lock_blocks_writer_and_is_preserved(self):
        lock=self.root/'.controller.lock';lock.write_text('synthetic live lock')
        self.runcli('start','--owner','test',ok=False)
        self.assertEqual(lock.read_text(),'synthetic live lock')

    def test_reopen_protects_completed_dependents(self):
        self.finish();self.finish('AUD-002')
        self.runcli('reopen','AUD-001','--reason','test',ok=False)
        self.runcli('reopen','AUD-002','--reason','test')
        self.runcli('reopen','AUD-001','--reason','test')
        self.assertEqual(self.runcli('next')['id'],'AUD-001')

    def test_context_contains_task_and_role(self):
        context=self.runcli('context')
        self.assertIn('AUD-001',context)
        self.assertIn('Technical lead',context)
        self.assertIn('docs/REPOSITORY_MAP.md',context)

    def assert_graph_resolves(self):
        # Synthetic simulation verifies the shipped dependency graph, not actual delivery.
        expected_ids={agent.Task(path).id for path in (self.root/'tasks').glob('*.md')}
        completed=[]
        for _ in range(len(expected_ids)+1):
            p=agent.Project(self.root);t=p.next()
            if not t:break
            id=t.id
            self.assertNotIn(id,completed,'A resolved task was selected again')
            if t.meta['optional']:
                self.runcli('skip',id,'--reason','Synthetic graph test deferral','--reviewer','synthetic-owner','--evidence',self.evidence(id+'-waiver.md'))
            else:
                self.finish(id,'human' if t.meta['human_review'] else 'self')
            completed.append(id)
        state=self.runcli('status')
        self.assertCountEqual(completed,expected_ids)
        self.assertIsNone(state['next'])
        self.assertEqual(state['blocked'],[])
        self.assertEqual(state['waiting'],[])

    def test_full_graph_can_resolve_without_deadlock(self):
        self.assert_graph_resolves()

    def test_graph_resolution_includes_new_split_child(self):
        # Add a child only to this test's copied backlog; retain parent acceptance.
        parent=agent.Task(self.root/'tasks/MON-006.md')
        child=agent.Task(self.root/'tasks/MON-011.md')
        child.path=self.root/'tasks/TST-001.md'
        child.meta.update(id='TST-001',title='Synthetic split child',
                          depends_on=list(parent.meta['depends_on']))
        child.save()
        parent.meta['depends_on'].append('TST-001')
        parent.save()
        self.runcli('validate')
        self.assert_graph_resolves()

if __name__=='__main__':
    unittest.main()
