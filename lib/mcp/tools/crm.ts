import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AuthContext } from "@/lib/api/auth-context";
import { wrapTool } from "@/lib/mcp/errors";
import { crmId, pipelineCreateSchema, pipelineUpdateSchema, dealCreateSchema, dealUpdateSchema, dealStageSchema,
  dealLostSchema, dealListSchema, activityCreateSchema, activityListSchema, crmAnalyticsSchema } from "@/lib/api/crm-wire";
import { listPipelines, getPipeline, createPipeline, updatePipeline, deletePipeline, listDeals, getDeal,
  createDeal, updateDeal, deleteDeal, moveDealStage, closeDeal, listDealActivities, addDealActivity, crmAnalytics } from "@/lib/api/crm";

const units = "Deal valueCents/valueCentsMinor retain fixed integer cents (1250 = 12.50), not FX or currency-scale conversion, safe range 0..9007199254740991. Probability is integer percent 0..100. Mutations and audits commit atomically.";
const pid = { pipelineId: crmId.describe("Live organization pipeline UUID") };
const did = { dealId: crmId.describe("Live organization deal UUID") };
export function registerCrmTools(server: McpServer, ctx: AuthContext) {
  server.registerTool("list_pipelines", { description: "List live organization pipelines and ordered stages. Returns pipelines.", inputSchema: z.object({}).strict() },
    () => wrapTool(ctx, async () => ({ pipelines: await listPipelines(ctx) })));
  server.registerTool("get_pipeline", { description: "Get owned live pipeline with live owned deals and exact cents aliases. Returns pipeline. " + units, inputSchema: z.object(pid).strict() },
    p => wrapTool(ctx, async () => ({ pipeline: await getPipeline(ctx, p.pipelineId) })));
  server.registerTool("create_pipeline", { description: "Create pipeline; requires manage:contacts. Unique stages; true default clears other defaults. Returns pipeline.", inputSchema: pipelineCreateSchema },
    p => wrapTool(ctx, async () => ({ pipeline: await createPipeline(ctx, p) })));
  server.registerTool("update_pipeline", { description: "Patch owned pipeline; requires manage:contacts. Cannot remove stages used by live deals. Returns pipeline.", inputSchema: pipelineUpdateSchema.extend(pid).strict() },
    p => { const { pipelineId, ...input } = p; return wrapTool(ctx, async () => ({ pipeline: await updatePipeline(ctx, pipelineId, input) })); });
  server.registerTool("delete_pipeline", { description: "Soft-delete empty pipeline; requires manage:contacts. Live deals prevent deletion. Returns success.", inputSchema: z.object(pid).strict() },
    p => wrapTool(ctx, () => deletePipeline(ctx, p.pipelineId)));
  server.registerTool("list_deals", { description: "List filtered paginated deals with scoped contact/public member joins. Returns deals,total,page,limit,summary. Summary ignores stage/source/status/search but honors pipeline/currency; mixed currencies require filter. " + units, inputSchema: dealListSchema },
    p => wrapTool(ctx, async () => { const r = await listDeals(ctx, p); return { deals: r.data, total: r.pagination.total, page: r.pagination.page, limit: r.pagination.limit, summary: r.summary }; }));
  server.registerTool("get_deal", { description: "Get live owned deal, contact, public assignee, pipeline and activity timeline. Returns deal. " + units, inputSchema: z.object(did).strict() },
    p => wrapTool(ctx, async () => ({ deal: await getDeal(ctx, p.dealId) })));
  server.registerTool("create_deal", { description: "Create active deal in configured live pipeline stage; contact/member must belong to organization. Supply numeric value or exact alias or matching pair, default zero/USD. Returns deal. " + units, inputSchema: dealCreateSchema },
    p => wrapTool(ctx, async () => ({ deal: await createDeal(ctx, p) })));
  server.registerTool("update_deal", { description: "Patch provided deal fields; null clears nullable fields. Does not change currency, pipeline, stage or lifecycle. Returns deal. " + units, inputSchema: dealUpdateSchema.extend(did).strict() },
    p => { const { dealId, ...input } = p; return wrapTool(ctx, async () => ({ deal: await updateDeal(ctx, dealId, input) })); });
  server.registerTool("delete_deal", { description: "Soft-delete live owned deal retaining activity history; deleted deals cannot receive activities. Returns success. " + units, inputSchema: z.object(did).strict() },
    p => wrapTool(ctx, () => deleteDeal(ctx, p.dealId)));
  server.registerTool("move_deal_stage", { description: "Move deal to configured stage; preserves lifecycle timestamps. Use mark_deal_won/lost to close. Returns deal. " + units, inputSchema: dealStageSchema.extend(did).strict() },
    p => wrapTool(ctx, async () => ({ deal: await moveDealStage(ctx, p.dealId, { stageId: p.stageId }) })));
  server.registerTool("mark_deal_won", { description: "Mark won, stage closed_won/probability 100; clears lost state. Same-state retries preserve timestamp/audit. Returns deal. " + units, inputSchema: z.object(did).strict() },
    p => wrapTool(ctx, async () => ({ deal: await closeDeal(ctx, p.dealId, "won") })));
  server.registerTool("mark_deal_lost", { description: "Mark lost, stage closed_lost/probability zero; clears won state. Same-state retries preserve timestamp/audit. Returns deal. " + units, inputSchema: dealLostSchema.extend(did).strict() },
    p => wrapTool(ctx, async () => ({ deal: await closeDeal(ctx, p.dealId, "lost", { reason: p.reason }) })));
  server.registerTool("list_deal_activities", { description: "List owned live deal timeline with scoped public users, filters/paging/order. Returns activities,pagination,typeCounts,totalAll; counts ignore filters.", inputSchema: activityListSchema.extend(did).strict() },
    p => { const { dealId, ...input } = p; return wrapTool(ctx, () => listDealActivities(ctx, dealId, input)); });
  server.registerTool("add_deal_activity", { description: "Append activity to live owned deal attributed to current organization member, optional UTC scheduled instant. Returns activity with atomic audit.", inputSchema: activityCreateSchema.extend(did).strict() },
    p => { const { dealId, ...input } = p; return wrapTool(ctx, async () => ({ activity: await addDealActivity(ctx, dealId, input) })); });
  server.registerTool("get_crm_analytics", { description: "Get CRM counts, integer conversion percent, exact rounded won average and cents totals/stage distribution tagged currency. Mixed currencies require a currency filter. Returns analytics fields directly. " + units, inputSchema: crmAnalyticsSchema },
    p => wrapTool(ctx, () => crmAnalytics(ctx, p)));
}
