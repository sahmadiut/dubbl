import { and, desc, eq, gte, isNull, lt, lte, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { organization, member, payrollEmployee, payrollRun, payrollItem, payslip, taxForm, taxFormGeneration,
  contractor, contractorPayment, payrollSettings, deductionType } from "@/lib/db/schema";
import { payrollInteger, payrollNumber, payrollRatio, payrollSum } from "@/lib/payroll/exact";
import { stringifyWire, WireCompatibilityError } from "@/lib/money/wire";
import { payrollMasterDto } from "./payroll-master-wire";
import { runMoneyDto } from "./payroll-run-wire";
import { headerDto, readItems } from "./payroll-runs";
import { auditTax, lockTaxOrganization, type TaxTx } from "./tax-config-transaction";
import { AuthError, type AuthContext } from "./auth-context";
import { requireRole } from "./require-role";
import { paginatedResponse } from "./pagination";
import { reportInput, taxGenerateSchema, taxListSchema, selfProfileSchema, outputId, outputCurrency,
  payslipMoneyFields, deductionPayload, taxDataDto, payrollCentsText, payrollCsvCell } from "./payroll-output-wire";

type Run = typeof payrollRun.$inferSelect;
type Slip = typeof payslip.$inferSelect;
async function read<T>(fn: (tx: TaxTx) => Promise<T>) {
  return db.transaction(fn, { isolationLevel: "repeatable read", accessMode: "read only" });
}
async function mutate<T>(ctx: AuthContext, fn: (tx: TaxTx) => Promise<T>) {
  return db.transaction(async tx => { await lockTaxOrganization(tx, ctx.organizationId); return fn(tx); });
}
async function baseCurrency(tx: TaxTx, ctx: AuthContext) {
  const [org] = await tx.select().from(organization).where(and(eq(organization.id, ctx.organizationId), isNull(organization.deletedAt)));
  if (!org) throw new AuthError("Organization not found", 404);
  return outputCurrency(org.defaultCurrency);
}
async function runCurrency(tx: TaxTx, ctx: AuthContext, row: Run) {
  return outputCurrency(row.baseCurrency ?? await baseCurrency(tx, ctx));
}
function oneCurrency(currencies: string[], fallback: string) {
  const unique = [...new Set(currencies)];
  if (unique.length > 1) throw new WireCompatibilityError("Payroll output cannot aggregate different currencies");
  return unique[0] ?? fallback;
}
async function ownedRun(tx: TaxTx, ctx: AuthContext, id: string) {
  outputId.parse(id);
  const [row] = await tx.select().from(payrollRun).where(and(eq(payrollRun.id, id), eq(payrollRun.organizationId, ctx.organizationId), isNull(payrollRun.deletedAt)));
  if (!row) throw new AuthError("Payroll run not found", 404);
  headerDto(row); return row;
}
async function employee(tx: TaxTx, ctx: AuthContext, id: string, live = false) {
  outputId.parse(id);
  const [row] = await tx.select().from(payrollEmployee).where(and(eq(payrollEmployee.id, id), eq(payrollEmployee.organizationId, ctx.organizationId), live ? isNull(payrollEmployee.deletedAt) : undefined));
  if (!row) throw new AuthError("Employee not found", 404);
  if (row.memberId) {
    const [mem] = await tx.select().from(member).where(and(eq(member.id, row.memberId), eq(member.organizationId, ctx.organizationId)));
    if (!mem) throw new WireCompatibilityError("Unsupported saved employee member reference");
  }
  payrollMasterDto(row); return row;
}
async function selfEmployee(tx: TaxTx, ctx: AuthContext) {
  const [mem] = await tx.select().from(member).where(and(eq(member.organizationId, ctx.organizationId), eq(member.userId, ctx.userId)));
  if (!mem) throw new AuthError("Member not found", 404);
  const rows = await tx.select().from(payrollEmployee).where(and(eq(payrollEmployee.organizationId, ctx.organizationId), eq(payrollEmployee.memberId, mem.id), isNull(payrollEmployee.deletedAt)));
  if (rows.length === 0) throw new AuthError("Employee profile not found", 404);
  if (rows.length !== 1) throw new WireCompatibilityError("Ambiguous employee profile for this member");
  return employee(tx, ctx, rows[0].id, true);
}
async function completedRuns(tx: TaxTx, ctx: AuthContext, input: unknown) {
  const p = reportInput(input);
  const rows = await tx.select().from(payrollRun).where(and(eq(payrollRun.organizationId, ctx.organizationId), eq(payrollRun.status, "completed"), isNull(payrollRun.deletedAt),
    p.startDate ? gte(payrollRun.payPeriodStart, p.startDate) : undefined, p.endDate ? lte(payrollRun.payPeriodEnd, p.endDate) : undefined)).orderBy(payrollRun.payPeriodEnd, payrollRun.id);
  for (const row of rows) headerDto(row);
  return rows;
}
export async function payrollSummary(ctx: AuthContext, input: unknown) {
  requireRole(ctx, "view:payroll-reports"); reportInput(input);
  return read(async tx => {
    const runs = await completedRuns(tx, ctx, input), currencies = [];
    for (const run of runs) currencies.push(await runCurrency(tx, ctx, run));
    const currency = oneCurrency(currencies, await baseCurrency(tx, ctx));
    const totalGross = payrollSum(runs.map(r => r.totalGross));
    const employees = await tx.select({ id: payrollEmployee.id }).from(payrollEmployee).where(and(eq(payrollEmployee.organizationId, ctx.organizationId), eq(payrollEmployee.isActive, true), isNull(payrollEmployee.deletedAt)));
    return { summary: runMoneyDto({ totalRuns: runs.length, totalGross, totalDeductions: payrollSum(runs.map(r => r.totalDeductions)),
      totalNet: payrollSum(runs.map(r => r.totalNet)), activeEmployees: employees.length,
      avgCostPerRun: runs.length ? payrollRatio(totalGross, 1n, BigInt(runs.length)) : 0, currency }, ["totalGross", "totalDeductions", "totalNet", "avgCostPerRun"]) };
  });
}
export async function payrollLaborCost(ctx: AuthContext, input: unknown) {
  requireRole(ctx, "view:payroll-reports"); reportInput(input);
  return read(async tx => {
    const groups = new Map<string, { department: string; currency: string; gross: number[]; net: number[]; employees: Set<string> }>();
    for (const run of await completedRuns(tx, ctx, input)) for (const item of await readItems(tx, ctx, run.id)) {
      const department = item.employee.department ?? "Unassigned", currency = outputCurrency(item.currency), key = JSON.stringify([department, currency]);
      const group = groups.get(key) ?? { department, currency, gross: [], net: [], employees: new Set<string>() };
      group.gross.push(item.grossAmount); group.net.push(item.netAmount); group.employees.add(item.employeeId); groups.set(key, group);
    }
    return { data: [...groups.values()].map(g => runMoneyDto({ department: g.department, currency: g.currency,
      totalGross: payrollSum(g.gross), totalNet: payrollSum(g.net), employeeCount: g.employees.size }, ["totalGross", "totalNet"])) };
  });
}
export async function payrollTaxLiability(ctx: AuthContext, input: unknown) {
  requireRole(ctx, "view:payroll-reports"); reportInput(input);
  return read(async tx => {
    const groups = new Map<string, { employeeId: string; employeeName: string; currency: string; gross: number[]; tax: number[] }>();
    for (const run of await completedRuns(tx, ctx, input)) for (const item of await readItems(tx, ctx, run.id)) {
      const currency = outputCurrency(item.currency), key = JSON.stringify([item.employeeId, currency]);
      const group = groups.get(key) ?? { employeeId: item.employeeId, employeeName: item.employee.name, currency, gross: [], tax: [] };
      group.gross.push(item.grossAmount); group.tax.push(item.taxAmount); groups.set(key, group);
    }
    const currency = oneCurrency([...groups.values()].map(g => g.currency), await baseCurrency(tx, ctx));
    const data = [...groups.values()].map(g => runMoneyDto({ employeeId: g.employeeId, employeeName: g.employeeName, currency: g.currency,
      totalGross: payrollSum(g.gross), totalTax: payrollSum(g.tax) }, ["totalGross", "totalTax"]));
    return { ...runMoneyDto({ totalTax: payrollSum(data.map(d => d.totalTax)), currency }, ["totalTax"]), data };
  });
}
export async function payrollYoy(ctx: AuthContext) {
  requireRole(ctx, "view:payroll-reports"); return read(async tx => {
    const runs = await completedRuns(tx, ctx, {}), currencies = [];
    for (const run of runs) currencies.push(await runCurrency(tx, ctx, run));
    const currency = oneCurrency(currencies, await baseCurrency(tx, ctx)), groups = new Map<string, Run[]>();
    for (const run of runs) { const month = run.payPeriodEnd.slice(0, 7), group = groups.get(month) ?? []; group.push(run); groups.set(month, group); }
    return { data: [...groups.entries()].map(([month, rows]) => runMoneyDto({ month, currency, totalGross: payrollSum(rows.map(r => r.totalGross)),
      totalNet: payrollSum(rows.map(r => r.totalNet)), runCount: rows.length }, ["totalGross", "totalNet"])) };
  });
}
export async function exportPayroll(ctx: AuthContext, input: unknown) {
  requireRole(ctx, "view:payroll-reports"); reportInput(input);
  return read(async tx => {
    const rows = ["Employee,Employee #,Period Start,Period End,Gross,Tax,Deductions,Net,Currency"];
    for (const run of await completedRuns(tx, ctx, input)) for (const item of await readItems(tx, ctx, run.id)) {
      rows.push([payrollCsvCell(item.employee.name), payrollCsvCell(item.employee.employeeNumber), run.payPeriodStart, run.payPeriodEnd,
        ...[item.grossAmount, item.taxAmount, item.deductions, item.netAmount].map(payrollCentsText), outputCurrency(item.currency)].join(","));
    }
    return { csv: rows.join("\n"), filename: "payroll-export.csv", contentType: "text/csv" };
  });
}
async function slipDto(tx: TaxTx, ctx: AuthContext, row: Slip, detail = false) {
  const run = await ownedRun(tx, ctx, row.payrollRunId), emp = await employee(tx, ctx, row.employeeId);
  const [item] = await tx.select().from(payrollItem).where(and(eq(payrollItem.id, row.payrollItemId), eq(payrollItem.payrollRunId, run.id), eq(payrollItem.employeeId, emp.id)));
  if (!item) throw new WireCompatibilityError("Unsupported payslip item/run/employee references");
  if (run.status !== "completed") throw new WireCompatibilityError("Payslip requires a completed payroll run");
  const items = await readItems(tx, ctx, run.id), qualifiedItem = items.find(i => i.id === item.id)!;
  if (["grossAmount", "netAmount", "taxAmount"].some(f => (row as unknown as Record<string, unknown>)[f] !== (item as unknown as Record<string, unknown>)[f]))
    throw new WireCompatibilityError("Payslip snapshot disagrees with saved payroll item");
  const result = { ...runMoneyDto(row, payslipMoneyFields), currency: outputCurrency(item.currency), deductionsBreakdown: deductionPayload(row.deductionsBreakdown),
    payrollRun: { ...headerDto(run), baseCurrency: await runCurrency(tx, ctx, run) },
    ...(detail ? { employee: payrollMasterDto(emp), payrollItem: qualifiedItem } : {}) };
  stringifyWire(result); return result;
}
async function employeeSlips(tx: TaxTx, ctx: AuthContext, id: string) {
  await employee(tx, ctx, id);
  // Scope both sides of the history link; malformed foreign run links fail closed.
  const rows = await tx.select().from(payslip).where(eq(payslip.employeeId, id)).orderBy(desc(payslip.generatedAt), payslip.id);
  const result = [];
  for (const row of rows) result.push(await slipDto(tx, ctx, row));
  return result;
}
export async function listEmployeePayslips(ctx: AuthContext, id: string) {
  requireRole(ctx, "view:payslips"); outputId.parse(id); return read(tx => employeeSlips(tx, ctx, id));
}
export async function listRunPayslips(ctx: AuthContext, id: string) {
  requireRole(ctx, "manage:payroll"); outputId.parse(id); return read(async tx => {
    await ownedRun(tx, ctx, id);
    const rows = await tx.select().from(payslip).where(eq(payslip.payrollRunId, id)).orderBy(payslip.id), result = [];
    for (const row of rows) {
      const dto = await slipDto(tx, ctx, row, true);
      result.push({ ...dto, employeeName: dto.employee!.name });
    }
    return result;
  });
}
export async function getPayslip(ctx: AuthContext, id: string, request?: Request) {
  requireRole(ctx, "view:payslips"); outputId.parse(id);
  return mutate(ctx, async tx => {
    // Ownership is checked in SQL before loading or mutating a payslip.
    const [owned] = await tx.select({ slip: payslip }).from(payslip).innerJoin(payrollRun, eq(payslip.payrollRunId, payrollRun.id))
      .where(and(eq(payslip.id, id), eq(payrollRun.organizationId, ctx.organizationId), isNull(payrollRun.deletedAt)));
    if (!owned) throw new AuthError("Payslip not found", 404);
    const dto = await slipDto(tx, ctx, owned.slip, true);
    if (owned.slip.status !== "viewed") {
      const viewedAt = new Date();
      await tx.update(payslip).set({ status: "viewed", viewedAt }).where(eq(payslip.id, id));
      await auditTax(tx, ctx.organizationId, "payslip", id, "view", { status: "viewed" }, ctx, request);
      return { ...dto, status: "viewed", viewedAt };
    }
    return dto;
  });
}
export async function generatePayslips(ctx: AuthContext, id: string, request?: Request) {
  requireRole(ctx, "manage:payroll"); outputId.parse(id);
  return mutate(ctx, async tx => {
    const run = await ownedRun(tx, ctx, id);
    if (run.status !== "completed") throw new AuthError("Can only generate payslips for completed runs", 422);
    const items = await readItems(tx, ctx, id), existing = await tx.select().from(payslip).where(eq(payslip.payrollRunId, id));
    for (const row of existing) await slipDto(tx, ctx, row);
    if (new Set(existing.map(r => r.payrollItemId)).size !== existing.length) throw new WireCompatibilityError("Duplicate historical payslip snapshots require remediation");
    const year = run.payPeriodEnd.slice(0, 4), yearRuns = await completedRuns(tx, ctx, { startDate: year + "-01-01", endDate: run.payPeriodEnd });
    const history = [];
    for (const r of yearRuns) history.push(...await readItems(tx, ctx, r.id));
    const pending = [];
    for (const item of items) {
      if (existing.some(p => p.payrollItemId === item.id)) continue;
      await employee(tx, ctx, item.employeeId);
      const ytd = history.filter(i => i.employeeId === item.employeeId);
      oneCurrency(ytd.map(i => outputCurrency(i.currency)), outputCurrency(item.currency));
      const deductions = [];
      for (const d of item.deductionBreakdowns) {
        const [type] = await tx.select().from(deductionType).where(and(eq(deductionType.id, d.deductionTypeId), eq(deductionType.organizationId, ctx.organizationId)));
        if (!type) throw new WireCompatibilityError("Unsupported payslip deduction reference");
        deductions.push({ name: type.name, amount: d.amount, category: d.category });
      }
      const values = { payrollRunId: id, payrollItemId: item.id, employeeId: item.employeeId,
        grossAmount: item.grossAmount, netAmount: item.netAmount, taxAmount: item.taxAmount, deductionsBreakdown: deductions,
        ytdGross: payrollSum(ytd.map(i => i.grossAmount)), ytdNet: payrollSum(ytd.map(i => i.netAmount)), ytdTax: payrollSum(ytd.map(i => i.taxAmount)) };
      runMoneyDto(values, payslipMoneyFields); deductionPayload(deductions); pending.push(values);
    }
    // All amounts and history are preflighted before inserting any snapshot.
    if (pending.length) {
      await tx.insert(payslip).values(pending);
      await auditTax(tx, ctx.organizationId, "payrollRun", id, "generate_payslips", { count: pending.length }, ctx, request);
    }
    return { count: pending.length };
  });
}
export async function getSelfProfile(ctx: AuthContext) {
  requireRole(ctx, "self-service:payroll"); return read(async tx => payrollMasterDto(await selfEmployee(tx, ctx)));
}
export async function updateSelfProfile(ctx: AuthContext, input: unknown, request?: Request) {
  requireRole(ctx, "self-service:payroll"); const p = selfProfileSchema.parse(input);
  return mutate(ctx, async tx => {
    const emp = await selfEmployee(tx, ctx);
    if (!Object.keys(p).length) return payrollMasterDto(emp);
    const [row] = await tx.update(payrollEmployee).set({ ...p, updatedAt: new Date() }).where(and(eq(payrollEmployee.id, emp.id), eq(payrollEmployee.organizationId, ctx.organizationId))).returning();
    const result = payrollMasterDto(row);
    // Do not copy bank account numbers into the audit trail.
    await auditTax(tx, ctx.organizationId, "payrollEmployee", emp.id, "self_update", { fields: Object.keys(p) }, ctx, request); return result;
  });
}
export async function listSelfPayslips(ctx: AuthContext) {
  requireRole(ctx, "self-service:payroll"); return read(async tx => employeeSlips(tx, ctx, (await selfEmployee(tx, ctx)).id));
}

async function formDto(tx: TaxTx, ctx: AuthContext, form: typeof taxForm.$inferSelect, generation: typeof taxFormGeneration.$inferSelect) {
  if (form.generationId !== generation.id || generation.organizationId !== ctx.organizationId || generation.deletedAt) throw new AuthError("Tax form not found", 404);
  if (generation.taxYear !== form.taxYear || generation.formType !== form.formType) throw new WireCompatibilityError("Unsupported saved tax form generation reference");
  if (form.recipientType === "employee" && form.formType === "w2") await employee(tx, ctx, form.recipientId);
  else if (form.recipientType === "contractor" && form.formType === "1099_nec") {
    const [c] = await tx.select().from(contractor).where(and(eq(contractor.id, form.recipientId), eq(contractor.organizationId, ctx.organizationId)));
    if (!c) throw new WireCompatibilityError("Unsupported tax form contractor reference");
  } else throw new WireCompatibilityError("Unsupported saved tax form recipient/type");
  const result = { ...form, currency: "USD", formData: taxDataDto(form.formData, form.formType) }; stringifyWire(result); return result;
}
async function generationDto(tx: TaxTx, ctx: AuthContext, row: typeof taxFormGeneration.$inferSelect) {
  if (row.createdBy) {
    const [mem] = await tx.select().from(member).where(and(eq(member.id, row.createdBy), eq(member.organizationId, ctx.organizationId)));
    if (!mem) throw new WireCompatibilityError("Unsupported tax generation member reference");
  }
  const forms = [];
  for (const form of await tx.select().from(taxForm).where(eq(taxForm.generationId, row.id)).orderBy(taxForm.id)) forms.push(await formDto(tx, ctx, form, row));
  return { ...row, forms };
}
export async function listTaxForms(ctx: AuthContext, input: unknown) {
  requireRole(ctx, "manage:payroll"); const p = taxListSchema.parse(input);
  return read(async tx => {
    const rows = await tx.select().from(taxFormGeneration).where(and(eq(taxFormGeneration.organizationId, ctx.organizationId), isNull(taxFormGeneration.deletedAt),
      p.taxYear ? eq(taxFormGeneration.taxYear, p.taxYear) : undefined, p.formType ? eq(taxFormGeneration.formType, p.formType) : undefined)).orderBy(desc(taxFormGeneration.createdAt), taxFormGeneration.id);
    const data = [];
    for (const row of rows.slice((p.page - 1) * p.limit, p.page * p.limit)) data.push(await generationDto(tx, ctx, row));
    return paginatedResponse(data, rows.length, p.page, p.limit);
  });
}
export async function getTaxForm(ctx: AuthContext, id: string) {
  requireRole(ctx, "manage:payroll"); outputId.parse(id);
  return read(async tx => {
    const [row] = await tx.select({ form: taxForm, generation: taxFormGeneration }).from(taxForm).innerJoin(taxFormGeneration, eq(taxForm.generationId, taxFormGeneration.id))
      .where(and(eq(taxForm.id, id), eq(taxFormGeneration.organizationId, ctx.organizationId), isNull(taxFormGeneration.deletedAt)));
    if (!row) throw new AuthError("Tax form not found", 404);
    const generation = await generationDto(tx, ctx, row.generation);
    return { ...await formDto(tx, ctx, row.form, row.generation), generation: { ...generation, forms: undefined } };
  });
}
export async function taxFormPdfData(ctx: AuthContext, id: string) {
  const form = await getTaxForm(ctx, id);
  return { formType: form.formType, taxYear: form.taxYear, recipientName: form.recipientName, recipientTaxId: form.recipientTaxId,
    formData: form.formData, currency: form.currency, note: "PDF generation requires pdf-lib package. Form data returned as JSON." };
}
function taxBucket(kind: string, level: string) {
  const k = kind.toLowerCase();
  if (k.includes("social_security")) return "box4_ss_tax";
  if (k.includes("medicare")) return "box6_medicare_tax";
  if (k.includes("income_tax") || k.includes("withholding")) return level === "state" ? "box17_state_income_tax" : level === "local" ? "box19_local_income_tax" : "box2_federal_tax";
  return "box14_other";
}
export async function generateTaxForms(ctx: AuthContext, input: unknown, request?: Request) {
  requireRole(ctx, "manage:payroll"); const p = taxGenerateSchema.parse(input);
  if (p.formType === "1099_misc") throw new AuthError("1099-MISC generation is unsupported", 422);
  return mutate(ctx, async tx => {
    const forms: Omit<typeof taxForm.$inferInsert, "generationId">[] = [];
    const start = `${p.taxYear}-01-01`, end = `${p.taxYear}-12-31`;
    if (p.formType === "w2") {
      const [settings] = await tx.select().from(payrollSettings).where(eq(payrollSettings.organizationId, ctx.organizationId));
      const cap = payrollInteger(settings?.ssWageBaseCents ?? 16810000);
      if (cap < 0n) throw new WireCompatibilityError("Unsupported SS wage cap");
      const groups = new Map<string, Awaited<ReturnType<typeof readItems>>>();
      for (const run of await completedRuns(tx, ctx, { startDate: start, endDate: end })) for (const item of await readItems(tx, ctx, run.id)) {
        if (item.currency !== "USD") throw new WireCompatibilityError("W-2 generation supports USD payroll only");
        if (!item.taxBreakdowns.length && item.taxAmount !== 0) throw new WireCompatibilityError("W-2 requires saved tax breakdowns; legacy withholding must be remediated");
        const group = groups.get(item.employeeId) ?? []; group.push(item); groups.set(item.employeeId, group);
      }
      for (const [employeeId, items] of groups) {
        if (items.some(i => i.preTaxDeductions === null || i.postTaxDeductions === null)) throw new WireCompatibilityError("W-2 requires saved pre/post-tax deduction totals");
        const emp = await employee(tx, ctx, employeeId), gross = items.reduce((s, i) => s + payrollInteger(i.grossAmount), 0n), pre = items.reduce((s, i) => s + payrollInteger(i.preTaxDeductions!), 0n);
        const boxes: Record<string, bigint> = { box1_wages: gross - pre, box3_ss_wages: gross < cap ? gross : cap, box5_medicare_wages: gross,
          box2_federal_tax: 0n, box4_ss_tax: 0n, box6_medicare_tax: 0n, box12_retirement_deferrals: 0n, box14_other: 0n, box17_state_income_tax: 0n, box19_local_income_tax: 0n };
        for (const item of items) {
          if (payrollInteger(item.taxAmount) + payrollInteger(item.preTaxDeductions!) + payrollInteger(item.postTaxDeductions!) !== payrollInteger(item.deductions))
            throw new WireCompatibilityError("W-2 saved withholding/deductions do not reconcile");
          for (const tax of item.taxBreakdowns) boxes[taxBucket(tax.taxKind, tax.jurisdictionLevel)] += payrollInteger(tax.amount);
          const preDetails = item.deductionBreakdowns.filter(d => d.category === "pre_tax"), postDetails = item.deductionBreakdowns.filter(d => d.category === "post_tax");
          if (payrollSum(preDetails.map(d => d.amount)) !== item.preTaxDeductions || payrollSum(postDetails.map(d => d.amount)) !== item.postTaxDeductions)
            throw new WireCompatibilityError("W-2 requires complete saved deduction breakdowns");
          boxes.box12_retirement_deferrals += payrollInteger(item.preTaxDeductions!);
          boxes.box14_other += payrollInteger(item.postTaxDeductions!);
        }
        if (Object.values(boxes).some(v => v < 0n)) throw new WireCompatibilityError("Unsupported negative annual tax form totals");
        const data = taxDataDto({ ...Object.fromEntries(Object.entries(boxes).map(([k, v]) => [k, payrollNumber(v)])), currency: "USD",
          box13_retirement_plan: boxes.box12_retirement_deferrals > 0n, employee_email: emp.email, employee_number: emp.employeeNumber }, "w2");
        forms.push({ recipientType: "employee", recipientId: emp.id, recipientName: emp.name, recipientTaxId: null, formType: "w2", taxYear: p.taxYear, formData: data, status: "generated" });
      }
    } else {
      const payments = await tx.select({ payment: contractorPayment, contractor: contractor }).from(contractorPayment).innerJoin(contractor, eq(contractorPayment.contractorId, contractor.id))
        .where(and(eq(contractor.organizationId, ctx.organizationId), eq(contractorPayment.status, "paid"),
          or(and(gte(contractorPayment.paymentDate, start), lte(contractorPayment.paymentDate, end)),
            and(isNull(contractorPayment.paymentDate), gte(contractorPayment.paidAt, new Date(start + "T00:00:00Z")),
              lt(contractorPayment.paidAt, new Date(`${p.taxYear + 1}-01-01T00:00:00Z`))))));
      const totals = new Map<string, { contractor: typeof contractor.$inferSelect; amount: bigint }>();
      for (const row of payments) {
        if (outputCurrency(row.payment.currency) !== "USD") throw new WireCompatibilityError("1099-NEC generation supports saved USD payments only");
        const amount = payrollInteger(row.payment.amount);
        if (amount <= 0n) throw new WireCompatibilityError("Unsupported paid contractor amount");
        const group = totals.get(row.contractor.id) ?? { contractor: row.contractor, amount: 0n }; group.amount += amount; totals.set(row.contractor.id, group);
      }
      for (const { contractor: c, amount } of totals.values()) {
        const total = payrollNumber(amount); if (amount < 60000n) continue;
        forms.push({ recipientType: "contractor", recipientId: c.id, recipientName: c.name, recipientTaxId: c.taxId, formType: "1099_nec", taxYear: p.taxYear,
          formData: taxDataDto({ box1_nonemployee_compensation: total, recipient_company: c.company, recipient_email: c.email, currency: "USD" }, "1099_nec"), status: "generated" });
      }
    }
    const [mem] = await tx.select().from(member).where(and(eq(member.organizationId, ctx.organizationId), eq(member.userId, ctx.userId)));
    const [generation] = await tx.insert(taxFormGeneration).values({ organizationId: ctx.organizationId, taxYear: p.taxYear, formType: p.formType,
      status: "generated", generatedAt: new Date(), createdBy: mem?.id ?? null }).returning();
    if (forms.length) await tx.insert(taxForm).values(forms.map(f => ({ ...f, generationId: generation.id })));
    const result = { generation, formsGenerated: forms.length }; stringifyWire(result);
    await auditTax(tx, ctx.organizationId, "taxFormGeneration", generation.id, "generate", { formType: p.formType, taxYear: p.taxYear, count: forms.length }, ctx, request);
    return result;
  });
}
