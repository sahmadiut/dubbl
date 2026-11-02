import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import * as React from "react";
import * as jsx from "react/jsx-runtime";
import ts from "typescript";
import { z } from "zod";
import { renderWithPresentation } from "./helpers/presentation";
import { AiAdminError, type Provider } from "../lib/ai/admin-client";
import { UsageSettingsController, usageSettingsRequest, usageNumber, priceRate, priceDto, budgetDto, type PriceVersion, type UsageBudget, type PriceInput, type BudgetInput } from "../lib/ai/usage-settings-client";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const org = "11111111-1111-4111-8111-111111111111", other = "22222222-2222-4222-8222-222222222222", user = "33333333-3333-4333-8333-333333333333";
const provider: Provider = { id: "44444444-4444-4444-8444-444444444444", name: "Fixture <script>", adapter: "responses", endpoint: "https://fixture.invalid/responses", enabled: false, models: [{ id: "fixture-model", contextTokens: 1000, outputTokens: 100, functionCalls: true, strictSchemas: true, streaming: false, usage: true, evidenceDate: "2026-11-02" }], defaultModel: "fixture-model", timeoutMs: 1000, version: 1 };
const price: PriceVersion = { id: "55555555-5555-4555-8555-555555555555", organizationId: org, providerId: provider.id, model: "fixture-model", currency: "USD", inputRate: "999999999999999999", outputRate: "1000001", cachedRate: "0", reasoningRate: "0", source: "synthetic", evidenceDate: "2026-11-02", createdAt: "2026-11-02T00:00:00Z", unit: "micro-major-per-million-tokens", invoice: false };
const budget: UsageBudget = { id: "66666666-6666-4666-8666-666666666666", organizationId: org, subject: "organization", userId: null, currency: "USD", monthlyTokens: "999999999999999999", monthlyCost: "999999999999.999999999999", runTokens: "9007199254740993", runCost: "0.000000000001", requestsPerMinute: 10, concurrency: 2, version: 3, period: "UTC calendar month", costIsEstimate: true };
const members = [{ userId: user, userName: "Fixture <script>", userEmail: "fixture@test.invalid" }];
const priceInput: PriceInput = { providerId: provider.id, model: "fixture-model", currency: "USD", inputPerMillion: "999999999999.999999", outputPerMillion: "1.000001", cachedPerMillion: "0", reasoningPerMillion: "0", evidenceDate: "2026-11-02", source: "synthetic" };
const budgetInput: BudgetInput = { userId: null, currency: "USD", monthlyTokens: budget.monthlyTokens, monthlyCost: budget.monthlyCost, runTokens: budget.runTokens, runCost: budget.runCost, requestsPerMinute: 10, concurrency: 2, expectedVersion: 3 };
type Props = Record<string, unknown> & { children?: React.ReactNode };
const flush = async () => { for (let i = 0; i < 8; i++) await new Promise(resolve => setImmediate(resolve)); };
function deferred<T>() { let resolve!: (v: T) => void; let reject!: (err: unknown) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }

function harness(component: string, initialProps: Props, locale: "en-US" | "fa-IR", options: { file?: string; overrides?: Record<string, unknown> } = {}) {
  const file = options.file ?? "components/ai/usage-settings-forms.tsx", require = createRequire(resolve(file));
  const slots: unknown[] = []; let cursor = 0, props = initialProps;
  const captured: { kind: string; props: Props }[] = [];
  const state = (initial: unknown) => { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === "function" ? initial() : initial; return [slots[i], (v: unknown) => { slots[i] = typeof v === "function" ? v(slots[i]) : v; }]; };
  const capture = (factory: typeof jsx.jsx) => (type: React.ElementType, p: Props, key?: string) => { captured.push({ kind: typeof type === "string" ? type : (type as { name?: string }).name ?? "", props: p }); return factory(type, p, key); };
  const compiled = { exports: {} as Record<string, React.ComponentType<Props>> };
  const code = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function("require", "module", "exports", code)((id: string) => {
    if (options.overrides && Object.hasOwn(options.overrides, id)) return options.overrides[id];
    if (id === "react") return { ...React, useState: state, useRef: (initial: unknown) => state({ current: initial })[0], useId: () => state("fixture-id")[0] };
    if (id === "react/jsx-runtime") return { ...jsx, jsx: capture(jsx.jsx), jsxs: capture(jsx.jsxs) };
    if (id.endsWith("/admin-client")) return { AiAdminError };
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  }, compiled, compiled.exports);
  const render = (updated?: Props) => { if (updated) props = { ...props, ...updated }; cursor = 0; captured.length = 0; return renderWithPresentation(React.createElement(compiled.exports[component], props), locale); };
  const field = (name: string) => { const item = captured.find(v => v.props.name === name); assert.ok(item, `missing field ${name}`); return item.props; };
  const change = (name: string, value: string) => { (field(name).onChange as (e: unknown) => void)({ target: { value } }); render(); };
  let focused = "";
  const submit = async () => { const f = captured.find(v => v.kind === "form"); assert.ok(f); await (f.props.onSubmit as (e: unknown) => Promise<void>)({ preventDefault() {}, currentTarget: { elements: { namedItem(name: string) { return { focus() { focused = name; } }; } } } }); return render(); };
  const button = (label: string) => { const item = captured.find(v => v.kind === "Button" && v.props.children === label); assert.ok(item, `missing button ${label}`); return item.props; };
  render(); return { render, field, change, submit, button, captured, get focused() { return focused; } };
}

test("exact AI setting numbers normalize Persian/Arabic scripts without floating point or excess precision", () => {
  assert.equal(usageNumber("۹۹۹۹۹۹۹۹۹۹۹۹٫۹۹۹۹۹۹"), "999999999999.999999");
  assert.equal(usageNumber("٩٠٠٧١٩٩٢٥٤٧٤٠٩٩٣"), "9007199254740993");
  assert.equal(usageNumber("۹۹۹,۹۹۹.۰۰۰۰۰۰۰۰۰۰۰۱"), "999999.000000000001");
  assert.equal(priceRate("999999999999999999"), "999999999999.999999");
  for (const bad of ["۱2", "1e3", "1,23", " 1", "1٫2.3", "1\u202e2"]) assert.throws(() => usageNumber(bad));
});

test("real English/Persian price form submits exact new versions, preserves failures and requires review after uncertainty", async () => {
  for (const locale of ["en-US", "fa-IR"] as const) {
    const messages = locale === "en-US" ? en.AiUsageSettings : fa.AiUsageSettings;
    const calls: PriceInput[] = []; let error: "invalid" | "network" | undefined = "invalid";
    const h = harness("PriceVersionForm", { providers: [provider], blocked: false, readVersion: 1, save: async (value: PriceInput) => { calls.push(value); if (error) throw new AiAdminError(error); return price; } }, locale);
    assert.ok(h.render().includes(messages.immutableHelp));
    for (const [key, value] of Object.entries(priceInput)) h.change(key, key === "inputPerMillion" ? "۹۹۹۹۹۹۹۹۹۹۹۹٫۹۹۹۹۹۹" : String(value));
    assert.ok(!(h.field("inputPerMillion").type === "number"));
    let html = await h.submit(); assert.deepEqual(calls[0], priceInput); assert.equal(h.field("inputPerMillion").value, "۹۹۹۹۹۹۹۹۹۹۹۹٫۹۹۹۹۹۹"); assert.ok(html.includes(locale === "en-US" ? en.AiManagementErrors.invalid : fa.AiManagementErrors.invalid)); error = "network"; html = await h.submit(); assert.ok(html.includes(messages.uncertainHelp)); assert.equal(h.button(messages.createPrice).disabled, true);
    await h.submit(); assert.equal(calls.length, 2, "an uncertain immutable write must not silently replay"); h.render({ readVersion: 2 }); error = undefined;
    html = await h.submit(); assert.ok(html.includes(messages.priceSaved)); assert.equal(h.button(messages.createPrice).disabled, true);
    await h.submit(); assert.equal(calls.length, 3); h.change("inputPerMillion", "0.0000001"); await h.submit(); assert.equal(h.focused, "inputPerMillion"); assert.equal(calls.length, 3); assert.equal(h.field("inputPerMillion")["aria-invalid"], true);
  }
});

test("real bilingual member/org budget editors retain exact entries and explicitly review/reapply a newer version", async () => {
  for (const locale of ["en-US", "fa-IR"] as const) {
    const m = locale === "en-US" ? en.AiUsageSettings : fa.AiUsageSettings;
    const calls: BudgetInput[] = []; let conflict = true;
    const h = harness("BudgetForm", { budget, members, blocked: false, readVersion: 1, save: async (value: BudgetInput) => { calls.push(value); if (conflict) throw new AiAdminError("conflict"); return { ...budget, ...value, version: value.expectedVersion! + 1 }; } }, locale);
    assert.equal(h.field("monthlyTokens").value, "999999999999999999");
    h.change("runTokens", "۹۰۰۷۱۹۹۲۵۴۷۴۰۹۹۳"); await h.submit(); assert.deepEqual(calls[0], budgetInput);
    const newer = { ...budget, version: 4, runTokens: "100" };
    let html = h.render({ budget: newer, readVersion: 2 }); assert.equal(h.field("runTokens").value, "۹۰۰۷۱۹۹۲۵۴۷۴۰۹۹۳"); assert.ok(html.includes(m.reviewCurrent));
    assert.equal(h.button(m.saveBudget).disabled, true); await h.submit(); assert.equal(calls.length, 1);
    (h.button(m.reapplyEdits).onClick as () => void)(); h.render(); conflict = false;
    await h.submit(); assert.equal(calls[1].expectedVersion, 4); assert.equal(calls[1].runTokens, "9007199254740993");
    h.render({ budget: { ...newer, version: 6, runTokens: "25" } }); (h.button(m.loadCurrent).onClick as () => void)(); html = h.render(); assert.equal(h.field("runTokens").value, "25");
    const memberCalls: BudgetInput[] = [];
    const add = harness("BudgetForm", { members, blocked: false, readVersion: 1, save: async (value: BudgetInput) => { memberCalls.push(value); return { ...budget, ...value, version: 1 }; } }, locale);
    add.change("scope", "member"); add.change("userId", user); add.change("currency", "USD");
    for (const key of ["monthlyTokens", "monthlyCost", "runTokens", "runCost", "requestsPerMinute", "concurrency"] as const) add.change(key, String(budgetInput[key]));
    assert.ok(add.render().includes("Fixture &lt;script&gt;")); await add.submit(); assert.equal(memberCalls[0].userId, user); assert.ok(!("expectedVersion" in memberCalls[0]));
    assert.equal(add.field("monthlyCost").value, "", "only the successfully created form clears");
    const removed = harness("BudgetForm", { budget: { ...budget, userId: user, subject: `user:${user}` }, members: [], blocked: false, readVersion: 1, save: async () => { throw new Error("must not submit"); } }, locale);
    assert.equal(removed.button(m.saveBudget).disabled, true); assert.ok(removed.render().includes(m.memberMissing));
    for (const value of Object.values(fa.AiUsageSettings)) { assert.match(value, /[\u0600-\u06ff]/); assert.ok(!value.includes("???")); }
  }
});

test("assembled settings render exact history and accessible English LTR/Persian RTL sections without exposing denied forms", () => {
  for (const locale of ["en-US", "fa-IR"] as const) {
    const m = locale === "en-US" ? en.AiUsageSettings : fa.AiUsageSettings;
    const state = { organizationId: org, prices: { data: { prices: [price], providers: [provider] }, loading: false, readVersion: 1 }, budgets: { data: { budgets: [budget], members }, loading: false, readVersion: 1 } };
    const controller = { state, subscribe() { return () => {}; }, refresh() {}, createPrice() {}, saveBudget() {} };
    const h = harness("AiUsageSettings", {}, locale, { file: "components/ai/usage-settings.tsx", overrides: { "@/lib/ai/usage-settings-client": { priceRate, UsageSettingsController: class { constructor() { return controller; } } } } });
    const html = h.render();
    assert.ok(html.includes(`dir="${locale === "fa-IR" ? "rtl" : "ltr"}"`)); assert.ok(html.includes("Fixture &lt;script&gt;"));
    assert.ok(html.includes("999999999999.999999")); assert.ok(html.includes('value="999999999999.999999999999"'));
    assert.ok(html.includes(m.zeroHelp)); assert.ok(html.includes(m.bothBudgets)); assert.ok(html.includes('dir="ltr"')); assert.ok(!html.includes('type="number"'));
    assert.ok(html.includes('aria-label="' + m.prices + '"')); assert.ok(html.includes(m.reloadPrices));
    const denied = { state: { ...state, prices: { loading: false, error: "denied", readVersion: 1 }, budgets: { loading: false, error: "denied", readVersion: 1 } } };
    const deniedHtml = harness("AiUsageSettings", {}, locale, { file: "components/ai/usage-settings.tsx", overrides: { "@/lib/ai/usage-settings-client": { priceRate, UsageSettingsController: class { constructor() { return denied; } } } } }).render();
    assert.ok(!deniedHtml.includes("<form")); assert.ok(deniedHtml.includes('role="alert"'));
  }
});

test("form submission fences rapid duplicate clicks while the confirmed save is pending", async () => {
  const pending = deferred<UsageBudget>(); let calls = 0;
  const h = harness("BudgetForm", { budget, members, blocked: false, readVersion: 1, save: async () => { calls++; return pending.promise; } }, "en-US");
  const first = h.submit(); await h.submit(); assert.equal(calls, 1);
  pending.resolve({ ...budget, version: 4 }); await first;
});

function controllerFixture() {
  let currentOrg = org, mode: "all" | "price" | "budget" | "denied" = "all", failSave: string | undefined;
  const requests: { scope: string; resource: string; method: string; body?: unknown }[] = [];
  let delayed: ReturnType<typeof deferred<unknown>> | undefined;
  const request: typeof usageSettingsRequest = async <T>(scope: string, resource: Parameters<typeof usageSettingsRequest>[1], schema: z.ZodType<T>, method = "GET", body?: unknown) => {
    requests.push({ scope, resource, method, body });
    if (delayed) return schema.parse(await delayed.promise);
    if (mode === "denied" || mode === "price" && resource === "budgets" || mode === "budget" && resource === "prices") throw new AiAdminError("denied");
    if (method !== "GET" && failSave) throw new AiAdminError(failSave as "conflict");
    const data = method !== "GET" ? resource === "prices" ? { ...price, organizationId: scope } : { ...budget, ...(body as BudgetInput), organizationId: scope, version: ((body as BudgetInput).expectedVersion ?? 0) + 1 } : resource === "prices" ? { prices: [{ ...price, organizationId: scope }] } : resource === "budgets" ? { budgets: [{ ...budget, organizationId: scope }] } : resource === "members" ? { members } : { providers: [provider] };
    return schema.parse(data);
  };
  const controller = new UsageSettingsController(() => currentOrg, request);
  return { controller, requests, org(value: string) { currentOrg = value; }, mode(value: typeof mode) { mode = value; }, fail(value?: string) { failSave = value; }, delay(value?: typeof delayed) { delayed = value; } };
}

test("independent permissions and targeted mutations preserve other sections and revoke forms on denial", async () => {
  for (const role of ["price", "budget", "denied"] as const) {
    const f = controllerFixture(); f.mode(role); f.controller.start(); await flush();
    assert.equal(!!f.controller.state.prices.data, role === "price"); assert.equal(!!f.controller.state.budgets.data, role === "budget"); f.controller.dispose();
  }
  const f = controllerFixture(); f.controller.start(); await flush();
  const retained = f.controller.state.budgets, reads = f.requests.filter(v => v.method === "GET").length;
  await f.controller.createPrice(priceInput); assert.equal(f.controller.state.budgets, retained); assert.equal(f.requests.filter(v => v.method === "GET").length, reads);
  f.fail("conflict"); await assert.rejects(f.controller.saveBudget(budgetInput), { key: "conflict" }); assert.equal(f.controller.state.budgets, retained);
  f.fail("denied"); await assert.rejects(f.controller.saveBudget(budgetInput), { key: "denied" }); assert.equal(f.controller.state.budgets.data, undefined); assert.ok(f.controller.state.prices.data);
  f.controller.dispose();
});

test("delayed reads/saves and organization A/B/A switches cannot disclose or adopt obsolete results", async () => {
  const f = controllerFixture(); f.controller.start(); await flush();
  const delay = deferred<unknown>(); f.delay(delay);
  const write = f.controller.createPrice(priceInput); f.org(other); f.delay(undefined); f.controller.sync(); await flush();
  delay.resolve(price); await assert.rejects(write, { key: "conflict" }); assert.equal(f.controller.state.organizationId, other); assert.ok(f.controller.state.prices.data?.prices.every(p => p.organizationId === other));
  const stale = deferred<unknown>(); f.delay(stale); const read = f.controller.refresh("budgets");
  f.org(org); f.delay(undefined); f.controller.sync(); await flush(); f.org(other); f.controller.sync(); await flush();
  const latest = f.controller.state.budgets; stale.resolve({ budgets: [budget], members }); await read; assert.equal(f.controller.state.budgets, latest);
  const count = f.requests.length; f.org(org); await assert.rejects(f.controller.saveBudget(budgetInput), { key: "conflict" }); assert.ok(!f.requests.slice(count).some(v => v.method !== "GET"));
  const old = f.controller.state; f.controller.dispose(); await flush(); assert.equal(f.controller.state, old);
});

test("a confirmed save invalidates an older overlapping reload and releases its loading state", async () => {
  const f = controllerFixture(); f.controller.start(); await flush();
  const writing = deferred<unknown>(), reading = deferred<unknown>();
  f.delay(writing); const write = f.controller.createPrice(priceInput);
  f.delay(reading); const read = f.controller.refresh("prices");
  assert.equal(f.controller.state.prices.loading, true);
  const created = { ...price, id: "77777777-7777-4777-8777-777777777777" };
  writing.resolve(created); await write; assert.equal(f.controller.state.prices.loading, false);
  assert.equal(f.controller.state.prices.data!.prices[0].id, created.id);
  reading.resolve({ prices: [price], providers: [provider] }); await read;
  assert.equal(f.controller.state.prices.data!.prices[0].id, created.id); assert.equal(f.controller.state.prices.loading, false);
  f.controller.dispose();
});

test("browser envelopes reject malformed, foreign and unsafe numeric DTOs and conceal diagnostics", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (url, init) => { assert.equal(String(url), "/api/v1/ai/prices"); assert.equal((init?.headers as Record<string, string>)["x-organization-id"], org); return Response.json(price); };
    assert.deepEqual(await usageSettingsRequest(org, "prices", priceDto, "POST", priceInput), price);
    assert.equal(budgetDto.safeParse({ ...budget, monthlyTokens: 999999999999999999 }).success, false);
    globalThis.fetch = async () => Response.json({ ...price, inputRate: 10 }); await assert.rejects(usageSettingsRequest(org, "prices", priceDto), { key: "failed" });
    globalThis.fetch = async () => Response.json({ error: "PRIVATE-SENTINEL" }, { status: 403 }); await assert.rejects(usageSettingsRequest(org, "budgets", budgetDto), err => err instanceof AiAdminError && err.key === "denied" && !err.message.includes("PRIVATE"));
    globalThis.fetch = async () => { throw new Error("PRIVATE-SENTINEL"); }; await assert.rejects(usageSettingsRequest(org, "budgets", budgetDto), { key: "network" });
    await assert.rejects(usageSettingsRequest("", "prices", priceDto), { key: "missingOrganization" });
    globalThis.fetch = async url => Response.json(String(url).endsWith("/prices") ? { prices: [{ ...price, organizationId: other }] } : String(url).endsWith("/provider-catalog") ? { providers: [provider] } : String(url).endsWith("/budgets") ? { budgets: [budget] } : { members });
    const controller = new UsageSettingsController(() => org); controller.start(); await flush(); assert.equal(controller.state.prices.error, "failed"); assert.equal(controller.state.prices.data, undefined); assert.ok(controller.state.budgets.data); controller.dispose();
  } finally { globalThis.fetch = original; }
});
