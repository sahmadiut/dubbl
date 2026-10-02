// Read-only HTTP captures of the corrected AUD-002 fixture; ephemeral key revoked.
// node --env-file=.env --import tsx .agentic/scripts/capture_http_baseline.mjs
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { and, eq } from 'drizzle-orm';

const target = new URL(process.env.DATABASE_URL);
if (!['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) || target.pathname !== '/dubbl') {
  throw new Error('Restricted to the authorized local dubbl test database.');
}
const source = JSON.parse(await readFile(new URL('../evidence/AUD-002-capture-bf956749-da47-48f0-bb10-2f8fe74e3fc6.json', import.meta.url), 'utf8'));
const { db } = await import('../../lib/db/index.ts');
const { apiKey, organization, member } = await import('../../lib/db/schema/index.ts');
const token = `dk_${randomBytes(32).toString('hex')}`;
const capture = { startedAt: new Date().toISOString(), organizationId: source.organizationId, mode: 'HTTP to user-started Next.js development server', samples: [] };
let keyId;
try {
  const org = await db.query.organization.findFirst({ where: and(eq(organization.id, source.organizationId), eq(organization.slug, `aud-002-${source.runId}`)) });
  const owner = await db.query.member.findFirst({ where: and(eq(member.organizationId, source.organizationId), eq(member.userId, source.userId), eq(member.role, 'owner')) });
  if (!org || !owner) throw new Error('Corrected synthetic fixture identity not found');
  const [key] = await db.insert(apiKey).values({ organizationId: org.id, createdBy: source.userId, name: 'AUD-002 HTTP ephemeral', keyHash: createHash('sha256').update(token).digest('hex'), keyPrefix: 'dk_audit', expiresAt: new Date(Date.now() + 3600000) }).returning();
  keyId = key.id;
  for (const path of ['reports/trial-balance?asAt=2025-12-31', 'reports/aged-receivables?asAt=2025-12-31', 'reports/aged-payables?asAt=2025-12-31', 'reports/balance-sheet?asAt=2025-12-31', 'bank-accounts']) {
    const sample = { path, requests: [] };
    capture.samples.push(sample);
    for (let i = 0; i < 6; i++) {
      const start = performance.now();
      const response = await fetch(`http://localhost:3000/api/v1/${path}`, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(60000), cache: 'no-store' });
      const result = await response.json();
      sample.requests.push({ kind: i === 0 ? 'firstInCapture' : 'warm', status: response.status, ms: performance.now() - start });
      if (i === 0) sample.result = result;
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${path}`);
      // Compare every response with the direct-handler closed-fixture baseline.
      const name = path.split('?')[0].split('/').at(-1);
      const expected = source.reports.afterClose[name === 'bank-accounts' ? 'bank' : name];
      if (JSON.stringify(result) !== JSON.stringify(expected)) throw new Error(`HTTP result differs from direct handler at ${path}`);
    }
    const warm = sample.requests.slice(1).map(r => r.ms).sort((a, b) => a - b);
    sample.warmMedianMs = warm[2];
  }
  capture.passed = true;
} catch (error) {
  capture.passed = false;
  capture.failure = error instanceof Error ? error.message : 'HTTP capture failed';
  process.exitCode = 1;
} finally {
  if (keyId) await db.delete(apiKey).where(eq(apiKey.id, keyId));
  capture.credentialRevoked = Boolean(keyId);
  capture.finishedAt = new Date().toISOString();
  const output = new URL(`../evidence/AUD-002-http-${randomUUID()}.json`, import.meta.url);
  await writeFile(output, JSON.stringify(capture, null, 2) + '\n', { flag: 'wx' });
  await db.$client.end();
  console.log(JSON.stringify({ output: output.pathname, passed: capture.passed, failure: capture.failure, samples: capture.samples.map(s => ({ path: s.path, firstMs: s.requests[0]?.ms, warmMedianMs: s.warmMedianMs })) }));
}
