import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { wrapTool } from "@/lib/mcp/errors";
import type { AuthContext } from "@/lib/api/auth-context";
import { getConsolidationReport, persistConsolidationReport } from "@/lib/api/consolidation-report-service";
import { consolidationWindowSchema } from "@/lib/api/consolidation-report-wire";
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
  const reportInput = consolidationWindowSchema.in.extend({ groupId });
  server.registerTool("get_consolidation_report", {
    description: "Read a consolidated P&L and balance sheet over inclusive Gregorian dates. Accessible members' functional-currency fixed cents are translated to presentation-currency fixed cents at closing/average/historical rates. Returns CTA and eliminations with safe numeric and additive *Minor integer-string aliases, account byEntityMinor maps and rateExact quote_per_base rates. No rescaling by currency. Read-only; investment_equity rules are skipped. Existing symmetric invoice/bill cap assumptions remain.",
    inputSchema: reportInput,
  }, p => wrapTool(ctx, async () => { const { groupId: id, ...window } = p; return getConsolidationReport(ctx, id, window); }));
  server.registerTool("recalculate_consolidation_report", {
    description: "Recalculate an owned group's report and atomically replace saved elimination entries for the period end, including stale deleted/skipped rules. Requires manage:reports and current access to all members. Returns persisted:true plus the same safe numeric/*Minor cents and rateExact contracts as the read report; no member GL posting. Repeated/concurrent calls replace entries without duplicates; each success is audited.",
    inputSchema: reportInput,
  }, p => wrapTool(ctx, async () => { const { groupId: id, ...window } = p; return persistConsolidationReport(ctx, id, window); }));

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
