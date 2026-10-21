import { projectCrmJson } from "@/lib/money/project-crm-ui";

export const crmAnalyticsStageKeys = {
  lead: "lead", qualified: "qualified", proposal: "proposal", negotiation: "negotiation",
  closed_won: "won", closed_lost: "lost",
} as const;

export interface CrmAnalytics {
  currency: string;
  totalDeals: number; openDeals: number; wonDeals: number; lostDeals: number;
  totalPipelineValue: number; wonValue: number; conversionRate: number; avgDealValue: number;
  stageDistribution: Record<string, { count: number; value: number }>;
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid CRM analytics");
  return value as Record<string, unknown>;
}
function count(value: unknown): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < 0 || Object.is(value, -0)) throw new Error("Invalid CRM statistic");
}
/** Validate the complete direct REST/MCP envelope before adopting any statistics. */
export async function crmAnalyticsJson(response: Response, expectedCurrency = "") {
  if (!response.ok) throw new Error("CRM analytics request failed");
  const body = record(await projectCrmJson(response));
  if (typeof body.currency !== "string" || expectedCurrency && body.currency !== expectedCurrency) throw new Error("Unexpected CRM currency");
  for (const key of ["totalDeals", "openDeals", "wonDeals", "lostDeals", "totalPipelineValue", "wonValue", "avgDealValue", "conversionRate"]) count(body[key]);
  const total = BigInt(body.totalDeals as number), open = BigInt(body.openDeals as number);
  const won = BigInt(body.wonDeals as number), lost = BigInt(body.lostDeals as number);
  if (open + won + lost !== total || (body.conversionRate as number) > 100) throw new Error("Inconsistent CRM counts");
  const conversion = won + lost ? (won * 200n + won + lost) / (2n * (won + lost)) : 0n;
  const wonValue = BigInt(body.wonValue as number);
  const average = won ? (wonValue * 2n + won) / (2n * won) : 0n;
  if (BigInt(body.conversionRate as number) !== conversion || BigInt(body.avgDealValue as number) !== average ||
    !won && wonValue !== 0n || !open && body.totalPipelineValue !== 0) throw new Error("Inconsistent CRM statistics");
  let stageCount = 0n, stageValue = 0n;
  for (const [stage, value] of Object.entries(record(body.stageDistribution))) {
    if (!stage.trim()) throw new Error("Invalid CRM stage");
    const row = record(value); count(row.count); count(row.value);
    if (!row.count) throw new Error("Empty CRM stage");
    stageCount += BigInt(row.count); stageValue += BigInt(row.value);
  }
  const knownValue = wonValue + BigInt(body.totalPipelineValue as number);
  if (stageCount !== total || stageValue < knownValue || !lost && stageValue !== knownValue) throw new Error("Inconsistent CRM stages");
  return body as unknown as CrmAnalytics;
}
