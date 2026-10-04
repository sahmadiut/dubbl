import { and, asc, eq, gte, inArray, isNull, lte, ne, sql } from "drizzle-orm";
import { bankTransaction, bankAccount, bill, invoice, payment, journalEntry, journalLine, organization, chartAccount } from "@/lib/db/schema";
import { notDeleted } from "@/lib/db/soft-delete";
import { legacyMinor, WireCompatibilityError } from "@/lib/money/wire";
import { findMatches, type MatchCandidate } from "@/lib/banking/reconciliation-matcher";
import { suggestAccounts } from "@/lib/banking/account-suggestions";
import type { AuthContext } from "./auth-context";
import { requireRole } from "./require-role";
import { publicMoneyDto } from "./public-money-wire";
import { bankAmountProximity, sameBankReadCurrency } from "./bank-transaction-read-wire";
import { bankReadSnapshot, bankReadTransaction } from "./bank-transaction-reads";
function checkContact(contact: { organizationId: string } | null, ctx: AuthContext) {
  if (contact && contact.organizationId !== ctx.organizationId) throw new WireCompatibilityError("Invalid match contact ownership");
}
interface ExistingCandidate {
  type: "existing_payment" | "existing_journal" | "transfer";
  id: string; // payment.id / journalEntry.id / opposite bankTransaction.id
  journalEntryId: string | null; // the JE to link (already posted)
  date: string;
  description: string;
  amount: number; // signed cents, oriented to compare against the bank tx
  reference?: string | null;
  // Extra display context surfaced to the UI.
  meta?: Record<string, unknown>;
}

function normalize(s: string | null | undefined): string {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreExisting(
  tx: { date: string; description: string; amount: number; reference?: string | null; payee?: string | null },
  cand: ExistingCandidate
): { confidence: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  // Amount (compared on absolute value — sign orientation is handled by query).
  const proximity = bankAmountProximity(tx.amount, cand.amount);
  if (proximity === "exact") {
    score += 45;
    reasons.push("Exact amount match");
  } else {
    if (proximity === "one") {
      score += 25;
      reasons.push("Amount within 1%");
    } else if (proximity === "five") {
      score += 10;
      reasons.push("Amount within 5%");
    }
  }

  // Date proximity.
  const daysDiff = Math.abs(
    (new Date(tx.date).getTime() - new Date(cand.date).getTime()) / (1000 * 60 * 60 * 24)
  );
  if (daysDiff === 0) {
    score += 25;
    reasons.push("Same date");
  } else if (daysDiff <= 1) {
    score += 20;
    reasons.push("Within 1 day");
  } else if (daysDiff <= 3) {
    score += 15;
    reasons.push("Within 3 days");
  } else if (daysDiff <= 7) {
    score += 8;
    reasons.push("Within 7 days");
  }

  // Reference match.
  const txRef = normalize(tx.reference);
  const candRef = normalize(cand.reference);
  if (txRef && candRef) {
    if (txRef === candRef) {
      score += 25;
      reasons.push("Exact reference match");
    } else if (txRef.includes(candRef) || candRef.includes(txRef)) {
      score += 15;
      reasons.push("Partial reference match");
    }
  }

  // Payee / description similarity.
  const txText = normalize(`${tx.payee || ""} ${tx.description}`);
  const candText = normalize(cand.description);
  if (txText && candText) {
    if (txText === candText) {
      score += 15;
      reasons.push("Exact description match");
    } else {
      const txWords = new Set(txText.split(/\s+/).filter((w) => w.length > 2));
      const candWords = new Set(candText.split(/\s+/).filter((w) => w.length > 2));
      let overlap = 0;
      for (const w of txWords) if (candWords.has(w)) overlap++;
      const total = Math.max(txWords.size, candWords.size);
      if (total > 0) {
        const ratio = overlap / total;
        if (ratio >= 0.5) {
          score += 10;
          reasons.push("Strong description overlap");
        } else if (ratio >= 0.25) {
          score += 5;
          reasons.push("Some description overlap");
        }
      }
    }
  }

  return { confidence: Math.min(100, score), reasons };
}

export async function getBankMatchSuggestions(ctx: AuthContext, id: string) {
  requireRole(ctx, "manage:banking");
  return bankReadSnapshot(async tx => {
    const { transaction, account } = await bankReadTransaction(tx, ctx, id);
    const isOutgoing = transaction.amount < 0;
    const txForMatch = {
      id: transaction.id,
      date: transaction.date,
      description: transaction.description,
      amount: transaction.amount,
      reference: transaction.reference,
      currencyCode: account.currencyCode,
    };

    // --- Open documents (records a payment when chosen) ---
    let suggestedMatches;
    let allOpenInvoices: Array<Record<string, unknown>> = [];
    let allOpenBills: Array<Record<string, unknown>> = [];

    if (isOutgoing) {
      const openBills = await tx.query.bill.findMany({
        where: and(
          eq(bill.organizationId, ctx.organizationId),
          eq(bill.currencyCode, account.currencyCode),
          notDeleted(bill.deletedAt),
          inArray(bill.status, ["received", "partial", "overdue"])
        ),
        with: { contact: { columns: { name: true, organizationId: true } } },
        orderBy: asc(bill.id), limit: 50,
      });
      for (const row of openBills) { publicMoneyDto(row, ["total", "amountDue", "amountPaid"]); checkContact(row.contact, ctx); }
      const billCandidates: MatchCandidate[] = openBills.map((b) => ({
        type: "bill" as const,
        id: b.id,
        date: b.dueDate,
        description: `${b.billNumber} - ${b.contact?.name || "Unknown"}`,
        amount: -b.amountDue,
        reference: b.reference || b.billNumber,
      }));
      suggestedMatches = findMatches(txForMatch, [], billCandidates, []);
      allOpenBills = openBills.map((b) => ({
        id: b.id,
        billNumber: b.billNumber,
        contactName: b.contact?.name || "Unknown",
        dueDate: b.dueDate,
        total: b.total,
        amountDue: b.amountDue,
        status: b.status,
      }));
    } else {
      const openInvoices = await tx.query.invoice.findMany({
        where: and(
          eq(invoice.organizationId, ctx.organizationId),
          eq(invoice.currencyCode, account.currencyCode),
          notDeleted(invoice.deletedAt),
          inArray(invoice.status, ["sent", "partial", "overdue"])
        ),
        with: { contact: { columns: { name: true, organizationId: true } } },
        orderBy: asc(invoice.id), limit: 50,
      });
      for (const row of openInvoices) { publicMoneyDto(row, ["total", "amountDue", "amountPaid"]); checkContact(row.contact, ctx); }
      const invoiceCandidates: MatchCandidate[] = openInvoices.map((inv) => ({
        type: "invoice" as const,
        id: inv.id,
        date: inv.dueDate,
        description: `${inv.invoiceNumber} - ${inv.contact?.name || "Unknown"}`,
        amount: inv.amountDue,
        reference: inv.reference || inv.invoiceNumber,
      }));
      suggestedMatches = findMatches(txForMatch, invoiceCandidates, [], []);
      allOpenInvoices = openInvoices.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        contactName: inv.contact?.name || "Unknown",
        dueDate: inv.dueDate,
        total: inv.total,
        amountDue: inv.amountDue,
        status: inv.status,
      }));
    }

    // Date/amount window for the "find existing record" candidates.
    const txDate = new Date(transaction.date);
    const windowDays = 7;
    const windowStart = new Date(txDate);
    windowStart.setUTCDate(windowStart.getUTCDate() - windowDays);
    const windowEnd = new Date(txDate);
    windowEnd.setUTCDate(windowEnd.getUTCDate() + windowDays);
    const startStr = windowStart.toISOString().slice(0, 10);
    const endStr = windowEnd.toISOString().slice(0, 10);

    const existingCandidates: ExistingCandidate[] = [];

    // --- (a) Existing payments on this bank not yet linked to a bank tx ---
    // received payments are money in; made payments are money out. Match
    // direction so a money-out tx only sees outgoing payments and vice versa.
    const paymentRows = await tx.query.payment.findMany({
      where: and(
        eq(payment.organizationId, ctx.organizationId),
        eq(payment.currencyCode, account.currencyCode),
        eq(payment.bankAccountId, account.id),
        isNull(payment.bankTransactionId),
        isNull(payment.deletedAt),
        eq(payment.type, isOutgoing ? "made" : "received"),
        gte(payment.date, startStr),
        lte(payment.date, endStr)
      ),
      with: { contact: { columns: { name: true, organizationId: true } } },
      orderBy: asc(payment.id), limit: 50,
    });
    for (const p of paymentRows) {
      publicMoneyDto(p, ["amount"]); checkContact(p.contact, ctx);
      if (p.journalEntryId) {
        const je = await tx.query.journalEntry.findFirst({ where: and(eq(journalEntry.id, p.journalEntryId), eq(journalEntry.organizationId, ctx.organizationId)), columns: { status: true, deletedAt: true } });
        if (!je) throw new WireCompatibilityError("Invalid payment journal ownership");
        if (je.status !== "posted" || je.deletedAt !== null) continue;
      }
      existingCandidates.push({
        type: "existing_payment",
        id: p.id,
        journalEntryId: p.journalEntryId,
        date: p.date,
        description: `${p.paymentNumber} - ${p.contact?.name || "Unknown"}`,
        amount: isOutgoing ? -p.amount : p.amount,
        reference: p.reference || p.paymentNumber,
        meta: {
          paymentNumber: p.paymentNumber,
          contactName: p.contact?.name || "Unknown",
          method: p.method,
          amount: p.amount,
        },
      });
    }

    // --- (b) Posted journal lines hitting this bank's GL not yet linked ---
    // Only when the bank account has a GL account. Money-in transactions look
    // for entries that DEBITED the bank (debitAmount > 0); money-out for ones
    // that CREDITED it. Exclude journals already linked to any bank tx so we
    // never offer a journal that's already reconciled elsewhere.
    const org = await tx.query.organization.findFirst({ where: eq(organization.id, ctx.organizationId), columns: { defaultCurrency: true } });
    if (account.chartAccountId) {
      const gl = await tx.query.chartAccount.findFirst({ where: and(eq(chartAccount.id, account.chartAccountId), eq(chartAccount.organizationId, ctx.organizationId)) });
      if (!gl) throw new WireCompatibilityError("Invalid bank GL ownership");
    }
    // GL debit/credit is base currency. Foreign bank amounts cannot be compared without a carrying-value adapter.
    if (account.chartAccountId && org?.defaultCurrency === account.currencyCode) {
      const linkedJournalIds = tx
        .select({ jid: bankTransaction.journalEntryId })
        .from(bankTransaction)
        .innerJoin(bankAccount, eq(bankAccount.id, bankTransaction.bankAccountId))
        .where(and(eq(bankAccount.organizationId, ctx.organizationId), sql`${bankTransaction.journalEntryId} is not null`));

      const lineRows = await tx
        .select({
          entryId: journalEntry.id,
          entryDate: journalEntry.date,
          entryDescription: journalEntry.description,
          entryReference: journalEntry.reference,
          sourceType: journalEntry.sourceType,
          lineId: journalLine.id,
          currencyCode: journalLine.currencyCode,
          debit: journalLine.debitAmount,
          credit: journalLine.creditAmount,
        })
        .from(journalLine)
        .innerJoin(journalEntry, eq(journalLine.journalEntryId, journalEntry.id))
        .where(
          and(
            eq(journalEntry.organizationId, ctx.organizationId),
            eq(journalEntry.status, "posted"),
            isNull(journalEntry.deletedAt),
            eq(journalLine.accountId, account.chartAccountId),
            gte(journalEntry.date, startStr),
            lte(journalEntry.date, endStr),
            sql`${journalEntry.id} not in ${linkedJournalIds}`
          )
        )
        .orderBy(asc(journalEntry.date), asc(journalEntry.id), asc(journalLine.id));

      const grouped = new Map<string, { row: typeof lineRows[number]; net: bigint }>();
      for (const r of lineRows) {
        sameBankReadCurrency(r.currencyCode, account.currencyCode);
        const dto = publicMoneyDto(r, ["debit", "credit"]);
        const item = grouped.get(r.entryId) ?? { row: r, net: 0n };
        item.net += BigInt(dto.debitMinor) - BigInt(dto.creditMinor); grouped.set(r.entryId, item);
      }
      for (const { row: r, net } of [...grouped.values()].slice(0, 50)) {
        const oriented = isOutgoing ? -net : net;
        if (oriented <= 0n) continue;
        const lineAmount = legacyMinor(oriented);
        existingCandidates.push({
          type: "existing_journal",
          id: r.entryId,
          journalEntryId: r.entryId,
          date: r.entryDate,
          description: r.entryDescription,
          amount: isOutgoing ? -lineAmount : lineAmount,
          reference: r.entryReference,
          meta: {
            sourceType: r.sourceType,
            amount: lineAmount,
          },
        });
      }
    }

    // --- (c) Opposite-sign bank transactions in OTHER accounts (transfers) ---
    // A money-out leg here pairs with a money-in leg elsewhere. We only surface
    // unreconciled, un-paired lines in other bank accounts of this org.
    const transferRows = await tx
      .select({
        id: bankTransaction.id,
        date: bankTransaction.date,
        description: bankTransaction.description,
        reference: bankTransaction.reference,
        amount: bankTransaction.amount,
        bankAccountId: bankTransaction.bankAccountId,
        accountName: bankAccount.accountName,
      })
      .from(bankTransaction)
      .innerJoin(bankAccount, eq(bankTransaction.bankAccountId, bankAccount.id))
      .where(
        and(
          eq(bankAccount.organizationId, ctx.organizationId),
          notDeleted(bankAccount.deletedAt),
          eq(bankAccount.currencyCode, account.currencyCode),
          sql`coalesce(${bankTransaction.currencyCode}, ${bankAccount.currencyCode}) = ${account.currencyCode}`,
          ne(bankTransaction.bankAccountId, account.id),
          // Only surface lines that can actually be matched: unreconciled and
          // un-paired. (Reconciled/excluded lines would be rejected by POST.)
          eq(bankTransaction.status, "unreconciled"),
          isNull(bankTransaction.transferTransactionId),
          // opposite sign of this transaction
          isOutgoing
            ? sql`${bankTransaction.amount} > 0`
            : sql`${bankTransaction.amount} < 0`,
          gte(bankTransaction.date, startStr),
          lte(bankTransaction.date, endStr)
        )
      )
      .orderBy(asc(bankTransaction.date), asc(bankTransaction.id)).limit(50);

    for (const t of transferRows) {
      publicMoneyDto(t, ["amount"]);
      existingCandidates.push({
        type: "transfer",
        id: t.id,
        journalEntryId: null,
        date: t.date,
        description: `${t.accountName}: ${t.description}`,
        // Orient to compare absolute amounts; sign mirrors this tx's direction.
        amount: isOutgoing ? -Math.abs(t.amount) : Math.abs(t.amount),
        reference: t.reference,
        meta: {
          bankAccountId: t.bankAccountId,
          accountName: t.accountName,
          amount: t.amount,
        },
      });
    }

    // Score & rank the existing/transfer candidates; keep a reasonable cut.
    const existingMatches = existingCandidates
      .map((cand) => {
        const { confidence, reasons } = scoreExisting(
          {
            date: transaction.date,
            description: transaction.description,
            amount: transaction.amount,
            reference: transaction.reference,
            payee: transaction.payee,
          },
          cand
        );
        return {
          transactionId: transaction.id,
          candidate: cand,
          confidence,
          reasons,
        };
      })
      .filter((m) => m.confidence >= 30)
      .sort((a, b) => b.confidence - a.confidence || a.candidate.id.localeCompare(b.candidate.id))
      .slice(0, 10);


    const candidateDto = <T extends { amount: number }>(row: T) => ({ ...publicMoneyDto(row, ["amount"]), currencyCode: account.currencyCode });
    return {
      transaction: candidateDto(txForMatch),
      suggestedMatches: suggestedMatches.map(m => ({ ...m, candidate: candidateDto(m.candidate) })),
      existingMatches: existingMatches.map(m => ({ ...m, candidate: { ...candidateDto(m.candidate), meta: m.candidate.meta ? { ...publicMoneyDto(m.candidate.meta as { amount: number }, ["amount"]), currencyCode: account.currencyCode } : undefined } })),
      openInvoices: allOpenInvoices.map(row => ({ ...publicMoneyDto(row as { total: number; amountDue: number }, ["total", "amountDue"]), currencyCode: account.currencyCode })),
      openBills: allOpenBills.map(row => ({ ...publicMoneyDto(row as { total: number; amountDue: number }, ["total", "amountDue"]), currencyCode: account.currencyCode })),
      accountSuggestions: await suggestAccounts(transaction.bankAccountId, transaction.description, 5, tx),
    };
  });
}
