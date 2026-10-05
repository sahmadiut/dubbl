import type { AuthContext } from "./auth-context";
import { AuthError } from "./auth-context";
import { payrollSum, payrollConvert } from "@/lib/payroll/exact";
import { WireCompatibilityError } from "@/lib/money/wire";
import { runItemDto } from "./payroll-run-wire";
import { assertNotLocked } from "./period-lock";
import { payrollItem } from "@/lib/db/schema";
import { db } from "@/lib/db";
import {
  payrollRun,
  organization, chartAccount,
  payrollItemDeduction,
  payrollItemTaxBreakdown,
  payrollItemEmployerTax,
  payrollSettings,
  deductionType,
  journalEntry,
  journalLine,
} from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import {
  getNextEntryNumber,
  findAccountByCode,
  ensureAccountByCode,
} from "@/lib/api/journal-automation";

/**
 * A transaction handle compatible with the one passed to db.transaction().
 * postPayrollRun does ALL its reads and writes through this so the journal
 * entry commits (or rolls back) together with the run-completion update.
 */
type Tx = Parameters<Parameters<(typeof db)["transaction"]>[0]>[0];

type PayrollPostingContext = AuthContext;

// ─── GL account codes for the payroll posting ───────────────────────
// NOTE: payrollSettings.taxPayableAccountCode defaults to 2200 (the OUTPUT VAT
// control account) in the schema column default — posting every withholding
// there is the books-corrupting bug this module fixes. We treat 2200 as
// "unset" and fall back to 2220 (Income Tax Payable) in code, never crediting
// payroll withholdings to the VAT liability.
const SALARY_EXPENSE_CODE = "5100"; // Wages & Salaries Expense (DR gross)
const EMPLOYER_TAX_EXPENSE_CODE = "5120"; // Employer Payroll Taxes Expense (DR)
const INCOME_TAX_PAYABLE_CODE = "2220"; // PAYE / income-tax withheld (CR)
const PAYROLL_TAXES_PAYABLE_CODE = "2235"; // FICA / SS / Medicare / NIC (CR)
const PENSION_BENEFITS_PAYABLE_CODE = "2245"; // pension & benefit withholdings (CR)
const OTHER_STATUTORY_PAYABLE_CODE = "2236"; // garnishments / other statutory (CR)
const WAGES_PAYABLE_CODE = "2310"; // net pay accrued-not-paid (CR)
const BANK_FALLBACK_CODE = "1100"; // default bank/cash for net pay (CR)

const ACCOUNT_DEFS = {
  [BANK_FALLBACK_CODE]: { name: "Bank", type: "asset" as const, subType: "current" },
  [SALARY_EXPENSE_CODE]: { name: "Wages & Salaries Expense", type: "expense" as const, subType: "operating" },
  [EMPLOYER_TAX_EXPENSE_CODE]: { name: "Employer Payroll Taxes", type: "expense" as const, subType: "operating" },
  [INCOME_TAX_PAYABLE_CODE]: { name: "Income Tax Payable", type: "liability" as const, subType: "current" },
  [PAYROLL_TAXES_PAYABLE_CODE]: { name: "Payroll Taxes Payable", type: "liability" as const, subType: "current" },
  [PENSION_BENEFITS_PAYABLE_CODE]: { name: "Pension & Benefits Payable", type: "liability" as const, subType: "current" },
  [OTHER_STATUTORY_PAYABLE_CODE]: { name: "Other Statutory Deductions Payable", type: "liability" as const, subType: "current" },
  [WAGES_PAYABLE_CODE]: { name: "Wages Payable", type: "liability" as const, subType: "current" },
} as const;

/**
 * Classify a withholding into the liability account it should be credited to.
 * Used for BOTH payrollItemTaxBreakdown.taxKind and (fallback) deduction-type
 * names so a FICA/Medicare line never lands in the income-tax bucket.
 */
function classifyTaxKind(taxKind: string): string {
  const k = taxKind.toLowerCase();
  if (
    k.includes("social_security") ||
    k.includes("social security") ||
    k.includes("medicare") ||
    k.includes("fica") ||
    k.includes("nic") ||
    k.includes("national insurance") ||
    k.includes("unemployment") ||
    k.includes("futa") ||
    k.includes("suta")
  ) {
    return PAYROLL_TAXES_PAYABLE_CODE;
  }
  // income tax / PAYE / FIT / state income / withholding tax
  return INCOME_TAX_PAYABLE_CODE;
}

/**
 * Classify a deduction type (by category + name) into a liability account.
 * pre_tax deductions are typically pension/benefit/HSA style → 2245;
 * post_tax statutory items (garnishments) → 2236; payroll-tax-shaped names → 2235.
 */
export function classifyPayrollDeduction(name: string | null, category: string): string {
  const n = (name ?? "").toLowerCase();
  if (
    n.includes("social security") ||
    n.includes("medicare") ||
    n.includes("fica") ||
    n.includes("nic") ||
    n.includes("national insurance") ||
    n.includes("payroll tax")
  ) {
    return PAYROLL_TAXES_PAYABLE_CODE;
  }
  if (
    n.includes("paye") ||
    n.includes("income tax") ||
    n.includes("withholding") ||
    n.includes("fit") ||
    n.includes("federal tax") ||
    n.includes("state tax")
  ) {
    return INCOME_TAX_PAYABLE_CODE;
  }
  if (
    n.includes("pension") ||
    n.includes("401") ||
    n.includes("retirement") ||
    n.includes("benefit") ||
    n.includes("health") ||
    n.includes("hsa") ||
    n.includes("medical") ||
    n.includes("insurance") ||
    n.includes("dental") ||
    n.includes("vision") ||
    category === "pre_tax"
  ) {
    return PENSION_BENEFITS_PAYABLE_CODE;
  }
  // garnishments, levies, union dues and other post-tax statutory deductions
  return OTHER_STATUTORY_PAYABLE_CODE;
}

/**
 * Resolve (find-or-create) a GL account by code within the transaction, using
 * the known def for the canonical payroll codes, or a sensible liability default
 * for any other code (e.g. an operator-configured taxPayableAccountCode).
 */
async function resolveAccount(
  organizationId: string,
  code: string,
  baseCurrency: string,
  tx: Tx,
  expectedType: "asset" | "expense" | "liability" = "liability"
) {
  const def = ACCOUNT_DEFS[code as keyof typeof ACCOUNT_DEFS];
  const account = (await findAccountByCode(organizationId, code, tx)) ?? await ensureAccountByCode(organizationId,
    def ? { code, name: def.name, type: def.type, subType: def.subType } : { code, name: `Account ${code}`, type: expectedType, subType: "current" }, baseCurrency, tx);
  if (!account) throw new AuthError("Could not resolve payroll account", 422);
  const [valid] = await tx.select().from(chartAccount).where(and(eq(chartAccount.id, account.id), eq(chartAccount.organizationId, organizationId), eq(chartAccount.isActive, true), isNull(chartAccount.deletedAt))).for("share");
  if (!valid || valid.type !== expectedType || valid.currencyCode !== baseCurrency) throw new AuthError("Payroll account must be active, owned, in base currency and of the correct type", 422);
  return valid;
}

/** The per-run figures the journal needs, all in the org BASE currency. */
interface RunBuckets {
  /** Gross wages, base cents (sum of each item's gross at rateExact). */
  grossWages: number;
  /** Employer-side payroll-tax expense, base cents (DR 5120). */
  employerTax: number;
  /** Credit per liability account code, base cents. */
  liabilityByCode: Map<string, number>;
}

/** Convert saved per-item withholding, deductions and employer taxes at rateExact.
 * Correction items already carry the parent's per-employee signed snapshots. */
async function accumulateBaseBuckets(tx: Tx, items: (typeof payrollItem.$inferSelect)[], organizationId: string): Promise<RunBuckets> {
  const liabilityByCode = new Map<string, number>();
  const add = (code: string, amount: number) => liabilityByCode.set(code, payrollSum([liabilityByCode.get(code) ?? 0, amount]));
  let grossWages = 0, employerTax = 0;
  for (const raw of items) {
    const item = runItemDto(raw), rate = item.rateExact;
    const convert = (amount: number) => payrollConvert(amount, rate);
    const taxRows = await tx.select().from(payrollItemTaxBreakdown).where(eq(payrollItemTaxBreakdown.payrollItemId, item.id));
    const employerRows = await tx.select().from(payrollItemEmployerTax).where(eq(payrollItemEmployerTax.payrollItemId, item.id));
    const deductionRows = await tx.select({ row: payrollItemDeduction, name: deductionType.name, organizationId: deductionType.organizationId })
      .from(payrollItemDeduction).innerJoin(deductionType, eq(payrollItemDeduction.deductionTypeId, deductionType.id))
      .where(eq(payrollItemDeduction.payrollItemId, item.id));
    const local = new Map<string, number>();
    const part = (code: string, amount: number) => local.set(code, payrollSum([local.get(code) ?? 0, amount]));
    if (taxRows.some(t => t.taxKind.toLowerCase().startsWith("employer"))) throw new WireCompatibilityError("Legacy employee/employer tax split is ambiguous");
    if (taxRows.length) {
      if (payrollSum(taxRows.map(t => t.amount)) !== item.taxAmount) throw new WireCompatibilityError("Payroll tax breakdown differs from item withholding");
      for (const line of taxRows) part(classifyTaxKind(line.taxKind), convert(line.amount));
    } else part(INCOME_TAX_PAYABLE_CODE, convert(item.taxAmount));
    const pre = payrollSum(deductionRows.filter(d => d.row.category === "pre_tax").map(d => d.row.amount));
    const post = payrollSum(deductionRows.filter(d => d.row.category === "post_tax").map(d => d.row.amount));
    if (pre !== (item.preTaxDeductions ?? 0) || post !== (item.postTaxDeductions ?? 0))
      throw new WireCompatibilityError("Payroll deduction breakdown is unavailable or inconsistent");
    if (payrollSum([item.taxAmount, pre, post]) !== item.deductions || payrollSum([item.grossAmount, -item.deductions]) !== item.netAmount)
      throw new WireCompatibilityError("Payroll item wages, deductions and net do not reconcile");
    for (const d of deductionRows) {
      if (d.organizationId !== organizationId) throw new AuthError("Deduction type belongs to another organization", 404);
      const code = d.row.liabilityAccountCode ?? classifyPayrollDeduction(d.name, d.row.category);
      if (code === "2200") throw new WireCompatibilityError("Payroll deductions cannot post to VAT control");
      part(code, convert(d.row.amount));
    }
    // Absorb per-component FX rounding into the largest employee liability bucket.
    const residual = payrollSum([convert(item.deductions), -payrollSum([...local.values()])]);
    if (residual) {
      const largest = [...local.entries()].sort((a, b) => Math.abs(a[1]) > Math.abs(b[1]) ? -1 : Math.abs(a[1]) < Math.abs(b[1]) ? 1 : a[0].localeCompare(b[0]))[0];
      if (!largest) throw new WireCompatibilityError("No payroll liability can absorb FX residual");
      part(largest[0], residual);
    }
    for (const [code, amount] of local) add(code, amount);
    for (const line of employerRows) { const amount = convert(line.amount); employerTax = payrollSum([employerTax, amount]); add(classifyTaxKind(line.taxKind), amount); }
    grossWages = payrollSum([grossWages, convert(item.grossAmount)]);
  }
  for (const [code, amount] of liabilityByCode) if (amount === 0) liabilityByCode.delete(code);
  return { grossWages, employerTax, liabilityByCode };
}

/**
 * Build and post ONE balanced journal entry for a completed payroll run and
 * stamp payrollRun.journalEntryId. Returns the posted journalEntry id, or null
 * when the run has no monetary effect (zero gross AND zero deductions).
 *
 * Posting (all amounts integer cents, double-entry MUST balance):
 *   DR Wages & Salaries Expense (5100) ............ gross wages
 *   DR Employer Payroll Taxes (5120) .............. employer-side taxes (if any)
 *   CR Income Tax Payable (2220) .................. PAYE / income-tax withheld
 *   CR Payroll Taxes Payable (2235) .............. FICA / SS / Medicare / NIC
 *   CR Pension & Benefits Payable (2245) ......... pension/benefit withholdings
 *   CR Other Statutory Payable (2236) ............ garnishments / other statutory
 *   CR Bank/Cash (settings bank, fallback 1100) .. net pay   [paid]
 *      — OR —
 *   CR Wages Payable (2310) ...................... net pay   [accrued-not-paid]
 *
 * Employee tax and deduction snapshots must reconcile before posting. Missing
 * legacy tax detail falls back only to the item's validated taxAmount; ambiguous
 * deductions fail. Employer tax snapshots add expense and matching liabilities.
 * Signed correction amounts reverse the appropriate individual accounts.
 *
 * Convert each employee-currency component once using its decimal rateExact.
 * Absorb component rounding residuals into the largest employee liability bucket.
 * Run net is converted gross less converted deductions. Journal legs use the
 * saved run base currency and exact 1:1 FX.
 *
 * Must be called inside a db.transaction; pass that tx so the journal and the
 * run update commit together.
 *
 * @param accrued when true, net pay is credited to Wages Payable (2310) instead
 *   of the bank account — i.e. the liability is recognized but not yet disbursed.
 */
export async function postPayrollRun(
  ctx: PayrollPostingContext,
  runId: string,
  tx: Tx,
  opts: { accrued?: boolean } = {}
): Promise<string | null> {
  const [run] = await tx.select().from(payrollRun).where(and(eq(payrollRun.id, runId), eq(payrollRun.organizationId, ctx.organizationId), isNull(payrollRun.deletedAt))).for("update");
  if (!run) throw new Error(`Payroll run ${runId} not found`);
  // Flat selects keep PostgreSQL numeric as decimal strings; relational JSON would coerce nested rates to Number.
  const items = await tx.select().from(payrollItem).where(eq(payrollItem.payrollRunId, runId)).orderBy(payrollItem.id);

  // Correction runs (parentRunId set) carry SIGNED delta amounts: a positive
  // gross adjustment pays more, a negative one claws back. We post those deltas
  // directly so the books move by exactly the correction — the reversing effect
  // for negative deltas is produced by pushLeg flipping a negative debit/credit
  // to the opposite column (so a clawback debits the bank, a reduced gross
  // credits the wage expense). No global negation: that would invert a genuine
  // additional-pay correction and corrupt the books.
  const isCorrection = run.runType === "correction" || run.parentRunId != null;

  // The org base currency every leg is posted in. All per-item local amounts are
  // converted into this currency by accumulateBaseBuckets, using each item's own
  // rateExact exactly once — there is no second conversion at insert time.
  const [org] = await tx.select({ currency: organization.defaultCurrency }).from(organization).where(and(eq(organization.id, ctx.organizationId), isNull(organization.deletedAt)));
  if (!org) throw new AuthError("Organization not found", 404);
  const base = run.baseCurrency ?? org.currency;
  if (base !== org.currency) throw new WireCompatibilityError("Payroll base currency differs from organization");
  await assertNotLocked(ctx.organizationId, run.payPeriodEnd, ctx);
  const own = await accumulateBaseBuckets(tx, items, ctx.organizationId);
  const grossWages = own.grossWages, employerTax = own.employerTax;
  const liabilityByCode = own.liabilityByCode;

  // Net pay must balance the entry against the actual debits/credits we post.
  // DR side total = gross + employerTax. CR side = withholdings + employerTax-liability
  // ... but employer-tax liability is already in liabilityByCode. So:
  //   debits  = grossWages (5100) + employerTax (5120)
  //   credits = sum(liabilityByCode) + netPay
  // → netPay = grossWages + employerTax − sum(liabilityByCode)
  // Everything here is already in base currency.
  const totalLiabilityCredits = payrollSum([...liabilityByCode.values()]);
  const netPay = payrollSum([grossWages, employerTax, -totalLiabilityCredits]);
  if (grossWages !== run.totalGross || netPay !== run.totalNet || payrollSum([totalLiabilityCredits, -employerTax]) !== run.totalDeductions)
    throw new WireCompatibilityError("Payroll journal does not reconcile to saved run totals");

  // Nothing to post.
  if (grossWages === 0 && totalLiabilityCredits === 0 && netPay === 0) {
    return null;
  }

  const settings = await tx.query.payrollSettings.findFirst({
    where: eq(payrollSettings.organizationId, ctx.organizationId),
  });

  const salaryCode = settings?.salaryExpenseAccountCode || SALARY_EXPENSE_CODE;
  // Treat the legacy 2200 (VAT) default as unset; never credit payroll there.
  const configuredTaxCode = settings?.taxPayableAccountCode;
  const incomeTaxCode =
    configuredTaxCode && configuredTaxCode !== "2200"
      ? configuredTaxCode
      : INCOME_TAX_PAYABLE_CODE;
  const bankCode = settings?.bankAccountCode || BANK_FALLBACK_CODE;

  // If the operator configured a non-default tax payable code, route the income
  // tax bucket there (keep FICA/pension/etc on their canonical accounts).
  if (incomeTaxCode !== INCOME_TAX_PAYABLE_CODE && liabilityByCode.has(INCOME_TAX_PAYABLE_CODE)) {
    const moved = liabilityByCode.get(INCOME_TAX_PAYABLE_CODE)!;
    liabilityByCode.delete(INCOME_TAX_PAYABLE_CODE);
    liabilityByCode.set(incomeTaxCode, payrollSum([liabilityByCode.get(incomeTaxCode) ?? 0, moved]));
  }

  const salaryAccount = await resolveAccount(ctx.organizationId, salaryCode, base, tx, "expense");
  const netPayCode = opts.accrued ? WAGES_PAYABLE_CODE : bankCode;
  const netPayAccount = await resolveAccount(ctx.organizationId, netPayCode, base, tx, opts.accrued ? "liability" : "asset");

  if (!salaryAccount || !netPayAccount) {
    throw new Error("Could not resolve payroll GL accounts");
  }

  // Pre-resolve every liability account.
  const liabilityAccounts = new Map<string, string>();
  for (const code of liabilityByCode.keys()) {
    const acct = await resolveAccount(ctx.organizationId, code, base, tx);
    if (!acct) throw new Error(`Could not resolve payroll liability account ${code}`);
    liabilityAccounts.set(code, acct.id);
  }

  let employerTaxAccountId: string | null = null;
  if (employerTax !== 0) {
    const acct = await resolveAccount(ctx.organizationId, EMPLOYER_TAX_EXPENSE_CODE, base, tx, "expense");
    if (!acct) throw new Error("Could not resolve employer payroll tax account");
    employerTaxAccountId = acct.id;
  }

  // ── Build the entry header ────────────────────────────────────────
  // Pass tx: postPayrollRun runs inside a db.transaction and several runs may be
  // posted in one tx, so the number must be read from the uncommitted tx state.
  const entryNumber = await getNextEntryNumber(ctx.organizationId, tx);
  const descBase = isCorrection
    ? `Payroll correction ${run.payPeriodStart} to ${run.payPeriodEnd}`
    : `Payroll ${run.payPeriodStart} to ${run.payPeriodEnd}`;

  const [entry] = await tx
    .insert(journalEntry)
    .values({
      organizationId: ctx.organizationId,
      entryNumber,
      date: run.payPeriodEnd,
      description: descBase,
      reference: `PR-${run.id.slice(0, 8)}`,
      status: "posted",
      sourceType: "payroll",
      sourceId: run.id,
      postedAt: new Date(),
      createdBy: ctx.userId,
    })
    .returning();

  // ── Build balanced lines ──────────────────────────────────────────
  // A negative posting amount (correction clawback / reduced gross) can't be a
  // negative debit or credit, so pushLeg flips it to the opposite column. This
  // makes a correction self-reversing: e.g. a negative net pay debits the bank
  // (cash recovered) and a negative gross credits the wage expense.
  const lines: (typeof journalLine.$inferInsert)[] = [];
  const pushLeg = (
    accountId: string,
    description: string,
    debit: number,
    credit: number
  ) => {
    let d = debit;
    let c = credit;
    if (d < 0) {
      c = payrollSum([c, -d]);
      d = 0;
    }
    if (c < 0) {
      d = payrollSum([d, -c]);
      c = 0;
    }
    if (d === 0 && c === 0) return;
    // Every amount is already in base currency, so each line is posted 1:1 in
    // base — no second conversion pass (the bug that double-converted gross/net).
    lines.push({
      journalEntryId: entry.id,
      accountId,
      description,
      debitAmount: d,
      creditAmount: c,
      currencyCode: base,
      exchangeRate: 1000000, rateExact: "1", rateDirection: "quote_per_base", rateFormatVersion: 1, rateMigrationStatus: "exact", rateProvenance: "payroll_base_snapshot",
    });
  };

  // DR gross wages
  pushLeg(salaryAccount.id, "Payroll - Gross wages", grossWages, 0);

  // DR employer payroll taxes
  if (employerTax !== 0 && employerTaxAccountId) {
    pushLeg(employerTaxAccountId, "Payroll - Employer taxes", employerTax, 0);
  }

  // CR each withholding liability
  for (const [code, amount] of liabilityByCode.entries()) {
    const acctId = liabilityAccounts.get(code)!;
    pushLeg(acctId, "Payroll - Withholding", 0, amount);
  }

  // CR net pay (bank or wages payable)
  pushLeg(
    netPayAccount.id,
    opts.accrued ? "Payroll - Net wages accrued" : "Payroll - Net wages paid",
    0,
    netPay
  );

  if (lines.length > 0) {
    if (payrollSum(lines.map(l => l.debitAmount ?? 0)) !== payrollSum(lines.map(l => l.creditAmount ?? 0))) throw new WireCompatibilityError("Payroll journal is unbalanced");
    // All lines are exact base-currency snapshots.
    await tx.insert(journalLine).values(lines);
  }

  await tx
    .update(payrollRun)
    .set({ journalEntryId: entry.id })
    .where(eq(payrollRun.id, run.id));

  return entry.id;
}
