import { and, eq, gte, isNull, lte, notInArray, sql } from "drizzle-orm";
import { chartAccount, journalEntry, journalLine, invoice, bill, contact } from "@/lib/db/schema";
import { CASH_SOURCE_TYPES } from "@/lib/reports/gl-query";
import type { TaxBasis } from "@/lib/reports/tax-return";
import type { TaxTx } from "./tax-config-transaction";
import { WireCompatibilityError } from "@/lib/money/wire";
import { taxSafeMinor } from "./tax-period-wire";

// Separate adopted filing path; broader report consumers remain MON-029.
export async function taxControlMovement(tx: TaxTx, orgId: string, code: string, start: string, end: string, basis: TaxBasis) {
  const [account] = await tx.select().from(chartAccount).where(and(eq(chartAccount.organizationId, orgId), eq(chartAccount.code, code), isNull(chartAccount.deletedAt)));
  if (!account) return { debits: 0n, credits: 0n };
  const cash = sql`(${journalEntry.sourceType} in (${sql.join(CASH_SOURCE_TYPES.map(s => sql`${s}`), sql`, `)}) or exists (
    select 1 from journal_line cash_jl join chart_account cash_acct on cash_acct.id = cash_jl.account_id
    where cash_jl.journal_entry_id = ${journalEntry.id} and cash_acct.organization_id = ${orgId} and cash_acct.sub_type = 'bank'))`;
  const [row] = await tx.select({
    debits: sql<string>`coalesce(sum(${journalLine.debitAmount}), 0)::text`,
    credits: sql<string>`coalesce(sum(${journalLine.creditAmount}), 0)::text`,
    invalid: sql<boolean>`coalesce(bool_or(${journalLine.debitAmount} < 0 or ${journalLine.creditAmount} < 0), false)`,
  }).from(journalLine).innerJoin(journalEntry, eq(journalLine.journalEntryId, journalEntry.id)).where(and(
    eq(journalLine.accountId, account.id), eq(journalEntry.organizationId, orgId), eq(journalEntry.status, "posted"),
    isNull(journalEntry.deletedAt), gte(journalEntry.date, start), lte(journalEntry.date, end), basis === "cash" ? cash : undefined,
  ));
  if (row.invalid) throw new WireCompatibilityError("Negative saved tax ledger leg");
  const debits = BigInt(row.debits), credits = BigInt(row.credits);
  taxSafeMinor(debits); taxSafeMinor(credits); return { debits, credits };
}
export async function taxEcTotals(tx: TaxTx, orgId: string, start: string, end: string, country: string | null, base: string) {
  const billingCountry = sql<string>`(${contact.addresses} #>> '{billing,country}')`;
  const border = country ? sql`${billingCountry} is not null and ${billingCountry} <> '' and ${billingCountry} <> ${country}` : sql`${billingCountry} is not null and ${billingCountry} <> ''`;
  // Preserve the existing cross-border VAT-registered heuristic, not a legal EU classification.
  const totals = [];
  for (const table of [invoice, bill]) {
    const [row] = await tx.select({ total: sql<string>`coalesce(sum(${table.subtotal}),0)::text`,
      foreign: sql<boolean>`coalesce(bool_or(${table.currencyCode} <> ${base}),false)`,
      invalidAmount: sql<boolean>`coalesce(bool_or(${table.subtotal} < -9007199254740991 or ${table.subtotal} > 9007199254740991),false)`,
      invalidOwner: sql<boolean>`coalesce(bool_or(${contact.organizationId} <> ${orgId}),false)` })
      .from(table).innerJoin(contact, eq(table.contactId, contact.id)).where(and(eq(table.organizationId, orgId),
        gte(table.issueDate, start), lte(table.issueDate, end), notInArray(table.status, ["draft", "void"]), isNull(table.deletedAt),
        sql`${contact.taxNumber} is not null and ${contact.taxNumber} <> ''`, border));
    if (row.foreign) throw new WireCompatibilityError("Cross-border filing subtotals require base-currency documents; historical FX conversion is not qualified here");
    if (row.invalidOwner) throw new WireCompatibilityError("Cross-border filing contact must be organization-owned");
    if (row.invalidAmount) throw new WireCompatibilityError("Unsupported saved cross-border document subtotal");
    totals.push(taxSafeMinor(BigInt(row.total)));
  }
  return { sales: totals[0], acquisitions: totals[1] };
}
