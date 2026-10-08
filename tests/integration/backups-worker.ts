import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { organization, users, member, apiKey, customRole, contact, chartAccount, invoice, invoiceLine, journalEntry, journalLine, dataBackup, periodLock, payment, paymentAllocation } from "../../lib/db/schema";
import { POST as upload } from "../../app/api/v1/backups/upload/route";
import { GET as download } from "../../app/api/v1/backups/download-snapshot/route";
import { GET as list, POST as create } from "../../app/api/v1/backups/route";
import { POST as restore } from "../../app/api/v1/backups/[id]/restore/route";
import { GET as get, DELETE as remove } from "../../app/api/v1/backups/[id]/route";
import { GET as storedDownload } from "../../app/api/v1/backups/[id]/download/route";
import { registerBackupTools } from "../../lib/mcp/tools/backups";
import { processBackupMaintenance } from "../../lib/api/backup-maintenance";
import type { AuthContext } from "../../lib/api/auth-context";

async function mcp(ctx: AuthContext) {
  const server = new McpServer({ name: "Backups", version: "1" }); registerBackupTools(server, ctx);
  const client = new Client({ name: "Fixture", version: "1" });
  const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
  for (const tool of (await client.listTools()).tools) for (const field of Object.values(tool.inputSchema.properties ?? {})) assert.ok((field as { description?: string }).description);
  return { async call(name: string, args: Record<string, unknown> = {}) {
    const result = await client.callTool({ name, arguments: args });
    return { isError: result.isError === true, body: JSON.parse((result.content as { text: string }[])[0].text) };
  }, async close() { await client.close(); await server.close(); } };
}

async function run() {
  const [a, b] = await db.insert(organization).values([{ name: "Backup A", slug: "backup-a" }, { name: "Backup B", slug: "backup-b" }]).returning();
  const [owner, denied] = await db.insert(users).values([{ email: "backup-owner@example.test" }, { email: "backup-denied@example.test" }]).returning();
  const [noRole] = await db.insert(customRole).values({ organizationId: a.id, name: "No access", permissions: [] }).returning();
  await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner" }, { organizationId: b.id, userId: owner.id, role: "owner" }, { organizationId: a.id, userId: denied.id, customRoleId: noRole.id }]);
  const keys = { owner: "dk_backup_owner", foreign: "dk_backup_foreign", denied: "dk_backup_denied" };
  for (const [label, key] of Object.entries(keys)) await db.insert(apiKey).values({ organizationId: label === "foreign" ? b.id : a.id, createdBy: label === "denied" ? denied.id : owner.id, name: label, keyHash: createHash("sha256").update(key).digest("hex"), keyPrefix: "dk_backup" });
  const ctx: AuthContext = { userId: owner.id, organizationId: a.id, role: "owner" };
  const ma = await mcp(ctx), mb = await mcp({ ...ctx, organizationId: b.id }), noAccess = await mcp({ ...ctx, permissions: [] });
  const objects = new Map<string, string>(); let failStorage = false;
  const original = S3Client.prototype.send;
  S3Client.prototype.send = (async function(command: PutObjectCommand | GetObjectCommand | DeleteObjectCommand) {
    const key = command.input.Key!;
    if (command instanceof PutObjectCommand) {
      if (failStorage) throw new Error("Synthetic S3 failure");
      assert.ok(!objects.has(key), "immutable files must use a new key"); objects.set(key, Buffer.from(command.input.Body as Buffer).toString()); return {};
    }
    if (command instanceof GetObjectCommand) {
      assert.ok(objects.has(key)); return { Body: { transformToString: async () => objects.get(key)! } };
    }
    if (command instanceof DeleteObjectCommand) { objects.delete(key); return {}; }
    throw new Error("Unexpected S3 operation");
  }) as typeof S3Client.prototype.send;
  const req = (method = "GET", body?: unknown, key = keys.owner, query = "") => new Request(`http://fixture.test/api/v1/backups${query}`, { method,
    headers: { authorization: `Bearer ${key}`, "x-organization-id": b.id, "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const fileReq = (json: string, key = keys.owner) => {
    const data = new FormData(); data.set("file", new File([json], "snapshot.json", { type: "application/json" }));
    return new Request("http://fixture.test/api/v1/backups/upload", { method: "POST", headers: { authorization: `Bearer ${key}` }, body: data });
  };
  const params = (id: string) => ({ params: Promise.resolve({ id }) });
  const body = async (response: Response, status = 200) => { assert.equal(response.status, status, await response.clone().text()); return response.json(); };
  const state = async (includeMetadata = true) => {
    const result: Record<string, unknown> = {};
    for (const table of ["contact", "chart_account", "invoice", "invoice_line", "journal_entry", "journal_line", "payment", "payment_allocation", "audit_log", ...(includeMetadata ? ["data_backup"] : [])])
      result[table] = (await db.execute(sql.raw(`select row_to_json(t)::text as row from ${table} t order by id`))).rows;
    return result;
  };
  try {
    const [local, foreign] = await db.insert(contact).values([{ organizationId: a.id, name: "Local", creditLimit: 1250, currencyCode: "USD" }, { organizationId: b.id, name: "Foreign secret", creditLimit: 777 }]).returning();
    const [account] = await db.insert(chartAccount).values({ organizationId: a.id, code: "1000", name: "Cash", type: "asset" }).returning();
    const [entry] = await db.insert(journalEntry).values({ organizationId: a.id, entryNumber: 1, date: "2024-02-29", description: "Manual", createdBy: owner.id }).returning();
    await db.insert(journalLine).values({ journalEntryId: entry.id, accountId: account.id, debitAmount: 1250, creditAmount: 0, rateExact: "1.234567", exchangeRate: 1234567 });
    const [inv] = await db.insert(invoice).values({ organizationId: a.id, contactId: local.id, invoiceNumber: "INV-1", issueDate: "2024-02-29", dueDate: "2024-03-01", total: 1250, subtotal: 1250, currencyCode: "USD", createdBy: owner.id }).returning();
    const [line] = await db.insert(invoiceLine).values({ invoiceId: inv.id, description: "Item", quantity: 100, unitPrice: 1250, amount: 1250, accountId: account.id }).returning();
    const response = await download(req()); assert.equal(response.status, 200);
    const exact = JSON.parse(await response.text()); assert.equal(exact.version, 2);
    assert.equal(exact.entities.contacts.length, 1); assert.equal(exact.entities.contacts[0].creditLimitMinor, "1250");
    assert.equal(exact.entities.invoices[0].totalMinor, "1250"); assert.equal(exact.entities.invoices[0].lines[0].unitPriceMinor, "1250");
    assert.equal(exact.entities.journalEntries[0].lines[0].rateExact, "1.234567");
    const mc = await ma.call("download_backup_snapshot"); assert.equal(mc.isError, false);
    assert.deepEqual(mc.body.snapshot.entities, exact.entities);
    const exactJson = JSON.stringify(exact, null, 2);
    const uploaded = (await body(await upload(fileReq(exactJson)))).backup;
    assert.equal(objects.get(uploaded.fileKey), exactJson);
    const legacy = structuredClone(exact); legacy.version = 1;
    for (const rows of Object.values(legacy.entities) as Record<string, unknown>[][]) for (const row of rows) {
      for (const key of Object.keys(row)) if (key.endsWith("Minor")) delete row[key];
      for (const child of (row.lines ?? []) as Record<string, unknown>[]) for (const key of Object.keys(child)) if (key.endsWith("Minor")) delete child[key];
    }
    const legacyJson = JSON.stringify(legacy);
    const ml = await ma.call("upload_backup", { snapshotJson: legacyJson }); assert.equal(ml.isError, false);
    assert.equal(objects.get(ml.body.backup.fileKey), legacyJson);
    assert.equal(await (await storedDownload(req(), params(uploaded.id))).text(), exactJson);
    assert.equal((await ma.call("download_backup", { backupId: ml.body.backup.id })).body.snapshotJson, legacyJson);
    assert.deepEqual(await body(await get(req(), params(uploaded.id))), (await ma.call("get_backup", { backupId: uploaded.id })).body);
    for (const method of [get, storedDownload]) await body(await method(req("GET", undefined, keys.foreign), params(uploaded.id)), 404);
    // Exact-only clients can omit numeric siblings, within the current safe bridge.
    const exactOnly = structuredClone(exact);
    for (const rows of Object.values(exactOnly.entities) as Record<string, unknown>[][]) for (const row of rows) {
      for (const key of Object.keys(row)) if (key.endsWith("Minor")) delete row[key.slice(0, -5)];
      for (const child of (row.lines ?? []) as Record<string, unknown>[]) for (const key of Object.keys(child)) if (key.endsWith("Minor")) delete child[key.slice(0, -5)];
    }
    assert.equal((await ma.call("upload_backup", { snapshotJson: JSON.stringify(exactOnly) })).isError, false);
    const manual = (await body(await create(req("POST")), 201)).backup;
    assert.equal(JSON.parse(objects.get(manual.fileKey)!).version, 2); assert.ok(manual.expiresAt);
    assert.equal((await ma.call("create_backup")).isError, false);
    const beforeInvalid = await state(), beforeObjects = objects.size;
    for (const mutate of [
      (value: typeof exact) => { value.version = 99; },
      (value: typeof exact) => { value.organizationId = b.id; },
      (value: typeof exact) => { value.entities.contacts[0].creditLimitMinor = "1251"; },
      (value: typeof exact) => { value.entities.contacts[0].creditLimit = 1.5; },
      (value: typeof exact) => { value.entities.contacts[0].organizationId = b.id; },
      (value: typeof exact) => { value.entities.contacts[0].id = foreign.id; },
      (value: typeof exact) => { value.entities.invoices[0].contactId = foreign.id; },
      (value: typeof exact) => { value.entities.invoices[0].lines[0].invoiceId = randomUUID(); },
      (value: typeof exact) => { value.entities.invoices[0].lines[0].projectId = randomUUID(); },
      (value: typeof exact) => { value.entities.journalEntries[0].lines[0].rateExact = "1.25"; },
      (value: typeof exact) => { value.entities.invoices[0].dueDate = "2024-02-30"; },
      (value: typeof exact) => { value.entities.journalEntries[0].sourceId = foreign.id; value.entities.journalEntries[0].sourceType = "invoice"; },
      (value: typeof exact) => { delete value.entities.accounts; },
    ]) {
      const bad = structuredClone(exact); mutate(bad);
      await body(await upload(fileReq(JSON.stringify(bad))), 400);
      assert.equal((await ma.call("upload_backup", { snapshotJson: JSON.stringify(bad) })).isError, true);
    }
    const unsafe = structuredClone(exact); delete unsafe.entities.contacts[0].creditLimit; unsafe.entities.contacts[0].creditLimitMinor = "9007199254740992";
    const range = await body(await upload(fileReq(JSON.stringify(unsafe))), 422); assert.equal(range.code, "LEGACY_NUMERIC_RANGE");
    assert.equal((await ma.call("upload_backup", { snapshotJson: JSON.stringify(unsafe) })).body.code, "LEGACY_NUMERIC_RANGE");
    await body(await upload(fileReq("null")), 400); await body(await upload(fileReq("{")), 400);
    await body(await upload(fileReq(exactJson, keys.denied)), 403); await body(await upload(fileReq(exactJson, keys.foreign)), 400);
    await body(await create(req("POST", undefined, keys.denied)), 403); await body(await download(req("GET", undefined, keys.denied)), 403);
    await body(await restore(req("POST", { confirm: false }), params(uploaded.id)), 400);
    await body(await restore(req("POST", { confirm: true }, keys.foreign), params(uploaded.id)), 404);
    for (const name of ["list_backups", "create_backup", "download_backup_snapshot"]) assert.equal((await noAccess.call(name)).isError, true);
    assert.equal((await noAccess.call("upload_backup", { snapshotJson: exactJson })).isError, true);
    assert.equal((await noAccess.call("get_backup", { backupId: uploaded.id })).body.status, 403);
    assert.equal((await noAccess.call("download_backup", { backupId: uploaded.id })).body.status, 403);
    assert.equal((await mb.call("restore_backup", { backupId: uploaded.id, confirm: true })).body.status, 404);
    assert.deepEqual(await state(), beforeInvalid); assert.equal(objects.size, beforeObjects);
    const beforeRate = await state(); await body(await create(req("POST")), 429);
    assert.equal((await ma.call("create_backup")).body.status, 429); assert.deepEqual(await state(), beforeRate);

    await db.update(contact).set({ creditLimit: 999, name: "Changed" }).where(eq(contact.id, local.id));
    await db.update(invoiceLine).set({ amount: 999 }).where(eq(invoiceLine.id, line.id));
    const [extra] = await db.insert(contact).values({ organizationId: a.id, name: "After backup" }).returning();
    const restored = await body(await restore(req("POST", { confirm: true }), params(uploaded.id)));
    assert.equal(restored.success, true); assert.equal(restored.restoredCounts.restoredCounts["invoices.lines"], 1);
    assert.equal((await db.query.contact.findFirst({ where: eq(contact.id, local.id) }))!.creditLimit, 1250);
    assert.ok((await db.query.contact.findFirst({ where: eq(contact.id, extra.id) }))!.deletedAt);
    assert.equal((await db.query.invoiceLine.findFirst({ where: eq(invoiceLine.id, line.id) }))!.amount, 1250);
    assert.equal((await db.query.contact.findFirst({ where: eq(contact.id, foreign.id) }))!.creditLimit, 777);
    assert.equal((await ma.call("restore_backup", { backupId: ml.body.backup.id, confirm: true })).isError, false);
    assert.equal(objects.get(uploaded.fileKey), exactJson); assert.equal(objects.get(ml.body.backup.fileKey), legacyJson);

    // A database error after soft deletion rolls back every data change and the restore audit.
    await db.execute(sql.raw("CREATE FUNCTION reject_restore() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.name = 'Local' AND OLD.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'synthetic restore failure'; END IF; RETURN NEW; END $$"));
    await db.execute(sql.raw("CREATE TRIGGER reject_restore BEFORE UPDATE ON contact FOR EACH ROW EXECUTE FUNCTION reject_restore()"));
    const beforeFailure = await state(false);
    await body(await restore(req("POST", { confirm: true }), params(uploaded.id)), 500);
    assert.deepEqual(await state(false), beforeFailure);
    assert.equal((await ma.call("restore_backup", { backupId: uploaded.id, confirm: true })).isError, true);
    assert.deepEqual(await state(false), beforeFailure);
    await db.execute(sql.raw("DROP TRIGGER reject_restore ON contact"));
    // Revalidation of stored bytes and locks precedes the safety backup.
    objects.set(uploaded.fileKey, JSON.stringify({ ...exact, organizationId: b.id }));
    const beforeCorrupt = await state(); await body(await restore(req("POST", { confirm: true }), params(uploaded.id)), 400);
    assert.deepEqual(await state(), beforeCorrupt); objects.set(uploaded.fileKey, exactJson);
    await db.insert(periodLock).values({ organizationId: a.id, lockDate: "2024-02-29" });
    const beforeLock = await state(); await body(await restore(req("POST", { confirm: true }), params(uploaded.id)), 400); assert.deepEqual(await state(), beforeLock);
    await db.delete(periodLock).where(eq(periodLock.organizationId, a.id));
    const [pay] = await db.insert(payment).values({ organizationId: a.id, contactId: local.id, paymentNumber: "P-1", type: "received", date: "2024-02-29", amount: 1250 }).returning();
    await db.insert(paymentAllocation).values({ paymentId: pay.id, documentType: "invoice", documentId: inv.id, amount: 1250 });
    const beforeCoverage = await state();
    const blocked = await body(await restore(req("POST", { confirm: true }), params(uploaded.id)), 400);
    assert.match(blocked.error, /omitted payment_allocation/);
    assert.equal((await ma.call("restore_backup", { backupId: uploaded.id, confirm: true })).isError, true);
    assert.deepEqual(await state(), beforeCoverage);
    await db.delete(paymentAllocation).where(eq(paymentAllocation.paymentId, pay.id)); await db.delete(payment).where(eq(payment.id, pay.id));
    // Both transports enforce the manual-cap policy independently of the hourly cap.
    await db.update(dataBackup).set({ createdAt: new Date("2020-01-01T00:00:00Z") });
    const manualCount = (await db.query.dataBackup.findMany()).filter(row => row.type === "manual" && !row.deletedAt).length;
    await db.insert(dataBackup).values(Array.from({ length: 10 - manualCount }, () => ({ organizationId: a.id, type: "manual" as const, status: "failed" as const, createdAt: new Date("2020-01-01T00:00:00Z") })));
    const beforeCap = await state(); await body(await create(req("POST")), 403); assert.equal((await ma.call("create_backup")).body.status, 403); assert.deepEqual(await state(), beforeCap);

    await body(await get(req(), params(uploaded.id))); await body(await list(req()));
    const foreignList = await mb.call("list_backups"); assert.deepEqual(foreignList.body.backups, []);
    // Uploaded metadata exists on the other org only if a valid matching payload was uploaded there.
    await body(await remove(req("DELETE"), params(uploaded.id))); const beforeDeleted = await state();
    await body(await restore(req("POST", { confirm: true }), params(uploaded.id)), 404); assert.deepEqual(await state(), beforeDeleted);
    failStorage = true; await body(await upload(fileReq(exactJson)), 500); failStorage = false;
    assert.ok((await db.query.dataBackup.findMany()).some(row => row.status === "failed"));
    // The existing maintenance job adopts the shared versioned builder, skips
    // recently scheduled snapshots, and purges only expired files.
    const maintained = await processBackupMaintenance(); assert.equal(maintained.created, 2);
    for (const scheduled of await db.query.dataBackup.findMany({ where: eq(dataBackup.type, "scheduled") })) {
      assert.equal(JSON.parse(objects.get(scheduled.fileKey!)!).version, 2); assert.ok(scheduled.expiresAt);
    }
    const expiredId = randomUUID(), expiredKey = `backups/${a.id}/${expiredId}.json`;
    await db.insert(dataBackup).values({ id: expiredId, organizationId: a.id, type: "uploaded", status: "completed", fileKey: expiredKey, expiresAt: new Date("2020-01-01T00:00:00Z") });
    objects.set(expiredKey, legacyJson);
    const purged = await processBackupMaintenance(); assert.equal(purged.created, 0); assert.equal(purged.skipped, 2); assert.equal(purged.purged, 1);
    assert.equal(objects.has(expiredKey), false); assert.equal(objects.get(ml.body.backup.fileKey), legacyJson);
    console.log("REST and MCP backup contracts verified");
  } finally { S3Client.prototype.send = original; await Promise.all([ma.close(), mb.close(), noAccess.close()]); }
}
run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
