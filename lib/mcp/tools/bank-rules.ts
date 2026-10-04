import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AuthContext } from "@/lib/api/auth-context";
import { wrapTool } from "@/lib/mcp/errors";
import { bankReadId } from "@/lib/api/bank-transaction-read-wire";
import { ruleCreateSchema, ruleUpdateSchema, ruleApplySchema, ruleAutoSchema } from "@/lib/api/bank-rule-wire";
import { listBankRules, ruleListSchema, ruleSuggestionSchema, getBankRule, createBankRule, updateBankRule, deleteBankRule, getBankRuleSuggestions, applyBankRules } from "@/lib/api/bank-rules";
import { autoReconcileBankTransactions } from "@/lib/api/bank-auto-reconcile";
export function registerBankRuleTools(server: McpServer, ctx: AuthContext) {
  server.registerTool("list_bank_rules", {
    description: "List owned bank rules by priority with pagination. Fixed amounts retain numeric bank minor units (USD cents) and add amountMinor strings; supported safe numeric range.",
    inputSchema: ruleListSchema,
  }, params => wrapTool(ctx, () => listBankRules(ctx, params, true)));
  server.registerTool("get_bank_rule", {
    description: "Read one owned bank rule, including exact amount conditions and fixed split amountMinor aliases.",
    inputSchema: z.object({ ruleId: bankReadId.describe("Organization-owned bank rule UUID") }).strict(),
  }, params => wrapTool(ctx, async () => ({ rule: await getBankRule(ctx, params.ruleId) })));
  server.registerTool("create_bank_rule", {
    description: "Create an owned bank rule with text or signed minor-unit conditions, optional fixed/percentage splits and active owned references. Fixed amounts are bank currency minor units, USD cents; amountMinor agrees with amount, safe range only. Returns rule.",
    inputSchema: ruleCreateSchema,
  }, params => wrapTool(ctx, async () => ({ rule: await createBankRule(ctx, params) })));
  server.registerTool("update_bank_rule", {
    description: "Patch an owned bank rule; omitted fields stay unchanged. Conditions replace the array; fixed amount/amountMinor aliases must agree. Returns rule.",
    inputSchema: ruleUpdateSchema.extend({ ruleId: bankReadId.describe("Organization-owned bank rule UUID") }),
  }, params => wrapTool(ctx, async () => { const { ruleId, ...patch } = params; return { rule: await updateBankRule(ctx, ruleId, patch) }; }));
  server.registerTool("delete_bank_rule", {
    description: "Soft-delete an owned bank rule; returns the deleted rule with fixed amountMinor aliases and deletion time. Unsupported saved monetary configurations reject atomically.",
    inputSchema: z.object({ ruleId: bankReadId.describe("Organization-owned bank rule UUID") }).strict(),
  }, params => wrapTool(ctx, async () => ({ rule: await deleteBankRule(ctx, params.ruleId) })));
  server.registerTool("get_bank_rule_suggestions", {
    description: "Suggest description patterns from owned categorized bank transactions. Returns pattern, active owned category/contact references and transactionCount; writes nothing.",
    inputSchema: ruleSuggestionSchema,
  }, params => wrapTool(ctx, () => getBankRuleSuggestions(ctx, params)));
  server.registerTool("apply_bank_rules", {
    description: "Apply active owned rules to unlinked, uncategorized, unreconciled bank lines. Splits and autoReconcile single categories post exact balanced journals with saved FX; suggestions stay unreconciled. Requires manage:banking. Returns matched/updated/applied/reconciled/split counts; dryRun also returns matches and writes nothing. Entire call rolls back on invalid posting.",
    inputSchema: ruleApplySchema,
  }, params => wrapTool(ctx, () => applyBankRules(ctx, params)));
  server.registerTool("auto_reconcile_bank_transactions", {
    description: "Link bank lines to qualified already-posted cash on the SAME bank ledger, signed amount and currency. Fuzzy text/date rank exact-amount candidates; ties skip. Manual journals require base identity FX; existing cash payments use the payment matching workflow. No open-document settlement or new journals. Requires manage:banking. Returns checked/reconciled/skipped counts, at most 500 lines per call; atomic on validation errors.",
    inputSchema: ruleAutoSchema,
  }, params => wrapTool(ctx, () => autoReconcileBankTransactions(ctx, params)));
}
