import { projectCrmJson } from "@/lib/money/project-crm-ui";
import { dateOnlyToDate } from "./dates";

export const crmSourceKeys = { website: "website", referral: "referral", cold_outreach: "coldOutreach", event: "event", other: "other" } as const;
export interface CrmPipeline { id: string; name: string; stages: { id: string; name: string; color: string }[]; isDefault: boolean }
export interface CrmDeal {
  id: string; title: string; stageId: string; valueCents: number; currency: string; probability: number | null;
  contact: { name: string } | null; assignedUser: { name: string | null } | null;
  expectedCloseDate: string | null; source: string | null; createdAt: string; wonAt: string | null; lostAt: string | null;
}
export interface CrmSummary { currency: string; activeCount: number; activeValue: number; wonCount: number; wonValue: number; totalDeals: number; stageDistribution: Record<string, { count: number; value: number }> }
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid CRM response");
  return value as Record<string, unknown>;
}
function text(value: unknown): value is string { return typeof value === "string" && value.trim().length > 0; }
function count(value: unknown) { if (!Number.isSafeInteger(value) || (value as number) < 0) throw new Error("Invalid CRM count"); }
function pipeline(value: unknown) {
  const row = record(value);
  if (!text(row.id) || !text(row.name) || typeof row.isDefault !== "boolean" || !Array.isArray(row.stages) || !row.stages.length) throw new Error("Invalid CRM pipeline");
  const ids = new Set<string>();
  for (const value of row.stages) {
    const stage = record(value);
    if (!text(stage.id) || ids.has(stage.id) || !text(stage.name) || typeof stage.color !== "string" || !/^#[a-f0-9]{6}$/i.test(stage.color)) throw new Error("Invalid CRM stage");
    ids.add(stage.id);
  }
}
async function read(response: Response) {
  if (!response.ok) throw new Error("CRM request failed");
  return record(await projectCrmJson(response));
}
export async function crmPipelinesJson(response: Response) {
  const body = await read(response);
  if (!Array.isArray(body.pipelines)) throw new Error("Invalid CRM pipelines");
  const ids = new Set<string>();
  for (const value of body.pipelines) { pipeline(value); const id = record(value).id as string; if (ids.has(id)) throw new Error("Duplicate pipeline"); ids.add(id); }
  return body as typeof body & { pipelines: CrmPipeline[] };
}
export async function crmPipelineCreatedJson(response: Response) {
  const body = await read(response); pipeline(body.pipeline); return body;
}
function deal(value: unknown, joins: boolean) {
  const row = record(value);
  if (!text(row.id) || !text(row.title) || !text(row.stageId) || !Number.isSafeInteger(row.valueCents)) throw new Error("Invalid CRM deal");
  if (row.probability !== null && (!Number.isInteger(row.probability) || (row.probability as number) < 0 || (row.probability as number) > 100)) throw new Error("Invalid probability");
  if (row.source !== null && !Object.hasOwn(crmSourceKeys, String(row.source))) throw new Error("Invalid source");
  if (row.expectedCloseDate !== null && (typeof row.expectedCloseDate !== "string" || !dateOnlyToDate(row.expectedCloseDate))) throw new Error("Invalid close date");
  for (const field of ["createdAt", "wonAt", "lostAt"]) if (!(field !== "createdAt" && row[field] === null) && (typeof row[field] !== "string" || !Number.isFinite(Date.parse(row[field] as string)))) throw new Error("Invalid CRM timestamp");
  if (row.wonAt && row.lostAt) throw new Error("Invalid CRM lifecycle");
  if (joins) for (const field of ["contact", "assignedUser"]) if (row[field] !== null) {
    const join = record(row[field]); if (typeof join.name !== "string" && !(field === "assignedUser" && join.name === null)) throw new Error("Invalid CRM join");
  }
}
export async function crmDealCreatedJson(response: Response) {
  const body = await read(response); deal(body.deal, false);
  return body as typeof body & { deal: CrmDeal };
}
export async function crmDealsJson(response: Response) {
  const body = await read(response);
  if (!Array.isArray(body.data)) throw new Error("Invalid deal list");
  const ids = new Set<string>();
  for (const value of body.data) { deal(value, true); const id = record(value).id as string; if (ids.has(id)) throw new Error("Duplicate deal"); ids.add(id); }
  const pagination = record(body.pagination); count(pagination.total);
  const summary = record(body.summary);
  for (const key of ["activeCount", "wonCount", "totalDeals"]) count(summary[key]);
  if (!Number.isSafeInteger(summary.activeValue) || !Number.isSafeInteger(summary.wonValue)) throw new Error("Invalid CRM totals");
  for (const value of Object.values(record(summary.stageDistribution))) { const row = record(value); count(row.count); if (!Number.isSafeInteger(row.value)) throw new Error("Invalid stage total"); }
  return body as typeof body & { data: CrmDeal[]; summary: CrmSummary; pagination: { total: number } };
}

export interface CrmDealDetail extends CrmDeal {
  notes: string | null; lostReason: string | null;
  contact: { id: string; name: string; email: string | null } | null;
  assignedUser: { id: string; name: string | null } | null;
  pipeline: CrmPipeline | null;
  activities: { id: string; type: string; content: string | null; createdAt: string; user: { name: string | null } | null }[];
}
export const crmActivityKeys = { note: "note", email: "email", call: "call", meeting: "meeting", task: "task" } as const;
function nullableText(value: unknown) { return value === null || typeof value === "string"; }
function activity(value: unknown, joins = true) {
  const row = record(value);
  if (!text(row.id) || !Object.hasOwn(crmActivityKeys, String(row.type)) || !nullableText(row.content) ||
    typeof row.createdAt !== "string" || !Number.isFinite(Date.parse(row.createdAt))) throw new Error("Invalid CRM activity");
  if (joins && row.user !== null && !nullableText(record(row.user).name)) throw new Error("Invalid CRM activity user");
}
export async function crmDealDetailJson(response: Response, expectedId: string) {
  const body = await read(response); deal(body.deal, true);
  const row = record(body.deal);
  if (row.id !== expectedId || !nullableText(row.notes) || !nullableText(row.lostReason)) throw new Error("Invalid CRM detail");
  if (row.contact !== null) {
    const contact = record(row.contact);
    if (!text(contact.id) || !nullableText(contact.email)) throw new Error("Invalid CRM contact");
  }
  if (row.assignedUser !== null && !text(record(row.assignedUser).id)) throw new Error("Invalid CRM assignee");
  if (row.pipeline !== null) pipeline(row.pipeline);
  if (!Array.isArray(row.activities)) throw new Error("Invalid CRM activities");
  const ids = new Set<string>();
  for (const value of row.activities) { activity(value); const id = record(value).id as string; if (ids.has(id)) throw new Error("Duplicate CRM activity"); ids.add(id); }
  return body as typeof body & { deal: CrmDealDetail };
}
/** Mutation replies omit joins. Validate their actual wire shape, then refresh detail separately. */
export async function crmDealMutationJson(response: Response, expectedId: string) {
  const body = await crmDealCreatedJson(response);
  if (body.deal.id !== expectedId) throw new Error("Invalid CRM mutation identity");
  return body;
}
export async function crmDealDeletedJson(response: Response) {
  const body = await read(response);
  if (body.success !== true) throw new Error("Invalid CRM deletion");
}
export async function crmActivityCreatedJson(response: Response, expectedDealId: string) {
  const body = await read(response); activity(body.activity, false);
  const row = record(body.activity);
  if (row.dealId !== expectedDealId || !text(row.userId)) throw new Error("Invalid CRM activity identity");
  return body;
}

export type CrmActivity = CrmDealDetail["activities"][number];
/** REST and MCP share this feed envelope; validate the whole page before adoption. */
export async function crmActivitiesJson(response: Response, expectedPage: number, expectedLimit = 30) {
  const body = await read(response);
  if (!Array.isArray(body.activities)) throw new Error("Invalid CRM activity feed");
  const ids = new Set<string>();
  for (const value of body.activities) {
    activity(value); const id = record(value).id as string;
    if (ids.has(id)) throw new Error("Duplicate CRM activity");
    ids.add(id);
  }
  const pagination = record(body.pagination);
  for (const key of ["page", "limit", "total", "totalPages"]) count(pagination[key]);
  if (pagination.page !== expectedPage || pagination.limit !== expectedLimit ||
    pagination.totalPages !== Math.ceil((pagination.total as number) / expectedLimit) ||
    body.activities.length !== Math.min(expectedLimit, Math.max(0, (pagination.total as number) - (expectedPage - 1) * expectedLimit))) throw new Error("Invalid CRM activity pagination");
  count(body.totalAll);
  const counts = record(body.typeCounts);
  if (Object.keys(counts).length !== Object.keys(crmActivityKeys).length) throw new Error("Invalid CRM activity counts");
  let sum = 0;
  for (const key of Object.keys(crmActivityKeys)) { count(counts[key]); sum += counts[key] as number; }
  if (sum !== body.totalAll || (pagination.total as number) > sum) throw new Error("Inconsistent CRM activity totals");
  return body as typeof body & { activities: CrmActivity[]; pagination: { page: number; limit: number; total: number; totalPages: number }; typeCounts: Record<keyof typeof crmActivityKeys, number>; totalAll: number };
}
