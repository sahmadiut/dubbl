import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AuthContext } from "@/lib/api/auth-context";
import { wrapTool } from "@/lib/mcp/errors";
import { createConversation, listConversations, getConversation, deleteConversation } from "@/lib/ai/persistence";
import { assertRuntimeEnabled } from "@/lib/ai/run-lifecycle";

export function registerAiHistoryTools(server: McpServer, ctx: AuthContext) {
  server.registerTool("create_ai_conversation", {
    description: "Create one own organization conversation under live use:ai permission and default-off runtime gate; returns opaque UUID and version. Does not invoke a provider or perform business actions. No identity or money arguments.",
    inputSchema: z.object({}).strict(),
  }, () => wrapTool(ctx, async () => { assertRuntimeEnabled(); const row = await createConversation(ctx); return { id: row.id, version: row.version }; }));
  const id = z.string().uuid().describe("Opaque conversation UUID in the current organization; ordinary history requires ownership.");
  server.registerTool("list_ai_conversations", {
    description: "List up to 100 own conversation metadata records under live view:ai-history permission. Returns {conversations}; no transcripts, credentials or money calculations.",
    inputSchema: z.object({}).strict(),
  }, () => wrapTool(ctx, async () => ({ conversations: await listConversations(ctx) })));
  server.registerTool("get_ai_conversation", {
    description: "Get own scoped conversation messages and run/step states. Returns redacted bounded payloads only while current domain permissions and retention allow; no configuration credentials or private reasoning.",
    inputSchema: z.object({ conversationId: id }).strict(),
  }, input => wrapTool(ctx, () => getConversation(ctx, input.conversationId)));
  server.registerTool("audit_ai_conversation", {
    description: "Read one organization conversation using dedicated audit:ai-transcripts permission and a recorded reason; each successful access is audited. Domain permissions still limit historical payload disclosure. Not an ordinary chat capability.",
    inputSchema: z.object({ conversationId: id, reason: z.string().trim().min(8).max(200).describe("Human audit purpose, 8-200 characters, recorded with actor and time.") }).strict(),
  }, input => wrapTool(ctx, () => getConversation(ctx, input.conversationId, input.reason)));
  server.registerTool("delete_ai_conversation", {
    description: "Tombstone and erase own conversation payloads; cancel pending runs and preserve uncertain effects as reconciliation metadata. Returns {deleted:true}; never deletes business/financial records. Requires live view:ai-history. Sensitive destructive operation, not auto-approved for chat.",
    inputSchema: z.object({ conversationId: id }).strict(),
  }, input => wrapTool(ctx, () => deleteConversation(ctx, input.conversationId)));
}
