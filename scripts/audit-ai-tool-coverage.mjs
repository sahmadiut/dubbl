import fs from "node:fs";
import { AI_TOOL_NAMES } from "../lib/ai/tool-catalog.ts";

const inventory = JSON.parse(fs.readFileSync(".agentic/registries/AI_CAPABILITIES.json", "utf8"));
const groups = {
  "AI-014": ["accounts", "entries", "opening-balances", "period-close", "currencies", "currency-regimes", "accrual-schedules", "revenue-schedules", "recurring-journals", "bank-accounts", "bank-categorization", "bank-document-matches", "bank-imports", "bank-reconciliations", "bank-rules", "bank-transaction-reads", "bank-transfers"],
  "AI-015": ["contacts", "contact-statements", "invoices", "invoice-bulk", "invoice-lifecycle", "invoice-ubl", "quotes", "sales-receipts", "credit-notes", "customer-credits", "recurring-templates", "reminders"],
  "AI-016": ["bills", "bill-bulk", "debit-notes", "expense-crud", "expenses", "purchasing", "purchase-orders", "purchase-requisitions", "goods-receipts", "payments", "scheduled-payments", "payment-batches"],
  "AI-017": ["asset-cwip", "asset-depreciation", "asset-master", "asset-valuation", "loans", "tax", "tax-lookup", "tax-periods", "tax-profiles", "tax-rates", "tax-reports"],
  "AI-018": ["inventory", "inventory-assembly", "inventory-catalog", "inventory-master", "inventory-movements", "inventory-valuation", "landed-costs", "warehouses", "pricing", "procurement-settings"],
  "AI-019": ["payroll-compensation", "payroll-config", "payroll-master", "payroll-outputs", "payroll-payments", "payroll-runs", "payroll-time", "projects", "project-master", "time-tracking", "crm", "budgets", "cost-centers", "tags"],
  "AI-020": ["reports", "custom-reports", "operational-reports", "forecast-fx", "bank-analytics", "consolidation", "dashboard-data", "dashboard-layouts", "documents", "document-rendering", "document-templates", "email", "public-portal", "report-schedule-tools", "import-export", "bulk"],
};
const excluded = new Set(["ai-providers", "provider-settings", "ai-tool-policy", "roles", "admin-organization", "integrations"]);
const modules = inventory.modules.map(m => ({ module: m.module, source: m.source, followUp: excluded.has(m.module) ? null : Object.keys(groups).find(k => groups[k].includes(m.module)) ?? "AI-021",
  disposition: excluded.has(m.module) ? "excluded-from-chat-security-provider-or-frozen-scope" : "review-required-for-each-unlisted-operation",
  tools: m.tools.map(name => ({ name, status: AI_TOOL_NAMES.includes(name) ? "reviewed-default-deny-until-policies-allow" : "not-allowlisted" })) }));
for (const name of AI_TOOL_NAMES) if (!modules.some(m => m.tools.some(t => t.name === name))) throw new Error(`Missing actual MCP registration: ${name}`);
const result = { version: 1, interpretation: "Exhaustive source disposition, not a full feature claim. Every unlisted tool, REST method and UI action is unsupported by chat. Shared domain names and source presence do not prove per-operation parity. Frozen/security/provider operations cannot be enabled by follow-up work without applicable owner authorization. Policies default to deny; this registry does not enable runtime/providers.",
  counts: { ...inventory.counts, reviewedTools: AI_TOOL_NAMES.length, unlistedTools: inventory.counts.tools - AI_TOOL_NAMES.length }, modules,
  routes: inventory.routes.map(r => ({ ...r, chatDisposition: "not-directly-dispatchable; only independently reviewed MCP contracts may be used" })),
  pages: inventory.pages.map(source => ({ source, chatDisposition: "UI actions unsupported unless separately represented by a reviewed MCP operation", followUp: "AI-021" })),
};
const output = ".agentic/registries/AI_TOOL_COVERAGE.json", encoded = JSON.stringify(result, null, 2) + "\n";
if (process.argv.includes("--write")) fs.writeFileSync(output, encoded, "utf8");
else if (fs.readFileSync(output, "utf8").replaceAll("\r\n", "\n") !== encoded) throw new Error("AI tool coverage drift; inspect and regenerate using --write");
console.log(`AI tool coverage: ${JSON.stringify(result.counts)}`);
