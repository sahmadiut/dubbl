import { deleteDraftJournal } from "@/lib/api/journal-delete";
import { AuthError } from "@/lib/api/auth-context";
import { journalLineSchema, journalLineInput, journalTotals, journalTotalDebit, journalLineDto } from "@/lib/api/journal-wire";
import { assertJournalReferences, assertJournalAccountScope } from "@/lib/api/journal-references";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { db } from "@/lib/db";
import { journalEntry, journalLine } from "@/lib/db/schema";
import { eq, and, desc, sql, gte, lte, isNull } from "drizzle-orm";
import { requireRole } from "@/lib/api/require-role";
import { assertNotLocked } from "@/lib/api/period-lock";
import { postJournal, voidJournal, setJournalAutoReverseDate, recodeJournals, recodeFields } from "@/lib/api/journal-lifecycle";
import { wrapTool } from "@/lib/mcp/errors";
import { checkMonthlyLimit } from "@/lib/api/check-limit";
import { logAudit } from "@/lib/api/audit";
import type { AuthContext } from "@/lib/api/auth-context";

export function registerEntryTools(server: McpServer, ctx: AuthContext) {
  server.tool(
    "list_entries",
    "List journal entries with optional filters. Returns totalDebit as a safe stored minor-unit number and totalDebitMinor as its exact integer string. Mixed line currencies retain the raw stored sum, not a converted economic total.",
    {
      status: z
        .enum(["draft", "posted", "void"])
        .optional()
        .describe("Filter by entry status"),
      startDate: z
        .string()
        .optional()
        .describe("Start date filter (YYYY-MM-DD)"),
      endDate: z
        .string()
        .optional()
        .describe("End date filter (YYYY-MM-DD)"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .default(50)
        .describe("Number of entries to return (max 100)"),
      page: z
        .number()
        .int()
        .min(1)
        .optional()
        .default(1)
        .describe("Page number"),
    },
    (params) =>
      wrapTool(ctx, async () => {
        const conditions = [
          eq(journalEntry.organizationId, ctx.organizationId),
          isNull(journalEntry.deletedAt),
        ];

        if (params.status) {
          conditions.push(eq(journalEntry.status, params.status));
        }
        if (params.startDate) {
          conditions.push(gte(journalEntry.date, params.startDate));
        }
        if (params.endDate) {
          conditions.push(lte(journalEntry.date, params.endDate));
        }

        const offset = (params.page - 1) * params.limit;

        const entries = await db.query.journalEntry.findMany({
          where: and(...conditions),
          orderBy: desc(journalEntry.createdAt),
          limit: params.limit,
          offset,
          with: { lines: { columns: { rateExact: false }, extras: { rateExact: sql<string | null>`${journalLine.rateExact}::text`.as("rate_exact_text") } } },
        });

        const [countResult] = await db
          .select({ count: sql<number>`count(*)`.mapWith(Number) })
          .from(journalEntry)
          .where(and(...conditions));

        const result = entries.map((e) => {
          const totalDebit = journalTotalDebit(e.lines);
          return {
            id: e.id,
            entryNumber: e.entryNumber,
            date: e.date,
            description: e.description,
            reference: e.reference,
            status: e.status,
            totalDebit,
            totalDebitMinor: BigInt(totalDebit).toString(),
            createdAt: e.createdAt,
          };
        });

        return {
          entries: result,
          total: Number(countResult?.count ?? 0),
          page: params.page,
          limit: params.limit,
        };
      })
  );

  server.tool(
    "get_entry",
    "Get a single journal entry by ID with all its line items. Returns legacy safe minor-unit numbers plus debitAmountMinor/creditAmountMinor strings and saved rateExact metadata. Automated postings store base amounts; currencyCode can tag the original document. No rescaling or second conversion.",
    {
      entryId: z.string().describe("The UUID of the journal entry"),
    },
    (params) =>
      wrapTool(ctx, async () => {
        const entry = await db.query.journalEntry.findFirst({
          where: and(
            eq(journalEntry.id, params.entryId),
            eq(journalEntry.organizationId, ctx.organizationId)
          ),
          with: {
            lines: {
              columns: { rateExact: false },
              extras: { rateExact: sql<string | null>`${journalLine.rateExact}::text`.as("rate_exact_text") },
              with: { account: true },
            },
          },
        });

        if (!entry) throw new Error("Entry not found");
        assertJournalAccountScope(ctx.organizationId, entry.lines);

        return {
          entry: {
            ...entry,
            lines: entry.lines.map((l) => ({
              ...journalLineDto(l),
              account: undefined,
              id: l.id,
              accountId: l.accountId,
              accountCode: l.account?.code ?? "",
              accountName: l.account?.name ?? "",
              description: l.description,
              debitAmount: l.debitAmount,
              creditAmount: l.creditAmount,
              currencyCode: l.currencyCode,
              exchangeRate: l.exchangeRate,
            })),
          },
        };
      })
  );

  server.tool(
    "create_entry",
    "Create a new journal entry. Raw stored total debits must equal total credits. Use legacy minor-unit numbers (USD 1250 = $12.50) or debitAmountMinor/creditAmountMinor canonical strings; dual aliases must agree. rateExact must fit int32 millionths exactly. Sums must fit safe Number range; full int64 domain support is pending. Minimum 2 lines required. Saved FX is not applied during this tool's balance validation.",
    {
      date: z.iso.date().describe("Canonical Gregorian entry date (YYYY-MM-DD)"),
      description: z.string().describe("Entry description/memo"),
      reference: z
        .string()
        .optional()
        .describe("External reference number"),
      autoReverseDate: z
        .iso.date()
        .optional()
        .describe(
          "Optional auto-reverse date (YYYY-MM-DD). If set, a scheduled job posts a mirror reversing entry on this date (for accruals/prepayments). Must be on or after the entry date."
        ),
      lines: z
        .array(
          journalLineSchema
        )
        .min(2)
        .describe("Journal lines (min 2)"),
    },
    (params) =>
      wrapTool(ctx, async () => {
        requireRole(ctx, "create:entries");
        const lines = params.lines.map(journalLineInput);
        journalTotals(lines);
        await assertJournalReferences(ctx.organizationId, lines);

        await assertNotLocked(ctx.organizationId, params.date);
        await checkMonthlyLimit(ctx.organizationId, journalEntry, journalEntry.organizationId, journalEntry.createdAt, "entriesPerMonth");

        if (params.autoReverseDate && params.autoReverseDate < params.date) {
          throw new Error(
            "Auto-reverse date must be on or after the entry date"
          );
        }

        const [maxResult] = await db
          .select({
            max: sql<number>`coalesce(max(${journalEntry.entryNumber}), 0)`,
          })
          .from(journalEntry)
          .where(eq(journalEntry.organizationId, ctx.organizationId));

        const entryNumber = (maxResult?.max || 0) + 1;

        const entry = await db.transaction(async (tx) => {
          const [entry] = await tx
            .insert(journalEntry)
            .values({
              organizationId: ctx.organizationId,
              entryNumber,
              date: params.date,
              description: params.description,
              reference: params.reference ?? null,
              autoReverseDate: params.autoReverseDate ?? null,
              createdBy: ctx.userId,
            })
            .returning();

          await tx.insert(journalLine).values(
            lines.map((l) => ({
              journalEntryId: entry.id,
              accountId: l.accountId,
              description: l.description ?? null,
              debitAmount: l.debitAmount,
              creditAmount: l.creditAmount,
              currencyCode: l.currencyCode ?? "USD",
              exchangeRate: l.exchangeRate,
              rateExact: l.rateExact,
              rateDirection: l.rateDirection,
              costCenterId: l.costCenterId ?? null,
              projectId: l.projectId ?? null,
            }))
          );

          return entry;
        });
        await logAudit({ ctx, action: "create", entityType: "journal_entry", entityId: entry.id });

        return { entry };
      })
  );

  server.tool(
    "post_entry",
    "Post an organization-owned draft journal. Checks permission, saved money/rate ranges, active dimensions and period locks before the atomic status change. Returns the posted header; no money input.",
    { entryId: z.string().uuid().describe("Draft entry UUID") },
    params => wrapTool(ctx, async () => ({ entry: (await postJournal(ctx, params.entryId)).entry }))
  );

  server.tool(
    "void_entry",
    "Reverse an organization-owned posted journal at its original date. Swaps stored minor-unit amounts without FX conversion; saved FX must be qualified. Locks and already-reversed entries are rejected. Returns original UUID and reversal header.",
    { entryId: z.string().uuid().describe("Posted entry UUID"), reason: z.string().min(1).describe("Reason for reversal") },
    params => wrapTool(ctx, async () => {
      const result = await voidJournal(ctx, params.entryId, params.reason);
      return { reversedEntry: result.reversedEntry, reversalEntry: result.reversalEntry };
    })
  );

  server.tool(
    "update_entry",
    "Edit a DRAFT journal entry — full header + line replace. Posted entries cannot be edited (void and re-create instead). Total debits must equal total credits. Use minor-unit numeric or canonical debitAmountMinor/creditAmountMinor aliases; dual aliases must agree, rateExact must fit int32 millionths and sums must fit safe Number range. Fails if the entry's old or new date is in a locked period.",
    {
      entryId: z.string().describe("The UUID of the draft entry to edit"),
      date: z.iso.date().describe("Canonical Gregorian entry date (YYYY-MM-DD)"),
      description: z.string().describe("Entry description/memo"),
      reference: z
        .string()
        .optional()
        .describe("External reference number"),
      lines: z
        .array(
          journalLineSchema
        )
        .min(2)
        .describe("Replacement journal lines (min 2)"),
    },
    (params) =>
      wrapTool(ctx, async () => {
        requireRole(ctx, "edit:entries");
        const lines = params.lines.map(journalLineInput);
        journalTotals(lines, false);
        await assertJournalReferences(ctx.organizationId, lines);

        const existing = await db.query.journalEntry.findFirst({
          where: and(
            eq(journalEntry.id, params.entryId),
            eq(journalEntry.organizationId, ctx.organizationId)
          ),
        });

        if (!existing) throw new Error("Entry not found");
        if (existing.status !== "draft") {
          throw new Error(
            "Only draft entries can be edited. Void the posted entry and create a new one to make changes."
          );
        }

        await assertNotLocked(ctx.organizationId, existing.date);
        if (params.date !== existing.date) {
          await assertNotLocked(ctx.organizationId, params.date);
        }

        const updated = await db.transaction(async (tx) => {
          const [entry] = await tx
            .update(journalEntry)
            .set({
              date: params.date,
              description: params.description,
              reference: params.reference ?? null,
              updatedAt: new Date(),
            })
            .where(and(eq(journalEntry.id, params.entryId), eq(journalEntry.organizationId, ctx.organizationId), eq(journalEntry.status, "draft")))
            .returning();
          if (!entry) throw new AuthError("Entry changed before edit", 409);

          await tx
            .delete(journalLine)
            .where(eq(journalLine.journalEntryId, params.entryId));
          await tx.insert(journalLine).values(
            lines.map((l) => ({
              journalEntryId: params.entryId,
              accountId: l.accountId,
              description: l.description ?? null,
              debitAmount: l.debitAmount,
              creditAmount: l.creditAmount,
              currencyCode: l.currencyCode ?? "USD",
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
          entityId: params.entryId,
          changes: {
            diff: {
              date:
                existing.date !== params.date
                  ? { from: existing.date, to: params.date }
                  : undefined,
              description:
                existing.description !== params.description
                  ? { from: existing.description, to: params.description }
                  : undefined,
              lines: { replaced: lines.length },
            },
          },
        });

        return { entry: updated };
      })
  );

  server.tool(
    "delete_entry",
    "Delete an organization-owned DRAFT journal entry and its legs. Requires edit:entries and an unlocked period; posted entries cannot be deleted. Returns success=true, with no monetary input/output.",
    { entryId: z.string().uuid().describe("UUID of the draft journal entry to delete") },
    (params) => wrapTool(ctx, async () => deleteDraftJournal(ctx, params.entryId))
  );

  server.tool(
    "set_auto_reverse_date",
    "Set or clear a journal auto-reverse date. Requires edit:entries, original and target unlocked dates, and an unreversed entry. Returns the updated header, with no monetary input/output.",
    { entryId: z.string().uuid().describe("Journal entry UUID"),
      autoReverseDate: z.iso.date().nullable().describe("Canonical Gregorian YYYY-MM-DD on/after entry date; null clears") },
    params => wrapTool(ctx, async () => setJournalAutoReverseDate(ctx, params.entryId, params.autoReverseDate))
  );

  server.tool(
    "recode_entries",
    "Reclassify organization-owned journal line dimensions with an atomic update. Drafts only by default; draftOnly=false explicitly includes posted entries. Validates scoped target dimensions and period locks. Money and rates are unchanged; returns counts and changed line UUIDs.",
    recodeFields,
    params => wrapTool(ctx, async () => {
      const result = await recodeJournals(ctx, params);
      return { recoded: result.recoded, entriesAffected: result.entriesAffected };
    })
  );
}
