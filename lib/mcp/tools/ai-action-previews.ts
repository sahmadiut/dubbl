import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AuthContext } from "@/lib/api/auth-context";
import { wrapTool } from "@/lib/mcp/errors";
import { journalPostPreviewSchema, previewJournalPost } from "@/lib/ai/action-preview";
import { getActionBatch, getActionBatchSchema, reviseActionBatch, reviseActionBatchSchema } from "@/lib/ai/action-batches";

export function registerAiActionPreviewTools(server: McpServer, ctx: AuthContext) {
  server.registerTool("get_ai_action_batch", {
    description: "Read the complete current own-run journal action proposal with live history, AI and domain permissions and resource checks. Input runId UUID. Returns version, fixed expiry, selection/dependencies, step references and every proposed business effect with exact per-currency minor-unit strings (USD cents), or a finite unavailable/stale/expired code. Works with runtime disabled; reads never refresh expiry, approve, queue or execute. No raw execution arguments or model approval authority. Not model-callable.",
    inputSchema: getActionBatchSchema,
  }, input => wrapTool(ctx, () => getActionBatch(ctx, input)));
  server.registerTool("revise_ai_action_batch", {
    description: "Explicitly replace an own pending journal proposal's complete items, selection and dependencies using exact batch/run versions and an idempotency key. Validates current resources and permission/configuration; invalidates prior preview/steps without extending original expiry/deadline. Returns a stable metadata receipt; retry identical input after a lost response, then get_ai_action_batch. Never approves, queues or executes. Arguments contain existing journal UUIDs, no amount input; selected totals use exact currency minor strings (USD cents). Initial proposal creation is trusted-worker-only; this tool is not model-callable.",
    inputSchema: reviseActionBatchSchema,
  }, input => wrapTool(ctx, () => reviseActionBatch(ctx, input)));
  server.registerTool("preview_ai_journal_post", {
    description: "Read a business preview for an existing organization-owned manual draft journal UUID under live use:ai, view:data and post:entries permissions. Returns before/after status, account lines, exact minor-unit strings grouped by currency (USD cents), scheduled reversal, business approval observation, resource fingerprint and five-minute display expiry. Optional expectedResourceVersion detects stale content; omit to refresh. PREVIEW_ONLY never approves, posts, queues or changes a record. Approval workflow conditions are not evaluated. Unsupported sources/invalid/oversized records fail closed. Not available to the ordinary chat model.",
    inputSchema: journalPostPreviewSchema,
  }, input => wrapTool(ctx, () => previewJournalPost(ctx, input)));
}
