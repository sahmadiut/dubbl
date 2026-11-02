import { z } from "zod";
import { AiAdminError, adminErrorKey, providerDto, type Provider, type AdminErrorKey } from "./admin-client";
import { priceSchema, budgetSchema } from "./usage-input";
import { normalizeLocalizedDecimal } from "@/lib/money/localized";

const uuid = z.string().uuid();
const integer = z.string().regex(/^(0|[1-9][0-9]*)$/);
const cost = z.string().regex(/^(0|[1-9][0-9]*)\.[0-9]{12}$/);
const currency = z.string().regex(/^[A-Z]{3}$/);
export const priceDto = z.object({ id: uuid, organizationId: uuid, providerId: uuid, model: z.string(), currency,
  inputRate: integer, outputRate: integer, cachedRate: integer, reasoningRate: integer,
  evidenceDate: z.iso.date(), source: z.string(), createdAt: z.iso.datetime(), unit: z.literal("micro-major-per-million-tokens"), invoice: z.literal(false),
});
export const budgetDto = z.object({ id: uuid, organizationId: uuid, subject: z.string(), userId: uuid.nullable(), currency,
  monthlyTokens: integer, monthlyCost: cost, runTokens: integer, runCost: cost,
  requestsPerMinute: z.number().int().min(0).max(10000), concurrency: z.number().int().min(0).max(1000), version: z.number().int().positive(),
  period: z.literal("UTC calendar month"), costIsEstimate: z.literal(true),
}).refine(v => v.subject === (v.userId ? `user:${v.userId}` : "organization"));
export const memberDto = z.object({ userId: uuid, userName: z.string().nullable(), userEmail: z.string() });
export type PriceVersion = z.infer<typeof priceDto>;
export type UsageBudget = z.infer<typeof budgetDto>;
export type UsageMember = z.infer<typeof memberDto>;
export type PriceInput = z.infer<typeof priceSchema>;
export type BudgetInput = z.infer<typeof budgetSchema>;

/** Exact UI normalization only: never Number for rates, costs or token ceilings. */
export function usageNumber(value: string): string {
  return normalizeLocalizedDecimal(value, /[\u066b\u066c]/.test(value) ? "arabic" : "ascii");
}
export function priceRate(atoms: string): string {
  const raw = BigInt(atoms).toString().padStart(7, "0");
  return `${raw.slice(0, -6)}.${raw.slice(-6)}`;
}
export async function usageSettingsRequest<T>(org: string, resource: "prices" | "budgets" | "provider-catalog" | "members", schema: z.ZodType<T>, method = "GET", body?: unknown): Promise<T> {
  if (!org) throw new AiAdminError("missingOrganization");
  let response: Response;
  try {
    response = await fetch(resource === "members" ? "/api/v1/members" : `/api/v1/ai/${resource}`, {
      method, cache: "no-store", headers: { "x-organization-id": org, "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch { throw new AiAdminError("network"); }
  let data: unknown;
  try { data = await response.json(); } catch { throw new AiAdminError("failed"); }
  if (!response.ok) throw new AiAdminError(adminErrorKey(response.status, data && typeof data === "object" && "error" in data ? data.error : undefined));
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new AiAdminError("failed");
  return parsed.data;
}

type Section<T> = { data?: T; loading: boolean; error?: AdminErrorKey; readVersion: number };
type Prices = { prices: PriceVersion[]; providers: Provider[] };
type Budgets = { budgets: UsageBudget[]; members: UsageMember[] };
export type UsageSettingsState = { organizationId: string; prices: Section<Prices>; budgets: Section<Budgets> };
type SectionName = "prices" | "budgets";
const empty = (organizationId = ""): UsageSettingsState => ({ organizationId, prices: { loading: true, readVersion: 0 }, budgets: { loading: true, readVersion: 0 } });

/** Coordinates independent forms; stale reads/writes may never populate another organization. */
export class UsageSettingsController {
  state = empty();
  private active = false;
  private epoch = 0;
  private reads = { prices: 0, budgets: 0 };
  private listeners = new Set<(state: UsageSettingsState) => void>();
  constructor(private readOrganization = () => localStorage.getItem("activeOrgId") ?? "", private request = usageSettingsRequest) {}
  subscribe(listener: (state: UsageSettingsState) => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  private publish() { for (const listener of this.listeners) listener(this.state); }
  start() { this.active = true; this.sync(true); }
  dispose() { this.active = false; this.epoch++; this.listeners.clear(); }
  sync(force = false) {
    if (!this.active) return;
    const org = this.readOrganization();
    if (!force && org === this.state.organizationId) return;
    this.epoch++; this.state = empty(org); this.publish();
    void this.refresh("prices"); void this.refresh("budgets");
  }
  private current(org: string, epoch: number) {
    if (!this.active || this.epoch !== epoch) return false;
    if (this.readOrganization() !== org) { this.sync(); return false; }
    return this.state.organizationId === org;
  }
  async refresh(section: SectionName) {
    if (!this.active) return;
    if (this.readOrganization() !== this.state.organizationId) { this.sync(); return; }
    const org = this.state.organizationId, epoch = this.epoch, read = ++this.reads[section];
    this.state = { ...this.state, [section]: { ...this.state[section], loading: true } }; this.publish();
    try {
      const data = section === "prices" ? await Promise.all([
        this.request(org, "prices", z.object({ prices: z.array(priceDto) }).refine(v => v.prices.every(p => p.organizationId === org))),
        this.request(org, "provider-catalog", z.object({ providers: z.array(providerDto) })),
      ]).then(([p, catalog]) => ({ ...p, ...catalog })) : await Promise.all([
        this.request(org, "budgets", z.object({ budgets: z.array(budgetDto) }).refine(v => v.budgets.every(b => b.organizationId === org))),
        this.request(org, "members", z.object({ members: z.array(memberDto) })),
      ]).then(([b, members]) => ({ ...b, ...members }));
      if (!this.current(org, epoch) || this.reads[section] !== read) return;
      this.state = { ...this.state, [section]: { data, loading: false, readVersion: this.state[section].readVersion + 1 } };
    } catch (err) {
      if (!this.current(org, epoch) || this.reads[section] !== read) return;
      const error = err instanceof AiAdminError ? err.key : "failed";
      this.state = { ...this.state, [section]: { ...this.state[section], ...(error === "denied" ? { data: undefined } : {}), loading: false, error } };
    }
    this.publish();
  }
  private async mutate<T>(section: SectionName, input: unknown, schema: z.ZodType<T>, method: string): Promise<T> {
    const org = this.state.organizationId, epoch = this.epoch;
    if (!this.current(org, epoch)) throw new AiAdminError("conflict");
    if (!this.state[section].data || this.state[section].loading || this.state[section].error) throw new AiAdminError("denied");
    try {
      const result = await this.request(org, section, schema, method, input);
      if (!this.current(org, epoch)) throw new AiAdminError("conflict");
      if (!this.state[section].data || this.state[section].error === "denied") throw new AiAdminError("denied");
      // Invalidate any older read that could overwrite this confirmed mutation.
      this.reads[section]++;
      return result;
    } catch (err) {
      if (!this.current(org, epoch)) throw new AiAdminError("conflict");
      if (err instanceof AiAdminError && err.key === "denied") {
        this.state = { ...this.state, [section]: { loading: false, error: "denied", readVersion: this.state[section].readVersion } }; this.publish();
      }
      throw err;
    }
  }
  async createPrice(input: PriceInput) {
    const epoch = this.epoch;
    const row = await this.mutate("prices", priceSchema.parse(input), priceDto.refine(v => v.organizationId === this.state.organizationId && v.providerId === input.providerId && v.model === input.model && v.currency === input.currency), "POST");
    if (!this.current(row.organizationId, epoch)) throw new AiAdminError("conflict");
    const section = this.state.prices;
    this.state = { ...this.state, prices: { ...section, loading: false, error: undefined, data: { ...section.data!, prices: [row, ...section.data!.prices].slice(0, 200) } } }; this.publish(); return row;
  }
  async saveBudget(input: BudgetInput) {
    const epoch = this.epoch;
    const row = await this.mutate("budgets", budgetSchema.parse(input), budgetDto.refine(v => v.organizationId === this.state.organizationId && v.userId === input.userId && v.currency === input.currency && v.version === (input.expectedVersion ?? 0) + 1), "PUT");
    if (!this.current(row.organizationId, epoch)) throw new AiAdminError("conflict");
    const section = this.state.budgets;
    this.state = { ...this.state, budgets: { ...section, loading: false, error: undefined, data: { ...section.data!, budgets: [...section.data!.budgets.filter(b => b.id !== row.id), row] } } }; this.publish(); return row;
  }
}
