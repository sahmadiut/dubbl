import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AuthContext } from "@/lib/api/auth-context";
import { wrapTool } from "@/lib/mcp/errors";
import { journalPostPreviewSchema, previewJournalPost } from "@/lib/ai/action-preview";

export function registerAiActionPreviewTools(server: McpServer, ctx: AuthContext) {
  server.registerTool("preview_ai_journal_post", {
    description: "Read a business preview for an existing organization-owned manual draft journal UUID under live use:ai, view:data and post:entries permissions. Returns before/after status, account lines, exact minor-unit strings grouped by currency (USD cents), scheduled reversal, business approval observation, resource fingerprint and five-minute display expiry. Optional expectedResourceVersion detects stale content; omit to refresh. PREVIEW_ONLY never approves, posts, queues or changes a record. Approval workflow conditions are not evaluated. Unsupported sources/invalid/oversized records fail closed. Not available to the ordinary chat model.",
    inputSchema: journalPostPreviewSchema,
  }, input => wrapTool(ctx, () => previewJournalPost(ctx, input)));
}
