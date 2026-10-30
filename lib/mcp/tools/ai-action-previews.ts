import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AuthContext } from "@/lib/api/auth-context";
import { wrapTool } from "@/lib/mcp/errors";
import { journalPostPreviewSchema, previewJournalPost, previewJournalDelete } from "@/lib/ai/action-preview";
import { getActionBatch, getActionBatchSchema, reviseActionBatch, reviseActionBatchSchema } from "@/lib/ai/action-batches";
import { actionDecisionSchema, approveActionBatch, rejectActionBatch } from "@/lib/ai/action-batches";

import { settlementPreviewSchema, previewSettlement, emailActionPreviewSchema, previewInvoiceEmail } from "@/lib/ai/action-adapters";

export function registerAiActionPreviewTools(server: McpServer, ctx: AuthContext) {
  server.registerTool("approve_ai_action_batch", {
    description: "Record explicit approval of one own exact persisted batch selection using batch/run versions, bindingDigest, selected item UUIDs and a unique requestKey. Returns a stable content-free decision receipt after current domain/resource/policy/expiry checks; amounts/arguments cannot be changed. Requires a live interactive user session: MCP tokens/API keys return DECISION_INTERACTION_REQUIRED and must open interactive approval. Existing business approval requirements cannot be satisfied by this operation. Never queues, executes, grants blanket permission or accepts model/clarification confirmation. Not model-callable.",
    inputSchema: actionDecisionSchema,
  }, input => wrapTool(ctx, () => approveActionBatch(ctx, input)));
  server.registerTool("reject_ai_action_batch", {
    description: "Explicitly reject one own entire persisted batch using exact batch/run versions, bindingDigest, complete selected item UUIDs and a unique requestKey. Returns a stable decision receipt; atomically cancels remaining prepared actions including dependents and erases proposal content, preserving completed effects. Current credential/history/domain access and current resource/policy/expiry apply; use cancel_ai_run for stale or expired proposals. Works with runtime disabled. No execution, rollback or approval authority; not model-callable.",
    inputSchema: actionDecisionSchema,
  }, input => wrapTool(ctx, () => rejectActionBatch(ctx, input)));
  server.registerTool("preview_ai_journal_delete", {
    description: "Read a permanent manual-draft journal deletion preview under current use:ai, view:data and edit:entries. Strict entryId UUID and optional expectedResourceVersion only. Requires a qualified balanced, unlinked draft; rejects document/reversal/attachment references and locked periods. Returns complete lines, separate exact currency minor strings (USD cents), deletion/cascade effects, current business policy and identity-free blockers. PREVIEW_ONLY never deletes, approves, queues or executes; not model-callable.",
    inputSchema: journalPostPreviewSchema,
  }, input => wrapTool(ctx, () => previewJournalDelete(ctx, input)));
  server.registerTool("preview_ai_settlement", {
    description: "Read one invoice received-cash or bill made-cash settlement preview under live use:ai, view:data and manage:payments. Strict documentType/documentId, positive exact document-currency amountMinor string (USD cents, IRR rials, safe-number ceiling), Gregorian cash date, method, optional existing linked bank UUID/reference and prior fingerprint. Returns before/after outstanding amounts, separate cash/base amounts, exact FX/provenance, balanced GL lines, current business policy and irreversible effects. Requires qualified recognition/history and existing bank/FX ledger accounts; never creates accounts, payments or approvals or dispatches cash. Not model-callable.",
    inputSchema: settlementPreviewSchema,
  }, input => wrapTool(ctx, () => previewSettlement(ctx, input)));
  server.registerTool("preview_ai_invoice_email", {
    description: "Read one invoice-summary email preview under live use:ai, view:data and manage:invoices. Strict documentId UUID and optional prior fingerprint; content, subject, exact document-currency minor strings (USD cents), dates and single recipient derive from current domain document/saved contact. No overrides, attachments, links, custom messages or recipient input. Returns complete proposed content, recipient/reply-to, current business policy and irrevocable disclosure effects; rejects unsafe or disagreeing saved mailboxes. Never renders/delivers externally, logs delivery, approves or queues. Not model-callable.",
    inputSchema: emailActionPreviewSchema,
  }, input => wrapTool(ctx, () => previewInvoiceEmail(ctx, input)));
  server.registerTool("get_ai_action_batch", {
    description: "Read the complete current own-run finite journal/settlement/invoice-email proposal under live history, AI, domain and resource/business-policy checks. Input runId UUID. Returns version, fixed expiry, selection/dependencies, step references, evaluated policy requirements and every effect with exact per-currency minor strings (USD cents), or a finite unavailable/stale/expired code. Legacy approval status never authorizes revised resources or self-approval. Works with runtime disabled; reads never refresh expiry, approve, queue or execute. No raw execution arguments or model approval authority. Not model-callable.",
    inputSchema: getActionBatchSchema,
  }, input => wrapTool(ctx, () => getActionBatch(ctx, input)));
  server.registerTool("revise_ai_action_batch", {
    description: "Explicitly replace an own pending finite journal/settlement/invoice-email proposal's complete items, selection and dependencies using exact batch/run versions and an idempotency key. Regenerates current resource/business-policy snapshots under live permission/configuration; invalidates prior preview/steps without extending original expiry/deadline or granting approval. Returns a stable metadata receipt; retry identical input after a lost response, then get_ai_action_batch. Never approves, queues or executes. Arguments are strict per action: journal UUIDs, exact document-currency amountMinor strings within safe-number bounds for settlement, or invoice UUID for derived recipient/content email; selected totals use exact currency minor strings (USD cents). Initial creation is trusted-worker-only; not model-callable.",
    inputSchema: reviseActionBatchSchema,
  }, input => wrapTool(ctx, () => reviseActionBatch(ctx, input)));
  server.registerTool("preview_ai_journal_post", {
    description: "Read a business preview for an existing organization-owned manual draft journal UUID under live use:ai, view:data and post:entries permissions. Returns before/after status, complete account lines, exact per-currency minor strings (USD cents), dates/FX/reversal effects, evaluated current business-policy requirement and identity-free next actors, policy/resource fingerprints and five-minute expiry. Legacy approval status never satisfies resource-bound approval or authorizes self-approval. Optional expectedResourceVersion detects stale resources/policy/approval metadata; omit to refresh. PREVIEW_ONLY never approves, posts, queues or changes a record. Invalid/ambiguous/oversized policy fails closed. Not available to the ordinary chat model.",
    inputSchema: journalPostPreviewSchema,
  }, input => wrapTool(ctx, () => previewJournalPost(ctx, input)));
}
