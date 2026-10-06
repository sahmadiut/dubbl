import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { wrapTool } from "@/lib/mcp/errors";
import type { AuthContext } from "@/lib/api/auth-context";
import { computeConsolidatedReport } from "@/lib/api/consolidation-report";
import { listConsolidationGroups, getConsolidationGroup, createConsolidationGroup, updateConsolidationGroup, deleteConsolidationGroup,
  listConsolidationMembers, addConsolidationMember, removeConsolidationMember, listConsolidationRules, createConsolidationRule, deleteConsolidationRule } from "@/lib/api/consolidation-config";
import { consolidationId, consolidationGroupCreateSchema, consolidationGroupUpdateSchema, consolidationMemberSchema, consolidationRuleSchema } from "@/lib/api/consolidation-config-wire";

export function registerConsolidationTools(server: McpServer, ctx: AuthContext) {
  const groupId = consolidationId.describe("UUID of a live consolidation group owned by the current organization");
  server.registerTool("list_consolidation_groups", {
    description: "List owned consolidation groups with public member names and ISO presentation/functional currencies. No monetary fields; group configuration only.", inputSchema: z.object({}).strict(),
  }, () => wrapTool(ctx, async () => ({ groups: (await listConsolidationGroups(ctx)).map(g => ({
    id: g.id, name: g.name, presentationCurrency: g.presentationCurrency, memberCount: g.members.length,
    members: g.members.map(m => ({ id: m.id, orgId: m.orgId, label: m.label || m.organization.name, orgName: m.organization.name, functionalCurrency: m.functionalCurrency || m.organization.defaultCurrency })),
  })) })));
  server.registerTool("get_consolidation_group", {
    description: "Get an owned group with public organization projections for currently accessible members. No money/FX amounts.", inputSchema: z.object({ groupId }).strict(),
  }, p => wrapTool(ctx, async () => ({ group: await getConsolidationGroup(ctx, p.groupId) })));
  server.registerTool("create_consolidation_group", {
    description: "Create a consolidation group; requires manage:reports. ISO presentation currency defaults USD; no ledger amount conversion. Returns group with empty members.", inputSchema: consolidationGroupCreateSchema,
  }, p => wrapTool(ctx, async () => ({ group: await createConsolidationGroup(ctx, p) })));
  server.registerTool("update_consolidation_group", {
    description: "Update group name/presentation currency; requires manage:reports. Saved rates/elimination entries prevent currency changes. Returns group with public members; no money/FX inputs.", inputSchema: consolidationGroupUpdateSchema.safeExtend({ groupId }),
  }, p => wrapTool(ctx, async () => { const { groupId: id, ...body } = p; return { group: await updateConsolidationGroup(ctx, id, body) }; }));
  server.registerTool("delete_consolidation_group", {
    description: "Soft-delete an owned group; requires manage:reports. Member ledgers and historical configuration are retained. Returns success.", inputSchema: z.object({ groupId }).strict(),
  }, p => wrapTool(ctx, () => deleteConsolidationGroup(ctx, p.groupId)));
  server.tool(
    "get_consolidation_report",
    "Get the consolidated P&L and balance sheet for a consolidation group over a date range. Each member entity's posted GL balances are translated from its functional currency into the group's presentation currency using IAS 21 rates (closing for assets/liabilities, average for revenue/expenses, historical for equity), then summed. The mixed-rate residual that prevents the balance sheet from footing is injected as a Cumulative Translation Adjustment (CTA, code 3900) equity line so the consolidated balance sheet FOOTS (assets = liabilities + equity incl. CTA + net income; see consolidatedBalanceSheet.balanceCheck, which should be ~0). Intercompany balances matched by the group's elimination rules (account-code prefixes) are removed, capped by the intercompany invoice/bill volume attributable to fellow members so third-party balances are never over-eliminated. This tool is READ-ONLY (it does not persist elimination entries). All amounts are in integer cents of the presentation currency.",
    {
      groupId: z.string().describe("UUID of the consolidation group to report on"),
      startDate: z
        .string()
        .optional()
        .describe(
          "Inclusive start date (YYYY-MM-DD) of the report window. Defaults to Jan 1 of the current year."
        ),
      endDate: z
        .string()
        .optional()
        .describe(
          "Inclusive end date (YYYY-MM-DD); also the period-end used to resolve translation rates. Defaults to today."
        ),
    },
    (params) =>
      wrapTool(ctx, async () => {
        const group = await getConsolidationGroup(ctx, params.groupId);

        const startDate =
          params.startDate || `${new Date().getFullYear()}-01-01`;
        const endDate = params.endDate || new Date().toISOString().slice(0, 10);

        // Shared computation: identical translation + CTA-as-equity injection +
        // intercompany-capped eliminations as the REST report route, so the two
        // paths can never diverge. Read-only.
        return computeConsolidatedReport(group, { startDate, endDate });
      })
  );


  server.registerTool("list_consolidation_members", {
    description: "List accessible member organizations with labels and ISO functional currencies. Returns groupId, presentationCurrency and members; no monetary fields.", inputSchema: z.object({ groupId }).strict(),
  }, p => wrapTool(ctx, () => listConsolidationMembers(ctx, p.groupId)));
  server.registerTool("add_consolidation_member", {
    description: "Add a currently accessible organization once to an owned group; requires manage:reports. Functional currency is report configuration; no conversion or rescaling. Returns member link.", inputSchema: consolidationMemberSchema.extend({ groupId }),
  }, p => wrapTool(ctx, async () => { const { groupId: id, ...body } = p; return { member: await addConsolidationMember(ctx, id, body) }; }));
  server.registerTool("remove_consolidation_member", {
    description: "Unlink a member organization, including revoked memberships; requires manage:reports. Does not change that organization's ledger. Returns success and removedMemberId.", inputSchema: z.object({ groupId, orgId: consolidationId.describe("UUID of member organization to unlink") }).strict(),
  }, p => wrapTool(ctx, () => removeConsolidationMember(ctx, p.groupId, p.orgId)));
  server.registerTool("list_consolidation_elimination_rules", {
    description: "List live account-prefix elimination rules for an owned group. Returns groupId and rules; no monetary or rate fields.", inputSchema: z.object({ groupId }).strict(),
  }, p => wrapTool(ctx, () => listConsolidationRules(ctx, p.groupId)));
  server.registerTool("create_consolidation_elimination_rule", {
    description: "Create an account-prefix elimination rule; requires manage:reports. investment_equity remains a report stub. Returns rule; no money inputs or posting.", inputSchema: consolidationRuleSchema.extend({ groupId }),
  }, p => wrapTool(ctx, async () => { const { groupId: id, ...body } = p; return { rule: await createConsolidationRule(ctx, id, body) }; }));
  server.registerTool("delete_consolidation_elimination_rule", {
    description: "Soft-delete a live rule belonging to this group; requires manage:reports. Retains persisted historical entries. Returns success and deletedRuleId.", inputSchema: z.object({ groupId, ruleId: consolidationId.describe("UUID of live elimination rule within this group") }).strict(),
  }, p => wrapTool(ctx, () => deleteConsolidationRule(ctx, p.groupId, p.ruleId)));
}
