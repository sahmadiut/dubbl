import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AuthContext } from "@/lib/api/auth-context";
import { wrapTool } from "@/lib/mcp/errors";
import { submitRunSchema, runIdSchema, eventsSchema, submitRun, getRun, cancelRun, getRunEvents } from "@/lib/ai/run-lifecycle";

export const AI_RUN_LIFECYCLE_TOOLS = new Set(["submit_ai_run", "get_ai_run", "cancel_ai_run", "get_ai_run_events"]);
export function registerAiRunTools(server: McpServer, ctx: AuthContext) {
  server.registerTool("submit_ai_run", {
    description: "Queue one own scoped request using a conversation UUID and idempotency key. Server chooses current default provider and agent policy; default-off AI_RUNTIME_ENABLED gate applies. Returns content-free run status, not executed actions. No money or identity arguments; not model-callable.",
    inputSchema: submitRunSchema,
  }, input => wrapTool(ctx, () => submitRun(ctx, input)));
  server.registerTool("get_ai_run", {
    description: "Get own run lifecycle and bounded step summaries under live view:ai-history and current domain permissions. No credentials, hidden reasoning, or worker lease tokens returned.",
    inputSchema: runIdSchema,
  }, input => wrapTool(ctx, () => getRun(ctx, input)));
  server.registerTool("cancel_ai_run", {
    description: "Request stop for an own run. Prevents new dispatch; in-flight effects remain pending or require reconciliation, never rolled back. Works while runtime is disabled. Returns content-free current status.",
    inputSchema: runIdSchema,
  }, input => wrapTool(ctx, () => cancelRun(ctx, input)));
  server.registerTool("get_ai_run_events", {
    description: "Read up to 100 own content-free persisted lifecycle events after a sequence cursor. Reconnect by passing returned next; observing events never repeats business actions. Requires view:ai-history.",
    inputSchema: eventsSchema,
  }, input => wrapTool(ctx, () => getRunEvents(ctx, input)));
}
