import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AuthContext } from "@/lib/api/auth-context";
import { wrapTool } from "@/lib/mcp/errors";
import { submitRunSchema, runIdSchema, eventsSchema, submitRun, getRun, cancelRun, getRunEvents } from "@/lib/ai/run-lifecycle";
import { getRunProgress, progressSchema } from "@/lib/ai/run-progress";
import { getRunInput, getRunInputSchema, answerRunInput, answerRunInputSchema } from "@/lib/ai/run-input";

export const AI_RUN_LIFECYCLE_TOOLS = new Set(["submit_ai_run", "get_ai_run", "cancel_ai_run", "get_ai_run_events", "get_ai_run_progress", "get_ai_run_input", "answer_ai_run_input"]);
export function registerAiRunTools(server: McpServer, ctx: AuthContext) {
  server.registerTool("get_ai_run_input", {
    description: "Read the own run's bounded pending clarification and live scoped record choices under current history/domain access. Returns inputId/inputVersion and runVersion to answer, or a safe unavailable code. Read works while runtime is disabled; no approval authority or money input. Not model-callable.",
    inputSchema: getRunInputSchema,
  }, input => wrapTool(ctx, () => getRunInput(ctx, input)));
  server.registerTool("answer_ai_run_input", {
    description: "Answer one own pending clarification using the exact input/run versions and an idempotency key. Atomically queues continuation under current identity/config/policy; preserves budgets, completed effects and deadlines. Returns a stable ANSWER_ACCEPTED receipt; retry never enqueues again. Text/record selection is not approval and never executes tools. Not model-callable.",
    inputSchema: answerRunInputSchema,
  }, input => wrapTool(ctx, () => answerRunInput(ctx, input)));
  server.registerTool("get_ai_run_progress", {
    description: "Observe own persisted run progress and ordered bounded step outcomes under live history/domain permissions. Returns safe state/recovery and final/partial outcome codes derived from receipts, plus currently scoped record links, with expense amountMinor strings in explicit currency (USD cents); never raw text, execution authority or provisional output. Use next.afterStepId and next.expectedVersion for pages; on version conflict restart from the first page. Reads/reconnect never dispatch, retry or resume work. Worker availability is unknown. Not model-callable.",
    inputSchema: progressSchema,
  }, input => wrapTool(ctx, () => getRunProgress(ctx, input)));
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
