import { db } from "@/lib/db";
import { organization, invoice, invoiceLine, bill, billLine, taxRate, journalEntry, journalLine, chartAccount, taxPeriod, contact, payment } from "@/lib/db/schema";
import { eq, and, gte, lte, sql, isNull, notInArray, ne } from "drizzle-orm";
import { AuthError, type AuthContext } from "@/lib/api/auth-context";
import { requireRole } from "@/lib/api/require-role";
import { currencyMetadata } from "@/lib/money/exact";
import { WireCompatibilityError } from "@/lib/money/wire";
import { getOrgTaxConfig, resolveBasis, controlAccountMovement, computeEcSales, getControlAccountId, boxTransactions, type TaxBasis, type OrgTaxConfig } from "./tax-return";
import { z } from "zod";
import { taxReportSchemas, taxReportPeriodSchema, report1099Schema, vatReportSchema, taxTransactionsSchema, taxReturnReportSchema, taxReportDto, taxReportThreshold, roundTaxRatio, type TaxReportKind } from "./tax-report-wire";
export type TaxReportDb = Pick<typeof db, "select" | "query">;
const sum = (values: bigint[]) => values.reduce((total, value) => total + value, 0n);

async function report1099(tx: TaxReportDb, ctx: AuthContext, input: z.infer<typeof report1099Schema>, currency: string) {
  const taxYear = input.year ?? new Date().getUTCFullYear() - 1;
  const threshold = taxReportThreshold(input), startDate = `${taxYear}-01-01`, endDate = `${taxYear}-12-31`;
  const rows = await tx.select({
    contactId: contact.id, name: contact.name, taxIdentifier: contact.taxIdentifier,
    w9TaxClassification: contact.w9TaxClassification, backupWithholding: contact.backupWithholding,
    totalPaid: sql<string>`coalesce(sum(${payment.amount}),0)::text`,
    paymentCount: sql<number>`count(${payment.id})`.mapWith(Number),
    foreignCurrency: sql<boolean>`coalesce(bool_or(${payment.currencyCode} <> ${currency}),false)`,
  }).from(contact).leftJoin(payment, and(eq(payment.contactId, contact.id), eq(payment.organizationId, ctx.organizationId),
    eq(payment.type, "made"), ne(payment.method, "card"), gte(payment.date, startDate), lte(payment.date, endDate), isNull(payment.deletedAt)))
    .where(and(eq(contact.organizationId, ctx.organizationId), eq(contact.is1099Vendor, true), isNull(contact.deletedAt)))
    .groupBy(contact.id);
  if (rows.some(row => row.foreignCurrency)) throw new WireCompatibilityError("1099 report requires single organization-currency payments");
  const vendors = rows.map(row => ({ contactId: row.contactId, name: row.name, taxIdentifier: row.taxIdentifier,
    w9TaxClassification: row.w9TaxClassification, backupWithholding: row.backupWithholding,
    paymentCount: row.paymentCount, totalPaid: BigInt(row.totalPaid), reportable: BigInt(row.totalPaid) >= threshold }));
  vendors.sort((a, b) => a.totalPaid > b.totalPaid ? -1 : a.totalPaid < b.totalPaid ? 1 : a.contactId.localeCompare(b.contactId));
  const reportable = vendors.filter(row => row.reportable);
  return { taxYear, startDate, endDate, threshold, vendors, reportableCount: reportable.length,
    reportableTotal: sum(reportable.map(row => row.totalPaid)), grandTotal: sum(vendors.map(row => row.totalPaid)) };
}

/** Historical foreign-currency document totals have no qualified FX conversion here. */
async function checkDocumentCurrencies(tx: TaxReportDb, org: string, currency: string, start: string, end: string, purchases: boolean) {
  for (const table of purchases ? [invoice, bill] : [invoice]) {
    const [row] = await tx.select({ foreign: sql<boolean>`coalesce(bool_or(${table.currencyCode} <> ${currency}),false)` }).from(table)
      .where(and(eq(table.organizationId, org), gte(table.issueDate, start), lte(table.issueDate, end),
        notInArray(table.status, ["draft", "void"]), isNull(table.deletedAt)));
    if (row.foreign) throw new WireCompatibilityError("Tax document report requires single organization-currency documents; historical FX conversion is unsupported");
  }
}

/** Shared REST/MCP service: every component is read from one scoped, read-only snapshot. */
export async function getTaxReport(ctx: AuthContext, kind: TaxReportKind, input: unknown) {
  requireRole(ctx, "view:data");
  taxReportSchemas[kind].parse(input);
  return db.transaction(async tx => {
    const org = await tx.query.organization.findFirst({ where: eq(organization.id, ctx.organizationId), columns: { id: true } });
    if (!org) throw new AuthError("Organization not found", 404);
    const config = await getOrgTaxConfig(ctx.organizationId, tx);
    try { if (currencyMetadata(config.baseCurrency).code !== config.baseCurrency) throw new Error(); }
    catch { throw new WireCompatibilityError("Unsupported organization tax report currency"); }
    if (kind === "1099") return taxReportDto({ currencyCode: config.baseCurrency, ...await report1099(tx, ctx, report1099Schema.parse(input), config.baseCurrency) });
    const params = taxReportSchemas[kind].parse(input);
    let startDate = params.startDate, endDate = params.endDate;
    if (kind === "vat-transactions") {
      const args = taxTransactionsSchema.parse(input);
      if (args.periodId) {
        const period = await tx.query.taxPeriod.findFirst({ where: and(eq(taxPeriod.id, args.periodId), eq(taxPeriod.organizationId, ctx.organizationId)),
          columns: { startDate: true, endDate: true } });
        if (!period) throw new AuthError("Tax period not found", 404);
        startDate = period.startDate; endDate = period.endDate;
      }
    }
    if (kind === "tax-summary") {
      startDate ??= `${new Date().getUTCFullYear()}-01-01`;
      endDate ??= new Date().toISOString().slice(0, 10);
    }
    if (!startDate || !endDate) throw new z.ZodError([{ code: "custom", path: [], message: "startDate and endDate (or owned periodId) required" }]);
    taxReportPeriodSchema.parse({ startDate, endDate });
    let data: object;
    if (["tax-summary", "sales-tax", "vat-return", "bas"].includes(kind))
      await checkDocumentCurrencies(tx, ctx.organizationId, config.baseCurrency, startDate, endDate, kind !== "sales-tax");
    if (kind === "tax-summary") data = await summary(tx, ctx, startDate, endDate);
    else if (kind === "sales-tax") data = await salesTax(tx, ctx, startDate, endDate);
    else if (kind === "schedule-c") data = await scheduleC(tx, ctx, startDate, endDate);
    else {
      const basis = resolveBasis(taxReturnReportSchema.parse({ startDate, endDate,
        basis: (input as { basis?: string }).basis }).basis, config);
      if (kind === "vat-return") data = await vatReturn(tx, ctx, startDate, endDate, config, basis, vatReportSchema.parse(input).flatRatePercent);
      else if (kind === "bas") data = await bas(tx, ctx, startDate, endDate, config, basis);
      else {
        const { box } = taxTransactionsSchema.parse(input);
        const transactions = await boxTransactions(ctx.organizationId, box, startDate, endDate, basis, tx);
        data = { box, period: { startDate, endDate }, basis, vatScheme: config.vatScheme,
          total: sum(transactions.map(row => row.amount)), count: transactions.length, transactions };
      }
    }
    return taxReportDto({ currencyCode: config.baseCurrency, ...data });
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
async function summary(tx: TaxReportDb, ctx: AuthContext, startDate: string, endDate: string) {
  // Get all tax rates for the org
  const rates = await tx.query.taxRate.findMany({
    where: and(
      eq(taxRate.organizationId, ctx.organizationId),
      isNull(taxRate.deletedAt)
    ),
    with: { components: true },
  });

  // Output tax (sales): from invoice lines
  const outputRows = await tx
    .select({
      taxRateId: invoiceLine.taxRateId,
      totalTax: sql<string>`COALESCE(SUM(${invoiceLine.taxAmount}), 0)::text`,
      totalNet: sql<string>`COALESCE(SUM(trunc(${invoiceLine.quantity}::numeric * ${invoiceLine.unitPrice} / 100)), 0)::text`,
      lineCount: sql<number>`COUNT(*)`.mapWith(Number),
    })
    .from(invoiceLine)
    .innerJoin(invoice, eq(invoiceLine.invoiceId, invoice.id))
    .where(
      and(
        eq(invoice.organizationId, ctx.organizationId),
        isNull(invoice.deletedAt),
        notInArray(invoice.status, ["draft", "void"]),
        gte(invoice.issueDate, startDate),
        lte(invoice.issueDate, endDate),
        sql`${invoiceLine.taxRateId} IS NOT NULL`
      )
    )
    .groupBy(invoiceLine.taxRateId);

  // Input tax (purchases): from bill lines
  const inputRows = await tx
    .select({
      taxRateId: billLine.taxRateId,
      totalTax: sql<string>`COALESCE(SUM(${billLine.taxAmount}), 0)::text`,
      totalNet: sql<string>`COALESCE(SUM(trunc(${billLine.quantity}::numeric * ${billLine.unitPrice} / 100)), 0)::text`,
      lineCount: sql<number>`COUNT(*)`.mapWith(Number),
    })
    .from(billLine)
    .innerJoin(bill, eq(billLine.billId, bill.id))
    .where(
      and(
        eq(bill.organizationId, ctx.organizationId),
        isNull(bill.deletedAt),
        notInArray(bill.status, ["draft", "void"]),
        gte(bill.issueDate, startDate),
        lte(bill.issueDate, endDate),
        sql`${billLine.taxRateId} IS NOT NULL`
      )
    )
    .groupBy(billLine.taxRateId);

  // Build summary per tax rate
  const summary = rates.map((rate) => {
    const output = outputRows.find((r) => r.taxRateId === rate.id);
    const input = inputRows.find((r) => r.taxRateId === rate.id);

    const outputTax = BigInt(output?.totalTax ?? "0");
    const inputTax = BigInt(input?.totalTax ?? "0");
    const outputNet = BigInt(output?.totalNet ?? "0");
    const inputNet = BigInt(input?.totalNet ?? "0");

    return {
      taxRateId: rate.id,
      taxRateName: rate.name,
      rate: rate.rate,
      type: rate.type,
      outputTax,
      outputNet,
      outputTransactions: Number(output?.lineCount || 0),
      inputTax,
      inputNet,
      inputTransactions: Number(input?.lineCount || 0),
      netTax: outputTax - inputTax,
    };
  });

  // Filter out rates with no activity
  const activeSummary = summary.filter(
    (s) => s.outputTax > 0n || s.inputTax > 0n
  );

  const totalOutputTax = activeSummary.reduce((s, r) => s + r.outputTax, 0n);
  const totalInputTax = activeSummary.reduce((s, r) => s + r.inputTax, 0n);
  const netTaxPayable = totalOutputTax - totalInputTax;

  return {
    startDate,
    endDate,
    rates: activeSummary,
    totalOutputTax,
    totalInputTax,
    netTaxPayable,
  };
}

async function salesTax(tx: TaxReportDb, ctx: AuthContext, startDate: string, endDate: string) {
  // Group by tax rate
  const taxBreakdown = await tx
    .select({
      taxRateName: taxRate.name,
      taxRatePercent: taxRate.rate,
      taxableAmount: sql<string>`COALESCE(SUM(${invoiceLine.amount}), 0)::text`,
      taxCollected: sql<string>`COALESCE(SUM(${invoiceLine.taxAmount}), 0)::text`,
      invoiceCount: sql<number>`COUNT(DISTINCT ${invoice.id})`.mapWith(Number),
    })
    .from(invoiceLine)
    .innerJoin(invoice, eq(invoiceLine.invoiceId, invoice.id))
    .leftJoin(taxRate, and(eq(invoiceLine.taxRateId, taxRate.id), eq(taxRate.organizationId, ctx.organizationId)))
    .where(and(
      eq(invoice.organizationId, ctx.organizationId),
      gte(invoice.issueDate, startDate),
      lte(invoice.issueDate, endDate),
      notInArray(invoice.status, ["draft", "void"]),
      isNull(invoice.deletedAt)
    ))
    .groupBy(taxRate.id, taxRate.name, taxRate.rate);

  // Exempt (no tax rate assigned)
  const exempt = await tx
    .select({
      total: sql<string>`COALESCE(SUM(${invoiceLine.amount}), 0)::text`,
    })
    .from(invoiceLine)
    .innerJoin(invoice, eq(invoiceLine.invoiceId, invoice.id))
    .where(and(
      eq(invoice.organizationId, ctx.organizationId),
      gte(invoice.issueDate, startDate),
      lte(invoice.issueDate, endDate),
      notInArray(invoice.status, ["draft", "void"]),
      isNull(invoice.deletedAt),
      isNull(invoiceLine.taxRateId)
    ));

  return {
    breakdown: taxBreakdown.map(row => ({ ...row, taxableAmount: BigInt(row.taxableAmount), taxCollected: BigInt(row.taxCollected) })),
    exemptAmount: BigInt(exempt[0]?.total ?? "0"),
    period: { startDate, endDate },
  };
}

async function vatReturn(tx: TaxReportDb, ctx: AuthContext, startDate: string, endDate: string, config: OrgTaxConfig, basis: TaxBasis, flatRatePercent: number | undefined) {
  const flatRateApplied = flatRatePercent !== undefined && flatRatePercent > 0;
  const outputMovement = await controlAccountMovement(ctx.organizationId, "2200", startDate, endDate, basis, tx);
  const inputMovement = await controlAccountMovement(ctx.organizationId, "1500", startDate, endDate, basis, tx);
  // Box 6: Total sales ex-VAT (kept from document lines)
  const totalSales = await tx
    .select({ total: sql<string>`COALESCE(SUM(${invoice.subtotal}), 0)::text` })
    .from(invoice)
    .where(and(
      eq(invoice.organizationId, ctx.organizationId),
      gte(invoice.issueDate, startDate),
      lte(invoice.issueDate, endDate),
      notInArray(invoice.status, ["draft", "void"]),
      isNull(invoice.deletedAt)
    ));

  // Box 7: Total purchases ex-VAT (kept from document lines)
  const totalPurchases = await tx
    .select({ total: sql<string>`COALESCE(SUM(${bill.subtotal}), 0)::text` })
    .from(bill)
    .where(and(
      eq(bill.organizationId, ctx.organizationId),
      gte(bill.issueDate, startDate),
      lte(bill.issueDate, endDate),
      notInArray(bill.status, ["draft", "void"]),
      isNull(bill.deletedAt)
    ));

  // Gross (VAT-inclusive) turnover for the flat-rate computation.
  const grossSales = await tx
    .select({ total: sql<string>`COALESCE(SUM(${invoice.total}), 0)::text` })
    .from(invoice)
    .where(and(
      eq(invoice.organizationId, ctx.organizationId),
      gte(invoice.issueDate, startDate),
      lte(invoice.issueDate, endDate),
      notInArray(invoice.status, ["draft", "void"]),
      isNull(invoice.deletedAt)
    ));

  const ec = await computeEcSales(
    ctx.organizationId,
    startDate,
    endDate,
    config.country, tx
  );

  const box6 = BigInt(totalSales[0]?.total ?? "0");
  const box7 = BigInt(totalPurchases[0]?.total ?? "0");
  const box8 = ec.ecSalesNet;
  const box9 = ec.ecAcquisitionsNet;

  // Box 2: EU/acquisitions reverse-charge VAT. The buyer self-accounts notional
  // VAT by crediting Output VAT (2200) on a purchase entry that also debits
  // Input VAT (1500) — see lib/api/journal-automation.ts. Summing the 2200
  // credits restricted to entries that carry a 1500 debit isolates
  // reverse-charge output VAT from ordinary sales output VAT (a sale never
  // debits 1500 on the same entry).
  //
  // This output VAT is part of the full 2200 movement that feeds Box 1, so we
  // subtract it from Box 1 and surface it in Box 2 instead — Box 3 (= Box 1 +
  // Box 2) and Box 5 are unchanged, but the acquisition VAT is now reported in
  // its own box rather than buried in "VAT due on sales".
  //
  // TODO: a fully non-recoverable reverse charge (recoverablePercent = 0) posts
  // no 1500 leg, so it is not captured here; tagging the reverse-charge output
  // leg explicitly (e.g. a journalLine kind / taxRate reference) would let us
  // include it. Basis note: this follows the posting/entry date (accrual); the
  // VAT side of a reverse charge is net-zero cash, so a cash-basis distinction
  // is not meaningful for box 2.
  const outputVatAccountId = await getControlAccountId(ctx.organizationId, "2200", tx);
  const inputVatAccountId = await getControlAccountId(ctx.organizationId, "1500", tx);
  let reverseChargeVat = 0n;
  if (outputVatAccountId && inputVatAccountId) {
    const [row] = await tx
      .select({
        credits: sql<string>`COALESCE(SUM(${journalLine.creditAmount}), 0)::text`,
        debits: sql<string>`COALESCE(SUM(${journalLine.debitAmount}), 0)::text`,
      })
      .from(journalLine)
      .innerJoin(journalEntry, eq(journalLine.journalEntryId, journalEntry.id))
      .where(
        and(
          eq(journalLine.accountId, outputVatAccountId),
          eq(journalEntry.organizationId, ctx.organizationId),
          eq(journalEntry.status, "posted"),
          gte(journalEntry.date, startDate),
          lte(journalEntry.date, endDate),
          isNull(journalEntry.deletedAt),
          sql`exists (
            select 1 from ${journalLine} rc_input
            where rc_input.journal_entry_id = ${journalEntry.id}
              and rc_input.account_id = ${inputVatAccountId}
              and rc_input.debit_amount > 0
          )`
        )
      );
    reverseChargeVat = BigInt(row?.credits ?? "0") - BigInt(row?.debits ?? "0");
  }

  let box1: bigint;
  let box2: bigint;
  let box4: bigint;
  if (flatRateApplied) {
    // Flat-rate: VAT due = flat % of gross (VAT-inclusive) turnover; input VAT
    // is not separately reclaimable (standard flat-rate scheme). Reverse-charge
    // acquisitions are out of scope for the standard flat-rate calculation.
    const gross = BigInt(grossSales[0]?.total ?? "0");
    box1 = roundTaxRatio(gross * BigInt(flatRatePercent!), 10000n);
    box2 = 0n;
    box4 = 0n;
  } else {
    // The full 2200 movement includes reverse-charge output VAT; move that
    // slice into Box 2 so it is not double-counted in Box 3.
    box1 = outputMovement.credits - outputMovement.debits - reverseChargeVat;
    box2 = reverseChargeVat;
    box4 = inputMovement.debits - inputMovement.credits;
  }

  const box3 = box1 + box2;
  const box5 = box3 - box4;

  const boxes = [
    { box: "1", label: "VAT due on sales", amount: box1 },
    { box: "2", label: "VAT due on EU acquisitions", amount: box2 },
    { box: "3", label: "Total VAT due (Box 1 + 2)", amount: box3 },
    { box: "4", label: "VAT reclaimed on purchases", amount: box4 },
    { box: "5", label: "Net VAT to pay/reclaim (Box 3 - 4)", amount: box5 },
    { box: "6", label: "Total sales ex-VAT", amount: box6 },
    { box: "7", label: "Total purchases ex-VAT", amount: box7 },
    { box: "8", label: "Total supplies to EU ex-VAT", amount: box8 },
    { box: "9", label: "Total acquisitions from EU ex-VAT", amount: box9 },
  ];

  return {
    boxes,
    period: { startDate, endDate },
    basis,
    vatScheme: config.vatScheme,
    flatRate: flatRateApplied ? { applied: true, percentBp: flatRatePercent } : { applied: false },
  };
}

async function bas(tx: TaxReportDb, ctx: AuthContext, startDate: string, endDate: string, config: OrgTaxConfig, basis: TaxBasis) {
  // G1: Total sales (incl GST) — kept from documents
  const totalSales = await tx
    .select({ total: sql<string>`COALESCE(SUM(${invoice.total}), 0)::text` })
    .from(invoice)
    .where(and(
      eq(invoice.organizationId, ctx.organizationId),
      gte(invoice.issueDate, startDate),
      lte(invoice.issueDate, endDate),
      notInArray(invoice.status, ["draft", "void"]),
      isNull(invoice.deletedAt)
    ));

  // Total purchases (incl GST) — kept from documents
  const totalPurchases = await tx
    .select({ total: sql<string>`COALESCE(SUM(${bill.total}), 0)::text` })
    .from(bill)
    .where(and(
      eq(bill.organizationId, ctx.organizationId),
      gte(bill.issueDate, startDate),
      lte(bill.issueDate, endDate),
      notInArray(bill.status, ["draft", "void"]),
      isNull(bill.deletedAt)
    ));

  const outputMovement = await controlAccountMovement(
    ctx.organizationId,
    "2200",
    startDate,
    endDate,
    basis, tx
  );
  const inputMovement = await controlAccountMovement(
    ctx.organizationId,
    "1500",
    startDate,
    endDate,
    basis, tx
  );

  // G2 (exports): cross-border sales to a tax-registered counterparty. Derived
  // from contact country + taxNumber (best-effort, ex-GST subtotal).
  const ec = await computeEcSales(
    ctx.organizationId,
    startDate,
    endDate,
    config.country, tx
  );

  const g1 = BigInt(totalSales[0]?.total ?? "0");
  const oneA = outputMovement.credits - outputMovement.debits;
  const g11 = BigInt(totalPurchases[0]?.total ?? "0");
  const oneB = inputMovement.debits - inputMovement.credits;
  const g2 = ec.ecSalesNet;

  const fields = [
    { field: "G1", label: "Total sales (including GST)", amount: g1 },
    { field: "G2", label: "Export sales", amount: g2 },
    { field: "G3", label: "Other GST-free sales", amount: 0n },
    { field: "G10", label: "Capital purchases", amount: 0n },
    { field: "G11", label: "Non-capital purchases", amount: g11 },
    { field: "1A", label: "GST on sales", amount: oneA },
    { field: "1B", label: "GST on purchases", amount: oneB },
    { field: "NET", label: "Net GST (1A - 1B)", amount: oneA - oneB },
  ];

  return {
    fields,
    period: { startDate, endDate },
    basis,
    vatScheme: config.vatScheme,
  };
}

const SCHEDULE_C_MAP: Record<string, { line: string; label: string }> = {
  income: { line: "1", label: "Gross receipts or sales" },
  returns_allowances: { line: "2", label: "Returns and allowances" },
  advertising: { line: "8", label: "Advertising" },
  car_truck: { line: "9", label: "Car and truck expenses" },
  commissions: { line: "10", label: "Commissions and fees" },
  depreciation: { line: "13", label: "Depreciation" },
  insurance: { line: "15", label: "Insurance (other than health)" },
  interest_mortgage: { line: "16a", label: "Mortgage interest" },
  interest_other: { line: "16b", label: "Other interest" },
  legal_professional: { line: "17", label: "Legal and professional services" },
  office_expense: { line: "18", label: "Office expense" },
  rent_lease_vehicles: { line: "20a", label: "Rent/lease - vehicles, machinery" },
  rent_lease_other: { line: "20b", label: "Rent/lease - other business property" },
  repairs_maintenance: { line: "21", label: "Repairs and maintenance" },
  supplies: { line: "22", label: "Supplies" },
  taxes_licenses: { line: "23", label: "Taxes and licenses" },
  travel: { line: "24a", label: "Travel" },
  meals: { line: "24b", label: "Deductible meals" },
  utilities: { line: "25", label: "Utilities" },
  wages: { line: "26", label: "Wages" },
  other_expenses: { line: "27", label: "Other expenses" },
};


async function scheduleC(tx: TaxReportDb, ctx: AuthContext, startDate: string, endDate: string) {
  // Get all posted journal lines with account info
  const lines = await tx
    .select({
      subType: chartAccount.subType,
      accountType: chartAccount.type,
      debit: sql<string>`COALESCE(SUM(${journalLine.debitAmount}), 0)::text`,
      credit: sql<string>`COALESCE(SUM(${journalLine.creditAmount}), 0)::text`,
    })
    .from(journalLine)
    .innerJoin(journalEntry, eq(journalLine.journalEntryId, journalEntry.id))
    .innerJoin(chartAccount, eq(journalLine.accountId, chartAccount.id))
    .where(and(
      eq(journalEntry.organizationId, ctx.organizationId),
      eq(chartAccount.organizationId, ctx.organizationId),
      eq(journalEntry.status, "posted"),
      gte(journalEntry.date, startDate),
      lte(journalEntry.date, endDate),
      isNull(journalEntry.deletedAt)
    ))
    .groupBy(chartAccount.subType, chartAccount.type);

  // Map to Schedule C lines
  const scheduleCLines: Array<{ line: string; label: string; amount: bigint }> = [];

  for (const row of lines) {
    const subType = row.subType || "";
    const mapping = SCHEDULE_C_MAP[subType];
    if (!mapping) continue;

    // Revenue: credit - debit; Expense: debit - credit
    const amount = row.accountType === "revenue"
      ? BigInt(row.credit) - BigInt(row.debit)
      : BigInt(row.debit) - BigInt(row.credit);

    const existing = scheduleCLines.find(l => l.line === mapping.line);
    if (existing) {
      existing.amount += amount;
    } else {
      scheduleCLines.push({ ...mapping, amount });
    }
  }

  scheduleCLines.sort((a, b) => {
    const aNum = parseFloat(a.line.replace(/[a-z]/g, ""));
    const bNum = parseFloat(b.line.replace(/[a-z]/g, ""));
    return aNum - bNum;
  });

  const totalIncome = scheduleCLines
    .filter(l => l.line === "1")
    .reduce((sum, l) => sum + l.amount, 0n);
  const totalExpenses = scheduleCLines
    .filter(l => l.line !== "1" && l.line !== "2")
    .reduce((sum, l) => sum + l.amount, 0n);
  const netProfit = totalIncome - totalExpenses;

  return {
    lines: scheduleCLines,
    totalIncome,
    totalExpenses,
    netProfit,
    period: { startDate, endDate },
  };
}
