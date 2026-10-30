import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AuthContext } from "@/lib/api/auth-context";
import { wrapTool } from "@/lib/mcp/errors";
import { journalPostPreviewSchema, previewJournalPost } from "@/lib/ai/action-preview";
import { getActionBatch, getActionBatchSchema, reviseActionBatch, reviseActionBatchSchema } from "@/lib/ai/action-batches";

export function registerAiActionPreviewTools(server: McpServer, ctx: AuthContext) {
  server.registerTool("get_ai_action_batch", {
    description: "Read the complete current own-run journal proposal under live history, AI, domain and resource/business-policy checks. Input runId UUID. Returns version, fixed expiry, selection/dependencies, step references, evaluated policy requirements and every effect with exact per-currency minor strings (USD cents), or a finite unavailable/stale/expired code. Legacy approval status never authorizes revised resources or self-approval. Works with runtime disabled; reads never refresh expiry, approve, queue or execute. No raw execution arguments or model approval authority. Not model-callable.",
    inputSchema: getActionBatchSchema,
  }, input => wrapTool(ctx, () => getActionBatch(ctx, input)));
  server.registerTool("revise_ai_action_batch", {
    description: "Explicitly replace an own pending journal proposal's complete items, selection and dependencies using exact batch/run versions and an idempotency key. Regenerates current resource/business-policy snapshots under live permission/configuration; invalidates prior preview/steps without extending original expiry/deadline or granting approval. Returns a stable metadata receipt; retry identical input after a lost response, then get_ai_action_batch. Never approves, queues or executes. Arguments contain existing journal UUIDs, no amount input; selected totals use exact currency minor strings (USD cents). Initial creation is trusted-worker-only; not model-callable.",
    inputSchema: reviseActionBatchSchema,
  }, input => wrapTool(ctx, () => reviseActionBatch(ctx, input)));
  server.registerTool("preview_ai_journal_post", {
    description: "Read a business preview for an existing organization-owned manual draft journal UUID under live use:ai, view:data and post:entries permissions. Returns before/after status, complete account lines, exact per-currency minor strings (USD cents), dates/FX/reversal effects, evaluated current business-policy requirement and identity-free next actors, policy/resource fingerprints and five-minute expiry. Legacy approval status never satisfies resource-bound approval or authorizes self-approval. Optional expectedResourceVersion detects stale resources/policy/approval metadata; omit to refresh. PREVIEW_ONLY never approves, posts, queues or changes a record. Invalid/ambiguous/oversized policy fails closed. Not available to the ordinary chat model.",
    inputSchema: journalPostPreviewSchema,
  }, input => wrapTool(ctx, () => previewJournalPost(ctx, input)));
}
