import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { consolidationGroup, consolidationGroupMember, consolidationEliminationRule, consolidationRate,
  consolidationEliminationEntry, organization, member } from "@/lib/db/schema";
import { AuthError, type AuthContext } from "./auth-context";
import { requireRole } from "./require-role";
import { auditTax, lockTaxOrganization, type TaxTx } from "./tax-config-transaction";
import { consolidationId, consolidationGroupCreateSchema, consolidationGroupUpdateSchema, consolidationMemberSchema,
  consolidationRuleSchema, savedConsolidationCurrency, consolidationConfigDto } from "./consolidation-config-wire";
import { WireCompatibilityError } from "@/lib/money/wire";

const readOptions = { isolationLevel: "repeatable read", accessMode: "read only" } as const;
const owned = (ctx: AuthContext, id?: string) => and(eq(consolidationGroup.parentOrgId, ctx.organizationId),
  isNull(consolidationGroup.deletedAt), id ? eq(consolidationGroup.id, id) : undefined);
async function groupRow(tx: TaxTx, ctx: AuthContext, id: string) {
  const [row] = await tx.select().from(consolidationGroup).where(owned(ctx, id));
  if (!row) throw new AuthError("Consolidation group not found", 404);
  savedConsolidationCurrency(row.presentationCurrency); return consolidationConfigDto(row);
}
async function accessibleOrganization(tx: TaxTx, ctx: AuthContext, id: string) {
  // Explicit public projection: organization settings include financial and provider data.
  const [row] = await tx.select({ id: organization.id, name: organization.name, slug: organization.slug, defaultCurrency: organization.defaultCurrency })
    .from(organization).innerJoin(member, and(eq(member.organizationId, organization.id), eq(member.userId, ctx.userId)))
    .where(and(eq(organization.id, id), isNull(organization.deletedAt)));
  if (!row) throw new AuthError("You do not have access to the specified organization", 403);
  savedConsolidationCurrency(row.defaultCurrency); return consolidationConfigDto(row);
}
async function joinedGroup(tx: TaxTx, ctx: AuthContext, row: typeof consolidationGroup.$inferSelect) {
  savedConsolidationCurrency(row.presentationCurrency);
  const rows = await tx.select().from(consolidationGroupMember).where(eq(consolidationGroupMember.groupId, row.id)).orderBy(asc(consolidationGroupMember.createdAt), asc(consolidationGroupMember.id));
  if (new Set(rows.map(r => r.orgId)).size !== rows.length) throw new WireCompatibilityError("Duplicate saved consolidation members require remediation");
  const members = await Promise.all(rows.map(async r => {
    if (r.functionalCurrency !== null) savedConsolidationCurrency(r.functionalCurrency);
    return { ...r, organization: await accessibleOrganization(tx, ctx, r.orgId) };
  }));
  return consolidationConfigDto({ ...row, members });
}
async function mutation<T>(ctx: AuthContext, work: (tx: TaxTx) => Promise<T>) {
  requireRole(ctx, "manage:reports");
  return db.transaction(async tx => { await lockTaxOrganization(tx, ctx.organizationId); return consolidationConfigDto(await work(tx)); });
}
export async function listConsolidationGroups(ctx: AuthContext) {
  return db.transaction(async tx => {
    const rows = await tx.select().from(consolidationGroup).where(owned(ctx)).orderBy(desc(consolidationGroup.createdAt), asc(consolidationGroup.id));
    return Promise.all(rows.map(row => joinedGroup(tx, ctx, row)));
  }, readOptions);
}
export async function getConsolidationGroup(ctx: AuthContext, id: string) {
  consolidationId.parse(id); return db.transaction(async tx => joinedGroup(tx, ctx, await groupRow(tx, ctx, id)), readOptions);
}
export async function createConsolidationGroup(ctx: AuthContext, input: unknown, request?: Request) {
  requireRole(ctx, "manage:reports"); const values = consolidationGroupCreateSchema.parse(input);
  return mutation(ctx, async tx => {
    const [row] = await tx.insert(consolidationGroup).values({ parentOrgId: ctx.organizationId, ...values }).returning();
    const result = await joinedGroup(tx, ctx, row);
    await auditTax(tx, ctx.organizationId, "consolidation_group", row.id, "create", result, ctx, request); return result;
  });
}
export async function updateConsolidationGroup(ctx: AuthContext, id: string, input: unknown, request?: Request) {
  requireRole(ctx, "manage:reports"); consolidationId.parse(id); const values = consolidationGroupUpdateSchema.parse(input);
  return mutation(ctx, async tx => {
    const existing = await groupRow(tx, ctx, id); await joinedGroup(tx, ctx, existing);
    if (values.presentationCurrency && values.presentationCurrency !== existing.presentationCurrency) {
      const [rate] = await tx.select({ id: consolidationRate.id }).from(consolidationRate).where(eq(consolidationRate.groupId, id)).limit(1);
      const [entry] = await tx.select({ id: consolidationEliminationEntry.id }).from(consolidationEliminationEntry).where(eq(consolidationEliminationEntry.groupId, id)).limit(1);
      if (rate || entry) throw new AuthError("Saved rates or elimination entries prevent presentation currency changes", 409);
    }
    const [row] = await tx.update(consolidationGroup).set({ ...values, updatedAt: new Date() }).where(owned(ctx, id)).returning();
    const result = await joinedGroup(tx, ctx, row);
    await auditTax(tx, ctx.organizationId, "consolidation_group", id, "update", result, ctx, request); return result;
  });
}
export async function deleteConsolidationGroup(ctx: AuthContext, id: string, request?: Request) {
  consolidationId.parse(id); return mutation(ctx, async tx => {
    const existing = await joinedGroup(tx, ctx, await groupRow(tx, ctx, id));
    const [deleted] = await tx.update(consolidationGroup).set({ deletedAt: new Date(), updatedAt: new Date() }).where(owned(ctx, id)).returning();
    savedConsolidationCurrency(deleted.presentationCurrency); consolidationConfigDto(deleted);
    await auditTax(tx, ctx.organizationId, "consolidation_group", id, "delete", existing, ctx, request); return { success: true };
  });
}
export async function listConsolidationMembers(ctx: AuthContext, id: string) {
  const group = await getConsolidationGroup(ctx, id);
  return { groupId: group.id, presentationCurrency: group.presentationCurrency, members: group.members.map(m => ({
    id: m.id, orgId: m.orgId, label: m.label || m.organization.name, orgName: m.organization.name,
    functionalCurrency: m.functionalCurrency || m.organization.defaultCurrency,
  })) };
}
export async function addConsolidationMember(ctx: AuthContext, id: string, input: unknown, request?: Request) {
  requireRole(ctx, "manage:reports"); consolidationId.parse(id); const values = consolidationMemberSchema.parse(input);
  return mutation(ctx, async tx => {
    await joinedGroup(tx, ctx, await groupRow(tx, ctx, id));
    await accessibleOrganization(tx, ctx, values.orgId);
    const [existing] = await tx.select().from(consolidationGroupMember).where(and(eq(consolidationGroupMember.groupId, id), eq(consolidationGroupMember.orgId, values.orgId)));
    if (existing) throw new AuthError("Organization is already a member of this group", 409);
    const [row] = await tx.insert(consolidationGroupMember).values({ groupId: id, ...values, label: values.label || null }).returning();
    if (row.functionalCurrency !== null) savedConsolidationCurrency(row.functionalCurrency);
    await joinedGroup(tx, ctx, await groupRow(tx, ctx, id)); consolidationConfigDto(row);
    await auditTax(tx, ctx.organizationId, "consolidation_member", row.id, "create", row, ctx, request); return row;
  });
}
export async function removeConsolidationMember(ctx: AuthContext, id: string, orgId: string, request?: Request) {
  consolidationId.parse(id); consolidationId.parse(orgId);
  return mutation(ctx, async tx => {
    await groupRow(tx, ctx, id);
    // A parent manager can remove a revoked member without reading its organization.
    const [row] = await tx.select().from(consolidationGroupMember).where(and(eq(consolidationGroupMember.groupId, id), eq(consolidationGroupMember.orgId, orgId)));
    if (!row) throw new AuthError("Group member not found", 404);
    await tx.delete(consolidationGroupMember).where(eq(consolidationGroupMember.id, row.id));
    await auditTax(tx, ctx.organizationId, "consolidation_member", row.id, "delete", row, ctx, request);
    return { success: true, removedMemberId: row.id };
  });
}
function ruleDto(row: typeof consolidationEliminationRule.$inferSelect) {
  try { consolidationRuleSchema.parse({ name: row.name, kind: row.kind, debitAccountMatch: row.debitAccountMatch, creditAccountMatch: row.creditAccountMatch, description: row.description }); }
  catch { throw new WireCompatibilityError("Saved consolidation rule is unsupported"); }
  return consolidationConfigDto(row);
}
export async function listConsolidationRules(ctx: AuthContext, id: string) {
  consolidationId.parse(id); return db.transaction(async tx => {
    await joinedGroup(tx, ctx, await groupRow(tx, ctx, id));
    return { groupId: id, rules: (await tx.select().from(consolidationEliminationRule).where(and(eq(consolidationEliminationRule.groupId, id), isNull(consolidationEliminationRule.deletedAt)))
      .orderBy(asc(consolidationEliminationRule.createdAt), asc(consolidationEliminationRule.id))).map(row => { const r = ruleDto(row);
        return { id: r.id, name: r.name, kind: r.kind, debitAccountMatch: r.debitAccountMatch, creditAccountMatch: r.creditAccountMatch, description: r.description }; }) };
  }, readOptions);
}
export async function createConsolidationRule(ctx: AuthContext, id: string, input: unknown, request?: Request) {
  requireRole(ctx, "manage:reports"); consolidationId.parse(id); const values = consolidationRuleSchema.parse(input);
  return mutation(ctx, async tx => {
    await joinedGroup(tx, ctx, await groupRow(tx, ctx, id));
    const [row] = await tx.insert(consolidationEliminationRule).values({ groupId: id, ...values,
      debitAccountMatch: values.debitAccountMatch || null, creditAccountMatch: values.creditAccountMatch || null }).returning();
    const result = ruleDto(row); await auditTax(tx, ctx.organizationId, "consolidation_rule", row.id, "create", result, ctx, request); return result;
  });
}
export async function deleteConsolidationRule(ctx: AuthContext, id: string, ruleId: string, request?: Request) {
  consolidationId.parse(id); consolidationId.parse(ruleId);
  return mutation(ctx, async tx => {
    await joinedGroup(tx, ctx, await groupRow(tx, ctx, id));
    const [row] = await tx.select().from(consolidationEliminationRule).where(and(eq(consolidationEliminationRule.id, ruleId), eq(consolidationEliminationRule.groupId, id), isNull(consolidationEliminationRule.deletedAt)));
    if (!row) throw new AuthError("Elimination rule not found", 404);
    const result = ruleDto(row);
    const [deleted] = await tx.update(consolidationEliminationRule).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(consolidationEliminationRule.id, ruleId)).returning();
    ruleDto(deleted);
    await auditTax(tx, ctx.organizationId, "consolidation_rule", ruleId, "delete", result, ctx, request);
    return { success: true, deletedRuleId: ruleId };
  });
}
