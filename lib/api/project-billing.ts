import { createHash } from "node:crypto";
import { and, eq, gte, lte, isNull, inArray, notInArray, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { project, projectBillableItem, projectMilestone, projectMember, timeEntry, projectTask,
  invoice, invoiceLine, bill, billLine, expenseClaim, expenseItem, journalEntry, journalLine,
  chartAccount, contact, member, users, auditLog } from "@/lib/db/schema";
import { AuthError, type AuthContext } from "./auth-context";
import { requireRole } from "./require-role";
import { lockTaxOrganization, auditTax, type TaxTx } from "./tax-config-transaction";
import { assertNotLocked } from "./period-lock";
import { nextNumber } from "./invoice-writes";
import { invoiceWriteDto, invoiceRound } from "./invoice-write-wire";
import { projectRowDto } from "./project-master-wire";
import { legacyMinor, stringifyWire, WireCompatibilityError } from "@/lib/money/wire";
import { billingSchemas, billingCost, billingDto, billingInteger as integer, billingMarkup, billingTime,
  billingPercent, billingRatio, type BillingOperation } from "./project-billing-wire";

const fail = (message: string, status = 422): never => { throw new AuthError(message, status); };
type Project = typeof project.$inferSelect;
type Item = typeof projectBillableItem.$inferSelect;
const sum = (values: number[]) => legacyMinor(values.reduce((s, v) => s + integer(v, false), 0n));
function sameCurrency(actual: string, expected: string) { if (actual !== expected) throw new WireCompatibilityError("Project and source currencies must agree; conversion is not implicit"); }
async function getProject(tx: TaxTx, ctx: AuthContext, id: string, write = false) {
  const q = tx.select().from(project).where(and(eq(project.id, id), eq(project.organizationId, ctx.organizationId), isNull(project.deletedAt)));
  const [p] = await (write ? q.for("update") : q);
  if (!p) return fail("Project not found", 404);
  projectRowDto("project", p); return p;
}
async function customer(tx: TaxTx, ctx: AuthContext, id: string | null) {
  if (!id) return fail("Project requires a customer");
  const [c] = await tx.select({ id: contact.id }).from(contact).where(and(eq(contact.id, id), eq(contact.organizationId, ctx.organizationId), isNull(contact.deletedAt)));
  return c ?? fail("Contact not found", 404);
}
async function source(tx: TaxTx, ctx: AuthContext, p: Project, kind: Item["sourceType"], id: string) {
  if (kind === "bill_line") {
    const [r] = await tx.select({ amount: billLine.amount, description: billLine.description, currency: bill.currencyCode, date: bill.issueDate }).from(billLine)
      .innerJoin(bill, eq(billLine.billId, bill.id)).where(and(eq(billLine.id, id), eq(billLine.projectId, p.id), eq(bill.organizationId, ctx.organizationId), isNull(bill.deletedAt), inArray(bill.status, ["received", "partial", "paid", "overdue"])));
    if (!r) return fail("Live approved project bill line not found", 404);
    sameCurrency(r.currency, p.currency); integer(r.amount); return r;
  }
  if (kind === "expense_item") {
    const [r] = await tx.select({ amount: expenseItem.amount, description: expenseItem.description, currency: expenseClaim.currencyCode, date: expenseItem.date }).from(expenseItem)
      .innerJoin(expenseClaim, eq(expenseItem.expenseClaimId, expenseClaim.id)).where(and(eq(expenseItem.id, id), eq(expenseClaim.organizationId, ctx.organizationId), isNull(expenseClaim.deletedAt), inArray(expenseClaim.status, ["approved", "paid"])));
    if (!r) return fail("Live approved expense item not found", 404);
    sameCurrency(r.currency, p.currency); integer(r.amount); return r;
  }
  const [r] = await tx.select({ debit: journalLine.debitAmount, credit: journalLine.creditAmount, description: journalLine.description, currency: journalLine.currencyCode,
    date: journalEntry.date, rate: journalLine.exchangeRate, rateExact: journalLine.rateExact }).from(journalLine)
    .innerJoin(journalEntry, eq(journalLine.journalEntryId, journalEntry.id)).innerJoin(chartAccount, eq(journalLine.accountId, chartAccount.id))
    .where(and(eq(journalLine.id, id), eq(journalLine.projectId, p.id), eq(journalEntry.organizationId, ctx.organizationId), isNull(journalEntry.deletedAt), eq(journalEntry.status, "posted"),
      eq(chartAccount.organizationId, ctx.organizationId), isNull(chartAccount.deletedAt), eq(chartAccount.type, "expense")));
  if (!r) return fail("Live posted project expense journal line not found", 404);
  sameCurrency(r.currency, p.currency);
  if (r.rate !== 1000000 || (r.rateExact !== null && !/^1(?:\.0+)?$/.test(r.rateExact))) throw new WireCompatibilityError("Project journal costing requires an identity rate");
  const amount = legacyMinor(integer(r.debit) - integer(r.credit)); integer(amount);
  return { ...r, amount, description: r.description ?? "Billable expense" };
}
async function items(tx: TaxTx, ctx: AuthContext, p: Project, unbilled = false) {
  const rows = await tx.select().from(projectBillableItem).where(and(eq(projectBillableItem.projectId, p.id), eq(projectBillableItem.organizationId, ctx.organizationId), unbilled ? isNull(projectBillableItem.billedInvoiceId) : undefined));
  for (const r of rows) {
    integer(r.costAmount); integer(r.billedAmount); billingMarkup(r.costAmount, r.markupBasisPoints);
    await source(tx, ctx, p, r.sourceType, r.sourceLineId);
    if (r.billedInvoiceId) {
      const [inv] = await tx.select({ currency: invoice.currencyCode }).from(invoice).where(and(eq(invoice.id, r.billedInvoiceId), eq(invoice.organizationId, ctx.organizationId)));
      if (!inv) fail("Saved billed invoice not found", 404); sameCurrency(inv.currency, p.currency);
    }
  }
  return rows;
}
async function list(tx: TaxTx, ctx: AuthContext, p: Project) {
  const rows = await items(tx, ctx, p);
  const registered = rows.filter(r => !r.billedInvoiceId).map(r => billingDto({ id: r.id, sourceType: r.sourceType, sourceLineId: r.sourceLineId, description: r.description,
    costAmount: r.costAmount, markupBasisPoints: r.markupBasisPoints, billableAmount: billingMarkup(r.costAmount, r.markupBasisPoints) }, ["costAmount", "billableAmount"]));
  const billed = rows.filter(r => r.billedInvoiceId).map(r => billingDto({ id: r.id, sourceType: r.sourceType, sourceLineId: r.sourceLineId, description: r.description,
    costAmount: r.costAmount, markupBasisPoints: r.markupBasisPoints, billedAmount: r.billedAmount, billedInvoiceId: r.billedInvoiceId, billedAt: r.billedAt }, ["costAmount", "billedAmount"]));
  const registeredIds = new Set(rows.filter(r => r.sourceType === "bill_line").map(r => r.sourceLineId));
  const candidates = [];
  const lines = await tx.select({ id: billLine.id, billId: bill.id, billNumber: bill.billNumber }).from(billLine).innerJoin(bill, eq(billLine.billId, bill.id))
    .where(and(eq(billLine.projectId, p.id), eq(bill.organizationId, ctx.organizationId), isNull(bill.deletedAt), inArray(bill.status, ["received", "partial", "paid", "overdue"])));
  for (const line of lines.filter(r => !registeredIds.has(r.id))) {
    const s = await source(tx, ctx, p, "bill_line", line.id);
    candidates.push(billingDto({ sourceType: "bill_line", sourceLineId: line.id, description: s.description, costAmount: s.amount, billId: line.billId, billNumber: line.billNumber }, ["costAmount"]));
  }
  return billingDto({ projectId: p.id, currency: p.currency, registered, billed, candidates, registeredCount: registered.length,
    registeredBillableTotal: sum(registered.map(r => r.billableAmount)) }, ["registeredBillableTotal"]);
}
async function entries(tx: TaxTx, ctx: AuthContext, p: Project) {
  const rows = await tx.select().from(timeEntry).where(and(eq(timeEntry.projectId, p.id), eq(timeEntry.isBillable, true), isNull(timeEntry.invoiceId)));
  const result = [];
  for (const r of rows) {
    projectRowDto("time", r);
    const [u] = await tx.select({ id: users.id, name: users.name, email: users.email, image: users.image }).from(users).innerJoin(member, eq(users.id, member.userId))
      .where(and(eq(users.id, r.userId), eq(member.organizationId, ctx.organizationId)));
    if (!u) fail("Time entry user not found", 404);
    const [task] = r.taskId ? await tx.select({ id: projectTask.id, title: projectTask.title }).from(projectTask).where(and(eq(projectTask.id, r.taskId), eq(projectTask.projectId, p.id))) : [];
    if (r.taskId && !task) fail("Time entry task not found", 404);
    result.push(billingDto({ ...r, amount: billingTime(r.minutes, r.hourlyRate), user: u, task: task ?? null }, ["hourlyRate", "amount"]));
  }
  return result;
}
async function milestones(tx: TaxTx, p: Project) {
  const rows = await tx.select().from(projectMilestone).where(eq(projectMilestone.projectId, p.id));
  return rows.map(r => { projectRowDto("milestone", r); return billingDto({ ...r, remaining: legacyMinor(integer(r.amount) - integer(r.invoicedAmountCents)) }, ["amount", "invoicedAmountCents", "remaining"]); });
}
// Writers must hold the organization/project locks; reads use a consistent snapshot.
export async function projectFixedInvoiced(tx: TaxTx, ctx: AuthContext, p: Project) {
  // Old name-only invoices cannot be attributed safely after rename or name reuse.
  const [untagged] = await tx.select({ id: invoiceLine.id }).from(invoiceLine).innerJoin(invoice, eq(invoiceLine.invoiceId, invoice.id))
    .where(and(eq(invoice.reference, `Project: ${p.name}`), eq(invoice.organizationId, ctx.organizationId), isNull(invoice.deletedAt), notInArray(invoice.status, ["void"]), isNull(invoiceLine.projectId))).limit(1);
  if (untagged) throw new WireCompatibilityError("Name-only fixed invoice history requires explicit project attribution before billing");
  const lines = await tx.select({ amount: invoiceLine.amount, currency: invoice.currencyCode }).from(invoiceLine).innerJoin(invoice, eq(invoiceLine.invoiceId, invoice.id))
    .where(and(eq(invoiceLine.projectId, p.id), eq(invoice.organizationId, ctx.organizationId), isNull(invoice.deletedAt), notInArray(invoice.status, ["void"])));
  for (const r of lines) sameCurrency(r.currency, p.currency);
  const expenses = await tx.select({ amount: projectBillableItem.billedAmount, currency: invoice.currencyCode }).from(projectBillableItem)
    .innerJoin(invoice, eq(projectBillableItem.billedInvoiceId, invoice.id)).where(and(eq(projectBillableItem.projectId, p.id), eq(projectBillableItem.organizationId, ctx.organizationId),
      eq(invoice.organizationId, ctx.organizationId), isNull(invoice.deletedAt), notInArray(invoice.status, ["void"])));
  for (const r of expenses) sameCurrency(r.currency, p.currency);
  const total = legacyMinor(integer(sum(lines.map(r => r.amount)), false) - integer(sum(expenses.map(r => r.amount))));
  if (total < 0 || total > p.fixedPrice) fail("Fixed-price invoice history exceeds or contradicts the project price");
  return total;
}
export async function projectBillingPreview(ctx: AuthContext, input: unknown) {
  const { projectId } = billingSchemas.list.parse(input);
  return db.transaction(async tx => {
    const p = await getProject(tx, ctx, projectId), registered = (await list(tx, ctx, p)).registered;
    const common = { billingType: p.billingType, currency: p.currency, billableExpenses: registered,
      ...billingDto({ billableExpensesTotal: sum(registered.map(r => r.billableAmount)) }, ["billableExpensesTotal"]) };
    let result;
    if (p.billingType === "milestone") {
      const ms = await milestones(tx, p); result = { ...common, milestones: ms, ...billingDto({ totalRemaining: sum(ms.map(m => m.remaining)) }, ["totalRemaining"]) };
    } else if (p.billingType === "hourly") {
      const time = await entries(tx, ctx, p); result = { ...common, timeEntries: time, ...billingDto({ totalAmount: sum(time.map(t => t.amount)) }, ["totalAmount"]) };
    } else if (p.billingType === "fixed") {
      const totalInvoiced = await projectFixedInvoiced(tx, ctx, p);
      result = { ...common, ...billingDto({ fixedPrice: p.fixedPrice, totalInvoiced, remaining: legacyMinor(integer(p.fixedPrice) - integer(totalInvoiced)) }, ["fixedPrice", "totalInvoiced", "remaining"]),
        invoicedPercent: legacyMinor(invoiceRound(integer(totalInvoiced) * 100n, integer(p.fixedPrice) || 1n)) };
    } else result = { ...common, message: "Non-billable project" };
    stringifyWire(result); return result;
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
function selected<T extends { id: string }>(rows: T[], ids: string[] | undefined, what: string) {
  if (!ids) return rows;
  const result = ids.map(id => rows.find(r => r.id === id) ?? fail(`${what} not available in this project`, 409)); return result;
}
export async function executeProjectBilling(ctx: AuthContext, op: BillingOperation, input: unknown, request?: Request) {
  if (op === "profitability") return projectProfitability(ctx, input);
  // Each operation is validated again even when invoked by a transport SDK.
  const parsed = billingSchemas[op].parse(input);
  if (op !== "list") requireRole(ctx, "manage:projects");
  return db.transaction(async tx => {
    if (op !== "list") {
      await lockTaxOrganization(tx, ctx.organizationId);
      await tx.execute(sql`lock table period_lock, fiscal_year in share mode`);
    }
    const p = await getProject(tx, ctx, parsed.projectId!, op !== "list");
    if (op === "list") { const result = await list(tx, ctx, p); stringifyWire(result); return result; }
    if (op === "register") {
      const v = billingSchemas.register.parse(input);
      const keys = v.items.map(i => `${i.sourceType}:${i.sourceLineId}`);
      if (new Set(keys).size !== keys.length) fail("Duplicate source keys");
      const resolved = [];
      for (const item of v.items) {
        const cost = billingCost(item), s = await source(tx, ctx, p, item.sourceType, item.sourceLineId);
        await assertNotLocked(ctx.organizationId, s.date, ctx, tx);
        const amount = cost.costAmount === undefined ? s.amount : cost.costAmount as number;
        billingMarkup(amount, item.markupBasisPoints);
        const [old] = await tx.select().from(projectBillableItem).where(and(eq(projectBillableItem.projectId, p.id), eq(projectBillableItem.sourceType, item.sourceType), eq(projectBillableItem.sourceLineId, item.sourceLineId)));
        if (old && (old.organizationId !== ctx.organizationId || old.billedInvoiceId)) fail("Billed or foreign item cannot be changed", 409);
        resolved.push({ organizationId: ctx.organizationId, projectId: p.id, sourceType: item.sourceType, sourceLineId: item.sourceLineId,
          description: item.description ?? s.description, costAmount: amount, markupBasisPoints: item.markupBasisPoints });
      }
      const created = [];
      for (const value of resolved) {
        const [r] = await tx.insert(projectBillableItem).values(value).onConflictDoUpdate({ target: [projectBillableItem.projectId, projectBillableItem.sourceType, projectBillableItem.sourceLineId],
          set: { description: value.description, costAmount: value.costAmount, markupBasisPoints: value.markupBasisPoints } }).returning();
        created.push(billingDto({ id: r.id, costAmount: r.costAmount, billableAmount: billingMarkup(r.costAmount, r.markupBasisPoints) }, ["costAmount", "billableAmount"]));
      }
      const result = { registered: created.length, items: created, currency: p.currency };
      await auditTax(tx, ctx.organizationId, "project", p.id, "register_billable_items", result, ctx, request); stringifyWire(result); return result;
    }
    if (op === "unregister") {
      const v = billingSchemas.unregister.parse(input);
      const row = (await items(tx, ctx, p)).find(r => r.id === v.itemId) ?? fail("Billable item not found", 404);
      if (row.billedInvoiceId) fail("Billed item cannot be removed", 409);
      const s = await source(tx, ctx, p, row.sourceType, row.sourceLineId); await assertNotLocked(ctx.organizationId, s.date, ctx, tx);
      await tx.delete(projectBillableItem).where(eq(projectBillableItem.id, row.id));
      await auditTax(tx, ctx.organizationId, "project", p.id, "unregister_billable_item", { itemId: row.id }, ctx, request); return { success: true };
    }
    const v = billingSchemas.progress.parse(op === "invoice" ? { ...billingSchemas.invoice.parse(input) } : input);
    const fingerprint = createHash("sha256").update(stringifyWire({ op, ...v })).digest("hex");
    if (v.requestKey) {
      const [prior] = await tx.select().from(auditLog).where(and(eq(auditLog.organizationId, ctx.organizationId), eq(auditLog.entityType, "project_invoice"), sql`${auditLog.changes}->>'requestKey' = ${v.requestKey}`));
      if (prior) {
        const changes = prior.changes as { fingerprint?: string };
        if (changes.fingerprint !== fingerprint) fail("Retry key already used with different inputs", 409);
        const [inv] = await tx.select().from(invoice).where(and(eq(invoice.id, prior.entityId!), eq(invoice.organizationId, ctx.organizationId), isNull(invoice.deletedAt), notInArray(invoice.status, ["void"])));
        if (!inv) fail("Retry invoice no longer available", 409);
        sameCurrency(inv.currencyCode, p.currency); await customer(tx, ctx, inv.contactId);
        const result = { invoice: invoiceWriteDto(inv) }; stringifyWire(result); return result;
      }
    }
    if (p.billingType === "non_billable") fail("Project is non-billable");
    if (op === "invoice" && p.billingType !== "hourly") fail("Full time invoice requires hourly billing; use progress invoicing");
    if ((v.milestoneIds && p.billingType !== "milestone") || (v.timeEntryIds && p.billingType !== "hourly") || (v.percentageToInvoice !== undefined && p.billingType !== "fixed") || (v.billableItemIds && !v.includeBillableExpenses)) fail("Billing selection does not match the project policy");
    await customer(tx, ctx, v.contactId ?? p.contactId);
    const issueDate = v.issueDate ?? new Date().toISOString().slice(0, 10);
    const due = new Date(`${issueDate}T00:00:00Z`); due.setUTCDate(due.getUTCDate() + 30);
    const dueDate = v.dueDate ?? due.toISOString().slice(0, 10);
    billingSchemas.progress.parse({ ...v, issueDate, dueDate });
    if (dueDate < issueDate) fail("Due date precedes issue date");
    await assertNotLocked(ctx.organizationId, issueDate, ctx, tx);
    const time = p.billingType === "hourly" && (op === "invoice" || v.timeEntryIds) ? selected(await entries(tx, ctx, p), v.timeEntryIds, "Time entry") : [];
    const ms = p.billingType === "milestone" && v.milestoneIds ? selected(await milestones(tx, p), v.milestoneIds, "Milestone") : [];
    const costs = v.includeBillableExpenses ? selected(await items(tx, ctx, p, true), v.billableItemIds, "Billable item") : [];
    for (const c of costs) {
      const s = await source(tx, ctx, p, c.sourceType, c.sourceLineId); await assertNotLocked(ctx.organizationId, s.date, ctx, tx);
    }
    const lines: { description: string; quantity: number; unitPrice: number; amount: number }[] = [];
    for (const t of time) {
      await assertNotLocked(ctx.organizationId, t.date, ctx, tx);
      const quantity = invoiceRound(integer(t.minutes) * 100n, 60n);
      if (quantity > 2147483647n) fail("Time quantity exceeds signed int32 hundredths");
      lines.push({ description: t.description || `Time entry: ${t.minutes} minutes`, quantity: Number(quantity), unitPrice: t.hourlyRate, amount: t.amount });
    }
    for (const m of ms) {
      if (m.remaining <= 0) fail("Milestone already fully invoiced", 409);
      lines.push({ description: `Milestone: ${m.title}`, quantity: 100, unitPrice: m.remaining, amount: m.remaining });
    }
    if (p.billingType === "fixed" && v.percentageToInvoice !== undefined) {
      const amount = billingPercent(p.fixedPrice, v.percentageToInvoice), used = await projectFixedInvoiced(tx, ctx, p);
      if (amount <= 0 || integer(used) + integer(amount) > integer(p.fixedPrice)) fail("Fixed-price allocation is zero or exceeds remaining price", 409);
      lines.push({ description: `${p.name} - ${v.percentageToInvoice}% of fixed price`, quantity: 100, unitPrice: amount, amount });
    }
    const billed = costs.map(c => {
      const amount = billingMarkup(c.costAmount, c.markupBasisPoints || v.defaultExpenseMarkupBasisPoints);
      lines.push({ description: c.description, quantity: 100, unitPrice: amount, amount }); return { id: c.id, amount };
    });
    if (!lines.length) fail("No unbilled items to invoice", 409);
    const subtotal = sum(lines.map(l => l.amount)), totalBilled = legacyMinor(integer(p.totalBilled) + integer(subtotal));
    const [inv] = await tx.insert(invoice).values({ organizationId: ctx.organizationId, contactId: v.contactId ?? p.contactId!, invoiceNumber: await nextNumber(tx, ctx.organizationId),
      issueDate, dueDate, notes: v.notes === undefined ? (op === "invoice" ? `Invoice for project: ${p.name}` : null) : v.notes,
      reference: `Project: ${p.name}`, currencyCode: p.currency, createdBy: ctx.userId, subtotal, taxTotal: 0, total: subtotal, amountPaid: 0, amountDue: subtotal }).returning();
    const savedLines = await tx.insert(invoiceLine).values(lines.map((l, i) => ({ ...l, invoiceId: inv.id, projectId: p.id, taxAmount: 0, sortOrder: i }))).returning();
    for (const l of savedLines) billingDto(l, ["unitPrice", "amount", "taxAmount"]);
    for (const t of time) {
      const [saved] = await tx.update(timeEntry).set({ invoiceId: inv.id }).where(eq(timeEntry.id, t.id)).returning(); projectRowDto("time", saved);
    }
    for (const m of ms) {
      const [saved] = await tx.update(projectMilestone).set({ invoicedAmountCents: m.amount }).where(eq(projectMilestone.id, m.id)).returning(); projectRowDto("milestone", saved);
    }
    for (const c of billed) {
      const [saved] = await tx.update(projectBillableItem).set({ billedInvoiceId: inv.id, billedAmount: c.amount, billedAt: new Date() }).where(eq(projectBillableItem.id, c.id)).returning();
      integer(saved.costAmount); integer(saved.billedAmount); billingMarkup(saved.costAmount, saved.markupBasisPoints);
    }
    const [updated] = await tx.update(project).set({ totalBilled, updatedAt: new Date() }).where(eq(project.id, p.id)).returning(); projectRowDto("project", updated);
    const result = { invoice: invoiceWriteDto(inv) };
    await auditTax(tx, ctx.organizationId, "project_invoice", inv.id, "generate_project_invoice", { projectId: p.id, requestKey: v.requestKey ?? null, fingerprint, invoice: result.invoice }, ctx, request);
    stringifyWire(result); return result;
  }, op === "list" ? { isolationLevel: "repeatable read", accessMode: "read only" } : undefined);
}

export async function projectProfitability(ctx: AuthContext, input: unknown) {
  const v = billingSchemas.profitability.parse(input), today = new Date().toISOString().slice(0, 10);
  const startDate = v.startDate ?? `${today.slice(0, 4)}-01-01`, endDate = v.endDate ?? today;
  if (startDate > endDate) fail("Start date exceeds end date");
  return db.transaction(async tx => {
    if (v.projectId) await getProject(tx, ctx, v.projectId);
    const projects = await tx.select().from(project).where(and(eq(project.organizationId, ctx.organizationId), isNull(project.deletedAt), v.projectId ? eq(project.id, v.projectId) : undefined, v.currency ? eq(project.currency, v.currency) : undefined));
    if (new Set(projects.map(p => p.currency)).size > 1) fail("Mixed-currency project totals require a currency filter");
    const rows = [];
    for (const p of projects) {
      projectRowDto("project", p);
      const revenueLines = await tx.select({ amount: invoiceLine.amount, currency: invoice.currencyCode }).from(invoiceLine).innerJoin(invoice, eq(invoiceLine.invoiceId, invoice.id))
        .where(and(eq(invoiceLine.projectId, p.id), eq(invoice.organizationId, ctx.organizationId), isNull(invoice.deletedAt), inArray(invoice.status, ["sent", "partial", "paid", "overdue"]), gte(invoice.issueDate, startDate), lte(invoice.issueDate, endDate)));
      const costLines = await tx.select({ amount: billLine.amount, currency: bill.currencyCode }).from(billLine).innerJoin(bill, eq(billLine.billId, bill.id))
        .where(and(eq(billLine.projectId, p.id), eq(bill.organizationId, ctx.organizationId), isNull(bill.deletedAt), inArray(bill.status, ["received", "partial", "paid", "overdue"]), gte(bill.issueDate, startDate), lte(bill.issueDate, endDate)));
      for (const r of [...revenueLines, ...costLines]) sameCurrency(r.currency, p.currency);
      const journalRows = await tx.select({ id: journalLine.id }).from(journalLine).innerJoin(journalEntry, eq(journalLine.journalEntryId, journalEntry.id))
        .innerJoin(chartAccount, eq(journalLine.accountId, chartAccount.id)).where(and(eq(journalLine.projectId, p.id), eq(journalEntry.organizationId, ctx.organizationId), isNull(journalEntry.deletedAt), eq(journalEntry.status, "posted"),
          eq(chartAccount.organizationId, ctx.organizationId), isNull(chartAccount.deletedAt), eq(chartAccount.type, "expense"), or(isNull(journalEntry.sourceType), notInArray(journalEntry.sourceType, ["bill"])), gte(journalEntry.date, startDate), lte(journalEntry.date, endDate)));
      let other = 0n;
      for (const r of journalRows) { // Signed net expense is meaningful in reports, including credit reversals.
        const [j] = await tx.select().from(journalLine).where(eq(journalLine.id, r.id));
        sameCurrency(j.currencyCode, p.currency);
        if (j.exchangeRate !== 1000000 || (j.rateExact !== null && !/^1(?:\.0+)?$/.test(j.rateExact))) throw new WireCompatibilityError("Project journal costing requires an identity rate");
        other += integer(j.debitAmount) - integer(j.creditAmount);
      }
      const time = await tx.select({ userId: timeEntry.userId, minutes: timeEntry.minutes, billable: timeEntry.isBillable }).from(timeEntry)
        .where(and(eq(timeEntry.projectId, p.id), gte(timeEntry.date, startDate), lte(timeEntry.date, endDate)));
      const groups = new Map<string, { minutes: bigint; billable: bigint }>();
      for (const t of time) { const g = groups.get(t.userId) ?? { minutes: 0n, billable: 0n }; g.minutes += integer(t.minutes); if (t.billable) g.billable += integer(t.minutes); groups.set(t.userId, g); }
      let labor = 0n, minutes = 0n, billable = 0n;
      for (const [uid, g] of groups) {
        const [m] = await tx.select({ id: member.id }).from(member).where(and(eq(member.userId, uid), eq(member.organizationId, ctx.organizationId)));
        if (!m) fail("Project labor user is not an organization member", 404);
        const [rate] = await tx.select({ costRate: projectMember.costRate }).from(projectMember).where(and(eq(projectMember.projectId, p.id), eq(projectMember.memberId, m.id)));
        labor += invoiceRound(g.minutes * integer(rate?.costRate ?? 0), 60n); minutes += g.minutes; billable += g.billable;
      }
      const revenue = integer(sum(revenueLines.map(r => r.amount)), false), material = integer(sum(costLines.map(r => r.amount)), false), cost = material + other + labor, profit = revenue - cost;
      rows.push({ projectId: p.id, projectName: p.name, currency: p.currency, status: p.status, billingType: p.billingType, estimatedHours: p.estimatedHours,
        ...billingDto({ budget: p.budget, fixedPrice: p.fixedPrice, hourlyRate: p.hourlyRate, revenue: legacyMinor(revenue), costs: legacyMinor(cost), cost: legacyMinor(cost),
          materialCost: legacyMinor(material), otherCost: legacyMinor(other), laborCost: legacyMinor(labor), profit: legacyMinor(profit), budgetVariance: legacyMinor(integer(p.budget) - cost) },
          ["budget", "fixedPrice", "hourlyRate", "revenue", "costs", "cost", "materialCost", "otherCost", "laborCost", "profit", "budgetVariance"]),
        margin: billingRatio(profit, revenue), marginPercent: billingRatio(profit, revenue), actualMinutes: legacyMinor(minutes), totalMinutes: legacyMinor(minutes), billableMinutes: legacyMinor(billable),
        budgetUsedPercent: billingRatio(cost, integer(p.budget)), hoursVariance: legacyMinor(integer(p.estimatedHours) - minutes), hoursUsedPercent: billingRatio(minutes, integer(p.estimatedHours)) });
    }
    rows.sort((a, b) => a.profit === b.profit ? a.projectId.localeCompare(b.projectId) : a.profit > b.profit ? -1 : 1);
    const totalRevenue = sum(rows.map(r => r.revenue)), totalCosts = sum(rows.map(r => r.costs)), totalProfit = legacyMinor(integer(totalRevenue, false) - integer(totalCosts, false));
    const result = { startDate, endDate, groupBy: "project", currency: v.currency ?? projects[0]?.currency ?? null, entries: rows, projects: rows,
      ...billingDto({ totalRevenue, totalCosts, totalCost: totalCosts, totalProfit }, ["totalRevenue", "totalCosts", "totalCost", "totalProfit"]), overallMargin: billingRatio(integer(totalProfit, false), integer(totalRevenue, false)) };
    stringifyWire(result); return result;
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
