import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import * as React from "react";
import * as jsx from "react/jsx-runtime";
import ts from "typescript";
import { renderWithPresentation } from "./helpers/presentation";
import { AiAdminError } from "../lib/ai/admin-client";
import { DashboardController, dashboardRequest, DashboardRequestError, defaultFilters, filterQuery, reportDto, type DashboardState, type Report, type Detail, type Filters } from "../lib/ai/dashboard-client";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const org = "11111111-1111-4111-8111-111111111111", other = "22222222-2222-4222-8222-222222222222", user = "33333333-3333-4333-8333-333333333333";
const metrics = { attempts: "2", reservedAttempts: "1", inFlightAttempts: "0", unknownAttempts: "1", settledAttempts: "0", cancelledAttempts: "0", inputTokens: "9007199254740993", outputTokens: null, cachedTokens: null, reasoningTokens: null, unknownInputAttempts: "1", unknownOutputAttempts: "2", unknownCachedAttempts: "2", unknownReasoningAttempts: "2", chargedTokens: "9007199254740993", chargedCost: "900719925474099300.000000000001", settledCost: "0.000000000000", reservedCost: "900719925474099300.000000000000", unresolvedCost: "0.000000000001" };
const group = { ...metrics, currency: "USD", userId: user, providerId: user, model: "fixture<script>", priceId: user };
const report: Report = { scope: "own", organizationId: org, filters: {}, groups: [group], totalsByCurrency: [{ ...metrics, currency: "USD" }, { ...metrics, currency: "EUR" }], totalGroups: "26", page: 1, pageSize: 25, hasNextPage: true, costsAreEstimates: true, costUnit: "major-billing-currency-decimal", tokensAreObservedPartialSums: true };
const run = { id: user, ownerId: user, state: "running" as const, version: 1, createdAt: "2026-11-02T00:00:00Z", startedAt: "2026-11-02T00:00:00Z", finishedAt: null, cancelRequestedAt: null, durationMs: null };
const detail: Detail = { run, canStop: true, reasonCode: "RUN_RUNNING", outcomes: { requests: [], tools: [{ state: "uncertain", count: "1" }] } };
const flush = async () => { for (let i = 0; i < 6; i++) await new Promise(resolve => setImmediate(resolve)); };
function deferred<T>() { let resolve!: (v: T) => void; const promise = new Promise<T>(yes => { resolve = yes; }); return { promise, resolve }; }

function fixture(site = false) {
  let selected = org, denied = false, fail: string | undefined, delay: ReturnType<typeof deferred<unknown>> | undefined;
  const calls: { org: string; path: string; query: Record<string, string>; body: unknown }[] = [];
  const request: typeof dashboardRequest = async <T>(orgId: string, path: string, schema: import("zod").z.ZodType<T>, query: Record<string, string> = {}, body?: unknown) => {
    calls.push({ org: orgId, path, query, body });
    if (delay) return schema.parse(await delay.promise);
    if (denied) throw new AiAdminError("denied");
    if (fail && (body || path.includes("export"))) throw new DashboardRequestError(fail as "conflict");
    if (path.includes("/usage")) return schema.parse({ ...report, organizationId: site ? undefined : orgId, scope: site ? "site" : query.scope, groups: site ? [{ ...group, organizationId: org }] : report.groups, ...(path.includes("export") ? { page: undefined, hasNextPage: undefined, complete: true, totalGroups: "1" } : { page: Number(query.page) }) });
    if (path.endsWith("/quota")) return schema.parse({ organizationId: orgId, scope: query.scope, currency: query.currency, asOf: "2026-11-02T00:00:00Z", from: "2026-11-01T00:00:00Z", resetAt: "2026-12-01T00:00:00Z", constraints: [{ subject: "organization", status: "BUDGET_MISSING" }] });
    if (path.endsWith("/runs")) return schema.parse({ organizationId: orgId, scope: query.scope, rows: [run], totalRuns: "1", page: Number(query.page), hasNextPage: false, outcomes: detail.outcomes });
    if (path.endsWith("/run")) return schema.parse(detail);
    if (path.endsWith("/stop")) return schema.parse({ id: user, state: "running", version: 2 });
    if (path.endsWith("/disable")) return schema.parse({ id: user, enabled: false, version: 2 });
    return schema.parse({ configurations: [{ id: user, providerId: user, model: "fixture", enabled: true, isDefault: true, timeoutMs: 1000, version: 1, credentialConfigured: true }] });
  };
  const controller = new DashboardController(site, () => selected, request);
  return { controller, calls, org(v: string) { selected = v; }, deny(v = true) { denied = v; }, fail(v?: string) { fail = v; }, delay(v?: typeof delay) { delay = v; } };
}

type Props = Record<string, unknown> & { children?: React.ReactNode };
function harness(component: string, initial: Props, locale: "en-US" | "fa-IR") {
  const file = "components/ai/usage-dashboard.tsx", require = createRequire(resolve(file)), slots: unknown[] = [];
  let cursor = 0, props = initial;
  const captured: { kind: string; props: Props }[] = [];
  const state = (value: unknown) => { const i = cursor++; if (!(i in slots)) slots[i] = typeof value === "function" ? value() : value; return [slots[i], (v: unknown) => { slots[i] = typeof v === "function" ? v(slots[i]) : v; }]; };
  const capture = (factory: typeof jsx.jsx) => (type: React.ElementType, p: Props, key?: string) => { captured.push({ kind: typeof type === "string" ? type : (type as { name?: string }).name ?? "", props: p }); return factory(type, p, key); };
  const compiled = { exports: {} as Record<string, React.ComponentType<Props>> };
  const code = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function("require", "module", "exports", code)((id: string) => {
    if (id === "react") return { ...React, useState: state, useRef: (v: unknown) => state({ current: v })[0], useId: () => state("fixture-id")[0] };
    if (id === "react/jsx-runtime") return { ...jsx, jsx: capture(jsx.jsx), jsxs: capture(jsx.jsxs) };
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  }, compiled, compiled.exports);
  const render = (next?: Props) => { if (next) props = { ...props, ...next }; cursor = 0; captured.length = 0; return renderWithPresentation(React.createElement(compiled.exports[component], props), locale); };
  const field = (name: string) => { const result = captured.find(v => v.props.id === `fixture-id-${name}`); assert.ok(result, name); return result.props; };
  const button = (label: string) => { const result = captured.find(v => v.kind === "Button" && v.props.children === label); assert.ok(result, label); return result.props; };
  const click = (label: string) => { const p = button(label); assert.ok(!p.disabled); (p.onClick as () => void)(); render(); };
  render(); return { render, captured, field, button, click, change(name: string, value: string) { (field(name).onChange as (e: unknown) => void)({ target: { value } }); render(); } };
}

test("report filters use exact IDs, UTC exclusive windows, separate run filters and real reset", () => {
  const filters = { ...defaultFilters(new Date("2026-11-02Z")), currency: "USD", userId: user, organizationId: other, model: "fixture", state: "unknown", runState: "running" };
  assert.deepEqual(filterQuery(filters, "organization", true), { scope: "organization", from: "2026-11-01T00:00:00.000Z", to: "2026-12-01T00:00:00.000Z", userId: user, state: "running" });
  assert.equal(filterQuery(filters, "own").userId, undefined); assert.equal(filterQuery(filters, "organization").organizationId, undefined); assert.equal(filterQuery(filters, "site").organizationId, other);
  for (const bad of [{ to: filters.from }, { from: "2025-01-01" }, { from: "2026-02-30" }, { currency: "usd" }, { priceId: "bad" }, { runState: "unknown" }]) assert.throws(() => filterQuery({ ...filters, ...bad }, "organization", !!bad.runState));
});

test("English/Persian production filter handlers preserve draft edits through failures and paginate applied filters", async () => {
  for (const locale of ["en-US", "fa-IR"] as const) {
    const f = fixture(); f.controller.start(); await flush(); const t = (locale === "en-US" ? en : fa).AiDashboard;
    let applied: Filters | undefined, resets = 0;
    const h = harness("DashboardFilters", { state: f.controller.state, apply: (v: Filters) => { applied = v; }, reset: () => { resets++; } }, locale);
    h.change("model", "edited-model"); h.change("currency", "EUR");
    h.render({ state: { ...f.controller.state, report: { loading: false, error: "network" } } }); assert.equal(h.field("model").value, "edited-model");
    const form = h.captured.find(v => v.kind === "form")!; (form.props.onSubmit as (e: unknown) => void)({ preventDefault() {} }); assert.equal(applied!.currency, "EUR");
    assert.equal(h.field("from").type, "date"); assert.ok(h.render().includes(t.filterHelp));
    await f.controller.apply(applied!); await f.controller.page(2); assert.equal(f.calls.at(-1)!.query.model, "edited-model"); assert.equal(f.calls.at(-1)!.query.page, "2");
    h.click(t.reset); assert.equal(resets, 1); assert.equal(h.field("model").value, ""); f.controller.dispose();
  }
});

test("rendered bilingual dashboard shows full exact currency totals, uncertainty, quota and authorized controls", async () => {
  for (const locale of ["en-US", "fa-IR"] as const) {
    const f = fixture(); f.controller.start(); await flush(); await f.controller.inspect(user);
    const t = (locale === "en-US" ? en : fa).AiDashboard;
    const h = harness("DashboardView", { state: f.controller.state, controller: f.controller }, locale); const html = h.render();
    assert.ok(html.includes(locale === "fa-IR" ? 'dir="rtl"' : 'dir="ltr"')); assert.ok(html.includes("900719925474099300.000000000001")); assert.ok(html.includes("9007199254740993"));
    for (const value of ["USD", "EUR", t.unknown, t.constraint_BUDGET_MISSING, t.priceHelp, t.exportHelp, t.quotaHelp]) assert.ok(html.includes(value), value);
    assert.ok(html.includes("fixture&lt;script&gt;"), "escaped model"); assert.ok(!html.includes("<script>"), "no executable script"); assert.ok(html.includes('tabIndex="0"') || html.includes('tabindex="0"'), "keyboard scroll region"); assert.ok(html.includes('aria-label="' + t.runs), "named run region");
    assert.equal(h.button(t.stop).disabled, false); h.click(t.inspect); await flush();
    const readonly: DashboardState = { ...f.controller.state, detail: { loading: false, data: { ...detail, canStop: false } }, configs: { loading: false } };
    const deniedHtml = h.render({ state: readonly }); assert.ok(!deniedHtml.includes(t.stop + "</")); assert.ok(!h.captured.some(v => v.kind === "DashboardConfirmation"));
    for (const part of ["report", "runs", "quota"] as const) { const loading = h.render({ state: { ...readonly, [part]: { loading: true } } }); assert.ok(loading.includes('role="status"')); }
    const failure = h.render({ state: { ...readonly, report: { loading: false, error: "denied" }, notice: "conflict" } }); assert.ok(failure.includes('role="alert"')); assert.ok(!failure.includes("PRIVATE"));
    const empty = h.render({ state: { ...readonly, report: { loading: false, data: { ...report, groups: [], totalsByCurrency: [], totalGroups: "0", hasNextPage: false } } } }); assert.ok(empty.includes(t.empty));
    const site = h.render({ state: { ...readonly, scope: "site", organizationId: "", report: { loading: false, data: { ...report, scope: "site", organizationId: undefined, groups: [{ ...group, organizationId: org }] } } } }); assert.ok(site.includes(t.site)); assert.ok(!site.includes(t.stop + "</")); assert.ok(!h.captured.some(v => v.kind === "DashboardConfirmation"));
    f.controller.dispose();
  }
});

test("concrete stop/disable confirmations default focus to cancel and never invoke action on open", () => {
  for (const locale of ["en-US", "fa-IR"] as const) for (const kind of ["stop", "disable"] as const) {
    const t = (locale === "en-US" ? en : fa).AiDashboard; let calls = 0;
    const h = harness("DashboardConfirmation", { kind, target: user, version: 7, busy: false, confirm: () => { calls++; } }, locale);
    assert.equal(calls, 0); (h.captured.find(v => v.kind === "Dialog")!.props.onOpenChange as (open: boolean) => void)(true); h.render(); assert.equal(calls, 0);
    const content = h.captured.find(v => v.kind === "DialogContent")!; let focused = false;
    (h.button(t.cancel).ref as { current: unknown }).current = { focus() { focused = true; } };
    (content.props.onOpenAutoFocus as (e: unknown) => void)({ preventDefault() {} }); assert.ok(focused);
    h.click(t[`${kind}Confirm`]); assert.equal(calls, 1);
  }
});

test("scope fences discard delayed reads/details/writes/exports and organization A/B/A results", async () => {
  const f = fixture(); f.controller.start(); await flush(); const old = deferred<unknown>(); f.delay(old);
  const reading = f.controller.page(2); f.org(other); f.delay(undefined); f.controller.sync(); await flush(); f.org(org); f.controller.sync(); await flush();
  const latest = f.controller.state.report; old.resolve(report); await reading; assert.equal(f.controller.state.report, latest);
  const exportDelay = deferred<unknown>(); f.delay(exportDelay); let downloads = 0; const exporting = f.controller.export(() => downloads++);
  f.org(other); f.delay(undefined); f.controller.sync(); await flush(); exportDelay.resolve({ ...report, totalGroups: "1", complete: true }); await exporting; assert.equal(downloads, 0);
  await f.controller.inspect(user); const writeDelay = deferred<unknown>(); f.delay(writeDelay); const stopping = f.controller.stop(user, 1);
  f.org(org); f.delay(undefined); f.controller.sync(); await flush(); const newState = f.controller.state;
  writeDelay.resolve({ id: user, state: "running", version: 2 }); await stopping; assert.equal(f.controller.state, newState);
  const detailDelay = deferred<unknown>(); f.delay(detailDelay); const inspecting = f.controller.inspect(user); f.controller.select("organization"); f.delay(undefined); await flush(); detailDelay.resolve(detail); await inspecting; assert.equal(f.controller.state.detail.data, undefined);
  f.controller.dispose();
});

test("duplicates, conflicts, denial and uncertain writes require fresh explicit inspection; exports never use a page", async () => {
  const f = fixture(); f.controller.start(); await flush(); await f.controller.inspect(user);
  const delayed = deferred<unknown>(); f.delay(delayed); const first = f.controller.stop(user, 1), second = f.controller.stop(user, 1);
  assert.equal(f.calls.filter(v => v.path.endsWith("/stop")).length, 1); f.delay(undefined); delayed.resolve({ id: user, state: "running", version: 2 }); await Promise.all([first, second]);
  assert.equal(f.controller.state.detail.data, undefined); await f.controller.stop(user, 1); assert.equal(f.calls.filter(v => v.path.endsWith("/stop")).length, 1);
  for (const error of ["conflict", "network", "denied"]) { await f.controller.inspect(user); f.fail(error); await f.controller.stop(user, 1); assert.equal(f.controller.state.notice, error); assert.equal(f.controller.state.detail.data, undefined); f.fail(); }
  await f.controller.load(); await f.controller.page(2); let exported: Report | undefined; await f.controller.export(data => { exported = data; }); assert.equal(exported?.complete, true); assert.equal(exported?.groups.length, 1); assert.ok(!("page" in f.calls.at(-1)!.query)); assert.equal(exported?.costUnit, "major-billing-currency-decimal");
  f.fail("tooLarge"); exported = undefined; await f.controller.export(data => { exported = data; }); assert.equal(exported, undefined); assert.equal(f.controller.state.notice, "tooLarge");
  f.deny(); await f.controller.load(); assert.equal(f.controller.state.report.data, undefined); assert.equal(f.controller.state.configs.data, undefined); f.controller.dispose();
});

test("site dashboard needs no organization, never requests operations and rejects foreign/malformed envelopes", async () => {
  const f = fixture(true); f.controller.start(); await flush(); assert.equal(f.controller.state.report.data?.scope, "site"); assert.ok(f.calls.every(v => v.org === "" && v.path.startsWith("/api/v1/admin/ai/")));
  await f.controller.inspect(user); await f.controller.runPage(); await f.controller.stop(user, 1); await f.controller.disable(user, 1); assert.equal(f.calls.length, 1);
  let count = 0; await f.controller.export(() => count++); assert.equal(count, 1); f.controller.dispose();
  assert.equal(reportDto.safeParse({ ...report, totalGroups: 9007199254740993 }).success, false);
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => Response.json({ ...report, organizationId: other }); const c = new DashboardController(false, () => org); c.start(); await flush(); assert.equal(c.state.report.error, "failed"); assert.equal(c.state.report.data, undefined); c.dispose();
    globalThis.fetch = async () => Response.json({ error: "PRIVATE-SENTINEL" }, { status: 403 }); await assert.rejects(dashboardRequest(org, "/api/v1/ai/usage/report", reportDto), e => e instanceof AiAdminError && e.key === "denied" && !e.message.includes("PRIVATE"));
  } finally { globalThis.fetch = original; }
});
