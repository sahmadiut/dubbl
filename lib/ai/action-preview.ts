import { createHash } from "node:crypto";
import { and, asc, eq, getTableColumns, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { approvalRequest, approvalWorkflow, journalEntry, journalLine, chartAccount } from "@/lib/db/schema";
import { AuthError, type AuthContext } from "@/lib/api/auth-context";
import { authorizeExecution, executionIdentity } from "@/lib/api/execution-identity";
import { requireRole } from "@/lib/api/require-role";
import { assertNotLocked, PeriodLockedError } from "@/lib/api/period-lock";
import { assertJournalReferences } from "@/lib/api/journal-references";
import { currencyMetadata } from "@/lib/money/exact";
import { journalLineDto } from "@/lib/api/journal-wire";
import { WireCompatibilityError } from "@/lib/money/wire";

export const journalPostPreviewSchema = z.object({
  entryId: z.string().uuid().describe("Existing organization-owned manual draft journal UUID. This read never posts or approves it."),
  expectedResourceVersion: z.string().regex(/^[a-f0-9]{64}$/).optional().describe("Optional fingerprint from a previous preview; changed headers, lines or displayed approval status return PREVIEW_STALE. Omit to refresh."),
}).strict();

type UnavailableCode = "PREVIEW_DENIED" | "PREVIEW_NOT_FOUND" | "PREVIEW_STALE" | "PREVIEW_UNSUPPORTED" | "PREVIEW_TOO_LARGE" | "PREVIEW_INVALID_RECORD" | "PREVIEW_PERIOD_LOCKED";
function unavailable(code: UnavailableCode) {
  return { code, preview: null, recovery: code === "PREVIEW_DENIED" ? ["contact_administrator"] : code === "PREVIEW_STALE" ? ["refresh_preview"] : ["inspect_record"] };
}
async function actor(ctx: AuthContext) {
  const current = await authorizeExecution(executionIdentity(ctx), ctx.organizationId, "use:ai");
  requireRole(current, "view:data");
  requireRole(current, "post:entries");
  return current;
}

/** Observation only. The fingerprint is not a signed capability or approval.
 * Durable proposals, decisions and dispatch belong to later AI-008 children.
 * Restrict the first adapter to manual drafts, whose saved currency tags own
 * their amounts. Other sources must receive separate reviewed adapters.
 */
export async function previewJournalPost(ctx: AuthContext, input: unknown) {
  const value = journalPostPreviewSchema.parse(input);
  let current: AuthContext;
  try { current = await actor(ctx); }
  catch (err) { if (err instanceof AuthError) return unavailable("PREVIEW_DENIED"); throw err; }
  const result = await db.transaction(async tx => {
    const [entry] = await tx.select().from(journalEntry).where(and(eq(journalEntry.id, value.entryId), eq(journalEntry.organizationId, current.organizationId), isNull(journalEntry.deletedAt)));
    if (!entry) return unavailable("PREVIEW_NOT_FOUND");
    if (entry.status !== "draft" || (entry.sourceType !== null && entry.sourceType !== "manual") || entry.sourceId || entry.reversesEntryId || entry.reversedByEntryId) return unavailable("PREVIEW_UNSUPPORTED");
    const lines = await tx.select({ ...getTableColumns(journalLine),
      debitAmount: sql<string>`${journalLine.debitAmount}::text`, creditAmount: sql<string>`${journalLine.creditAmount}::text`, rateExact: sql<string | null>`${journalLine.rateExact}::text`,
    }).from(journalLine).where(eq(journalLine.journalEntryId, entry.id)).orderBy(asc(journalLine.id)).limit(101);
    if (lines.length > 100 || [entry.description, entry.reference].some(t => t !== null && t.length > 2000) || lines.some(l => (l.description?.length ?? 0) > 2000)) return unavailable("PREVIEW_TOO_LARGE");
    if (lines.length < 2) return unavailable("PREVIEW_INVALID_RECORD");
    try {
      await assertJournalReferences(current.organizationId, lines, entry.fiscalYearId, false, tx);
      await assertNotLocked(current.organizationId, entry.date, current, tx);
    } catch (err) {
      if (err instanceof PeriodLockedError) return unavailable("PREVIEW_PERIOD_LOCKED");
      if (err instanceof z.ZodError) return unavailable("PREVIEW_INVALID_RECORD");
      throw err;
    }
    const accounts = await tx.select({ id: chartAccount.id, code: chartAccount.code, name: chartAccount.name }).from(chartAccount)
      .where(and(eq(chartAccount.organizationId, current.organizationId), inArray(chartAccount.id, lines.map(l => l.accountId)), eq(chartAccount.isActive, true), isNull(chartAccount.deletedAt))).orderBy(asc(chartAccount.id));
    const accountMap = new Map(accounts.map(a => [a.id, a]));
    const totals = new Map<string, { debit: bigint; credit: bigint }>();
    for (const line of lines) {
      // The posting domain currently has a safe-number compatibility ceiling.
      // Never round SQL bigint values to make an unsupported action look ready.
      if (![line.debitAmount, line.creditAmount].every(n => /^(0|[1-9][0-9]*)$/.test(n) && BigInt(n) <= BigInt(Number.MAX_SAFE_INTEGER))) return unavailable("PREVIEW_INVALID_RECORD");
      try {
        if (currencyMetadata(line.currencyCode).code !== line.currencyCode) return unavailable("PREVIEW_INVALID_RECORD");
        journalLineDto({ ...line, debitAmount: Number(line.debitAmount), creditAmount: Number(line.creditAmount) });
      } catch (err) {
        if (err instanceof RangeError || err instanceof WireCompatibilityError) return unavailable("PREVIEW_INVALID_RECORD");
        throw err;
      }
      const account = accountMap.get(line.accountId);
      if (!account || account.code.length > 200 || account.name.length > 500) return unavailable("PREVIEW_INVALID_RECORD");
      const total = totals.get(line.currencyCode) ?? { debit: 0n, credit: 0n };
      total.debit += BigInt(line.debitAmount); total.credit += BigInt(line.creditAmount);
      totals.set(line.currencyCode, total);
    }
    // Separate currencies, with no inferred FX or economically mixed total.
    const rawWorkflowSum = [...totals.values()].reduce((sum, t) => sum + t.debit, 0n);
    if ([...totals.values()].some(t => t.debit !== t.credit) || rawWorkflowSum === 0n || rawWorkflowSum > BigInt(Number.MAX_SAFE_INTEGER)) return unavailable("PREVIEW_INVALID_RECORD");
    const [workflow] = await tx.select({ id: approvalWorkflow.id }).from(approvalWorkflow).where(and(eq(approvalWorkflow.organizationId, current.organizationId), eq(approvalWorkflow.entityType, "journal_entry"), eq(approvalWorkflow.isActive, true), isNull(approvalWorkflow.deletedAt))).limit(1);
    const [request] = await tx.select({ id: approvalRequest.id, status: approvalRequest.status, updatedAt: approvalRequest.updatedAt }).from(approvalRequest)
      .where(and(eq(approvalRequest.organizationId, current.organizationId), eq(approvalRequest.entityType, "journal_entry"), eq(approvalRequest.entityId, entry.id)))
      .orderBy(sql`${approvalRequest.createdAt} desc`, asc(approvalRequest.id)).limit(1);
    // A saved business approval is not an AI action approval. This adapter
    // reports status only; it never evaluates/waives workflow conditions.
    const businessApproval = { evaluation: "not_evaluated" as const, activeWorkflowPresent: !!workflow, latestRequestStatus: request?.status ?? null };
    const displayedLines = lines.map(l => ({ id: l.id, account: accountMap.get(l.accountId)!, description: l.description,
      debitAmountMinor: l.debitAmount, creditAmountMinor: l.creditAmount, currencyCode: l.currencyCode,
      costCenterId: l.costCenterId, projectId: l.projectId, exchangeRate: l.exchangeRate, rateExact: l.rateExact, rateDirection: l.rateDirection }));
    const resourceVersion = createHash("sha256").update(JSON.stringify({ schemaVersion: 1, actor: current.userId, organization: current.organizationId,
      action: "post_entry", arguments: { entryId: entry.id }, entry, lines, displayedLines, businessApproval, request })).digest("hex");
    if (value.expectedResourceVersion && value.expectedResourceVersion !== resourceVersion) return unavailable("PREVIEW_STALE");
    const observedAt = new Date();
    const preview = { schemaVersion: 1, action: "post_entry", labelKey: "post_journal", target: { type: "journal_entry", id: entry.id, reference: String(entry.entryNumber), href: `/accounting/${entry.id}` },
      resourceVersion, observedAt: observedAt.toISOString(), expiresAt: new Date(observedAt.getTime() + 300_000).toISOString(),
      before: { status: "draft" }, after: { status: "posted" }, date: entry.date, description: entry.description, reference: entry.reference,
      lines: displayedLines, amounts: [...totals].sort(([a], [b]) => a.localeCompare(b)).map(([currencyCode, t]) => ({ currencyCode, debitAmountMinor: String(t.debit), creditAmountMinor: String(t.credit) })),
      recipients: [], effects: ["posts_journal", "posted_history_requires_reversal", ...(entry.autoReverseDate ? ["scheduled_reversal"] : [])], autoReverseDate: entry.autoReverseDate,
      businessApproval, authority: "preview_only", canApprove: false, recovery: ["inspect_record", "refresh_preview"] };
    if (Buffer.byteLength(JSON.stringify(preview), "utf8") > 32768) return unavailable("PREVIEW_TOO_LARGE");
    return { code: "PREVIEW_ONLY", preview, recovery: ["inspect_record", "refresh_preview"] };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
  // Revoke disclosure if the current credential or grants changed during reads.
  try { await actor(ctx); }
  catch (err) { if (err instanceof AuthError) return unavailable("PREVIEW_DENIED"); throw err; }
  return result;
}
