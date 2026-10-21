import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import * as React from "react";
import { createElement, type ComponentType, type ReactNode } from "react";
import * as jsx from "react/jsx-runtime";
import * as nextIntl from "next-intl";
import ts from "typescript";
import * as detailPresentation from "../i18n/crm-detail-presentation";
import * as activityPresentation from "../i18n/crm-activity-presentation";
import * as brandLoader from "../components/dashboard/brand-loader";
import * as searchInput from "../components/ui/search-input";
import { crmDealDetailJson, crmDealsJson, crmActivitiesJson } from "../i18n/crm-presentation";
import { crmAnalyticsJson } from "../i18n/crm-analytics-presentation";
import { payrollMoneyDisplay } from "../lib/money/payroll-display";
import { renderWithPresentation } from "./helpers/presentation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const root = "app/(dashboard)/crm", detail = `${root}/deals/[id]`, layout = `${detail}/layout.tsx`;
const drawer = "components/dashboard/create-drawer.tsx";
const namespaces = ["CrmPipeline", "CrmDetail", "CrmActivity", "CrmAnalytics"] as const;
const noop = () => {};
const caller = '<script>Caller & "deal"</script>';
const escaped = (s: string) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
const pipeline = { id: "pipeline-a", name: caller, isDefault: true, stages: [{ id: "lead", name: caller, color: "#10b981" }, { id: "qualified", name: caller, color: "#aabbcc" }] };
const activity = { id: "activity-a", type: "call", content: caller, createdAt: "2026-10-21T00:00:00Z", user: { name: caller } };
const deal = {
  id: "deal-a", title: caller, stageId: "lead", valueCents: Number.MAX_SAFE_INTEGER, valueCentsMinor: String(Number.MAX_SAFE_INTEGER),
  currency: "KWD", probability: 33, expectedCloseDate: "2024-02-29", source: "cold_outreach", notes: caller, lostReason: caller,
  createdAt: "2026-10-21T00:00:00Z", wonAt: null, lostAt: null,
  contact: { id: "contact-a", name: caller, email: "caller@example.test" }, assignedUser: { id: "user-a", name: caller }, pipeline, activities: [activity],
};
const feed = { activities: [activity], pagination: { page: 1, limit: 30, total: 1, totalPages: 1 }, totalAll: 1, typeCounts: { note: 0, email: 0, call: 1, meeting: 0, task: 0 } };
type States = Record<string, Record<string, unknown>>;
type Capture = { kind: string; props: Record<string, unknown> };

// Link the production layout/provider and sibling pages, retaining one real
// React context and next-intl provider. Only hooks/IO/motion/portals are controlled.
function composition(pathname: string, states: States = {}) {
  const cache = new Map<string, Record<string, ComponentType<Record<string, unknown>>>>();
  const captured: Capture[] = [], events: [string, unknown][] = [];
  const capture = (factory: typeof jsx.jsx) => (kind: unknown, props: Record<string, unknown>, key: string) => {
    captured.push({ kind: typeof kind === "string" ? kind : (kind as { name?: string })?.name ?? "", props });
    return factory(kind as Parameters<typeof jsx.jsx>[0], props, key);
  };
  function load(file: string) {
    const path = resolve(file);
    if (cache.has(path)) return cache.get(path)!;
    const source = readFileSync(path, "utf8");
    const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const hooks: string[] = [];
    function inspect(n: ts.Node) {
      if (ts.isVariableDeclaration(n) && ts.isArrayBindingPattern(n.name) && n.initializer && ts.isCallExpression(n.initializer) && n.initializer.expression.getText(ast) === "useState") hooks.push(n.name.elements[0].getText(ast));
      ts.forEachChild(n, inspect);
    }
    inspect(ast);
    let index = 0;
    const overrides = states[file] ?? {};
    const inline = () => function Inline({ children, placeholder }: { children?: ReactNode; placeholder?: string }) { return createElement("div", null, children, placeholder); };
    const require = createRequire(path), compiled = { exports: {} as Record<string, ComponentType<Record<string, unknown>>> };
    const dependency = (id: string): unknown => {
      if (id === "react") return { ...React, useState: (initial: unknown) => {
        const key = hooks[index++]; return [Object.hasOwn(overrides, key) ? overrides[key] : typeof initial === "function" ? initial() : initial, (v: unknown) => events.push([key, v])];
      }, useEffect: noop };
      if (id === "react/jsx-runtime") return { ...jsx, jsx: capture(jsx.jsx), jsxs: capture(jsx.jsxs) };
      if (id === "next-intl") return nextIntl;
      if (id.endsWith("/crm-detail-presentation")) return detailPresentation;
      if (id.endsWith("/crm-activity-presentation")) return activityPresentation;
      if (id.endsWith("/brand-loader")) return brandLoader;
      if (id.endsWith("/search-input")) return searchInput;
      if (id === "./layout" || id === "../layout") return load(layout);
      if (id === "next/navigation") return { useParams: () => ({ id: deal.id }), usePathname: () => pathname, useRouter: () => ({ push: (v: string) => events.push(["push", v]) }) };
      if (id === "sonner") return { toast: { success: (v: string) => events.push(["success", v]), error: (v: string) => events.push(["error", v]) } };
      if (id.endsWith("/use-entity-title")) return { useEntityTitle: noop };
      if (id.endsWith("/use-document-title")) return { useDocumentTitle: noop };
      if (id.endsWith("/use-debounce")) return { useDebounce: (v: unknown) => v };
      if (id.endsWith("/create-drawer")) return { useCreateDrawer: () => ({ open: noop }) };
      if (id.endsWith("/use-confirm")) return { useConfirm: () => ({ dialog: null, confirm: async () => false }) };
      if (id.endsWith("/content-reveal")) return { ContentReveal: inline() };
      if (id === "motion/react") return { motion: { div: inline() }, MotionConfig: inline() };
      if (["/ui/select", "/ui/currency-select"].some(s => id.endsWith(s))) return new Proxy({}, { get: () => inline() });
      return require(id.startsWith("@/") ? resolve(id.slice(2)) : id.startsWith(".") ? resolve(dirname(path), id) : id);
    };
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    new Function("require", "module", "exports", code)(dependency, compiled, compiled.exports);
    cache.set(path, compiled.exports);
    return compiled.exports;
  }
  return { load, captured, events };
}
function text(value: unknown): string {
  if (Array.isArray(value)) return value.map(text).join("");
  if (React.isValidElement<{ children?: unknown }>(value)) return text(value.props.children);
  return typeof value === "string" ? value : "";
}

test("combined CRM inventory pairs all four namespaces and 224 Persian messages", () => {
  assert.deepEqual(Object.keys(en).filter(key => key.startsWith("Crm")), [...namespaces]);
  let count = 0;
  for (const namespace of namespaces) {
    assert.deepEqual(Object.keys(en[namespace]).sort(), Object.keys(fa[namespace]).sort());
    count += Object.keys(en[namespace]).length;
    for (const [key, value] of Object.entries(fa[namespace])) assert.match(value, /[\u0600-\u06ff]/u, `${namespace}.${key}`);
  }
  assert.equal(count, 224);
});

test("one checked deal composes actual shared context, navigation, overview/activity/settings in both locales", async () => {
  const checked = (await crmDealDetailJson(Response.json({ deal }), deal.id)).deal;
  const checkedFeed = await crmActivitiesJson(Response.json(feed), 1);
  for (const locale of ["en-US", "fa-IR"] as const) {
    const messages = locale === "en-US" ? en : fa;
    for (const [route, tab, label] of [
      ["page.tsx", "overview", messages.CrmDetail.dealInformation],
      ["activity/page.tsx", "activity", messages.CrmActivity.logActivity],
      ["settings/page.tsx", "settings", messages.CrmDetail.saveChanges],
    ] as const) {
      const path = `/crm/deals/${deal.id}${tab === "overview" ? "" : `/${tab}`}`;
      const c = composition(path, {
        [layout]: { deal: checked, loading: false },
        [`${detail}/activity/page.tsx`]: { activities: checkedFeed.activities, loading: false, total: 1, totalAll: 1, typeCounts: checkedFeed.typeCounts, hasMore: false },
      });
      const Layout = c.load(layout).default, Page = c.load(`${detail}/${route}`).default;
      const html = renderWithPresentation(createElement(Layout, null, createElement(Page)), locale);
      assert.ok(html.includes(escaped(label)), route);
      assert.ok(html.includes(escaped(caller)) && !html.includes("<script>"), route);
      assert.ok(html.includes(escaped(payrollMoneyDisplay(checked.valueCents, checked.currency))), route);
      for (const key of ["overview", "activity", "settings"] as const) {
        const button = c.captured.find(p => p.kind === "button" && text(p.props.children) === messages.CrmDetail[key]);
        assert.ok(button, `${route}: ${key}`);
        assert.equal(button.props.className?.toString().includes("border-foreground"), tab === key);
        (button.props.onClick as () => void)();
        assert.ok(c.events.some(([event, url]) => event === "push" && url === `/crm/deals/${deal.id}${key === "overview" ? "" : `/${key}`}`));
      }
      if (tab === "overview") {
        const weighted = (BigInt(checked.valueCents) * 33n * 2n + 100n) / 200n;
        assert.ok(html.includes(escaped(payrollMoneyDisplay(weighted, checked.currency))));
      }
      if (tab === "settings") assert.ok(html.includes('name="expectedCloseDate"') && html.includes("2024-02-29"));
      assert.ok(!html.includes("MISSING_MESSAGE"));
    }
  }
});

test("shared CRM shell blocks all sibling content for unavailable and previous-route data", () => {
  for (const locale of ["en-US", "fa-IR"] as const) for (const failed of [null, { ...deal, id: "previous-route" }]) {
    const messages = locale === "en-US" ? en : fa;
    for (const route of ["page.tsx", "activity/page.tsx", "settings/page.tsx"]) {
      const c = composition(`/crm/deals/${deal.id}`, { [layout]: { deal: failed, loading: false } });
      const Layout = c.load(layout).default, Page = c.load(`${detail}/${route}`).default;
      const html = renderWithPresentation(createElement(Layout, null, createElement(Page)), locale);
      assert.ok(!html.includes(escaped(caller)) && !html.includes("90071992547409.91"), route);
      assert.ok(!html.includes('name="notes"') && !html.includes(escaped(messages.CrmActivity.logActivity)));
      if (!failed) assert.ok(html.includes(escaped(messages.CrmDetail.unavailable)) && html.includes(escaped(messages.CrmDetail.backToPipeline)));
      else assert.ok(html.includes(`aria-label="${escaped(messages.SharedUI.loading2)}"`));
    }
  }
});

test("activity page invokes the actual shared create callback and refreshes only verified creations", async () => {
  const originalFetch = globalThis.fetch, storage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: () => "org-a" } });
  try {
    for (const locale of ["en-US", "fa-IR"] as const) for (const mode of ["ok", "http", "identity", "refresh"]) {
      const messages = locale === "en-US" ? en : fa;
      const calls: string[] = [];
      globalThis.fetch = async (url, init) => {
        calls.push(String(url));
        assert.equal((init?.headers as Record<string, string>)["x-organization-id"], "org-a");
        if (calls.length === 1) {
          assert.equal(url, `/api/v1/crm/deals/${deal.id}/activities`); assert.equal(init?.method, "POST");
          assert.equal((init.headers as Record<string, string>)["Content-Type"], "application/json");
          assert.deepEqual(JSON.parse(init.body as string), { type: "call", content: caller });
          return Response.json({ activity: { ...activity, dealId: mode === "identity" ? "other-deal" : deal.id, userId: "user-a", user: undefined } }, { status: mode === "http" ? 403 : 201 });
        }
        assert.equal(url, `/api/v1/crm/deals/${deal.id}/activities?sortBy=date&sortOrder=desc&page=1&limit=30`);
        return Response.json(mode === "refresh" ? {} : feed);
      };
      const c = composition(`/crm/deals/${deal.id}/activity`, {
        [layout]: { deal, loading: false, activityType: "call", activityContent: caller },
        [`${detail}/activity/page.tsx`]: { activities: [], loading: false, hasMore: false },
      });
      const Layout = c.load(layout).default, Activity = c.load(`${detail}/activity/page.tsx`).default;
      renderWithPresentation(createElement(Layout, null, createElement(Activity)), locale);
      const submit = c.captured.find(p => p.kind === "Button" && text(p.props.children) === messages.CrmActivity.addActivity);
      assert.ok(submit);
      await (submit.props.onClick as () => Promise<void>)();
      const created = mode === "ok" || mode === "refresh";
      assert.equal(calls.length, created ? 2 : 1);
      assert.equal(c.events.some(([key, value]) => key === "activityContent" && value === ""), created);
      assert.equal(c.events.some(([key, value]) => key === "success" && value === messages.CrmDetail.activityAdded), created);
      assert.equal(c.events.some(([key, value]) => key === "error" && value === messages.CrmDetail.activityFailed), !created);
      assert.equal(c.events.some(([key, value]) => key === "error" && value === messages.CrmActivity.loadFailed), mode === "refresh");
      assert.ok(c.events.some(([key, value]) => key === "submitting" && value === false));
      assert.equal(c.events.some(([key]) => key === "activities"), mode === "ok");
    }
  } finally {
    globalThis.fetch = originalFetch;
    if (storage) Object.defineProperty(globalThis, "localStorage", storage); else Reflect.deleteProperty(globalThis, "localStorage");
  }
});

test("checked pipeline, detail and analytics share identical maximum fixed cents across currency labels/locales", async () => {
  for (const currency of ["USD", "JPY", "KWD"]) {
    const checkedDeal = (await crmDealDetailJson(Response.json({ deal: { ...deal, currency } }), deal.id)).deal;
    const distribution = { lead: { count: 1, value: deal.valueCents, valueMinor: deal.valueCentsMinor } };
    const list = await crmDealsJson(Response.json({ data: [checkedDeal], pagination: { total: 1 }, summary: {
      currency, activeCount: 1, activeValue: deal.valueCents, activeValueMinor: deal.valueCentsMinor,
      wonCount: 0, wonValue: 0, wonValueMinor: "0", totalDeals: 1, stageDistribution: distribution,
    } }));
    const analytics = await crmAnalyticsJson(Response.json({ currency, totalDeals: 1, openDeals: 1, wonDeals: 0, lostDeals: 0,
      totalPipelineValue: deal.valueCents, totalPipelineValueMinor: deal.valueCentsMinor,
      wonValue: 0, wonValueMinor: "0", avgDealValue: 0, avgDealValueMinor: "0", conversionRate: 0, stageDistribution: distribution,
    }), currency);
    for (const locale of ["en-US", "fa-IR"] as const) {
      const c = composition("/crm", {
        [`${root}/page.tsx`]: { initialLoading: false, pipelinesReady: true, pipelines: [pipeline], activePipeline: pipeline, deals: list.data, summary: list.summary, total: 1, hasMore: false },
        [`${root}/analytics/page.tsx`]: { loading: false, data: analytics, currency },
        [layout]: { loading: false, deal: checkedDeal },
      });
      const Pipeline = c.load(`${root}/page.tsx`).default, Analytics = c.load(`${root}/analytics/page.tsx`).default, Layout = c.load(layout).default, Overview = c.load(`${detail}/page.tsx`).default;
      const html = renderWithPresentation(createElement("div", null, createElement(Pipeline), createElement(Analytics), createElement(Layout, null, createElement(Overview))), locale);
      const amount = escaped(payrollMoneyDisplay(deal.valueCents, currency));
      assert.ok(html.split(amount).length - 1 >= 6, `${currency}/${locale}: common amount across list, statistics, stage and detail`);
      assert.ok(!html.includes("MISSING_MESSAGE"));
    }
  }
});

test("combined extraction audits all seven CRM components and DealDrawer with explicit exceptions", () => {
  function files(path: string): string[] { return readdirSync(path, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(`${path}/${e.name}`) : e.name.endsWith(".tsx") ? [`${path}/${e.name}`] : []); }
  const routes = files(root);
  assert.deepEqual(routes.map(path => path.slice(root.length + 1)).sort(), ["page.tsx", "loading.tsx", "analytics/page.tsx", "deals/[id]/layout.tsx", "deals/[id]/page.tsx", "deals/[id]/activity/page.tsx", "deals/[id]/settings/page.tsx"].sort());
  for (const path of [...routes, drawer]) {
    const ast = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const owners = path === drawer ? ast.statements.filter(n => ts.isFunctionDeclaration(n) && n.name && ["DealDrawer", "DrawerFooter", "SectionLabel"].includes(n.name.text)) : [ast];
    function audit(n: ts.Node) {
      if (ts.isJsxText(n)) assert.doesNotMatch(n.text.trim().replace(/&(?:rarr|middot|ndash|mdash|infin);/g, ""), /[A-Za-z]/, `${path}: ${n.text.trim()}`);
      if (ts.isJsxAttribute(n) && ["title", "description", "placeholder", "aria-label", "alt", "label", "emptyMessage"].includes(n.name.getText(ast)) && n.initializer && ts.isStringLiteral(n.initializer)) assert.doesNotMatch(n.initializer.text, /[A-Za-z]/, `${path}: ${n.getText(ast)}`);
      if (ts.isCallExpression(n) && /^(toast\.(success|error)|useDocumentTitle)$/.test(n.expression.getText(ast))) assert.ok(!n.arguments.some(ts.isStringLiteral), `${path}: ${n.getText(ast)}`);
      if (ts.isImportDeclaration(n) && n.importClause?.namedBindings && ts.isNamedImports(n.importClause.namedBindings)) for (const binding of n.importClause.namedBindings.elements) assert.notEqual(binding.name.text, "timeAgo", `${path}: legacy untranslated helper`);
      ts.forEachChild(n, audit);
    }
    owners.forEach(audit);
  }
});
