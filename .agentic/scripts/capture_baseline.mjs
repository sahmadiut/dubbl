// AUD-002: invoke real route handlers; this does not start or qualify Next.js.
// Run from repo root: node --env-file=.env --import tsx .agentic/scripts/capture_baseline.mjs
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { eq } from 'drizzle-orm';

const target = new URL(process.env.DATABASE_URL);
if (!['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) || target.pathname !== '/dubbl') {
  throw new Error('This fixture is restricted to the owner-authorized local dubbl test database.');
}
const { db } = await import('../../lib/db/index.ts');
const schema = await import('../../lib/db/schema/index.ts');
const runId = randomUUID();
const rawKey = `dk_${randomBytes(32).toString('hex')}`;
const capture = { runId, mode: 'direct-route-handler; no HTTP/server/browser', startedAt: new Date().toISOString(), calls: [], reports: {}, checks: [] };
const output = new URL(`../evidence/AUD-002-capture-${runId}.json`, import.meta.url);
let keyId;

async function call(path, method = 'GET', body, id, expectedStatus) {
  const modulePath = path.split('?')[0];
  const route = await import(`../../app/api/v1/${modulePath}/route.ts`);
  const request = new Request(`http://localhost/api/v1/${path}`, {
    method,
    headers: { authorization: `Bearer ${rawKey}`, 'content-type': 'application/json', 'user-agent': 'AUD-002 synthetic baseline' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const start = performance.now();
  const response = await route[method](request, { params: Promise.resolve({ id }) });
  const result = await response.json();
  capture.calls.push({ path, method, id, status: response.status, handlerMs: performance.now() - start, result });
  if (expectedStatus !== undefined ? response.status !== expectedStatus : !response.ok) {
    throw new Error(`Unexpected status ${response.status} at ${method} ${path}`);
  }
  return result;
}

async function reports(stage) {
  const result = {};
  for (const name of ['trial-balance', 'aged-receivables', 'aged-payables', 'balance-sheet']) {
    result[name] = await call(`reports/${name}?asAt=2025-12-31`);
  }
  result.bank = await call('bank-accounts');
  capture.reports[stage] = result;
  return result;
}

function check(name, actual, expected) {
  capture.checks.push({ name, actual, expected, passed: JSON.stringify(actual) === JSON.stringify(expected) });
}

try {
  // Only bootstrap identity/plan; all financial writes use application routes.
  await db.transaction(async tx => {
    const [user] = await tx.insert(schema.users).values({ name: 'AUD-002 Synthetic Owner', email: `aud-002-${runId}@example.invalid` }).returning();
    const [org] = await tx.insert(schema.organization).values({ name: 'AUD-002 Baseline', slug: `aud-002-${runId}`, defaultCurrency: 'USD', fiscalYearStartMonth: 1, taxRegime: 'none' }).returning();
    await tx.insert(schema.member).values({ organizationId: org.id, userId: user.id, role: 'owner' });
    await tx.insert(schema.subscription).values({ organizationId: org.id, plan: 'pro', status: 'active', managedBy: 'manual', adminNotes: 'AUD-002 synthetic test only; no provider' });
    const [key] = await tx.insert(schema.apiKey).values({ organizationId: org.id, createdBy: user.id, name: 'AUD-002 ephemeral', keyHash: createHash('sha256').update(rawKey).digest('hex'), keyPrefix: 'dk_audit', expiresAt: new Date(Date.now() + 3600000) }).returning();
    keyId = key.id;
    capture.organizationId = org.id;
    capture.userId = user.id;
  });
  const accounts = {};
  for (const [code, name, type, subType] of [
    ['1100', 'Bank', 'asset', 'bank'], ['1200', 'Accounts Receivable', 'asset', 'current'],
    ['2100', 'Accounts Payable', 'liability', 'current'], ['3000', 'Contributed Capital', 'equity', 'capital'],
    ['3100', 'Retained Earnings', 'equity', 'retained'], ['4000', 'Sales Revenue', 'revenue', 'operating'],
    ['6000', 'Operating Expense', 'expense', 'operating'],
  ]) accounts[code] = (await call('accounts', 'POST', { code, name, type, subType })).account.id;
  const bank = (await call('bank-accounts', 'POST', { accountName: 'AUD-002 Synthetic Bank', chartAccountId: accounts['1100'], currencyCode: 'USD', balance: 0 })).bankAccount;
  const year = (await call('fiscal-years', 'POST', { name: 'AUD-002 2025', startDate: '2025-01-01', endDate: '2025-12-31' })).fiscalYear;
  const opening = (await call('entries', 'POST', { date: '2025-12-01', description: 'AUD-002 owner contribution', fiscalYearId: year.id, lines: [
    { accountId: accounts['1100'], debitAmount: 100000 }, { accountId: accounts['3000'], creditAmount: 100000 },
  ] })).entry;
  await call('entries/[id]/post', 'POST', {}, opening.id);
  const customer = (await call('contacts', 'POST', { name: 'AUD-002 Synthetic Customer', type: 'customer' })).contact;
  const supplier = (await call('contacts', 'POST', { name: 'AUD-002 Synthetic Supplier', type: 'supplier' })).contact;
  // Existing v1 document unitPrice expects decimal major units; payment/journal amounts are cents.
  const inv = (await call('invoices', 'POST', { contactId: customer.id, issueDate: '2025-12-02', dueDate: '2025-12-31', lines: [{ description: 'AUD-002 sale', quantity: 1, unitPrice: 200, accountId: accounts['4000'] }] })).invoice;
  await call('invoices/[id]/send', 'POST', {}, inv.id); // No sendEmail request.
  const bill = (await call('bills', 'POST', { contactId: supplier.id, issueDate: '2025-12-02', dueDate: '2025-12-31', lines: [{ description: 'AUD-002 expense', quantity: 1, unitPrice: 80, accountId: accounts['6000'] }] })).bill;
  await call('bills/[id]/receive', 'POST', {}, bill.id);
  for (const [type, contactId, documentType, documentId, amount] of [
    ['received', customer.id, 'invoice', inv.id, 5000], ['made', supplier.id, 'bill', bill.id, 3000],
  ]) await call('payments', 'POST', { type, contactId, date: '2025-12-03', amount, bankAccountId: bank.id, allocations: [{ documentType, documentId, amount }] });
  const before = await reports('beforeClose');
  check('Aged AR cents', before['aged-receivables'].grandTotal, 15000);
  check('Aged AP cents', before['aged-payables'].grandTotal, 5000);
  check('Bank API balance cents', before.bank.bankAccounts[0].balance, 102000);
  for (const [code, expected] of Object.entries({ '1100': '1020.00', '1200': '150.00', '2100': '50.00', '3000': '1000.00', '3100': '0.00', '4000': '200.00', '6000': '80.00' })) {
    check(`Before-close TB natural balance ${code}`, before['trial-balance'].accounts.find(a => a.code === code)?.balance, expected);
  }
  check('Before-close TB AP credit column', before['trial-balance'].accounts.find(a => a.code === '2100')?.creditBalance, '50.00');
  check('Before-close balance sheet assets', before['balance-sheet'].assets.total, '1170.00');
  check('Before-close balance sheet liabilities', before['balance-sheet'].liabilities.total, '50.00');
  check('Before-close balance sheet equity incl current earnings', before['balance-sheet'].equity.total, '1120.00');
  await call('fiscal-years/[id]/close', 'POST', {}, year.id);
  const after = await reports('afterClose');
  for (const [code, expected] of Object.entries({ '1100': '1020.00', '1200': '150.00', '2100': '50.00', '3000': '1000.00', '3100': '120.00', '4000': '0.00', '6000': '0.00' })) {
    check(`After-close TB natural balance ${code}`, after['trial-balance'].accounts.find(a => a.code === code)?.balance, expected);
  }
  check('After-close aged AR cents', after['aged-receivables'].grandTotal, 15000);
  check('After-close aged AP cents', after['aged-payables'].grandTotal, 5000);
  await call('fiscal-years/[id]/close', 'POST', {}, year.id, 400);
  const duplicateClose = await reports('afterDuplicateClose');
  check('Duplicate close leaves reports unchanged', duplicateClose, after);
  capture.completed = true;
  capture.verificationPassed = capture.checks.every(c => c.passed);
  if (!capture.verificationPassed) process.exitCode = 1;
} catch (error) {
  capture.completed = false;
  capture.failure = error instanceof Error ? error.message : 'Capture failed';
  process.exitCode = 1;
} finally {
  // Synthetic records are retained for later browser capture; revoke the credential.
  if (keyId) await db.delete(schema.apiKey).where(eq(schema.apiKey.id, keyId));
  capture.credentialRevoked = Boolean(keyId);
  capture.finishedAt = new Date().toISOString();
  await writeFile(output, JSON.stringify(capture, null, 2) + '\n', { flag: 'wx' });
  await db.$client.end();
  console.log(JSON.stringify({ output: output.pathname, organizationId: capture.organizationId, completed: capture.completed, failure: capture.failure, failedChecks: capture.checks.filter(c => !c.passed) }));
}
