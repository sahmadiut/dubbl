import { jsonResponse } from "@/lib/api/json-response";
import { journalLineSchema, journalLineInput, journalTotals, journalTotalDebit, journalLegacyDecimal } from "@/lib/api/journal-wire";
import { assertJournalReferences } from "@/lib/api/journal-references";
import { requireRole } from "@/lib/api/require-role";
import { db } from "@/lib/db";
import { journalEntry, journalLine } from "@/lib/db/schema";
import { eq, sql, desc } from "drizzle-orm";
import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { logAudit } from "@/lib/api/audit";
import { assertNotLocked } from "@/lib/api/period-lock";
import { checkMonthlyLimit } from "@/lib/api/check-limit";
import { z } from "zod";

const createSchema = z.object({
  date: z.iso.date(),
  description: z.string().min(1),
  reference: z.string().nullable().optional(),
  fiscalYearId: z.string().uuid().nullable().optional(),
  // If set, a scheduled job posts a mirror reversing entry on this date
  // (accruals / prepayments). Must be on or after the entry date.
  autoReverseDate: z.iso.date().nullable().optional(),
  lines: z.array(journalLineSchema).min(2),
});

export async function GET(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") || "50");

    const entries = await db.query.journalEntry.findMany({
      where: eq(journalEntry.organizationId, ctx.organizationId),
      orderBy: desc(journalEntry.createdAt),
      limit,
      with: {
        lines: { columns: { rateExact: false }, extras: { rateExact: sql<string | null>`${journalLine.rateExact}::text`.as("rate_exact_text") } },
      },
    });

    const result = entries.map((e) => {
      const totalDebit = journalTotalDebit(e.lines);
      return {
        ...e,
        lines: undefined,
        totalDebit: journalLegacyDecimal(totalDebit),
        totalDebitMinor: BigInt(totalDebit).toString(),
      };
    });

    return jsonResponse({
      entries: result,
      total: result.length,
    });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getAuthContext(request);

    requireRole(ctx, "create:entries");
    const body = await request.json();
    const raw = createSchema.parse(body);
    const parsed = { ...raw, lines: raw.lines.map(journalLineInput) };
    journalTotals(parsed.lines, true);
    await assertJournalReferences(ctx.organizationId, parsed.lines, parsed.fiscalYearId);

    await assertNotLocked(ctx.organizationId, parsed.date);
    await checkMonthlyLimit(ctx.organizationId, journalEntry, journalEntry.organizationId, journalEntry.createdAt, "entriesPerMonth");

    // An auto-reversal must fall on or after the original entry's date.
    if (parsed.autoReverseDate && parsed.autoReverseDate < parsed.date) {
      return jsonResponse(
        { error: "Auto-reverse date must be on or after the entry date" },
        { status: 400 }
      );
    }

    // Get next entry number
    const [maxResult] = await db
      .select({ max: sql<number>`coalesce(max(${journalEntry.entryNumber}), 0)` })
      .from(journalEntry)
      .where(eq(journalEntry.organizationId, ctx.organizationId));

    const entryNumber = (maxResult?.max || 0) + 1;

    const entry = await db.transaction(async (tx) => {
      const [entry] = await tx
        .insert(journalEntry)
        .values({
          organizationId: ctx.organizationId,
          entryNumber,
          date: parsed.date,
          description: parsed.description,
          reference: parsed.reference || null,
          fiscalYearId: parsed.fiscalYearId || null,
          autoReverseDate: parsed.autoReverseDate || null,
          createdBy: ctx.userId,
        })
        .returning();

      // Insert lines
      await tx.insert(journalLine).values(
        parsed.lines.map((l) => ({
          journalEntryId: entry.id,
          accountId: l.accountId,
          description: l.description || null,
          debitAmount: l.debitAmount,
          creditAmount: l.creditAmount,
          currencyCode: l.currencyCode,
          exchangeRate: l.exchangeRate,
          rateExact: l.rateExact,
          rateDirection: l.rateDirection,
          costCenterId: l.costCenterId ?? null,
          projectId: l.projectId ?? null,
        }))
      );

      return entry;
    });

    await logAudit({ ctx, action: "create", entityType: "journal_entry", entityId: entry.id, request });

    return jsonResponse({ entry }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
