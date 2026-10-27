import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mock } from "node:test";
import { eq, sql } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db } from "../../lib/db";
import { users, organization, member, apiKey, mcpAccessToken, mcpRefreshToken, customRole, advisorAccess, contact } from "../../lib/db/schema";
import type { AuthContext } from "../../lib/api/auth-context";

let session: { user: { id: string }; iat?: number; expires: string } | null = null;
mock.module(new URL("../../lib/auth.ts", import.meta.url).href, { namedExports: { auth: async () => session } });

async function run() {
  const { getAuthContext } = await import("../../lib/api/auth-context");
  const { executionIdentity, resolveExecutionIdentity, authorizeExecution } = await import("../../lib/api/execution-identity");
  const { resolveToken } = await import("../../lib/mcp/auth");
  const { registerContactTools } = await import("../../lib/mcp/tools/contacts");
  const { registerOrganizationTools } = await import("../../lib/mcp/tools/organization");
  const { registerAdminOrganizationTools } = await import("../../lib/mcp/tools/admin-organization");
  const { POST: createContact } = await import("../../app/api/v1/contacts/route");
  const { GET: getContact } = await import("../../app/api/v1/contacts/[id]/route");
  const { PATCH: updateOrg } = await import("../../app/api/v1/organization/route");
  const { GET: adminOrg } = await import("../../app/api/v1/admin/organizations/[id]/route");
  const { POST: oauth } = await import("../../app/api/mcp/oauth/token/route");
  const [owner, siteAdmin, advisor] = await db.insert(users).values([
    { name: "Owner", email: "identity-owner@test.invalid" },
    { name: "Site admin", email: "identity-site@test.invalid", isSiteAdmin: true },
    { name: "Advisor", email: "identity-advisor@test.invalid" },
  ]).returning();
  const [a, b] = await db.insert(organization).values([{ name: "A", slug: "identity-a" }, { name: "Foreign secret", slug: "identity-b" }]).returning();
  const [restricted, foreignRole] = await db.insert(customRole).values([
    { organizationId: a.id, name: "Read only", permissions: ["view:data"] },
    { organizationId: b.id, name: "Foreign privileged", permissions: ["manage:contacts"] },
  ]).returning();
  const [membership] = await db.insert(member).values([{ organizationId: a.id, userId: owner.id, role: "owner", customRoleId: restricted.id },
    { organizationId: a.id, userId: siteAdmin.id, role: "member" }]).returning();
  const [foreignContact] = await db.insert(contact).values({ organizationId: b.id, name: "FOREIGN_SECRET", type: "customer" }).returning();
  const hash = (v: string) => createHash("sha256").update(v).digest("hex");
  const raw = "dk_identity_owner", mcpRaw = "mcp_at_identity_owner";
  const [key] = await db.insert(apiKey).values({ organizationId: a.id, createdBy: owner.id, name: "Fixture", keyHash: hash(raw), keyPrefix: "dk_identity" }).returning();
  const [token] = await db.insert(mcpAccessToken).values({ organizationId: a.id, userId: owner.id, role: "owner", clientId: "fixture", tokenHash: hash(mcpRaw), expiresAt: new Date(Date.now() + 3600000) }).returning();
  const req = (path: string, method = "GET", body?: object, credential: string | null = raw, org?: string) => new Request(`http://fixture.test/api/v1/${path}`, {
    method, headers: { "content-type": "application/json", ...(credential ? { authorization: `Bearer ${credential}` } : {}), ...(org ? { "x-organization-id": org } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = async (r: Response, status: number) => { const body = await r.json(); assert.equal(r.status, status, JSON.stringify(body)); return body; };
  const params = (id: string) => ({ params: Promise.resolve({ id }) });
  const connected: { client: Client; server: McpServer }[] = [];
  async function connect(ctx: AuthContext) {
    const server = new McpServer({ name: "Identity", version: "1" });
    registerContactTools(server, ctx); registerOrganizationTools(server, ctx); registerAdminOrganizationTools(server, ctx);
    const client = new Client({ name: "Fixture", version: "1" }), [ct, st] = InMemoryTransport.createLinkedPair();
    await server.connect(st); await client.connect(ct); connected.push({ client, server });
    return async (name: string, args: object = {}, status?: number) => {
      const r = await client.callTool({ name, arguments: { ...args } });
      const body = JSON.parse((r.content as { text: string }[])[0].text);
      assert.equal(!!r.isError, status !== undefined, JSON.stringify(body));
      if (status !== undefined) assert.equal(body.status, status, JSON.stringify(body));
      return body;
    };
  }
  try {
    const ctx = await resolveToken(mcpRaw), call = await connect(ctx);
    assert.deepEqual(ctx.permissions, ["view:data"]);
    await json(await createContact(req("contacts", "POST", { name: "Denied" })), 403);
    await call("create_contact", { name: "Denied" }, 403);
    await json(await getContact(req(`contacts/${foreignContact.id}`), params(foreignContact.id)), 404);
    const foreignResult = await (async () => { const server = connected[0]; return server.client.callTool({ name: "get_contact", arguments: { contactId: foreignContact.id } }); })();
    assert.equal(foreignResult.isError, true); assert.doesNotMatch(JSON.stringify(foreignResult), /FOREIGN_SECRET/);
    assert.equal((await getAuthContext(req("organization", "GET", undefined, raw, b.id))).organizationId, a.id);
    await assert.rejects(getAuthContext(req("organization"), b.id), /organization mismatch/);
    const forged = await connected[0].client.callTool({ name: "create_contact", arguments: { name: "Forged", organizationId: b.id } });
    assert.equal(forged.isError, true);
    // Live role change takes effect in an already connected MCP server.
    await db.update(customRole).set({ permissions: ["view:data", "manage:contacts"] }).where(eq(customRole.id, restricted.id));
    await call("create_contact", { name: "Allowed" });
    await json(await createContact(req("contacts", "POST", { name: "REST allowed" })), 201);
    const reference = executionIdentity(ctx);
    await authorizeExecution(reference, a.id, "manage:contacts");
    await assert.rejects(authorizeExecution(reference, b.id, "manage:contacts"), /organization mismatch/);
    await db.update(customRole).set({ permissions: [] }).where(eq(customRole.id, restricted.id));
    await call("create_contact", { name: "Revoked" }, 403);
    assert.deepEqual((await resolveExecutionIdentity(reference)).permissions, []);
    await assert.rejects(authorizeExecution(reference, a.id, "manage:contacts"), /Insufficient permissions/);
    // Invalid cross-org role IDs cannot fall back to owner privileges.
    await db.update(member).set({ customRoleId: foreignRole.id }).where(eq(member.id, membership.id));
    await assert.rejects(resolveToken(mcpRaw), /Invalid organization role/);
    await json(await createContact(req("contacts", "POST", { name: "Denied" })), 403);
    await db.update(member).set({ customRoleId: null }).where(eq(member.id, membership.id));
    await call("create_contact", { name: "Owner restored" });
    await assert.rejects(authorizeExecution(reference, a.id, "unknown:permission"), /Unknown execution permission/);
    await call("get_admin_organization", {}, 403);
    await json(await adminOrg(req(`admin/organizations/${a.id}`), params(a.id)), 403);
    // Site administration does not grant organization administration.
    session = { user: { id: siteAdmin.id }, iat: Math.floor(Date.now() / 1000), expires: new Date(Date.now() + 60000).toISOString() };
    await json(await updateOrg(req("organization", "PATCH", { name: "Denied" }, null, a.id)), 403);
    await json(await adminOrg(req(`admin/organizations/${b.id}`, "GET", undefined, null), params(b.id)), 200);
    await db.insert(advisorAccess).values({ advisorUserId: advisor.id, organizationId: a.id, role: "auditor", acceptedAt: new Date() });
    session = { user: { id: advisor.id }, iat: Math.floor(Date.now() / 1000), expires: new Date(Date.now() + 60000).toISOString() };
    const advisorCtx = await getAuthContext(req("organization", "GET", undefined, null, a.id));
    const advisorCall = await connect(advisorCtx);
    await advisorCall("get_organization");
    await advisorCall("create_contact", { name: "Advisor denied" }, 403);
    await json(await createContact(req("contacts", "POST", { name: "Advisor denied" }, null, a.id)), 403);
    await db.update(advisorAccess).set({ isActive: false, revokedAt: new Date() }).where(eq(advisorAccess.advisorUserId, advisor.id));
    await advisorCall("get_organization", {}, 403);
    session = { user: { id: owner.id }, iat: Math.floor(Date.now() / 1000) - 60, expires: new Date(Date.now() + 60000).toISOString() };
    const sessionCtx = await getAuthContext(req("organization", "GET", undefined, null, a.id)), sessionCall = await connect(sessionCtx);
    await db.update(users).set({ sessionRevokedAt: new Date() }).where(eq(users.id, owner.id));
    await sessionCall("get_organization", {}, 401);
    await assert.rejects(getAuthContext(req("organization", "GET", undefined, null, a.id)), /Session expired/);
    session = { user: { id: siteAdmin.id }, expires: new Date(Date.now() + 60000).toISOString() };
    await json(await adminOrg(req(`admin/organizations/${a.id}`, "GET", undefined, null), params(a.id)), 401);
    session.iat = Math.floor(Date.now() / 1000); session.expires = new Date(Date.now() - 1).toISOString();
    await assert.rejects(getAuthContext(req("organization", "GET", undefined, null, a.id)), /Session expired/);
    // Bound credential revocation and expiry apply even on an established transport.
    await db.update(mcpAccessToken).set({ expiresAt: new Date(Date.now() - 1) }).where(eq(mcpAccessToken.id, token.id));
    await call("get_organization", {}, 401);
    await db.update(mcpAccessToken).set({ expiresAt: new Date(Date.now() + 60000) }).where(eq(mcpAccessToken.id, token.id));
    await db.delete(mcpAccessToken).where(eq(mcpAccessToken.id, token.id));
    await call("get_organization", {}, 401);
    await db.update(apiKey).set({ expiresAt: new Date(Date.now() - 1) }).where(eq(apiKey.id, key.id));
    await json(await createContact(req("contacts", "POST", { name: "Expired" })), 401);
    await db.update(apiKey).set({ expiresAt: null }).where(eq(apiKey.id, key.id));
    const apiCtx = await getAuthContext(req("organization")), apiCall = await connect(apiCtx);
    await db.delete(apiKey).where(eq(apiKey.id, key.id));
    await apiCall("get_organization", {}, 401);
    // Removed creators cannot exchange refresh tokens or resume stored identities.
    const [removedToken] = await db.insert(mcpAccessToken).values({ organizationId: a.id, userId: owner.id, role: "owner", clientId: "fixture", tokenHash: hash("mcp_at_removed"), expiresAt: new Date(Date.now() + 60000) }).returning();
    await db.insert(mcpRefreshToken).values({ accessTokenId: removedToken.id, tokenHash: hash("mcp_rt_removed"), expiresAt: new Date(Date.now() + 60000) });
    await db.insert(apiKey).values({ organizationId: a.id, createdBy: owner.id, name: "Removed", keyHash: hash(raw), keyPrefix: "dk_identity" });
    const removedReference = executionIdentity(await resolveToken("mcp_at_removed"));
    await db.delete(member).where(eq(member.id, membership.id));
    await assert.rejects(resolveToken("mcp_at_removed"), /Not a member/);
    await assert.rejects(authorizeExecution(removedReference, a.id, "manage:contacts"), /Not a member/);
    await json(await createContact(req("contacts", "POST", { name: "Removed" })), 403);
    await assert.rejects(resolveExecutionIdentity(reference), /Invalid or expired credential/);
    await json(await oauth(new Request("http://fixture.test/api/mcp/oauth/token", { method: "POST", body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: "mcp_rt_removed", client_id: "fixture" }) })), 400);
    const [{ count }] = (await db.execute(sql`select count(*)::int as count from contact where organization_id=${a.id}`)).rows as { count: number }[];
    assert.equal(count, 3);
    console.log("Live identity REST/MCP/SQL verified");
  } finally { for (const { client, server } of connected) { await client.close(); await server.close(); } }
}
run().then(() => process.exit(0), error => { console.error(error); process.exit(1); });
