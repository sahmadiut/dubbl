import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, readFile, writeFile, rm, unlink, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import test from 'node:test';
import { decodeTranslation, decodeWireResponse, fetchCompletion, planMdxChunks, validateReplacement } from './review-mdx-translations.mjs';
import { assembleChunks, createRequestPool, runWorkers } from './mdx-review-chunks.mjs';
import { ReviewTerminal } from './mdx-review-terminal.mjs';

const runFile = promisify(execFile);
const script = fileURLToPath(new URL('./review-mdx-translations.mjs', import.meta.url));
const english = '---\ntitle: Guide\ndescription: A useful guide.\n---\n\n## Start\n\nHello **reader**, use `amountMinor`.\n\n[Docs](/docs)\n\n```js\nconst amount = 10;\n```\n';
const oldPersian = '---\ntitle: ترجمه قدیمی\ndescription: متن قدیمی.\n---\n\nمتن فارسی قبلی PERSIAN_SECRET_SENTINEL\n';
const translate = source => source.replace(/^title:.*$/m, 'title: راهنما').replace(/^description:.*$/m, 'description: راهنمای کاربردی.')
  .replace(/## Part (\d+)/g, '## بخش $1').replace('## Start', '## شروع').replaceAll('Hello', 'سلام')
  .replaceAll('reader', 'خواننده').replaceAll('[Docs]', '[مستندات]').replaceAll('Read the reference carefully.', 'راهنما را با دقت بخوانید.');
const answer = text => ({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ persian_mdx: text }) } }], usage: { total_tokens: 123 } });
const inputOf = call => JSON.parse(call.payload.messages[1].content);

async function fixture(t, respond = (_, call) => ({ body: answer(translate(inputOf(call).english_mdx)) })) {
  const root = await mkdtemp(path.join(tmpdir(), 'dubbl-mdx-translate-test-'));
  const docs = path.join(root, 'docs'), state = path.join(root, 'state');
  await mkdir(docs);
  await writeFile(path.join(docs, 'a.mdx'), english, 'utf8');
  await writeFile(path.join(docs, 'a.fa.mdx'), oldPersian, 'utf8');
  const calls = [];
  const server = createServer(async (request, response) => {
    let text = '';
    for await (const chunk of request) text += chunk;
    calls.push({ url: request.url, headers: request.headers, payload: JSON.parse(text || '{}') });
    const result = await respond(calls.length, calls.at(-1));
    if (result.serve) { result.serve(response); return; }
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
    assert.ok(path.basename(absolute).startsWith('dubbl-mdx-translate-test-'));
    await rm(absolute, { recursive: true, force: true });
  });
  const run = (...args) => runFile(process.execPath, [script, '--root', docs, '--state', state,
    '--config', path.join(root, 'absent.env'), '--base-url', baseUrl, '--delay', '0', '--retry-delay', '0', ...args],
  { env: { ...process.env, MDX_REVIEW_API_KEY: 'test-key-only' }, timeout: 20000 });
  const manifest = async () => JSON.parse(await readFile(path.join(state, 'manifest.json'), 'utf8'));
  return { root, docs, state, calls, run, manifest };
}

function largeSource(count = 14) {
  return '---\ntitle: Guide\ndescription: A useful guide.\n---\n\n' + Array.from({ length: count }, (_, i) =>
    `## Part ${i}\n\nUse \`amountMinor\` for section ${i}. ${'Read the reference carefully. '.repeat(5)}\n\n\`\`\`js\nconst section${i} = ${i};\n\`\`\`\n\n<Callout title="Note">Text ${i}</Callout>\n\n`).join('');
}

test('valid MDX changes are accepted; broken syntax/frontmatter/encoding are rejected', async () => {
  const fa = translate(english);
  await validateReplacement(fa.replace('/docs', '/new-docs').replace('amount = 10', 'amount = 99') + '\n## بخش تازه\n\nمتن تازه.\n');
  await validateReplacement(fa + '\n<Callout title="عنوان تازه">متن</Callout>\n');
  for (const invalid of [fa + '\n<Callout>\n', fa + '\nexport const = ;\n', fa.replace('title:', 'other:'),
    fa.replace('title: راهنما', 'title: [unclosed'), fa + '\uFFFD', english]) await assert.rejects(validateReplacement(invalid));
  assert.throws(() => decodeTranslation({ choices: [{ finish_reason: 'length', message: { content: '{}' } }] }), /Incomplete/);
  assert.throws(() => decodeTranslation(answer('')), /nonempty/);
});

test('requests contain only English; completion is skipped on restart and owner edits are preserved', async t => {
  const f = await fixture(t);
  await f.run(); await f.run();
  assert.equal(f.calls.length, 1);
  const call = f.calls[0];
  assert.equal(call.payload.model, 'ag/gemini-3.8-flash-high');
  assert.equal(call.payload.stream, true);
  assert.equal(call.headers.authorization, 'Bearer test-key-only');
  assert.deepEqual(inputOf(call), { english_path: 'a.mdx', persian_path: 'a.fa.mdx', english_mdx: english });
  assert.doesNotMatch(JSON.stringify(call.payload), /PERSIAN_SECRET_SENTINEL/);
  assert.equal(await readFile(path.join(f.docs, 'a.fa.mdx'), 'utf8'), translate(english));
  await writeFile(path.join(f.docs, 'a.fa.mdx'), translate(english) + '\nویرایش دستی کاربر\n');
  await f.run();
  assert.equal(f.calls.length, 1);
  assert.match(await readFile(path.join(f.docs, 'a.fa.mdx'), 'utf8'), /ویرایش دستی/);
  await writeFile(path.join(f.docs, 'a.mdx'), english.replace('Hello', 'Welcome'));
  await f.run();
  assert.equal(f.calls.length, 2);
  assert.equal((await f.manifest()).files[0].status, 'translated');
});

test('missing Persian is created; invalid old Persian is ignored and backed up locally', async t => {
  const f = await fixture(t);
  const broken = '<Broken> PERSIAN_SECRET_SENTINEL';
  await writeFile(path.join(f.docs, 'a.fa.mdx'), broken);
  await writeFile(path.join(f.docs, 'b.mdx'), english);
  await f.run();
  assert.equal(f.calls.length, 2);
  assert.equal(await readFile(path.join(f.docs, 'b.fa.mdx'), 'utf8'), translate(english));
  const row = (await f.manifest()).files[0];
  assert.equal(await readFile(path.join(f.state, 'jobs', row.job, 'before.fa.mdx'), 'utf8'), broken);
  for (const call of f.calls) assert.doesNotMatch(JSON.stringify(call.payload), /PERSIAN_SECRET_SENTINEL/);
  assert.equal(await readFile(path.join(f.docs, 'a.mdx'), 'utf8'), english);
});

test('saved response, raw response and prepared edit recover without another API request', async t => {
  const f = await fixture(t);
  await f.run();
  const manifest = await f.manifest(), row = manifest.files[0], dir = path.join(f.state, 'jobs', row.job);
  row.status = 'pending'; row.outputHash = null;
  await writeFile(path.join(f.state, 'manifest.json'), JSON.stringify(manifest));
  await f.run();
  assert.equal(f.calls.length, 1);
  await writeFile(path.join(f.docs, 'a.fa.mdx'), oldPersian);
  await unlink(path.join(dir, 'prepared.json'));
  await unlink(path.join(dir, 'response.json'));
  await writeFile(path.join(f.state, 'manifest.json'), JSON.stringify(manifest));
  await f.run();
  assert.equal(f.calls.length, 1);
  assert.equal(await readFile(path.join(f.docs, 'a.fa.mdx'), 'utf8'), translate(english));
});

test('source chunks preserve every byte and never split JSX or code blocks', async () => {
  const source = largeSource();
  const chunks = await planMdxChunks(source, { 'chunk-bytes': 900, 'chunk-lines': 35 });
  assert.ok(chunks.length > 3);
  assert.equal(chunks.map(chunk => chunk.english_mdx).join(''), source);
  assert.equal(chunks[0].frontmatter, true);
  for (const chunk of chunks) {
    assert.equal('persian_mdx' in chunk, false);
    assert.ok(chunk.bytes <= 900);
    assert.equal((chunk.english_mdx.match(/```/g) || []).length % 2, 0);
    const header = chunk.frontmatter ? '' : '---\ntitle: راهنما\ndescription: توضیح\n---\n';
    await validateReplacement(header + translate(chunk.english_mdx));
  }
  await validateReplacement(assembleChunks(chunks.map(chunk => translate(chunk.english_mdx))));
});

test('three global requests across files/chunks; large sources exceed the whole-file budget safely', async t => {
  let active = 0, maximum = 0;
  const f = await fixture(t, async (_, call) => {
    active++; maximum = Math.max(maximum, active);
    await new Promise(resolve => setTimeout(resolve, 30));
    active--; return { body: answer(translate(inputOf(call).english_mdx)) };
  });
  for (const name of ['a', 'b', 'c', 'd']) await writeFile(path.join(f.docs, `${name}.mdx`), largeSource(7));
  const { stdout } = await f.run('--chunk-bytes', '900', '--chunk-lines', '35', '--max-input-bytes', '1000');
  assert.equal(maximum, 3);
  assert.match(stdout, /SPLIT/); assert.doesNotMatch(stdout, /\x1b\[/);
  for (const call of f.calls) {
    const input = inputOf(call);
    assert.ok(input.chunk >= 1 && input.total_chunks > 3);
    assert.ok(Buffer.byteLength(input.english_mdx) <= 900);
    assert.equal('persian_mdx' in input, false);
    assert.equal(call.payload.max_tokens, 8192);
    assert.doesNotMatch(JSON.stringify(call.payload), /PERSIAN_SECRET_SENTINEL/);
  }
  assert.ok((await f.manifest()).files.every(row => row.status === 'translated'));
  const count = f.calls.length;
  await f.run('--chunk-bytes', '900', '--chunk-lines', '35');
  assert.equal(f.calls.length, count);
});

test('a failed chunk leaves the old file intact; only the failure is sent again after restart', async t => {
  let fail = true;
  const f = await fixture(t, (_, call) => inputOf(call).chunk === 2 && fail
    ? { code: 503 } : { body: answer(translate(inputOf(call).english_mdx)) });
  await writeFile(path.join(f.docs, 'a.mdx'), largeSource(9));
  const args = ['--chunk-bytes', '900', '--chunk-lines', '35', '--attempts', '1'];
  await assert.rejects(f.run(...args), error => error.code === 1);
  assert.equal(await readFile(path.join(f.docs, 'a.fa.mdx'), 'utf8'), oldPersian);
  const first = await f.manifest(), count = f.calls.length, row = first.files[0];
  const saved = row.chunks.find(chunk => chunk.status === 'translated');
  await unlink(path.join(f.state, 'jobs', row.job, 'chunks', saved.id, 'result.json'));
  fail = false;
  await f.run(...args);
  assert.equal(f.calls.length, count + 1);
  const done = (await f.manifest()).files[0];
  assert.equal(done.status, 'translated');
  assert.equal(done.chunks.filter(chunk => chunk.cached).length, done.chunks.length - 1);
  await validateReplacement(await readFile(path.join(f.docs, 'a.fa.mdx'), 'utf8'));
  assert.equal(await readFile(path.join(f.state, 'jobs', done.job, 'before.fa.mdx'), 'utf8'), oldPersian);
});

test('reset archives checkpoints and backups, preserves Persian, and sends fresh translation requests', async t => {
  const f = await fixture(t); await f.run();
  const fa = await readFile(path.join(f.docs, 'a.fa.mdx'), 'utf8');
  await f.run('--reset', '--list');
  assert.equal(f.calls.length, 1);
  assert.equal((await f.manifest()).files[0].status, 'pending');
  assert.equal(await readFile(path.join(f.docs, 'a.fa.mdx'), 'utf8'), fa);
  const history = path.join(f.root, 'state-history');
  const archives = await readdir(history);
  assert.equal(archives.length, 1);
  assert.ok((await readdir(path.join(history, archives[0]))).includes('jobs'));
  await f.run(); assert.equal(f.calls.length, 2);
});

test('concurrent owner edits are preserved as conflicts', async t => {
  let f;
  f = await fixture(t, async (_, call) => {
    await writeFile(path.join(f.docs, 'a.fa.mdx'), oldPersian + '\nتغییر همزمان کاربر\n');
    return { body: answer(translate(inputOf(call).english_mdx)) };
  });
  await assert.rejects(f.run(), error => error.code === 1);
  assert.equal((await f.manifest()).files[0].status, 'conflict');
  assert.match(await readFile(path.join(f.docs, 'a.fa.mdx'), 'utf8'), /تغییر همزمان/);
});

test('429/503 retries reuse idempotency keys; invalid MDX uses a new generation', async t => {
  const f = await fixture(t, (n, call) => n < 3 ? { code: n === 1 ? 429 : 503, headers: { 'Retry-After': '0' } }
    : { body: answer(translate(inputOf(call).english_mdx)) });
  await f.run(); assert.equal(f.calls.length, 3);
  assert.equal(new Set(f.calls.map(call => call.headers['idempotency-key'])).size, 1);
  const g = await fixture(t, (n, call) => ({ body: answer(translate(inputOf(call).english_mdx) + (n === 1 ? '\n<Broken>\n' : '')) }));
  await g.run(); assert.equal(g.calls.length, 2);
  assert.notEqual(g.calls[0].headers['idempotency-key'], g.calls[1].headers['idempotency-key']);
});

test('inventory and dry-run are local, exclude Stripe, and do not require Persian counterparts', async t => {
  const f = await fixture(t);
  await writeFile(path.join(f.docs, 'b.mdx'), largeSource(4));
  await writeFile(path.join(f.docs, 'orphan.fa.mdx'), oldPersian);
  await writeFile(path.join(f.docs, 'stripe-integration.mdx'), english);
  await f.run('--dry-run');
  assert.equal(f.calls.length, 0);
  assert.deepEqual((await f.manifest()).files.map(row => [row.en, row.status]), [
    ['a.mdx', 'pending'], ['b.mdx', 'pending'], ['stripe-integration.mdx', 'excluded_stripe'],
  ]);
  await f.run('--limit', '1'); assert.equal(f.calls.length, 1);
  assert.deepEqual((await f.manifest()).files.map(row => row.status), ['translated', 'pending', 'excluded_stripe']);
});

test('hard input limit blocks oversized atomic input before a request', async t => {
  const f = await fixture(t);
  await assert.rejects(f.run('--max-input-bytes', '1'), error => error.code === 1);
  assert.equal(f.calls.length, 0);
});

test('authentication failures stop queued work without exposing credentials', async t => {
  const f = await fixture(t, () => ({ code: 401, body: { authorization: 'Bearer test-key-only' } }));
  for (const name of ['b', 'c', 'd']) await writeFile(path.join(f.docs, `${name}.mdx`), english);
  await assert.rejects(f.run(), error => { assert.doesNotMatch(error.stdout + error.stderr, /test-key-only/); return error.code === 1; });
  assert.ok(f.calls.length >= 1 && f.calls.length <= 3);
  assert.equal((await f.manifest()).files[3].status, 'pending');
});

test('a second process cannot send requests while the state is locked', async t => {
  let received, release;
  const started = new Promise(resolve => { received = resolve; }), wait = new Promise(resolve => { release = resolve; });
  const f = await fixture(t, async (_, call) => { received(); await wait; return { body: answer(translate(inputOf(call).english_mdx)) }; });
  const first = f.run(); await started;
  try { await assert.rejects(f.run(), error => /Another reviewer is running/.test(error.stderr)); }
  finally { release(); }
  await first; assert.equal(f.calls.length, 1);
});

test('STOP finishes active work and resumes without resending a completed source', async t => {
  let f, stopped = false;
  f = await fixture(t, async (_, call) => {
    if (!stopped) { stopped = true; await writeFile(path.join(f.state, 'STOP'), ''); }
    return { body: answer(translate(inputOf(call).english_mdx)) };
  });
  await writeFile(path.join(f.docs, 'b.mdx'), english);
  await assert.rejects(f.run('--concurrency', '1'), error => error.code === 130);
  assert.equal(f.calls.length, 1);
  await f.run(); assert.equal(f.calls.length, 2);
});

const transport = { baseUrl: 'http://127.0.0.1/v1', apiKey: 'test-only', timeout: 0.2, 'idle-timeout': 0.1, 'progress-interval': 5 };
const transportJob = { en: 'test.mdx', id: 'test-job', attempts: 1 };
test('JSON and SSE decode; truncated streams are rejected', () => {
  const response = answer(translate(english));
  assert.deepEqual(decodeWireResponse(JSON.stringify(response)), response);
  assert.throws(() => decodeWireResponse('data: {"choices":[{"delta":{"content":"partial"}}]}\n\n'), /Incomplete/);
});
test('hard deadlines bound stalled headers and endless keepalives', async () => {
  await assert.rejects(fetchCompletion({ ...transport, timeout: 0.05 }, {}, transportJob, () => new Promise(() => {})), /total deadline/);
  let timer;
  const response = new Response(new ReadableStream({
    start(controller) { timer = setInterval(() => controller.enqueue(new TextEncoder().encode(': ping\n\n')), 10); },
    cancel() { clearInterval(timer); },
  }), { headers: { 'content-type': 'text/event-stream' } });
  await assert.rejects(fetchCompletion({ ...transport, timeout: 0.1 }, {}, transportJob, async () => response), /total deadline/);
});
test('silent bodies hit the idle deadline and cancel the reader', async () => {
  let cancelled = false;
  const response = new Response(new ReadableStream({ cancel() { cancelled = true; } }), { headers: { 'content-type': 'text/event-stream' } });
  await assert.rejects(fetchCompletion({ ...transport, 'idle-timeout': 0.05 }, {}, transportJob, async () => response), /No response data/);
  assert.equal(cancelled, true);
});
test('terminal SSE events finish without EOF, including split UTF-8 and partial trailing events', async () => {
  let cancelled = false;
  const content = JSON.stringify({ persian_mdx: 'متن ترجمه‌شده' });
  const bytes = new TextEncoder().encode(`data: ${JSON.stringify({ choices: [{ delta: { content }, finish_reason: 'stop' }] })}\n\ndata: {"usage":`);
  const response = new Response(new ReadableStream({ start(controller) {
    const split = Math.floor(bytes.length / 2);
    for (const byte of bytes.slice(0, split)) controller.enqueue(new Uint8Array([byte]));
    controller.enqueue(bytes.slice(split));
  }, cancel() { cancelled = true; } }), { headers: { 'content-type': 'text/event-stream' } });
  const raw = await fetchCompletion(transport, {}, transportJob, async () => response);
  assert.equal(decodeTranslation(decodeWireResponse(raw)).persian_mdx, 'متن ترجمه‌شده');
  assert.equal(cancelled, true);
});
test('Ctrl+C cancels immediately; queued pool entries never acquire a slot', async () => {
  const controller = new AbortController();
  const pending = fetchCompletion({ ...transport, signal: controller.signal }, {}, transportJob, () => new Promise(() => {}));
  controller.abort(); await assert.rejects(pending, error => error.code === 'REVIEW_STOP');
  const pool = createRequestPool(1), queuedController = new AbortController();
  let release, started = false;
  const first = pool.run(() => new Promise(resolve => { release = resolve; })); await Promise.resolve();
  const second = pool.run(() => { started = true; }, queuedController.signal);
  queuedController.abort(); await assert.rejects(second, error => error.code === 'REVIEW_STOP');
  release(); await first; assert.equal(started, false);
  let finished = false;
  await assert.rejects(runWorkers([0, 1], 2, async index => {
    if (!index) throw new Error('failure');
    await new Promise(resolve => setTimeout(resolve, 10)); finished = true;
  }), /failure/); assert.equal(finished, true);
});
test('the CLI reports heartbeat progress while waiting for headers', async t => {
  const f = await fixture(t, async (_, call) => {
    await new Promise(resolve => setTimeout(resolve, 1200)); return { body: answer(translate(inputOf(call).english_mdx)) };
  });
  const { stdout } = await f.run('--timeout', '3', '--idle-timeout', '3', '--progress-interval', '1');
  assert.match(stdout, /\d+\/3s; waiting for response headers/); assert.doesNotMatch(stdout, /\x1b\[/);
});
test('timeouts are recorded and other files continue', async t => {
  const f = await fixture(t, (_, call) => inputOf(call).english_path === 'a.mdx' ? { serve: response => {
    response.writeHead(200, { 'Content-Type': 'text/event-stream' }); response.flushHeaders();
  } } : { body: answer(translate(inputOf(call).english_mdx)) });
  await writeFile(path.join(f.docs, 'b.mdx'), english);
  await assert.rejects(f.run('--attempts', '1', '--timeout', '2', '--idle-timeout', '1'), error => error.code === 1);
  assert.deepEqual((await f.manifest()).files.map(row => row.status), ['failed', 'translated']);
});
test('TTY dashboard shows slots/chunks and restores the cursor', () => {
  let text = '';
  const ui = new ReviewTerminal({ model: 'test-model', concurrency: 3, requestPool: { active: 1, queued: 2 } },
    { isTTY: true, columns: 110, write(value) { text += value; } });
  try {
    ui.start(10, 2); ui.addChunks(21);
    ui.request('one', { label: 'api-reference.mdx [2/21]', phase: 'generating answer', bytes: 1024, outputChars: 100, started: Date.now() });
    ui.draw(); assert.match(text, /API slots: 1\/3/); assert.match(text, /Chunks 0\/21/);
    assert.match(text, /api-reference\.mdx \[2\/21\]/);
  } finally { ui.close(); }
  assert.ok(text.endsWith('\x1b[?25h'));
});
