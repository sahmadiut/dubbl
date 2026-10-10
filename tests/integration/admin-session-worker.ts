import assert from "node:assert/strict";
import { mock } from "node:test";
import { eq, sql } from "drizzle-orm";
import { db } from "../../lib/db";
import { organization, users } from "../../lib/db/schema";

// Only NextAuth session resolution is stubbed; actual handlers and DB-backed
// site-admin gates run normally. Browser/JWT/login acceptance is not claimed.
let sessionUserId: string | undefined;
mock.module(new URL("../../lib/auth.ts", import.meta.url).href, {
  namedExports: { auth: async () => sessionUserId ? { user: { id: sessionUserId } } : null },
});

async function run() {
  const { GET: listOrgs } = await import("../../app/api/v1/admin/organizations/route");
  const { GET: listUsers } = await import("../../app/api/v1/admin/users/route");
  const { GET: stats } = await import("../../app/api/v1/admin/stats/route");
  const { GET: usage } = await import("../../app/api/v1/admin/usage/route");
  const { GET: detail, PATCH: patch } = await import("../../app/api/v1/admin/organizations/[id]/route");
  const [admin, denied] = await db.select().from(users).orderBy(users.email);
  assert.equal(admin.isSiteAdmin, true); assert.equal(denied.isSiteAdmin, false);
  const [foreign] = await db.select().from(organization).where(eq(organization.slug, "opaque-b"));
  const request = new Request("http://fixture.test/api/v1/admin/usage");
  const params = { params: Promise.resolve({ id: foreign.id }) };
  const body = async (r: Response, status = 200) => { const b = await r.json(); assert.equal(r.status, status, JSON.stringify(b)); return b; };
  const snapshot = async () => (await db.execute(sql`select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text), '[]'::jsonb)::text as rows from subscription t`)).rows;
  for (const userId of [undefined, denied.id]) {
    sessionUserId = userId;
    const before = await snapshot();
    const status = userId ? 403 : 401;
    await body(await listOrgs(), status); await body(await listUsers(), status); await body(await stats(), status);
    await body(await usage(request), status); await body(await detail(request, params), status);
    await body(await patch(new Request(request.url, { method: "PATCH", body: '{"seatCount":7}' }), params), status);
    assert.deepEqual(await snapshot(), before);
  }
  sessionUserId = admin.id;
  const before = await snapshot();
  assert.equal((await body(await listOrgs())).organizations.length, 4);
  assert.equal((await body(await listUsers())).users.length, 2);
  const totals = await body(await stats()); assert.equal(totals.totalUsers, 2); assert.equal(totals.totalOrgs, 4); assert.equal(totals.totalMembers, 3);
  const counts = await body(await usage(request)); assert.deepEqual(counts.globalTotals, { entries: 0, invoices: 0, contacts: 0, fileStorageBytes: 0 });
  assert.equal((await body(await detail(request, params))).organization.name, "FOREIGN_SECRET");
  assert.deepEqual(await snapshot(), before);
  await body(await patch(new Request(request.url, { method: "PATCH", body: '{"seatCount":7}' }), params));
  assert.equal((await body(await detail(request, params))).subscription.seatCount, 7);
  await db.update(users).set({ isSiteAdmin: false }).where(eq(users.id, admin.id));
  await body(await listOrgs(), 403); await body(await detail(request, params), 403);
  console.log("Admin session forwarding verified: four global read handlers, session-site-admin flag, global detail and revoked access");
}
run().then(() => process.exit(0), error => { console.error(error); process.exit(1); });
