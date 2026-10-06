import { and, asc, desc, eq, ilike, isNull, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { pipeline, deal, dealActivity, contact, users, member } from "@/lib/db/schema";
import { AuthError, type AuthContext } from "./auth-context";
import { requireRole } from "./require-role";
import { lockTaxOrganization, auditTax, type TaxTx } from "./tax-config-transaction";
import { crmId, crmStages, pipelineCreateSchema, pipelineUpdateSchema, dealCreateSchema, dealUpdateSchema,
  dealStageSchema, dealLostSchema, dealAmounts, dealDto, dealListSchema, activityCreateSchema, activityListSchema, crmAnalyticsSchema, crmTotals } from "./crm-wire";
import { legacyMinor, stringifyWire, WireCompatibilityError } from "@/lib/money/wire";

const readOptions = { isolationLevel: "repeatable read", accessMode: "read only" } as const;
const ps = (ctx: AuthContext, id?: string) => and(eq(pipeline.organizationId, ctx.organizationId), isNull(pipeline.deletedAt), id ? eq(pipeline.id, id) : undefined);
const ds = (ctx: AuthContext, id?: string) => and(eq(deal.organizationId, ctx.organizationId), isNull(deal.deletedAt), id ? eq(deal.id, id) : undefined);
function pipelineDto<T extends { stages: unknown }>(row: T) {
  try { crmStages.parse(row.stages); stringifyWire(row); return row; }
  catch { throw new WireCompatibilityError("Saved CRM pipeline stage configuration is unsupported"); }
}
async function ownedPipeline(tx: TaxTx, ctx: AuthContext, id: string) {
  const [row] = await tx.select().from(pipeline).where(ps(ctx, id));
  if (!row) throw new AuthError("Pipeline not found", 404);
  return pipelineDto(row);
}
async function ownedDeal(tx: TaxTx, ctx: AuthContext, id: string) {
  const [row] = await tx.select().from(deal).where(ds(ctx, id));
  if (!row) throw new AuthError("Deal not found", 404);
  dealDto(row); await references(tx, ctx, row, false); return row;
}
async function ownedContact(tx: TaxTx, ctx: AuthContext, id: string, live: boolean) {
  const [row] = await tx.select().from(contact).where(and(eq(contact.id, id), eq(contact.organizationId, ctx.organizationId), live ? isNull(contact.deletedAt) : undefined));
  if (!row) throw new AuthError("Contact not found in organization", 404);
  const result = { ...row, creditLimitMinor: row.creditLimit === null ? null : String(legacyMinor(BigInt(row.creditLimit))) };
  stringifyWire(result); return result;
}
async function ownedUser(tx: TaxTx, ctx: AuthContext, id: string) {
  const [row] = await tx.select({ id: users.id, name: users.name, email: users.email, image: users.image }).from(users)
    .innerJoin(member, and(eq(member.userId, users.id), eq(member.organizationId, ctx.organizationId))).where(eq(users.id, id));
  if (!row) throw new AuthError("User is not a current organization member", 404);
  return row;
}
async function references(tx: TaxTx, ctx: AuthContext, row: { pipelineId: string; stageId: string; contactId?: string | null; assignedTo?: string | null }, live: boolean) {
  const p = await ownedPipeline(tx, ctx, row.pipelineId);
  if (!["closed_won", "closed_lost"].includes(row.stageId) && !p.stages.some(s => s.id === row.stageId))
    throw new AuthError("Stage is not configured in this pipeline", 422);
  if (row.contactId) await ownedContact(tx, ctx, row.contactId, live);
  if (row.assignedTo) await ownedUser(tx, ctx, row.assignedTo);
  return p;
}
async function joinedDeal(tx: TaxTx, ctx: AuthContext, row: typeof deal.$inferSelect, full = false) {
  const p = await references(tx, ctx, row, false);
  return { ...dealDto(row), contact: row.contactId ? await ownedContact(tx, ctx, row.contactId, false) : null,
    assignedUser: row.assignedTo ? await ownedUser(tx, ctx, row.assignedTo) : null,
    ...(full ? { pipeline: p, activities: await activityRows(tx, ctx, row.id) } : {}) };
}
async function activityRows(tx: TaxTx, ctx: AuthContext, id: string) {
  const rows = await tx.select().from(dealActivity).where(eq(dealActivity.dealId, id)).orderBy(desc(dealActivity.createdAt), desc(dealActivity.id));
  return Promise.all(rows.map(async row => {
    const result = { ...row, user: row.userId ? await ownedUser(tx, ctx, row.userId) : null }; stringifyWire(result); return result;
  }));
}
async function mutation<T>(ctx: AuthContext, work: (tx: TaxTx) => Promise<T>) {
  return db.transaction(async tx => { await lockTaxOrganization(tx, ctx.organizationId); const result = await work(tx); stringifyWire(result); return result; });
}
export async function listPipelines(ctx: AuthContext) {
  return db.transaction(async tx => (await tx.select().from(pipeline).where(ps(ctx)).orderBy(asc(pipeline.createdAt), asc(pipeline.id))).map(pipelineDto), readOptions);
}
export async function getPipeline(ctx: AuthContext, id: string) {
  crmId.parse(id);
  return db.transaction(async tx => { const p = await ownedPipeline(tx, ctx, id);
    const rows = await tx.select().from(deal).where(and(ds(ctx), eq(deal.pipelineId, id))).orderBy(asc(deal.createdAt), asc(deal.id));
    return { ...p, deals: await Promise.all(rows.map(row => joinedDeal(tx, ctx, row))) }; }, readOptions);
}
export async function createPipeline(ctx: AuthContext, input: unknown, request?: Request) {
  requireRole(ctx, "manage:contacts"); const values = pipelineCreateSchema.parse(input);
  return mutation(ctx, async tx => {
    if (values.isDefault) await tx.update(pipeline).set({ isDefault: false }).where(ps(ctx));
    const [row] = await tx.insert(pipeline).values({ organizationId: ctx.organizationId, ...values }).returning();
    const result = pipelineDto(row); await auditTax(tx, ctx.organizationId, "pipeline", row.id, "create", result, ctx, request); return result;
  });
}
export async function updatePipeline(ctx: AuthContext, id: string, input: unknown, request?: Request) {
  requireRole(ctx, "manage:contacts"); crmId.parse(id); const values = pipelineUpdateSchema.parse(input);
  return mutation(ctx, async tx => {
    const existing = await ownedPipeline(tx, ctx, id);
    if (values.stages) {
      const rows = await tx.select().from(deal).where(and(ds(ctx), eq(deal.pipelineId, id)));
      for (const row of rows) { dealDto(row); await references(tx, ctx, row, false);
        if (!["closed_won", "closed_lost"].includes(row.stageId) && !values.stages.some(s => s.id === row.stageId)) throw new AuthError("Cannot remove a stage used by a live deal", 409); }
    }
    if (values.isDefault) await tx.update(pipeline).set({ isDefault: false }).where(ps(ctx));
    const [row] = await tx.update(pipeline).set({ name: existing.name, ...values }).where(ps(ctx, id)).returning();
    const result = pipelineDto(row); await auditTax(tx, ctx.organizationId, "pipeline", id, "update", result, ctx, request); return result;
  });
}
export async function deletePipeline(ctx: AuthContext, id: string, request?: Request) {
  requireRole(ctx, "manage:contacts"); crmId.parse(id);
  return mutation(ctx, async tx => { await ownedPipeline(tx, ctx, id);
    const [existing] = await tx.select({ id: deal.id }).from(deal).where(and(ds(ctx), eq(deal.pipelineId, id))).limit(1);
    if (existing) throw new AuthError("Delete live deals before deleting their pipeline", 409);
    const [row] = await tx.update(pipeline).set({ deletedAt: new Date(), isDefault: false }).where(ps(ctx, id)).returning();
    pipelineDto(row);
    await auditTax(tx, ctx.organizationId, "pipeline", id, "delete", { id }, ctx, request); return { success: true }; });
}
export async function listDeals(ctx: AuthContext, input: unknown) {
  const q = dealListSchema.parse(input);
  return db.transaction(async tx => {
    if (q.pipelineId) await ownedPipeline(tx, ctx, q.pipelineId);
    const base = and(ds(ctx), q.pipelineId ? eq(deal.pipelineId, q.pipelineId) : undefined, q.currency ? eq(deal.currency, q.currency) : undefined);
    const where = and(base, q.stageId ? eq(deal.stageId, q.stageId) : undefined, q.source ? eq(deal.source, q.source) : undefined,
      q.search ? ilike(deal.title, `%${q.search}%`) : undefined,
      q.status === "active" ? and(isNull(deal.wonAt), isNull(deal.lostAt)) : q.status === "won" ? isNotNull(deal.wonAt) : q.status === "lost" ? isNotNull(deal.lostAt) : undefined);
    const column = q.sortBy === "value" ? deal.valueCents : q.sortBy === "name" ? deal.title : q.sortBy === "probability" ? deal.probability : deal.createdAt;
    const all = await tx.select().from(deal).where(where).orderBy((q.sortOrder === "asc" ? asc : desc)(column), asc(deal.id));
    const summaryRows = await tx.select().from(deal).where(base);
    for (const row of summaryRows) { dealDto(row); await references(tx, ctx, row, false); }
    const summary = crmTotals(summaryRows, q.currency).summary;
    const data = await Promise.all(all.slice((q.page - 1) * q.limit, q.page * q.limit).map(row => joinedDeal(tx, ctx, row)));
    return { data, pagination: { page: q.page, limit: q.limit, total: all.length, totalPages: Math.ceil(all.length / q.limit) }, summary };
  }, readOptions);
}
export async function getDeal(ctx: AuthContext, id: string) {
  crmId.parse(id); return db.transaction(async tx => joinedDeal(tx, ctx, await ownedDeal(tx, ctx, id), true), readOptions);
}
export async function createDeal(ctx: AuthContext, input: unknown, request?: Request) {
  const values = dealAmounts(dealCreateSchema.parse(input));
  return mutation(ctx, async tx => {
    await references(tx, ctx, values, true);
    const p = await ownedPipeline(tx, ctx, values.pipelineId);
    if (!p.stages.some(s => s.id === values.stageId)) throw new AuthError("Stage is not configured in pipeline", 422);
    const [row] = await tx.insert(deal).values({ organizationId: ctx.organizationId, ...values }).returning();
    const result = dealDto(row); await references(tx, ctx, row, false);
    await auditTax(tx, ctx.organizationId, "deal", row.id, "create", result, ctx, request); return result;
  });
}
export async function updateDeal(ctx: AuthContext, id: string, input: unknown, request?: Request) {
  crmId.parse(id); const values = dealAmounts(dealUpdateSchema.parse(input));
  return mutation(ctx, async tx => {
    const existing = await ownedDeal(tx, ctx, id); await references(tx, ctx, { ...existing, ...values }, false);
    if (values.contactId) await ownedContact(tx, ctx, values.contactId, true);
    if (values.assignedTo) await ownedUser(tx, ctx, values.assignedTo);
    const [row] = await tx.update(deal).set({ ...values, updatedAt: new Date() }).where(ds(ctx, id)).returning();
    const result = dealDto(row); await references(tx, ctx, row, false);
    await auditTax(tx, ctx.organizationId, "deal", id, "update", result, ctx, request); return result;
  });
}
export async function deleteDeal(ctx: AuthContext, id: string, request?: Request) {
  crmId.parse(id); return mutation(ctx, async tx => { await ownedDeal(tx, ctx, id);
    const [row] = await tx.update(deal).set({ deletedAt: new Date(), updatedAt: new Date() }).where(ds(ctx, id)).returning();
    dealDto(row); await references(tx, ctx, row, false);
    await auditTax(tx, ctx.organizationId, "deal", id, "delete", { id }, ctx, request); return { success: true }; });
}
export async function moveDealStage(ctx: AuthContext, id: string, input: unknown, request?: Request) {
  crmId.parse(id); const { stageId } = dealStageSchema.parse(input);
  return mutation(ctx, async tx => { const existing = await ownedDeal(tx, ctx, id), p = await ownedPipeline(tx, ctx, existing.pipelineId);
    if (!p.stages.some(s => s.id === stageId)) throw new AuthError("Stage is not configured in pipeline", 422);
    const [row] = await tx.update(deal).set({ stageId, updatedAt: new Date() }).where(ds(ctx, id)).returning();
    const result = dealDto(row); await references(tx, ctx, row, false); await auditTax(tx, ctx.organizationId, "deal", id, "change_stage", { previousStatus: existing.stageId, stageId }, ctx, request); return result; });
}
export async function closeDeal(ctx: AuthContext, id: string, status: "won" | "lost", input: unknown = {}, request?: Request) {
  crmId.parse(id); const { reason } = dealLostSchema.parse(input);
  return mutation(ctx, async tx => { const existing = await ownedDeal(tx, ctx, id);
    // A same-state retry preserves the original timestamp and creates no duplicate audit.
    if (status === "won" ? existing.wonAt : existing.lostAt) return dealDto(existing);
    const now = new Date();
    const [row] = await tx.update(deal).set({ stageId: status === "won" ? "closed_won" : "closed_lost", wonAt: status === "won" ? now : null,
      lostAt: status === "lost" ? now : null, lostReason: status === "lost" ? reason ?? null : null, probability: status === "won" ? 100 : 0, updatedAt: now }).where(ds(ctx, id)).returning();
    const result = dealDto(row); await references(tx, ctx, row, false); await auditTax(tx, ctx.organizationId, "deal", id, status, { previousStatus: existing.stageId, ...result }, ctx, request); return result; });
}
export async function listDealActivities(ctx: AuthContext, id: string, input: unknown) {
  crmId.parse(id); const q = activityListSchema.parse(input);
  return db.transaction(async tx => { await ownedDeal(tx, ctx, id);
    const all = await activityRows(tx, ctx, id), typeCounts = Object.fromEntries(["note", "email", "call", "meeting", "task"].map(type => [type, all.filter(r => r.type === type).length]));
    const filtered = await tx.select({ id: dealActivity.id }).from(dealActivity).where(and(eq(dealActivity.dealId, id), q.type ? eq(dealActivity.type, q.type) : undefined, q.search ? ilike(dealActivity.content, `%${q.search}%`) : undefined))
      .orderBy((q.sortOrder === "asc" ? asc : desc)(q.sortBy === "type" ? dealActivity.type : dealActivity.createdAt), asc(dealActivity.id));
    const byId = new Map(all.map(row => [row.id, row]));
    return { activities: filtered.slice((q.page - 1) * q.limit, q.page * q.limit).map(row => byId.get(row.id)!),
      pagination: { page: q.page, limit: q.limit, total: filtered.length, totalPages: Math.ceil(filtered.length / q.limit) }, typeCounts, totalAll: all.length };
  }, readOptions);
}
export async function addDealActivity(ctx: AuthContext, id: string, input: unknown, request?: Request) {
  crmId.parse(id); const values = activityCreateSchema.parse(input);
  return mutation(ctx, async tx => { await ownedDeal(tx, ctx, id); await ownedUser(tx, ctx, ctx.userId);
    const [row] = await tx.insert(dealActivity).values({ dealId: id, userId: ctx.userId, type: values.type, content: values.content ?? null, scheduledAt: values.scheduledAt ? new Date(values.scheduledAt) : null }).returning();
    if (row.dealId !== id || row.userId !== ctx.userId) throw new AuthError("Activity output scope changed", 422);
    stringifyWire(row); await ownedUser(tx, ctx, row.userId!);
    await auditTax(tx, ctx.organizationId, "deal_activity", row.id, "create", row, ctx, request); return row;
  });
}
export async function crmAnalytics(ctx: AuthContext, input: unknown = {}) {
  const q = crmAnalyticsSchema.parse(input);
  return db.transaction(async tx => { const rows = await tx.select().from(deal).where(and(ds(ctx), q.currency ? eq(deal.currency, q.currency) : undefined));
    for (const row of rows) { dealDto(row); await references(tx, ctx, row, false); }
    return crmTotals(rows, q.currency).analytics;
  }, readOptions);
}
