import { z } from "zod";
import { AiAdminError, adminErrorKey, configDto, type AdminErrorKey } from "./admin-client";
import { dateOnlyToDate } from "@/i18n/dates";

const id = z.string().uuid(), integer = z.string().regex(/^(0|[1-9][0-9]*)$/), decimal = z.string().regex(/^(0|[1-9][0-9]*)\.[0-9]{12}$/), currency = z.string().regex(/^[A-Z]{3}$/);
export const runStates = ["queued", "running", "awaiting_approval", "awaiting_input", "reconciliation_required", "succeeded", "failed", "cancelled", "expired"] as const;
export const attemptStates = ["reserved", "in_flight", "unknown", "settled", "cancelled"] as const;
const metrics = z.object({ attempts: integer, reservedAttempts: integer, inFlightAttempts: integer, unknownAttempts: integer, settledAttempts: integer, cancelledAttempts: integer,
  inputTokens: integer.nullable(), outputTokens: integer.nullable(), cachedTokens: integer.nullable(), reasoningTokens: integer.nullable(),
  unknownInputAttempts: integer, unknownOutputAttempts: integer, unknownCachedAttempts: integer, unknownReasoningAttempts: integer,
  chargedTokens: integer, chargedCost: decimal, settledCost: decimal, reservedCost: decimal, unresolvedCost: decimal });
const totals = metrics.extend({ currency });
const group = totals.extend({ userId: id, providerId: id, model: z.string(), priceId: id, organizationId: id.optional() });
export const reportDto = z.object({ scope: z.enum(["own", "organization", "site"]), organizationId: id.optional(), filters: z.record(z.string(), z.unknown()), costsAreEstimates: z.literal(true),
  costUnit: z.literal("major-billing-currency-decimal"), tokensAreObservedPartialSums: z.literal(true), format: z.literal("json").optional(), exportGroupLimit: z.literal(10000).optional(),
  groups: z.array(group), totalsByCurrency: z.array(totals), totalGroups: integer, page: z.number().int().positive().optional(), pageSize: z.number().int().positive().optional(), hasNextPage: z.boolean().optional(), complete: z.literal(true).optional() });
const run = z.object({ id, ownerId: id, state: z.enum(runStates), version: z.number().int().positive(), createdAt: z.iso.datetime(), startedAt: z.iso.datetime().nullable(), finishedAt: z.iso.datetime().nullable(), cancelRequestedAt: z.iso.datetime().nullable(), durationMs: integer.nullable() });
const outcomes = z.object({ requests: z.array(z.object({ state: z.enum(runStates), count: integer, durationSamples: integer, totalDurationMs: integer.nullable() })), tools: z.array(z.object({ state: z.enum(["prepared", "executing", "succeeded", "failed", "uncertain", "skipped"]), count: integer })) });
export const runsDto = z.object({ scope: z.enum(["own", "organization"]), organizationId: id, rows: z.array(run), totalRuns: integer, page: z.number().int().positive(), hasNextPage: z.boolean(), outcomes });
export const detailDto = z.object({ run, outcomes, reasonCode: z.string().regex(/^(STOP_REQUESTED|RUN_[A-Z_]+)$/), canStop: z.boolean() });
const constraint = z.object({ subject: z.enum(["organization", "member"]), status: z.enum(["BUDGET_MISSING", "LIMITED", "WITHIN_LIMITS"]), version: z.number().optional(), reasons: z.array(z.enum(["ZERO_LIMIT", "MONTHLY_TOKENS_EXHAUSTED", "MONTHLY_COST_EXHAUSTED", "CONCURRENCY_EXHAUSTED", "RATE_EXHAUSTED"])).optional(),
  monthlyTokensLimit: integer.optional(), remainingMonthlyTokens: integer.optional(), monthlyCostLimit: decimal.optional(), remainingMonthlyCost: decimal.optional(), runTokensLimit: integer.optional(), runCostLimit: decimal.optional(), concurrencyLimit: z.number().optional(), remainingConcurrency: integer.optional(), requestsPerMinuteLimit: z.number().optional(), remainingRequestsPerMinute: integer.optional() });
export const quotaDto = z.object({ scope: z.enum(["own", "organization"]), organizationId: id, currency, from: z.iso.datetime(), resetAt: z.iso.datetime(), asOf: z.iso.datetime(), constraints: z.array(constraint) });
export type Report = z.infer<typeof reportDto>;
export type Runs = z.infer<typeof runsDto>;
export type Detail = z.infer<typeof detailDto>;
export type Quota = z.infer<typeof quotaDto>;
export type DashboardScope = "own" | "organization" | "site";
export type Filters = { from: string; to: string; userId: string; organizationId: string; providerId: string; model: string; currency: string; priceId: string; state: string; runState: string; quotaCurrency: string };
export function defaultFilters(now = new Date()): Filters {
  return { from: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10), to: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString().slice(0, 10), userId: "", organizationId: "", providerId: "", model: "", currency: "", priceId: "", state: "", runState: "", quotaCurrency: "USD" };
}
export function filterQuery(filters: Filters, scope: DashboardScope, operations = false): Record<string, string> {
  const from = dateOnlyToDate(filters.from), to = dateOnlyToDate(filters.to);
  if (!from || !to || to <= from || +to - +from > 93 * 86400000) throw new AiAdminError("invalid");
  const query: Record<string, string> = { from: from.toISOString(), to: to.toISOString(), ...(scope === "site" ? {} : { scope }) };
  const keys = operations ? ["userId"] as const : ["userId", "providerId", "model", "currency", "priceId", "organizationId"] as const;
  for (const key of keys) {
    const value = filters[key].trim();
    if (!value || key === "userId" && scope === "own" || key === "organizationId" && scope !== "site") continue;
    if (key.endsWith("Id") && !id.safeParse(value).success || key === "currency" && !currency.safeParse(value).success || key === "model" && value.length > 120) throw new AiAdminError("invalid");
    query[key] = value;
  }
  const state = operations ? filters.runState : filters.state;
  if (state) {
    if (!(operations ? runStates : attemptStates).some(s => s === state)) throw new AiAdminError("invalid");
    query.state = state;
  }
  return query;
}
export type DashboardError = AdminErrorKey | "tooLarge";
export class DashboardRequestError extends AiAdminError { constructor(public dashboardKey: DashboardError) { super(dashboardKey === "tooLarge" ? "invalid" : dashboardKey); } }
export async function dashboardRequest<T>(org: string, path: string, schema: z.ZodType<T>, query: Record<string, string> = {}, body?: unknown): Promise<T> {
  if (!path.startsWith("/api/v1/admin/ai/") && !org) throw new AiAdminError("missingOrganization");
  let response: Response;
  try { response = await fetch(`${path}${Object.keys(query).length ? `?${new URLSearchParams(query)}` : ""}`, { method: body === undefined ? "GET" : "POST", cache: "no-store", headers: { "Content-Type": "application/json", ...(org ? { "x-organization-id": org } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); }
  catch { throw new AiAdminError("network"); }
  if (!response.ok) throw new DashboardRequestError(response.status === 413 ? "tooLarge" : adminErrorKey(response.status, undefined));
  try { return schema.parse(await response.json()); } catch { throw new AiAdminError("failed"); }
}
type Section<T> = { loading: boolean; data?: T; error?: DashboardError };
export type DashboardState = { organizationId: string; scope: DashboardScope; generation: number; filters: Filters; report: Section<Report>; runs: Section<Runs>; quota: Section<Quota>; detail: Section<Detail>; configs: Section<z.infer<typeof configDto>[]>; busy: boolean; notice?: DashboardError | "stopped" | "disabled" | "exported" };
type SectionName = "report" | "runs" | "quota" | "detail" | "configs";
const blank = (organizationId: string, scope: DashboardScope, generation = 0): DashboardState => ({ organizationId, scope, generation, filters: defaultFilters(), report: { loading: false }, runs: { loading: false }, quota: { loading: false }, detail: { loading: false }, configs: { loading: false }, busy: false });
const errorKey = (e: unknown): DashboardError => e instanceof DashboardRequestError ? e.dashboardKey : e instanceof AiAdminError ? e.key : "failed";

/** One active scope; all asynchronous results and downloads are fenced to that scope. */
export class DashboardController {
  state: DashboardState;
  private active = false;
  private epoch = 0;
  private reads = { report: 0, runs: 0, quota: 0, detail: 0, configs: 0 };
  private listeners = new Set<(s: DashboardState) => void>();
  constructor(private site = false, private readOrganization = () => localStorage.getItem("activeOrgId") ?? "", private request = dashboardRequest) { this.state = blank("", site ? "site" : "own"); }
  subscribe(fn: (s: DashboardState) => void) { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }
  private publish() { this.listeners.forEach(fn => fn(this.state)); }
  private clearDisclosure() {
    for (const key of Object.keys(this.reads) as SectionName[]) this.reads[key]++;
    this.state = { ...this.state, report: { loading: false }, runs: { loading: false }, quota: { loading: false }, detail: { loading: false }, configs: { loading: false } };
  }
  start() { this.active = true; this.sync(true); }
  dispose() { this.active = false; this.epoch++; this.listeners.clear(); }
  sync(force = false) {
    const org = this.site ? "" : this.readOrganization();
    if (!this.active || !force && org === this.state.organizationId) return;
    this.epoch++; this.state = blank(org, this.state.scope, this.epoch); this.publish(); void this.load();
  }
  private current(epoch: number) {
    if (!this.active || epoch !== this.epoch) return false;
    if (!this.site && this.readOrganization() !== this.state.organizationId) { this.sync(); return false; }
    return true;
  }
  select(scope: DashboardScope) {
    if (scope === this.state.scope || (this.site ? scope !== "site" : scope === "site")) return;
    this.epoch++; this.state = blank(this.state.organizationId, scope, this.epoch); this.publish(); void this.load();
  }
  async apply(filters: Filters) {
    try { filterQuery(filters, this.state.scope); filterQuery(filters, this.state.scope, true); if (!currency.safeParse(filters.quotaCurrency).success) throw new AiAdminError("invalid"); }
    catch { this.state = { ...this.state, notice: "invalid" }; this.publish(); return; }
    if (!this.current(this.epoch)) return;
    this.epoch++; this.state = { ...blank(this.state.organizationId, this.state.scope, this.state.generation), filters: { ...filters } }; this.publish(); await this.load();
  }
  private async read<T>(section: SectionName, path: string, schema: z.ZodType<T>, query: Record<string, string> = {}) {
    const epoch = this.epoch, sequence = ++this.reads[section], org = this.state.organizationId;
    if (!this.current(epoch)) return;
    this.state = { ...this.state, [section]: { loading: true } }; this.publish();
    try {
      const data = await this.request(org, path, schema, query);
      if (!this.current(epoch) || sequence !== this.reads[section]) return;
      this.state = { ...this.state, [section]: { loading: false, data } };
    } catch (e) {
      if (!this.current(epoch) || sequence !== this.reads[section]) return;
      this.state = { ...this.state, [section]: { loading: false, error: errorKey(e) } };
    }
    this.publish();
  }
  private reportSchema(exporting = false) {
    const { scope, organizationId } = this.state;
    return reportDto.refine(v => v.scope === scope && (scope === "site" ? v.organizationId === undefined && v.groups.every(g => !!g.organizationId) : v.organizationId === organizationId) && (exporting ? v.complete === true && BigInt(v.totalGroups) === BigInt(v.groups.length) : v.page !== undefined && v.hasNextPage !== undefined));
  }
  page(page = 1) { if (!this.current(this.epoch)) return Promise.resolve(); return this.read("report", this.site ? "/api/v1/admin/ai/usage" : "/api/v1/ai/usage/report", this.reportSchema(), { ...filterQuery(this.state.filters, this.state.scope), page: String(page), pageSize: "25" }); }
  runPage(page = 1) { if (this.site || !this.current(this.epoch)) return Promise.resolve(); return this.read("runs", "/api/v1/ai/operations/runs", runsDto.refine(v => v.scope === this.state.scope && v.organizationId === this.state.organizationId), { ...filterQuery(this.state.filters, this.state.scope, true), page: String(page), pageSize: "25" }); }
  async load() {
    await Promise.all([this.page(), ...(this.site ? [] : [this.runPage(), this.read("quota", "/api/v1/ai/operations/quota", quotaDto.refine(v => v.organizationId === this.state.organizationId && v.scope === this.state.scope && v.currency === this.state.filters.quotaCurrency), { scope: this.state.scope, currency: this.state.filters.quotaCurrency, ...(this.state.scope === "organization" && this.state.filters.userId ? { userId: this.state.filters.userId } : {}) }), this.read("configs", "/api/v1/ai/provider-configs", z.object({ configurations: z.array(configDto) }).transform(v => v.configurations))])]);
  }
  inspect(runId: string) { if (this.site || !this.current(this.epoch)) return Promise.resolve(); return this.read("detail", "/api/v1/ai/operations/run", detailDto.refine(v => v.run.id === runId), { scope: this.state.scope, runId }); }
  private async action<T>(path: string, body: unknown, schema: z.ZodType<T>, success: "stopped" | "disabled", invalidate: SectionName) {
    const epoch = this.epoch;
    if (!this.current(epoch) || this.state.busy || this.site) return;
    this.state = { ...this.state, busy: true, notice: undefined }; this.publish();
    try {
      await this.request(this.state.organizationId, `/api/v1/ai/operations/${path}`, schema, {}, body);
      if (!this.current(epoch)) return;
      this.reads[invalidate]++; this.state = { ...this.state, [invalidate]: { loading: false }, notice: success }; this.publish();
      await this.load();
    } catch (e) {
      if (!this.current(epoch)) return;
      if (errorKey(e) === "denied") this.clearDisclosure();
      this.reads[invalidate]++; this.state = { ...this.state, [invalidate]: { loading: false }, notice: errorKey(e) };
    } finally { if (this.current(epoch)) { this.state = { ...this.state, busy: false }; this.publish(); } }
  }
  stop(runId: string, expectedVersion: number) {
    const detail = this.state.detail.data;
    if (!detail?.canStop || detail.run.id !== runId || detail.run.version !== expectedVersion) return Promise.resolve();
    return this.action("stop", { scope: this.state.scope, runId, expectedVersion }, z.object({ id: z.literal(runId), state: z.enum(runStates), version: z.number().int().positive() }), "stopped", "detail");
  }
  disable(configId: string, expectedVersion: number) {
    if (!this.state.configs.data?.some(c => c.id === configId && c.version === expectedVersion && c.enabled)) return Promise.resolve();
    return this.action("disable", { configId, expectedVersion }, z.object({ id: z.literal(configId), enabled: z.literal(false), version: z.number().int().positive() }), "disabled", "configs");
  }
  async export(download: (data: Report) => void) {
    const epoch = this.epoch;
    if (!this.current(epoch) || this.state.busy || !this.state.report.data) return;
    this.state = { ...this.state, busy: true, notice: undefined }; this.publish();
    try {
      const data = await this.request(this.state.organizationId, this.site ? "/api/v1/admin/ai/usage/export" : "/api/v1/ai/usage/export", this.reportSchema(true), filterQuery(this.state.filters, this.state.scope));
      if (!this.current(epoch)) return;
      download(data); this.state = { ...this.state, notice: "exported" };
    } catch (e) { if (this.current(epoch)) { if (errorKey(e) === "denied") this.clearDisclosure(); this.state = { ...this.state, notice: errorKey(e) }; } }
    finally { if (this.current(epoch)) { this.state = { ...this.state, busy: false }; this.publish(); } }
  }
}
