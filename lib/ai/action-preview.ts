import { createHash } from "node:crypto";
import { and, asc, eq, getTableColumns, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { is } from "drizzle-orm";
import { PgTable, getTableConfig } from "drizzle-orm/pg-core";
import { assertDraftJournalDeletion } from "@/lib/api/journal-delete";
import { journalEntry, journalLine, chartAccount } from "@/lib/db/schema";
import { AuthError, type AuthContext } from "@/lib/api/auth-context";
import { authorizeExecution, executionIdentity } from "@/lib/api/execution-identity";
import { requireRole } from "@/lib/api/require-role";
import { assertNotLocked, PeriodLockedError } from "@/lib/api/period-lock";
import { assertJournalReferences } from "@/lib/api/journal-references";
import { currencyMetadata } from "@/lib/money/exact";
import { journalLineDto } from "@/lib/api/journal-wire";
import { WireCompatibilityError } from "@/lib/money/wire";
import { previewJournalBusinessPolicy, PreviewPolicyError } from "./business-policy-preview";

export const JOURNAL_POST_ADAPTER_VERSION = 2;

export const journalPostPreviewSchema = z.object({
  entryId: z.string().uuid().describe("Existing organization-owned manual draft journal UUID. This read never posts or approves it."),
  expectedResourceVersion: z.string().regex(/^[a-f0-9]{64}$/).optional().describe("Optional prior fingerprint; changed resources, business policy or approval metadata return PREVIEW_STALE. Omit to refresh; never an approval token."),
}).strict();

type UnavailableCode = "PREVIEW_DENIED" | "PREVIEW_NOT_FOUND" | "PREVIEW_STALE" | "PREVIEW_UNSUPPORTED" | "PREVIEW_TOO_LARGE" | "PREVIEW_INVALID_RECORD" | "PREVIEW_PERIOD_LOCKED" | "PREVIEW_POLICY_INVALID";
function unavailable(code: UnavailableCode) {
  return { code, preview: null, recovery: code === "PREVIEW_DENIED" || code === "PREVIEW_POLICY_INVALID" ? ["contact_administrator"] : code === "PREVIEW_STALE" ? ["refresh_preview"] : ["inspect_record"] };
}
async function actor(ctx: AuthContext, action: "post_entry" | "delete_draft_journal") {
  const current = await authorizeExecution(executionIdentity(ctx), ctx.organizationId, "use:ai");
  requireRole(current, "view:data");
  requireRole(current, action === "post_entry" ? "post:entries" : "edit:entries");
  return current;
}

/** Observation only. The fingerprint is not a signed capability or approval.
 * Durable proposals, decisions and dispatch belong to later AI-008 children.
 * Restrict the first adapter to manual drafts, whose saved currency tags own
 * their amounts. Other sources must receive separate reviewed adapters.
 */
export function previewJournalPost(ctx: AuthContext, input: unknown) { return previewJournal(ctx, input, "post_entry"); }
export function previewJournalDelete(ctx: AuthContext, input: unknown) { return previewJournal(ctx, input, "delete_draft_journal"); }

async function previewJournal(ctx: AuthContext, input: unknown, action: "post_entry" | "delete_draft_journal") {
  const value = journalPostPreviewSchema.parse(input);
  let current: AuthContext;
  try { current = await actor(ctx, action); }
  catch (err) { if (err instanceof AuthError) return unavailable("PREVIEW_DENIED"); throw err; }
  const result = await db.transaction(async tx => {
    const [entry] = await tx.select().from(journalEntry).where(and(eq(journalEntry.id, value.entryId), eq(journalEntry.organizationId, current.organizationId), isNull(journalEntry.deletedAt)));
    if (!entry) return unavailable("PREVIEW_NOT_FOUND");
    if (entry.status !== "draft" || (entry.sourceType !== null && entry.sourceType !== "manual") || entry.sourceId || entry.reversesEntryId || entry.reversedByEntryId) return unavailable("PREVIEW_UNSUPPORTED");
    if (action === "delete_draft_journal") {
      for (const table of Object.values(schema)) {
        if (!is(table, PgTable) || table === journalLine) continue;
        for (const key of getTableConfig(table).foreignKeys) {
          const reference = key.reference();
          if (reference.foreignTable !== journalEntry) continue;
          const [linked] = await tx.select({ exists: sql<number>`1` }).from(table).where(eq(reference.columns[0], entry.id)).limit(1);
          if (linked) return unavailable("PREVIEW_UNSUPPORTED");
        }
      }
      const [reversal] = await tx.select({ id: journalEntry.id }).from(journalEntry).where(sql`${journalEntry.reversesEntryId} = ${entry.id} or ${journalEntry.reversedByEntryId} = ${entry.id}`).limit(1);
      if (reversal) return unavailable("PREVIEW_UNSUPPORTED");
    }
    const lines = await tx.select({ ...getTableColumns(journalLine),
      debitAmount: sql<string>`${journalLine.debitAmount}::text`, creditAmount: sql<string>`${journalLine.creditAmount}::text`, rateExact: sql<string | null>`${journalLine.rateExact}::text`,
    }).from(journalLine).where(eq(journalLine.journalEntryId, entry.id)).orderBy(asc(journalLine.id)).limit(101);
    if (lines.length > 100 || [entry.description, entry.reference].some(t => t !== null && t.length > 2000) || lines.some(l => (l.description?.length ?? 0) > 2000)) return unavailable("PREVIEW_TOO_LARGE");
    if (lines.length < 2) return unavailable("PREVIEW_INVALID_RECORD");
    try {
      await assertJournalReferences(current.organizationId, lines, entry.fiscalYearId, false, tx);
      if (action === "delete_draft_journal") await assertDraftJournalDeletion(current, entry, tx);
      else await assertNotLocked(current.organizationId, entry.date, current, tx);
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
    let businessApproval: Awaited<ReturnType<typeof previewJournalBusinessPolicy>>;
    try { businessApproval = await previewJournalBusinessPolicy(tx, current, entry); }
    catch (err) { if (err instanceof PreviewPolicyError) return unavailable(err.code); throw err; }
    const displayedLines = lines.map(l => ({ id: l.id, account: accountMap.get(l.accountId)!, description: l.description,
      debitAmountMinor: l.debitAmount, creditAmountMinor: l.creditAmount, currencyCode: l.currencyCode,
      costCenterId: l.costCenterId, projectId: l.projectId, exchangeRate: l.exchangeRate, rateExact: l.rateExact, rateDirection: l.rateDirection }));
    const resourceVersion = createHash("sha256").update(JSON.stringify({ schemaVersion: JOURNAL_POST_ADAPTER_VERSION, actor: current.userId, organization: current.organizationId,
      action, arguments: { entryId: entry.id }, entry, lines, displayedLines, businessApproval })).digest("hex");
    if (value.expectedResourceVersion && value.expectedResourceVersion !== resourceVersion) return unavailable("PREVIEW_STALE");
    const observedAt = new Date();
    const preview = { schemaVersion: JOURNAL_POST_ADAPTER_VERSION, action, labelKey: action === "post_entry" ? "post_journal" : "delete_draft_journal", target: { type: "journal_entry", id: entry.id, reference: String(entry.entryNumber), href: `/accounting/${entry.id}` },
      resourceVersion, observedAt: observedAt.toISOString(), expiresAt: new Date(observedAt.getTime() + 300_000).toISOString(),
      before: { status: "draft" }, after: { status: action === "post_entry" ? "posted" : "deleted" }, date: entry.date, description: entry.description, reference: entry.reference,
      lines: displayedLines, amounts: [...totals].sort(([a], [b]) => a.localeCompare(b)).map(([currencyCode, t]) => ({ currencyCode, debitAmountMinor: String(t.debit), creditAmountMinor: String(t.credit) })),
      recipients: [], effects: action === "post_entry" ? ["posts_journal", "posted_history_requires_reversal", ...(entry.autoReverseDate ? ["scheduled_reversal"] : [])] : ["permanently_deletes_draft_journal", "permanently_deletes_all_journal_lines", "cannot_undo_deletion"], autoReverseDate: entry.autoReverseDate,
      businessApproval, authority: "preview_only", canApprove: false, recovery: ["inspect_record", "refresh_preview"] };
    if (Buffer.byteLength(JSON.stringify(preview), "utf8") > 32768) return unavailable("PREVIEW_TOO_LARGE");
    return { code: "PREVIEW_ONLY", preview, recovery: ["inspect_record", "refresh_preview"] };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
  // Revoke disclosure if the current credential or grants changed during reads.
  try { await actor(ctx, action); }
  catch (err) { if (err instanceof AuthError) return unavailable("PREVIEW_DENIED"); throw err; }
  return result;
}
