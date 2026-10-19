import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, readFile, writeFile, rm, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import test from 'node:test';
import { decodeReview, decodeWireResponse, validateReplacement } from './review-mdx-translations.mjs';

const runFile = promisify(execFile);
const script = fileURLToPath(new URL('./review-mdx-translations.mjs', import.meta.url));
const english = '---\ntitle: Guide\ndescription: A useful guide.\n---\n\n## Start\n\nHello **reader**, use `amountMinor`.\n\n[Docs](/docs)\n\n```js\nconst amount = 10;\n```\n';
const persian = '---\ntitle: راهنما\ndescription: راهنمای کاربردی.\n---\n\n## شروع\n\nسلام **خواننده**، از `amountMinor` استفاده کنید.\n\n[مستندات](/docs)\n\n```js\nconst amount = 10;\n```\n';
const improved = persian.replace('سلام', 'درود');
const answer = (status = 'ok', text = null) => ({ choices: [{ finish_reason: 'stop', message: {
  content: JSON.stringify({ status, reason: 'Reviewed Persian accuracy.', persian_mdx: text }),
} }], usage: { total_tokens: 123 } });

async function fixture(t, respond = () => ({ body: answer() })) {
  const root = await mkdtemp(path.join(tmpdir(), 'dubbl-mdx-review-test-'));
  const docs = path.join(root, 'docs'), state = path.join(root, 'state');
  await mkdir(docs);
  await writeFile(path.join(docs, 'a.mdx'), english, 'utf8');
  await writeFile(path.join(docs, 'a.fa.mdx'), persian, 'utf8');
  const calls = [];
  const server = createServer(async (request, response) => {
    let text = '';
    for await (const chunk of request) text += chunk;
    calls.push({ url: request.url, headers: request.headers, payload: JSON.parse(text || '{}') });
    const result = await respond(calls.length, calls.at(-1));
    response.writeHead(result.code || 200, { 'Content-Type': 'application/json', ...result.headers });
    response.end(JSON.stringify(result.body || {}));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}/v1`;
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    const absolute = path.resolve(root);
    assert.equal(path.dirname(absolute), path.resolve(tmpdir()));
    assert.ok(path.basename(absolute).startsWith('dubbl-mdx-review-test-'));
    await rm(absolute, { recursive: true, force: true });
  });
  const run = (...args) => runFile(process.execPath, [script, '--root', docs, '--state', state,
    '--config', path.join(root, 'absent.env'), '--base-url', baseUrl, '--delay', '0', '--retry-delay', '0', ...args],
  { env: { ...process.env, MDX_REVIEW_API_KEY: 'test-key-only' }, timeout: 20000 });
  const manifest = async () => JSON.parse(await readFile(path.join(state, 'manifest.json'), 'utf8'));
  return { root, docs, state, calls, run, manifest };
}

test('MDX validation permits prose corrections but protects executable structure and destinations', async () => {
  await validateReplacement(persian, improved);
  for (const bad of [improved.replace('/docs', '/phishing'), improved.replace('amount = 10', 'amount = 99'),
    improved.replace('amountMinor', 'amount'), improved + '\n{process.exit()}\n',
    improved.replace('title:', 'other:')]) {
    await assert.rejects(validateReplacement(persian, bad));
  }
  const jsx = persian + '\n<Callout title="عنوان">متن</Callout>\n';
  await assert.rejects(validateReplacement(jsx, jsx.replace('title="عنوان"', 'title="تغییر"')));
  assert.throws(() => decodeReview({ choices: [{ finish_reason: 'length', message: { content: '{}' } }] }), /Incomplete/);
});

test('review once, skip unchanged, re-review changed input; payload contains exactly one pair', async t => {
  const f = await fixture(t);
  await f.run();
  await f.run();
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].url, '/v1/chat/completions');
  assert.equal(f.calls[0].headers.authorization, 'Bearer test-key-only');
  assert.equal(f.calls[0].payload.messages.length, 2);
  assert.equal(f.calls[0].payload.model, 'ag/gemini-3.8-flash-high');
  assert.equal(f.calls[0].payload.stream, false);
  assert.deepEqual(JSON.parse(f.calls[0].payload.messages[1].content), {
    english_path: 'a.mdx', persian_path: 'a.fa.mdx', english_mdx: english, persian_mdx: persian, source_structure_deficits: {},
  });
  await writeFile(path.join(f.docs, 'a.mdx'), english.replace('Hello', 'Welcome'));
  await f.run();
  assert.equal(f.calls.length, 2);
  assert.equal((await f.manifest()).files[0].status, 'ok');
});

test('replace safely, back up original, resume after edit/manifest crash, reuse saved response', async t => {
  const f = await fixture(t, () => ({ body: answer('replace', improved) }));
  await f.run();
  assert.equal(await readFile(path.join(f.docs, 'a.fa.mdx'), 'utf8'), improved);
  assert.equal(await readFile(path.join(f.docs, 'a.mdx'), 'utf8'), english);
  const manifest = await f.manifest(), row = manifest.files[0];
  const jobDir = path.join(f.state, 'jobs', row.job);
  assert.equal(await readFile(path.join(jobDir, 'before.fa.mdx'), 'utf8'), persian);
  row.status = 'pending'; row.outputHash = null;
  await writeFile(path.join(f.state, 'manifest.json'), JSON.stringify(manifest));
  await f.run();
  assert.equal(f.calls.length, 1);
  assert.equal((await f.manifest()).files[0].status, 'updated');
  // Simulate a different interruption: response on disk, edit not yet applied.
  await writeFile(path.join(f.docs, 'a.fa.mdx'), persian);
  await unlink(path.join(jobDir, 'prepared.json'));
  await writeFile(path.join(f.state, 'manifest.json'), JSON.stringify(manifest));
  await f.run();
  assert.equal(f.calls.length, 1);
  assert.equal(await readFile(path.join(f.docs, 'a.fa.mdx'), 'utf8'), improved);
  // Recover when only the raw wire response was saved before interruption.
  await writeFile(path.join(f.docs, 'a.fa.mdx'), persian);
  await unlink(path.join(jobDir, 'response.json'));
  await unlink(path.join(jobDir, 'prepared.json'));
  await writeFile(path.join(f.state, 'manifest.json'), JSON.stringify(manifest));
  await f.run();
  assert.equal(f.calls.length, 1);
  assert.equal(await readFile(path.join(f.docs, 'a.fa.mdx'), 'utf8'), improved);
});

test('both ordinary JSON and event streams decode; truncated streams are rejected', () => {
  const result = answer();
  assert.deepEqual(decodeWireResponse(JSON.stringify(result)), result);
  const content = result.choices[0].message.content;
  const stream = [
    ': keepalive\n\n',
    ...[content.slice(0, 15), content.slice(15)].map(text => `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: text } }] })}\n\n`),
    `data: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: 'stop' }], usage: { total_tokens: 10 } })}\n\n`,
    'data: [DONE]\n\n',
  ].join('');
  assert.equal(decodeReview(decodeWireResponse(stream)).status, 'ok');
  assert.throws(() => decodeWireResponse(`data: ${JSON.stringify({ choices: [{ delta: { content: '{}' } }] })}\n\n`), /Incomplete/);
});

test('429/503 retries share an idempotency key and finish within the attempt budget', async t => {
  const f = await fixture(t, n => n < 3 ? { code: n === 1 ? 429 : 503, headers: { 'Retry-After': '0' } } : { body: answer() });
  await f.run();
  assert.equal(f.calls.length, 3);
  assert.equal(new Set(f.calls.map(call => call.headers['idempotency-key'])).size, 1);
  assert.equal((await f.manifest()).files[0].attempts, 3);
});

test('unsafe replacements retry without edits, then a later run retries only the failure', async t => {
  let allow = false;
  const f = await fixture(t, () => ({ body: allow ? answer() : answer('replace', improved.replace('/docs', '/wrong')) }));
  await assert.rejects(f.run(), error => error.code === 1);
  assert.equal(f.calls.length, 3);
  assert.equal(new Set(f.calls.map(call => call.headers['idempotency-key'])).size, 3);
  assert.equal(await readFile(path.join(f.docs, 'a.fa.mdx'), 'utf8'), persian);
  assert.equal((await f.manifest()).files[0].status, 'failed');
  allow = true;
  await f.run();
  assert.equal(f.calls.length, 4);
  await f.run();
  assert.equal(f.calls.length, 4);
});

test('an incomplete Persian file cannot be approved; missing English sections are restored safely', async t => {
  const complete = persian + '\n## بخش دیگر\n\nمحتوای حذف‌شده.\n';
  const f = await fixture(t, n => ({ body: n === 1 ? answer() : answer('replace', complete) }));
  await writeFile(path.join(f.docs, 'a.mdx'), english + '\n## More\n\nMissing content.\n');
  await f.run();
  assert.equal(f.calls.length, 2);
  assert.deepEqual(JSON.parse(f.calls[0].payload.messages[1].content).source_structure_deficits, { heading: 1, paragraph: 1 });
  assert.equal(await readFile(path.join(f.docs, 'a.fa.mdx'), 'utf8'), complete);
  await f.run();
  assert.equal(f.calls.length, 2);
});

test('file edits during a request are preserved and marked as a conflict', async t => {
  let f;
  f = await fixture(t, async () => {
    await writeFile(path.join(f.docs, 'a.fa.mdx'), persian + '\nتغییر کاربر\n');
    return { body: answer('replace', improved) };
  });
  await assert.rejects(f.run(), error => error.code === 1);
  assert.match(await readFile(path.join(f.docs, 'a.fa.mdx'), 'utf8'), /تغییر کاربر/);
  assert.equal((await f.manifest()).files[0].status, 'conflict');
});

test('inventory is sorted, detects missing counterparts, excludes Stripe, and never sends requests', async t => {
  const f = await fixture(t);
  await writeFile(path.join(f.docs, 'z.mdx'), english);
  await writeFile(path.join(f.docs, 'orphan.fa.mdx'), persian);
  await writeFile(path.join(f.docs, 'stripe-integration.mdx'), english);
  await writeFile(path.join(f.docs, 'stripe-integration.fa.mdx'), persian);
  await f.run('--dry-run');
  assert.equal(f.calls.length, 0);
  assert.deepEqual((await f.manifest()).files.map(row => [row.en, row.status]), [
    ['a.mdx', 'pending'], ['orphan.mdx', 'missing_english'],
    ['stripe-integration.mdx', 'excluded_stripe'], ['z.mdx', 'missing_persian'],
  ]);
  await assert.rejects(f.run(), error => error.code === 1);
  assert.equal(f.calls.length, 1);
  assert.ok((await readFile(path.join(f.state, 'progress.csv'), 'utf8')).startsWith('\uFEFF'));
});

test('oversized pairs are blocked before spending tokens', async t => {
  const f = await fixture(t);
  await assert.rejects(f.run('--max-input-bytes', '10'), error => error.code === 1);
  assert.equal(f.calls.length, 0);
  assert.equal((await f.manifest()).files[0].status, 'blocked');
});

test('authentication failures stop the batch without retrying or exposing secrets', async t => {
  const f = await fixture(t, () => ({ code: 401, body: { authorization: 'Bearer test-key-only' } }));
  await writeFile(path.join(f.docs, 'b.mdx'), english);
  await writeFile(path.join(f.docs, 'b.fa.mdx'), persian);
  await assert.rejects(f.run(), error => {
    assert.doesNotMatch(error.stdout + error.stderr, /test-key-only/);
    return error.code === 1;
  });
  assert.equal(f.calls.length, 1);
  assert.equal((await f.manifest()).files[1].status, 'pending');
});

test('a second process cannot send duplicate requests while the first holds the state lock', async t => {
  let received, release;
  const started = new Promise(resolve => { received = resolve; });
  const wait = new Promise(resolve => { release = resolve; });
  const f = await fixture(t, async () => { received(); await wait; return { body: answer() }; });
  const first = f.run();
  await started;
  try { await assert.rejects(f.run(), error => /Another reviewer is running/.test(error.stderr)); }
  finally { release(); }
  await first;
  assert.equal(f.calls.length, 1);
});

test('a stop file finishes the active checkpoint and resumes without resending that pair', async t => {
  let f, stopped = false;
  f = await fixture(t, async () => {
    if (!stopped) { stopped = true; await writeFile(path.join(f.state, 'STOP'), ''); }
    return { body: answer() };
  });
  await writeFile(path.join(f.docs, 'b.mdx'), english);
  await writeFile(path.join(f.docs, 'b.fa.mdx'), persian);
  await assert.rejects(f.run(), error => error.code === 130);
  assert.equal(f.calls.length, 1);
  assert.deepEqual((await f.manifest()).files.map(row => row.status), ['ok', 'pending']);
  await f.run();
  assert.equal(f.calls.length, 2);
  assert.deepEqual((await f.manifest()).files.map(row => row.status), ['ok', 'ok']);
});
