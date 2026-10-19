// Partition complete MDX blocks; never cut a code fence or a JSX element in half.
const bytes = text => Buffer.byteLength(text, 'utf8');
const lines = text => text ? text.split(/\r?\n/).length : 0;
const plain = node => node.value || node.children?.map(plain).join('') || '';

function units(text, processor) {
  const match = /^(?:\uFEFF)?---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/.exec(text);
  const offset = match?.[0].length || 0;
  const body = text.slice(offset);
  const nodes = processor.parse(body).children;
  const first = nodes[0]?.position.start.offset || 0;
  const result = [{ kind: 'frontmatter', text: text.slice(0, offset + first) }];
  for (const [index, node] of nodes.entries()) {
    const start = node.position.start.offset;
    const end = nodes[index + 1]?.position.start.offset ?? body.length;
    result.push({ kind: node.type, text: body.slice(start, end),
      depth: node.depth, name: node.name,
      heading: node.type === 'heading' ? plain(node) : undefined });
  }
  return result;
}

export function makeChunkPlan(english, options, processor) {
  const chunks = [];
  let current;
  const englishPath = [];
  const begin = () => ({ english_mdx: '', frontmatter: false, context: englishPath.filter(Boolean).join(' / ') });
  const flush = () => { if (current?.english_mdx) chunks.push(current); current = null; };
  for (const unit of units(english, processor)) {
    if (current) {
      const wouldExceed = bytes(current.english_mdx + unit.text) > options['chunk-bytes']
        || lines(current.english_mdx + unit.text) > options['chunk-lines'];
      const sectionBreak = unit.kind === 'heading' && unit.depth <= 2
        && bytes(current.english_mdx) >= options['chunk-bytes'] / 2;
      if (wouldExceed || sectionBreak) flush();
    }
    if (unit.kind === 'heading') { englishPath.length = unit.depth - 1; englishPath[unit.depth - 1] = unit.heading; }
    current ||= begin();
    current.english_mdx += unit.text;
    current.frontmatter ||= unit.kind === 'frontmatter';
  }
  flush();
  return chunks.map((chunk, index) => ({ ...chunk, index, bytes: bytes(chunk.english_mdx), lines: lines(chunk.english_mdx) }));
}

export function assembleChunks(outputs, crlf = false) {
  const text = outputs.map(value => value.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').trimEnd())
    .filter(value => value.trim()).join('\n\n') + '\n';
  return crlf ? text.replace(/\n/g, '\r\n') : text;
}

export function createRequestPool(limit) {
  let active = 0;
  const queue = [];
  const pump = () => {
    while (active < limit && queue.length) {
      const next = queue.shift();
      next.signal?.removeEventListener('abort', next.abort);
      if (next.signal?.aborted) { next.reject(stopped()); continue; }
      active++;
      Promise.resolve().then(next.task).then(next.resolve, next.reject).finally(() => { active--; pump(); });
    }
  };
  const stopped = () => Object.assign(new Error('Interrupted; saved progress preserved'), { code: 'REVIEW_STOP', retryable: false });
  return {
    get active() { return active; }, get queued() { return queue.length; },
    run(task, signal) {
      return new Promise((resolve, reject) => {
        if (signal?.aborted) { reject(stopped()); return; }
        const entry = { task, signal, resolve, reject, abort: () => {
          const index = queue.indexOf(entry);
          if (index >= 0) queue.splice(index, 1);
          reject(stopped());
        } };
        signal?.addEventListener('abort', entry.abort, { once: true });
        queue.push(entry); pump();
      });
    },
  };
}

export async function runWorkers(items, concurrency, worker, shouldStop = () => false) {
  let next = 0;
  const results = await Promise.allSettled(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length && !shouldStop()) { const index = next++; await worker(items[index], index); }
  }));
  const rejected = results.find(result => result.status === 'rejected');
  if (rejected) throw rejected.reason;
}
