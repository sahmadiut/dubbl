import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { payrollEmployee, payrollItem, contractor, contractorPayment, member, users, auditLog } from "@/lib/db/schema";
import { AuthError, type AuthContext } from "./auth-context";
import { requireRole } from "./require-role";
import { payrollMasterId, payrollMasterListSchema, payrollMasterAmounts, payrollMasterDto, payrollPaymentReadDto,
  employeeCreateSchema, employeeUpdateSchema, contractorCreateSchema, contractorUpdateSchema } from "./payroll-master-wire";
import { legacyMinor, stringifyWire } from "@/lib/money/wire";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
const employeeScope = (ctx: AuthContext, id?: string) => and(eq(payrollEmployee.organizationId, ctx.organizationId),
  isNull(payrollEmployee.deletedAt), id ? eq(payrollEmployee.id, id) : undefined);
const contractorScope = (ctx: AuthContext, id?: string) => and(eq(contractor.organizationId, ctx.organizationId),
  isNull(contractor.deletedAt), id ? eq(contractor.id, id) : undefined);
async function audit(tx: Tx, ctx: AuthContext, entityType: string, entityId: string, action: string, changes: unknown, request?: Request) {
  await tx.insert(auditLog).values({ organizationId: ctx.organizationId, userId: ctx.userId, entityType, entityId, action,
    changes: JSON.parse(stringifyWire(changes)), ipAddress: request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
    userAgent: request?.headers.get("user-agent") || null });
}
async function ownedMember(tx: Tx, ctx: AuthContext, id: string | null | undefined) {
  if (!id) return;
  const [row] = await tx.select({ id: member.id }).from(member).where(and(eq(member.id, id), eq(member.organizationId, ctx.organizationId))).for("share");
  if (!row) throw new AuthError("Member must belong to the organization", 404);
}
async function employeeRead(tx: Tx, ctx: AuthContext, row: typeof payrollEmployee.$inferSelect) {
  // Never return user credentials, or join a malformed historical cross-tenant member link.
  const [linked] = row.memberId ? await tx.select({ member: member, user: { id: users.id, name: users.name, email: users.email, image: users.image } })
    .from(member).innerJoin(users, eq(users.id, member.userId))
    .where(and(eq(member.id, row.memberId), eq(member.organizationId, ctx.organizationId))) : [];
  return { ...payrollMasterDto(row), member: linked ? { ...linked.member, user: linked.user } : null };
}
function dates(start: string, end: string | null | undefined) {
  if (end && end < start) throw new AuthError("Employment end date cannot precede start date", 400);
}
export async function listPayrollEmployees(ctx: AuthContext, input: unknown) {
  requireRole(ctx, "manage:payroll"); const p = payrollMasterListSchema.parse(input);
  return db.transaction(async tx => {
    const scope = and(employeeScope(ctx), p.active === undefined ? undefined : eq(payrollEmployee.isActive, p.active));
    const rows = await tx.select().from(payrollEmployee).where(scope).orderBy(desc(payrollEmployee.createdAt), asc(payrollEmployee.id)).limit(p.limit).offset((p.page - 1) * p.limit);
    const [count] = await tx.select({ count: sql<string>`count(*)::text` }).from(payrollEmployee).where(scope);
    return { employees: await Promise.all(rows.map(r => employeeRead(tx, ctx, r))), total: legacyMinor(BigInt(count.count)), page: p.page, limit: p.limit };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
export async function getPayrollEmployee(ctx: AuthContext, id: string) {
  requireRole(ctx, "manage:payroll"); payrollMasterId.parse(id);
  return db.transaction(async tx => {
    const [row] = await tx.select().from(payrollEmployee).where(employeeScope(ctx, id));
    if (!row) throw new AuthError("Employee not found", 404);
    return employeeRead(tx, ctx, row);
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
export async function createPayrollEmployee(ctx: AuthContext, input: unknown, request?: Request) {
  requireRole(ctx, "manage:payroll"); const values = payrollMasterAmounts(employeeCreateSchema.parse(input), true);
  dates(values.startDate, values.endDate);
  return db.transaction(async tx => {
    await ownedMember(tx, ctx, values.memberId);
    const [row] = await tx.insert(payrollEmployee).values({ ...values, salary: values.salary!, organizationId: ctx.organizationId,
      payFrequency: values.payFrequency ?? "monthly", compensationType: values.compensationType ?? "salary", taxRate: values.taxRate ?? 2000,
      currency: values.currency ?? "USD" }).returning();
    const result = payrollMasterDto(row); await audit(tx, ctx, "payroll_employee", row.id, "create", result, request); return result;
  });
}
export async function updatePayrollEmployee(ctx: AuthContext, id: string, input: unknown, request?: Request) {
  requireRole(ctx, "manage:payroll"); payrollMasterId.parse(id); const values = payrollMasterAmounts(employeeUpdateSchema.parse(input));
  return db.transaction(async tx => {
    const [before] = await tx.select().from(payrollEmployee).where(employeeScope(ctx, id)).for("update");
    if (!before) throw new AuthError("Employee not found", 404);
    const old = payrollMasterDto(before); dates(before.startDate, values.endDate === undefined ? before.endDate : values.endDate);
    await ownedMember(tx, ctx, values.memberId === undefined ? before.memberId : values.memberId);
    if (values.currency !== undefined && values.currency !== before.currency) {
      const [item] = await tx.select({ id: payrollItem.id }).from(payrollItem).where(eq(payrollItem.employeeId, id)).limit(1);
      if (item) throw new AuthError("Employee currency cannot change with pay-item history", 409);
    }
    const [row] = await tx.update(payrollEmployee).set({ ...values, updatedAt: new Date() }).where(employeeScope(ctx, id)).returning();
    const result = payrollMasterDto(row); await audit(tx, ctx, "payroll_employee", id, "update", { before: old, after: result }, request); return result;
  });
}
export async function deletePayrollEmployee(ctx: AuthContext, id: string, request?: Request) {
  requireRole(ctx, "manage:payroll"); payrollMasterId.parse(id);
  return db.transaction(async tx => {
    const [row] = await tx.select().from(payrollEmployee).where(employeeScope(ctx, id)).for("update");
    if (!row) throw new AuthError("Employee not found", 404);
    const before = payrollMasterDto(row);
    await tx.update(payrollEmployee).set({ deletedAt: new Date(), updatedAt: new Date() }).where(employeeScope(ctx, id));
    await audit(tx, ctx, "payroll_employee", id, "delete", before, request); return { success: true };
  });
}
export async function listPayrollContractors(ctx: AuthContext, input: unknown) {
  requireRole(ctx, "manage:contractors"); const p = payrollMasterListSchema.parse(input);
  return db.transaction(async tx => {
    const scope = and(contractorScope(ctx), p.active === undefined ? undefined : eq(contractor.isActive, p.active));
    const rows = await tx.select().from(contractor).where(scope).orderBy(desc(contractor.createdAt), asc(contractor.id)).limit(p.limit).offset((p.page - 1) * p.limit);
    const [count] = await tx.select({ count: sql<string>`count(*)::text` }).from(contractor).where(scope);
    return { contractors: rows.map(payrollMasterDto), total: legacyMinor(BigInt(count.count)), page: p.page, limit: p.limit };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
export async function getPayrollContractor(ctx: AuthContext, id: string) {
  requireRole(ctx, "manage:contractors"); payrollMasterId.parse(id);
  return db.transaction(async tx => {
    const [row] = await tx.select().from(contractor).where(contractorScope(ctx, id));
    if (!row) throw new AuthError("Contractor not found", 404);
    const payments = await tx.select().from(contractorPayment).where(eq(contractorPayment.contractorId, id)).orderBy(contractorPayment.createdAt, contractorPayment.id);
    return { ...payrollMasterDto(row), payments: payments.map(payrollPaymentReadDto) };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
export async function createPayrollContractor(ctx: AuthContext, input: unknown, request?: Request) {
  requireRole(ctx, "manage:contractors"); const values = payrollMasterAmounts(contractorCreateSchema.parse(input));
  return db.transaction(async tx => {
    const [row] = await tx.insert(contractor).values({ ...values, organizationId: ctx.organizationId, currency: values.currency ?? "USD" }).returning();
    const result = payrollMasterDto(row); await audit(tx, ctx, "contractor", row.id, "create", result, request); return result;
  });
}
export async function updatePayrollContractor(ctx: AuthContext, id: string, input: unknown, request?: Request) {
  requireRole(ctx, "manage:contractors"); payrollMasterId.parse(id); const values = payrollMasterAmounts(contractorUpdateSchema.parse(input));
  return db.transaction(async tx => {
    const [before] = await tx.select().from(contractor).where(contractorScope(ctx, id)).for("update");
    if (!before) throw new AuthError("Contractor not found", 404);
    const old = payrollMasterDto(before);
    if (values.currency !== undefined && values.currency !== before.currency) {
      const [payment] = await tx.select({ id: contractorPayment.id }).from(contractorPayment).where(eq(contractorPayment.contractorId, id)).limit(1);
      if (payment) throw new AuthError("Contractor currency cannot change with payment history", 409);
    }
    const [row] = await tx.update(contractor).set({ ...values, updatedAt: new Date() }).where(contractorScope(ctx, id)).returning();
    const result = payrollMasterDto(row); await audit(tx, ctx, "contractor", id, "update", { before: old, after: result }, request); return result;
  });
}
export async function deletePayrollContractor(ctx: AuthContext, id: string, request?: Request) {
  requireRole(ctx, "manage:contractors"); payrollMasterId.parse(id);
  return db.transaction(async tx => {
    const [row] = await tx.select().from(contractor).where(contractorScope(ctx, id)).for("update");
    if (!row) throw new AuthError("Contractor not found", 404);
    const before = payrollMasterDto(row);
    await tx.update(contractor).set({ deletedAt: new Date(), updatedAt: new Date() }).where(contractorScope(ctx, id));
    await audit(tx, ctx, "contractor", id, "delete", before, request); return { success: true };
  });
}
