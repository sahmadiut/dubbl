import { deleteDraftJournal } from "@/lib/api/journal-delete";
import { AuthError } from "@/lib/api/auth-context";
import { jsonResponse } from "@/lib/api/json-response";
import { journalLineSchema, journalLineInput, journalTotals, journalLineDto } from "@/lib/api/journal-wire";
import { assertJournalReferences, assertJournalAccountScope } from "@/lib/api/journal-references";
import { db } from "@/lib/db";
import { journalEntry, journalLine } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { getAuthContext } from "@/lib/api/auth-context";
import { handleError } from "@/lib/api/response";
import { requireRole } from "@/lib/api/require-role";
import { assertNotLocked } from "@/lib/api/period-lock";
import { logAudit } from "@/lib/api/audit";
import { z } from "zod";

const updateSchema = z.object({
  date: z.iso.date(),
  description: z.string().min(1),
  reference: z.string().nullable().optional(),
  fiscalYearId: z.string().uuid().nullable().optional(),
  lines: z.array(journalLineSchema).min(2),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ctx = await getAuthContext(request);

    const entry = await db.query.journalEntry.findFirst({
      where: and(
        eq(journalEntry.id, id),
        eq(journalEntry.organizationId, ctx.organizationId)
      ),
      with: {
        lines: {
          columns: { rateExact: false },
          extras: { rateExact: sql<string | null>`${journalLine.rateExact}::text`.as("rate_exact_text") },
          with: {
            account: true,
          },
        },
      },
    });

    if (!entry) {
      return jsonResponse({ error: "Not found" }, { status: 404 });
    }
    assertJournalAccountScope(ctx.organizationId, entry.lines);

    const result = {
      ...entry,
      lines: entry.lines.map((l) => ({
        ...journalLineDto(l, true),
        account: undefined,
        id: l.id,
        accountId: l.accountId,
        accountCode: l.account?.code || "",
        accountName: l.account?.name || "",
        description: l.description,
        currencyCode: l.currencyCode,
        exchangeRate: l.exchangeRate,
      })),
    };

    return jsonResponse({ entry: result });
  } catch (err) {
    return handleError(err);
  }
}

/**
 * Edit a journal entry (full header + line replace).
 *
 * Only DRAFT entries can be edited. Posted entries are immutable for audit
 * safety — to change a posted entry, void it (which posts a reversing entry)
 * and create a new one. Re-validates that debits equal credits, and asserts the
 * period isn't locked on BOTH the old and new date (so an edit can't move an
 * entry out of, or into, a locked period). Wrapped in a transaction so the
 * header update and the line replace commit (or roll back) together.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ctx = await getAuthContext(request);
    requireRole(ctx, "edit:entries");

    const body = await request.json();
    const raw = updateSchema.parse(body);
    const parsed = { ...raw, lines: raw.lines.map(journalLineInput) };
    journalTotals(parsed.lines);
    await assertJournalReferences(ctx.organizationId, parsed.lines, parsed.fiscalYearId);

    const existing = await db.query.journalEntry.findFirst({
      where: and(
        eq(journalEntry.id, id),
        eq(journalEntry.organizationId, ctx.organizationId)
      ),
    });

    if (!existing) {
      return jsonResponse({ error: "Not found" }, { status: 404 });
    }
    if (existing.status !== "draft") {
      return jsonResponse(
        {
          error:
            "Only draft entries can be edited. Void the posted entry and create a new one to make changes.",
        },
        { status: 400 }
      );
    }

    // Block edits that touch a locked period — both the date being moved away
    // from and the new date.
    await assertNotLocked(ctx.organizationId, existing.date);
    if (parsed.date !== existing.date) {
      await assertNotLocked(ctx.organizationId, parsed.date);
    }

    const updated = await db.transaction(async (tx) => {
      const [entry] = await tx
        .update(journalEntry)
        .set({
          date: parsed.date,
          description: parsed.description,
          reference: parsed.reference ?? null,
          fiscalYearId: parsed.fiscalYearId ?? null,
          updatedAt: new Date(),
        })
        .where(and(eq(journalEntry.id, id), eq(journalEntry.organizationId, ctx.organizationId), eq(journalEntry.status, "draft")))
        .returning();
      if (!entry) throw new AuthError("Entry changed before edit", 409);

      // Full line replace.
      await tx.delete(journalLine).where(eq(journalLine.journalEntryId, id));
      await tx.insert(journalLine).values(
        parsed.lines.map((l) => ({
          journalEntryId: id,
          accountId: l.accountId,
          description: l.description ?? null,
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

    await logAudit({
      ctx,
      action: "update",
      entityType: "journal_entry",
      entityId: id,
      changes: {
        diff: {
          date:
            existing.date !== parsed.date
              ? { from: existing.date, to: parsed.date }
              : undefined,
          description:
            existing.description !== parsed.description
              ? { from: existing.description, to: parsed.description }
              : undefined,
          reference:
            existing.reference !== (parsed.reference ?? null)
              ? { from: existing.reference, to: parsed.reference ?? null }
              : undefined,
          lines: { replaced: parsed.lines.length },
        },
      },
      request,
    });

    return jsonResponse({ entry: updated });
  } catch (err) {
    return handleError(err);
  }
}

// Alias PATCH to the same full-replace edit semantics.
export const PATCH = PUT;

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ctx = await getAuthContext(request);
    return jsonResponse(await deleteDraftJournal(ctx, id, request));
  } catch (err) {
    return handleError(err);
  }
}
