import { and, asc, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { chartAccount, costCenter, journalEntry, journalLine, organization, project } from "@/lib/db/schema";
import { AuthError, type AuthContext } from "@/lib/api/auth-context";
import { requireRole } from "@/lib/api/require-role";
import { analyticsCurrency } from "./document-analytics-wire";
import { reportMinor } from "./statement-wire";
import { accountTransactionsSchema, generalLedgerSchema, ledgerRange } from "./ledger-detail-wire";
import { periodInputError } from "./period-statement-wire";
import type { Statement } from "./statement-export";

type Snapshot = Parameters<Parameters<typeof db.transaction>[0]>[0];
const amount = <K extends string>(key: K, value: bigint) => ({ [key]: reportMinor(value), [`${key}Minor`]: value.toString() }) as Record<K, number> & Record<`${K}Minor`, string>;
const natural = (type: string, debit: bigint, credit: bigint) => type === "asset" || type === "expense" ? debit - credit : credit - debit;

async function read<T>(ctx: AuthContext, operation: (tx: Snapshot, currency: string) => Promise<T>) {
  return db.transaction(async tx => {
    const org = await tx.query.organization.findFirst({ where: eq(organization.id, ctx.organizationId), columns: { defaultCurrency: true } });
    if (!org) throw new AuthError("Organization not found", 404);
    return operation(tx, analyticsCurrency(org.defaultCurrency ?? "USD"));
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}

async function ledger(tx: Snapshot, ctx: AuthContext, params: ReturnType<typeof generalLedgerSchema.parse>, allLines = false, transactions = false) {
  const { startDate, endDate } = ledgerRange(params);
  const offset = params.offset ?? 0, limit = params.limit ?? 50;
  if (!params.accountId && offset !== 0) throw periodInputError("offset requires accountId");
  const dimension = params.costCenterId !== undefined ? "costCenterId" : params.projectId !== undefined ? "projectId" : undefined;
  const raw = dimension ? params[dimension] : undefined;
  const dimensionValue = raw === "none" || raw === "null" || raw === "" ? null : raw;
  if (dimension && dimensionValue) {
    const table = dimension === "costCenterId" ? costCenter : project;
    const owned = await tx.select({ id: table.id }).from(table).where(and(eq(table.id, dimensionValue), eq(table.organizationId, ctx.organizationId))).limit(1);
    if (!owned.length) throw new AuthError("Report dimension not found", 404);
  }
  const selected = params.accountId ? await tx.query.chartAccount.findFirst({
    where: and(eq(chartAccount.id, params.accountId), eq(chartAccount.organizationId, ctx.organizationId), isNull(chartAccount.deletedAt)),
    columns: { id: true, code: true, name: true, type: true },
  }) : undefined;
  if (params.accountId && !selected) throw new AuthError("Account not found", 404);
  const scope = and(eq(chartAccount.organizationId, ctx.organizationId), isNull(chartAccount.deletedAt),
    eq(journalEntry.organizationId, ctx.organizationId), eq(journalEntry.status, "posted"), isNull(journalEntry.deletedAt),
    lte(journalEntry.date, endDate), params.accountId ? eq(chartAccount.id, params.accountId) : undefined,
    dimension ? dimensionValue === null ? isNull(journalLine[dimension]) : eq(journalLine[dimension], dimensionValue!) : undefined);
  // PostgreSQL numeric SUM and text avoid both ORM Number decoding and int64 sum overflow.
  const summaries = await tx.select({ accountId: chartAccount.id, accountCode: chartAccount.code, accountName: chartAccount.name, accountType: chartAccount.type,
    opening: sql<string>`coalesce(sum(${journalLine.debitAmount}::numeric - ${journalLine.creditAmount}::numeric) filter (where ${journalEntry.date} < ${startDate}), 0)::text`,
    debit: sql<string>`coalesce(sum(${journalLine.debitAmount}) filter (where ${journalEntry.date} >= ${startDate}), 0)::text`,
    credit: sql<string>`coalesce(sum(${journalLine.creditAmount}) filter (where ${journalEntry.date} >= ${startDate}), 0)::text`,
    count: sql<string>`count(*) filter (where ${journalEntry.date} >= ${startDate})::text`,
  }).from(journalLine).innerJoin(journalEntry, eq(journalLine.journalEntryId, journalEntry.id))
    .innerJoin(chartAccount, eq(journalLine.accountId, chartAccount.id)).where(scope)
    .groupBy(chartAccount.id, chartAccount.code, chartAccount.name, chartAccount.type).orderBy(asc(chartAccount.code), asc(chartAccount.id));
  const order = sql`${journalEntry.date}, ${journalEntry.entryNumber}, ${journalEntry.id}, ${journalLine.id}`;
  const window = tx.select({ accountId: sql<string>`${chartAccount.id}`.as("account_id"),
    lineId: sql<string>`${journalLine.id}`.as("line_id"), entryId: sql<string>`${journalEntry.id}`.as("entry_id"),
    date: journalEntry.date, entryNumber: journalEntry.entryNumber, description: sql<string | null>`${journalEntry.description}`.as("entry_description"), reference: journalEntry.reference,
    sourceType: journalEntry.sourceType, sourceId: journalEntry.sourceId, lineDescription: sql<string | null>`${journalLine.description}`.as("line_description"),
    debit: sql<string>`${journalLine.debitAmount}::text`.as("debit"), credit: sql<string>`${journalLine.creditAmount}::text`.as("credit"),
    movement: sql<string>`sum(${journalLine.debitAmount}::numeric - ${journalLine.creditAmount}::numeric) over (partition by ${chartAccount.id} order by ${order} rows unbounded preceding)::text`.as("movement"),
    rn: sql<string>`row_number() over (partition by ${chartAccount.id} order by ${order})`.as("rn"),
  }).from(journalLine).innerJoin(journalEntry, eq(journalLine.journalEntryId, journalEntry.id))
    .innerJoin(chartAccount, eq(journalLine.accountId, chartAccount.id)).where(and(scope, gte(journalEntry.date, startDate))).as("ledger_lines");
  const rows = await tx.select().from(window).where(allLines ? undefined : and(sql`${window.rn} > ${offset}`, sql`${window.rn} <= ${offset + limit}`))
    .orderBy(asc(window.accountId), asc(window.date), asc(window.entryNumber), asc(window.entryId), asc(window.lineId));
  const accounts = summaries.filter(row => params.accountId || BigInt(row.count) > 0n).map(row => {
    const opening = natural(row.accountType, BigInt(row.opening), 0n);
    const debit = BigInt(row.debit), credit = BigInt(row.credit), balance = natural(row.accountType, debit, credit);
    const entries = rows.filter(line => line.accountId === row.accountId).map(line => {
      const running = natural(row.accountType, BigInt(line.movement), 0n);
      return { date: line.date, entryNumber: line.entryNumber, description: transactions ? line.lineDescription || line.description : line.description,
        reference: line.reference, ...(transactions ? { sourceType: line.sourceType, sourceId: line.sourceId } : {}),
        entryId: line.entryId, lineId: line.lineId, ...amount("debit", BigInt(line.debit)), ...amount("credit", BigInt(line.credit)),
        ...amount("runningBalance", running), ...amount("ledgerBalance", opening + running) };
    });
    return { accountId: row.accountId, accountName: row.accountName, accountCode: row.accountCode, accountType: row.accountType,
      entries, totalEntries: reportMinor(BigInt(row.count)), ...amount("totalDebit", debit), ...amount("totalCredit", credit),
      ...amount("balance", balance), ...amount("openingBalance", opening), ...amount("closingLedgerBalance", opening + balance) };
  });
  const empty = { entries: [], totalEntries: 0, ...amount("totalDebit", 0n), ...amount("totalCredit", 0n), ...amount("balance", 0n),
    ...amount("openingBalance", 0n), ...amount("closingLedgerBalance", 0n) };
  return { startDate, endDate, offset, limit, dimension, dimensionValue, accounts, selected, single: accounts[0] ?? empty };
}

export async function getGeneralLedger(ctx: AuthContext, input: unknown, options: { allLines?: boolean } = {}) {
  requireRole(ctx, "view:data");
  const params = generalLedgerSchema.parse(input);
  ledgerRange(params);
  if (!params.accountId && (params.offset ?? 0) !== 0) throw periodInputError("offset requires accountId");
  return read(ctx, async (tx, currency) => {
    const result = await ledger(tx, ctx, params, options.allLines);
    const { startDate, endDate, offset, limit, accounts, dimension, dimensionValue, single } = result;
    const statement = (): Statement => ({ title: "General Ledger", periodLabel: `${startDate} to ${endDate}`, currency,
      sections: accounts.map(account => ({ label: `${account.accountCode} ${account.accountName}`,
        rows: account.entries.map(line => ({ name: `${line.date} ${line.entryNumber}${line.description ? ` - ${line.description}` : ""}`,
          amount: reportMinor(BigInt(line.debitMinor) - BigInt(line.creditMinor)), depth: 1 })), subtotal: account.balance })) });
    const data = params.accountId ? { ...single, offset, limit, startDate, endDate, currencyCode: currency,
      ...(dimension ? { dimension, dimensionValue } : {}) } : { startDate, endDate, currencyCode: currency,
      ...(dimension ? { dimension, dimensionValue } : {}), accounts };
    return { data, statement };
  });
}

export async function getAccountTransactions(ctx: AuthContext, input: unknown) {
  requireRole(ctx, "view:data");
  const params = accountTransactionsSchema.parse(input);
  ledgerRange(params);
  return read(ctx, async (tx, currency) => {
    const { selected, single, startDate, endDate } = await ledger(tx, ctx, params, true, true);
    return { account: selected!, startDate, endDate, currencyCode: currency, transactions: single.entries,
      totalDebit: single.totalDebit, totalDebitMinor: single.totalDebitMinor, totalCredit: single.totalCredit, totalCreditMinor: single.totalCreditMinor,
      ...amount("closingBalance", BigInt(single.balanceMinor)), openingBalance: single.openingBalance, openingBalanceMinor: single.openingBalanceMinor,
      closingLedgerBalance: single.closingLedgerBalance, closingLedgerBalanceMinor: single.closingLedgerBalanceMinor };
  });
}
