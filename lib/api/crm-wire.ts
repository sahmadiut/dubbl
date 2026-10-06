import { z } from "zod";
import { currencyCodeSchema } from "@/lib/currency/zod";
import { rateDateSchema } from "@/lib/currency/rate-policy";
import { exactMinorSchema, legacyMinorSchema, legacyMinor, stringifyWire, WireCompatibilityError } from "@/lib/money/wire";

export const crmId = z.string().uuid().describe("Organization-owned CRM record or member UUID");
const text = z.string().min(1).max(10000);
const money = legacyMinorSchema.min(0).refine(v => !Object.is(v, -0), "Negative zero is unsupported");
const probability = z.number().int().min(0).max(100);
const stage = z.object({
  id: text.describe("Unique stage identifier within this pipeline"),
  name: text.describe("Stage display name"),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).describe("Six-digit CSS hex color"),
}).strict();
export const crmStages = z.array(stage).min(1).max(100).refine(s => new Set(s.map(v => v.id)).size === s.length, "Stage IDs must be unique");
export const pipelineCreateSchema = z.object({
  name: text.describe("Nonempty pipeline name"),
  stages: crmStages.describe("Ordered nonempty unique stages; closing operations use reserved closed_won/closed_lost IDs"),
  isDefault: z.boolean().optional().describe("Default selection flag; true clears other live defaults"),
}).strict();
export const pipelineUpdateSchema = pipelineCreateSchema.partial();
export const dealSource = z.enum(["website", "referral", "cold_outreach", "event", "other"]);
export const activityType = z.enum(["note", "email", "call", "meeting", "task"]);
const fields = {
  title: text.describe("Nonempty deal title"),
  valueCents: money.optional().describe("Nonnegative fixed integer cents, 0..9007199254740991; defaults 0; no currency rescaling"),
  valueCentsMinor: exactMinorSchema.refine(v => !v.startsWith("-"), "Value must be nonnegative").optional().describe("Canonical cents string within safe numeric range; must agree with valueCents"),
  probability: probability.nullable().optional().describe("Integer win probability percent 0..100, or null; never money"),
  expectedCloseDate: rateDateSchema.nullable().optional().describe("Gregorian YYYY-MM-DD expected close date, null clears"),
  contactId: crmId.nullable().optional().describe("Live organization contact UUID, null clears"),
  assignedTo: crmId.nullable().optional().describe("Current organization member user UUID, null clears"),
  notes: z.string().max(100000).nullable().optional().describe("Internal notes, null clears"),
};
export const dealCreateSchema = z.object({ ...fields,
  pipelineId: crmId.describe("Live organization pipeline UUID"),
  stageId: text.describe("Configured stage ID in the selected pipeline"),
  currency: currencyCodeSchema.optional().describe("ISO currency label, defaults USD; fixed cents remain unchanged across scales"),
  source: dealSource.nullable().optional().describe("Lead source, null for none"),
}).strict();
export const dealUpdateSchema = z.object({ ...fields, title: fields.title.optional() }).strict();
export const dealStageSchema = z.object({ stageId: text.describe("Configured pipeline stage ID; use won/lost operations to close") }).strict();
export const dealLostSchema = z.object({ reason: z.string().max(100000).nullable().optional().describe("Loss reason, null for none") }).strict();
export const activityCreateSchema = z.object({
  type: activityType.describe("Timeline activity type"),
  content: z.string().max(100000).nullable().optional().describe("Activity body, null for none"),
  scheduledAt: z.iso.datetime({ offset: true }).nullable().optional().describe("ISO timestamp with explicit timezone, null for none; stored as UTC"),
}).strict();
const paging = {
  page: z.number().int().min(1).max(21474836).optional().default(1).describe("One-based page, max 21474836"),
  limit: z.number().int().min(1).max(100).optional().default(50).describe("Page size 1..100, default 50"),
  search: z.string().max(10000).optional().describe("Case-insensitive title/content search"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc").describe("Sort direction, default desc"),
};
export const crmAnalyticsSchema = z.object({ currency: currencyCodeSchema.optional().describe("Optional currency group; mixed-currency scalar summaries require a filter") }).strict();
export const dealListSchema = crmAnalyticsSchema.extend({ ...paging,
  pipelineId: crmId.optional().describe("Optional live owned pipeline UUID"),
  stageId: text.optional().describe("Optional stage ID filter"),
  source: dealSource.optional().describe("Optional source filter"),
  status: z.enum(["active", "won", "lost"]).optional().describe("Optional lifecycle filter"),
  sortBy: z.enum(["created", "value", "name", "probability"]).optional().default("created").describe("Sort field, default created"),
}).strict();
export const activityListSchema = z.object({ ...paging,
  limit: paging.limit.removeDefault().default(30).describe("Page size 1..100, default 30"),
  type: activityType.optional().describe("Optional timeline type filter"),
  sortBy: z.enum(["date", "type"]).optional().default("date").describe("Sort field, default date"),
}).strict();
export function dealAmounts<T extends { valueCents?: number; valueCentsMinor?: string }>(input: T) {
  const { valueCents, valueCentsMinor, ...rest } = input;
  if (valueCents !== undefined && valueCentsMinor !== undefined && String(valueCents) !== valueCentsMinor)
    throw new z.ZodError([{ code: "custom", path: ["valueCentsMinor"], message: "Deal value aliases disagree" }]);
  const value = valueCentsMinor === undefined ? valueCents : legacyMinor(BigInt(valueCentsMinor));
  return { ...rest, ...(value === undefined ? {} : { valueCents: value }) };
}
export function dealDto<T extends { valueCents: number; currency: string; probability: number | null; expectedCloseDate: string | null; wonAt: Date | null; lostAt: Date | null }>(row: T) {
  try {
    money.parse(row.valueCents);
    if (currencyCodeSchema.parse(row.currency) !== row.currency) throw new Error("Noncanonical saved currency");
    probability.nullable().parse(row.probability);
    rateDateSchema.nullable().parse(row.expectedCloseDate);
    if (row.wonAt && row.lostAt) throw new Error("Ambiguous lifecycle history");
    const result = { ...row, valueCentsMinor: String(row.valueCents) }; stringifyWire(result); return result;
  } catch { throw new WireCompatibilityError("Saved CRM value, currency, date, probability or lifecycle is unsupported"); }
}
type ValueRow = { valueCents: number; currency: string; stageId: string; wonAt: Date | null; lostAt: Date | null };
export function crmTotals(rows: ValueRow[], requestedCurrency?: string) {
  const currencies = new Set(rows.map(r => r.currency));
  if (currencies.size > 1) throw new WireCompatibilityError("CRM totals span currencies; select a currency filter before summing");
  const currency = requestedCurrency ?? rows[0]?.currency ?? "USD";
  const active = rows.filter(r => !r.wonAt && !r.lostAt), won = rows.filter(r => r.wonAt), lost = rows.filter(r => r.lostAt);
  const sum = (values: ValueRow[]) => values.reduce((s, r) => { money.parse(r.valueCents); return s + BigInt(r.valueCents); }, 0n);
  const activeValue = legacyMinor(sum(active)), wonValue = legacyMinor(sum(won));
  const distribution = (values: ValueRow[]) => {
    const map = new Map<string, { count: number; value: bigint }>();
    for (const r of values) { const s = map.get(r.stageId) ?? { count: 0, value: 0n }; s.count++; s.value += BigInt(r.valueCents); map.set(r.stageId, s); }
    return Object.fromEntries([...map].map(([key, s]) => [key, { count: s.count, value: legacyMinor(s.value), valueMinor: String(s.value) }]));
  };
  const average = won.length ? legacyMinor((sum(won) * 2n + BigInt(won.length)) / (2n * BigInt(won.length))) : 0;
  return {
    summary: { currency, activeCount: active.length, activeValue, activeValueMinor: String(activeValue), wonCount: won.length, wonValue, wonValueMinor: String(wonValue), totalDeals: rows.length, stageDistribution: distribution(active) },
    analytics: { currency, totalDeals: rows.length, openDeals: active.length, wonDeals: won.length, lostDeals: lost.length,
      totalPipelineValue: activeValue, totalPipelineValueMinor: String(activeValue), wonValue, wonValueMinor: String(wonValue),
      conversionRate: won.length + lost.length ? Number((BigInt(won.length) * 200n + BigInt(won.length + lost.length)) / (2n * BigInt(won.length + lost.length))) : 0,
      avgDealValue: average, avgDealValueMinor: String(average), stageDistribution: distribution(rows) },
  };
}
export function crmQuery(request: Request) {
  const values: Record<string, string | number> = Object.create(null);
  for (const [key, value] of new URL(request.url).searchParams) {
    if (Object.hasOwn(values, key)) throw new z.ZodError([{ code: "custom", path: [key], message: "Duplicate query key" }]);
    if (key === "page" || key === "limit") {
      if (!/^[1-9]\d{0,9}$/.test(value)) throw new z.ZodError([{ code: "custom", path: [key], message: "Expected canonical positive integer" }]);
      values[key] = Number(value);
    } else values[key] = value;
  }
  return values;
}
export async function readCrmJson(request: Request): Promise<unknown> {
  try { return await request.json(); } catch { throw new z.ZodError([{ code: "custom", path: [], message: "Invalid CRM JSON body" }]); }
}
