import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { createElement, type ComponentType, type ReactNode, type ReactElement } from "react";
import * as React from "react";
import * as nextIntl from "next-intl";
import { createTranslator } from "next-intl";
import ts from "typescript";
import * as AccountPicker from "../components/dashboard/account-picker";
import * as BrandLoader from "../components/dashboard/brand-loader";
import * as SettlementPreview from "../components/dashboard/tax-settlement-preview";
import { taxUiMinor, taxUiCurrency, taxUiRows, taxUiMoney, taxUiSettlement } from "../lib/money/tax-ui";
import { taxPeriodTypeKey, taxPeriodStatusKey } from "../lib/i18n/tax-period-presentation";
import { renderWithPresentation } from "./helpers/presentation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const list = "app/(dashboard)/tax/periods/page.tsx";
const detail = "app/(dashboard)/tax/periods/[id]/page.tsx";
const locales = ["en-US", "fa-IR"] as const;
const noop = () => {};
const caller = '<script>دوره & data</script>';
const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
const translator = (locale: typeof locales[number]) => createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace: "TaxPeriods" });

// Execute production templates with real next-intl/shared controls. Only local
// state/effects and sheet portals are controlled; Select triggers remain real.
function loaded(path: string, states: unknown[] = [], directLocale?: typeof locales[number]) {
  const require = createRequire(resolve(path));
  const compiled = { exports: {} as Record<string, ComponentType<Record<string, unknown>>> };
  const source = readFileSync(path, "utf8");
  const extra = path === list ? "export { CreatePeriodSheet, FileSheet };" : "export { TaxPeriodWorkspace, SettleSheet };";
  const code = ts.transpileModule(source + "\n" + extra, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  let index = 0;
  const inline = ({ children }: { children: ReactNode }) => createElement("div", null, children);
  const load = (id: string) => {
    if (id === "react") return { ...React, useState: (initial: unknown) => { const i = index++; return [i < states.length ? states[i] : typeof initial === "function" ? initial() : initial, noop]; }, useEffect: noop, useCallback: (fn: unknown) => fn };
    if (id === "next-intl") return directLocale ? { useTranslations: () => translator(directLocale) } : nextIntl;
    if (id.endsWith("/account-picker")) return AccountPicker;
    if (id.endsWith("/brand-loader")) return BrandLoader;
    if (id.endsWith("/tax-settlement-preview")) return SettlementPreview;
    if (id.endsWith("/use-document-title")) return { useDocumentTitle: noop };
    if (id.endsWith("/use-entity-title")) return { useEntityTitle: noop };
    if (id.endsWith("/ui/sheet")) return Object.fromEntries(["Sheet", "SheetContent", "SheetHeader", "SheetTitle", "SheetTrigger"].map(key => [key, inline]));
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  };
  new Function("require", "module", "exports", code)(load, compiled, compiled.exports);
  return compiled.exports;
}

// Extract real callback bodies (including useCallback arguments) from the AST.
function callback(path: string, owner: string, name: string, scope: Record<string, unknown>) {
  const source = readFileSync(path, "utf8");
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let expression = "";
  function visit(node: ts.Node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) expression = `(${node.getText(ast)})`;
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name && node.initializer && ts.isCallExpression(node.initializer)) expression = node.initializer.arguments[0].getText(ast);
    ts.forEachChild(node, visit);
  }
  for (const node of ast.statements) if (ts.isFunctionDeclaration(node) && node.name?.text === owner) visit(node);
  assert.ok(expression, `${owner}.${name}`);
  const code = ts.transpileModule(`const run = ${expression};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(scope), `${code}; return run;`)(...Object.values(scope));
}

const period = { id: "period-a", name: caller, startDate: "2026-01-01", endDate: "2026-03-31", type: "quarterly", status: "filed", filedAt: "2026-04-02T00:00:00Z", filedReference: caller, notes: caller, lines: [] as { id: string; boxNumber: string; label: string; amount: bigint; sourceDescription: string; sortOrder: number }[] };
const event = { preventDefault: noop };

test("tax period list renders bilingual headings, status/type labels, plurals, links and escaped names", () => {
  for (const locale of locales) {
    const t = translator(locale);
    const periods = [period, { ...period, id: "period-b", type: "monthly", status: "open" }, { ...period, id: "period-c", type: "annual", status: "open" }];
    const Page = loaded(list, [periods, false, false, period]).default;
    const html = renderWithPresentation(createElement(Page), locale);
    for (const key of ["title", "description", "newPeriod", "name", "period", "type", "status", "dueSubmitted", "actions", "totalPeriods", "open", "filed", "submittedSoFar", "allPeriods", "markSubmittedShort", "monthly", "quarterly", "annual", "markSubmitted", "referenceNumber"] as const) assert.ok(html.includes(escape(t(key))), key);
    assert.ok(html.includes(escape(t("submittedCount", { count: 1, total: 3 }))));
    assert.ok(html.includes(escape(t("fileHelp", { name: caller }))));
    assert.ok(html.includes('href="/tax/periods/period-a"') && html.includes(`aria-label="${escape(t("delete"))}"`));
    assert.ok(html.includes(escape(caller)) && !html.includes("<script>"));
    const Empty = loaded(list, [[], false]).default;
    const empty = renderWithPresentation(createElement(Empty), locale);
    assert.ok(empty.includes(escape(t("emptyTitle"))) && empty.includes(escape(t("emptyHelp"))));
    const Loading = loaded(list, [[], true]).default;
    assert.ok(!renderWithPresentation(createElement(Loading), locale).includes(escape(t("emptyTitle"))));
  }
});

test("filing timing retains existing thresholds and uses actual ICU branches in both locales", () => {
  const source = readFileSync(list, "utf8");
  const ast = ts.createSourceFile(list, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const fn = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === "getFilingStatus")!;
  for (const locale of locales) for (const days of [-2, -1, 0, 1, 2, 14, 15]) {
    const t = translator(locale);
    const code = ts.transpileModule(fn.getText(ast), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    const run = new Function("getDaysUntil", `${code}; return getFilingStatus;`)(() => days);
    const result = run({ ...period, status: "open" }, t);
    assert.equal(result.variant, days < 0 ? "overdue" : days <= 14 ? "due-soon" : "open");
    assert.equal(result.label, t(days < 0 ? "overdue" : days <= 14 ? "dueSoon" : "open"));
    assert.equal(result.daysText, days < 0 ? t("daysOverdue", { count: -days }) : days === 0 ? t("dueToday") : t("daysLeft", { count: days }));
    assert.equal(run({ ...period, filedAt: null }, t).daysText, t("filed"));
    assert.equal(run(period, t).daysText, t("submittedDate", { date: new Date(period.filedAt).toLocaleDateString() }));
    for (const count of [0, 1, 2, 12]) assert.ok(t("submittedCount", { count, total: 12 }).length);
  }
});

test("detail renders exact signed boxes, statutory identifiers and settlement/null/zero/open states", () => {
  for (const locale of locales) for (const amount of [-1250n, 0n, 1250n, null]) {
    const t = translator(locale);
    const lines = amount === null ? [] : [{ id: "line-5", boxNumber: "5", label: caller, amount, sourceDescription: caller, sortOrder: 1 }];
    const Page = loaded(detail, [{ ...period, lines }, false, false, "USD", null]).TaxPeriodWorkspace;
    const html = renderWithPresentation(createElement(Page, { id: period.id, orgId: "org-a" }), locale);
    for (const key of ["back", "filed", "quarterly", "settleTitle", "recordSettlement", "notes"] as const) assert.ok(html.includes(escape(t(key))), key);
    assert.ok(html.includes(escape(t("referenceValue", { reference: caller }))));
    if (amount === null) {
      for (const key of ["settleHelp", "noBoxes", "noFrozenBoxes"] as const) assert.ok(html.includes(escape(t(key))), key);
    } else {
      for (const key of ["returnBoxes", "box", "boxDescription", "amount", amount < 0n ? "negativeBoxHelp" : "netBoxHelp"] as const) assert.ok(html.includes(escape(t(key))), key);
      assert.ok(html.includes(escape(taxUiMoney(amount, "USD", { locale, numerals: locale === "fa-IR" ? "arabext" : "latn" }))));
      assert.ok(html.includes(escape(amount === 0n ? t("nothingDue") : t(amount < 0n ? "refundDue" : "paymentDue", { amount: taxUiMoney(amount < 0n ? -amount : amount, "USD", { locale, numerals: locale === "fa-IR" ? "arabext" : "latn" }) }))));
    }
    assert.ok(html.includes(escape(caller)) && !html.includes("<script>"));
    const Open = loaded(detail, [{ ...period, status: "open" }, false, false, "USD", null]).TaxPeriodWorkspace;
    const open = renderWithPresentation(createElement(Open, { id: period.id, orgId: "org-a" }), locale);
    assert.ok(open.includes(escape(t("submitBoxesHelp"))) && !open.includes(escape(t("settleTitle"))));
  }
});

test("detail loading/not-found/errors and finite status/type fallbacks render without machine prose", () => {
  for (const locale of locales) {
    const t = translator(locale);
    for (const loading of [true, false]) {
      const Page = loaded(detail, [null, loading, false, null, loading ? null : t("loadDetailFailed")]).TaxPeriodWorkspace;
      const html = renderWithPresentation(createElement(Page, { id: period.id, orgId: "org-a" }), locale);
      assert.ok(html.includes(escape(t(loading ? "loading" : "notFound"))));
      assert.equal(html.includes('role="alert"'), !loading);
    }
    for (const value of ["constructor", "__proto__", caller]) {
      assert.equal(taxPeriodTypeKey(value), "unknownType");
      assert.equal(taxPeriodStatusKey(value), "unknownStatus");
      const Page = loaded(detail, [{ ...period, type: value, status: value }, false, false, "USD", null]).TaxPeriodWorkspace;
      const html = renderWithPresentation(createElement(Page, { id: period.id, orgId: "org-a" }), locale);
      assert.ok(html.includes(escape(t("unknownType"))) && html.includes(escape(t("unknownStatus"))));
    }
    for (const status of ["open", "filed", "amended"]) assert.equal(taxPeriodStatusKey(status), status);
  }
});

test("create/file/settlement templates localize fields, busy controls and exact previews", () => {
  for (const locale of locales) for (const busy of [false, true]) {
    const t = translator(locale);
    const Create = loaded(list, [caller, "2026-01-01", "2026-03-31", "quarterly", caller, busy]).CreatePeriodSheet;
    const create = renderWithPresentation(createElement(Create, { open: true, setOpen: noop, onCreated: noop, orgId: "org-a" }), locale);
    for (const key of ["newPeriod", "name", "startDate", "endDate", "type", "notes", "notesPlaceholder", busy ? "creating" : "create"] as const) assert.ok(create.includes(escape(t(key))), key);
    assert.ok(create.includes('type="date"') && create.includes('value="2026-01-01"') && create.includes('role="combobox"'));
    assert.equal(create.includes('disabled=""'), busy);
    const File = loaded(list, [caller, busy]).FileSheet;
    const file = renderWithPresentation(createElement(File, { period, onClose: noop, onFiled: noop, orgId: "org-a" }), locale);
    assert.ok(file.includes(escape(t("fileHelp", { name: caller }))) && file.includes(escape(t(busy ? "saving" : "markSubmitted"))));
    for (const direction of ["pay", "refund"]) {
      const Settle = loaded(detail, ["bank-a", "12.50", direction, "2026-04-02", caller, busy]).SettleSheet;
      const settle = renderWithPresentation(createElement(Settle, { period, open: true, onClose: noop, onSettled: noop, orgId: "org-a", defaultIsRefund: false, netAmount: 1250n, currency: "USD" }), locale);
      for (const key of ["settlementTitle", "whatHappened", direction === "pay" ? "paymentAccount" : "refundAccount", "accountPlaceholder", "date", "reference", busy ? "saving" : direction === "pay" ? "recordPayment" : "recordRefund"] as const) assert.ok(settle.includes(escape(t(key))), key);
      assert.ok(settle.includes(escape(t("settlementHelp", { name: caller }))) && settle.includes(escape(t("settlementPreview", { amount: taxUiMoney(1250n, "USD", { locale, numerals: locale === "fa-IR" ? "arabext" : "latn" }) }))));
      assert.ok(settle.includes('inputMode="decimal"') && settle.includes('value="12.50"') && settle.includes(escape(caller)) && !settle.includes("<script>"));
      assert.equal(settle.includes('disabled=""'), busy);
    }
  }
});

test("actual Select element trees keep canonical period types and settlement directions", () => {
  function nodes(node: ReactNode): ReactElement<Record<string, unknown>>[] {
    if (!node || typeof node !== "object") return [];
    if (Array.isArray(node)) return node.flatMap(nodes);
    const el = node as ReactElement<Record<string, unknown>>;
    return el.props ? [el, ...nodes(el.props.children as ReactNode)] : [];
  }
  for (const locale of locales) {
    const t = translator(locale);
    const Create = loaded(list, [], locale).CreatePeriodSheet as (props: Record<string, unknown>) => ReactNode;
    const create = nodes(Create({ open: true, setOpen: noop, onCreated: noop, orgId: "org-a" }));
    for (const value of ["monthly", "quarterly", "annual"] as const) assert.ok(create.some(el => el.props.value === value && el.props.children === t(value)));
    const Settle = loaded(detail, [], locale).SettleSheet as (props: Record<string, unknown>) => ReactNode;
    let settleTree: ReactNode;
    function Capture() { settleTree = Settle({ period, open: true, onClose: noop, onSettled: noop, orgId: "org-a", defaultIsRefund: true, netAmount: -1250n, currency: "USD" }); return null; }
    renderWithPresentation(createElement(Capture), locale);
    const settle = nodes(settleTree);
    for (const [value, key] of [["pay", "paidOffice"], ["refund", "receivedRefund"]] as const) assert.ok(settle.some(el => el.props.value === value && el.props.children === t(key)));
    assert.ok(settle.some(el => el.props.currencyFilter === "USD" && el.props.subTypeFilter === "bank" && JSON.stringify(el.props.typeFilter) === '["asset"]'));
  }
});

test("settlement preview keeps currency scales, max safe values, zero and localized invalid input", () => {
  for (const locale of locales) {
    const t = translator(locale);
    for (const [currency, amount] of [["USD", "12.50"], ["JPY", "1250"], ["IRR", "1250"], ["KWD", "1.250"], ["USD", "90071992547409.91"], ["JPY", "0"]]) {
      const preview = taxUiSettlement(amount, currency);
      const html = renderWithPresentation(createElement(SettlementPreview.TaxSettlementPreview, { amount, currency }), locale);
      assert.ok(html.includes('role="status"') && html.includes(escape(t("settlementPreview", { amount: taxUiMoney(preview.amount, currency, { locale, numerals: locale === "fa-IR" ? "arabext" : "latn" }) }))));
    }
    for (const [currency, amount] of [["USD", ""], ["USD", "0.005"], ["JPY", "0.1"], ["KWD", "0.0001"], ["USD", "90071992547409.92"], ["USD", "-1"], ["USD", "1e3"], ["USD", caller], ["BAD", "1"]]) {
      const html = renderWithPresentation(createElement(SettlementPreview.TaxSettlementPreview, { amount, currency }), locale);
      assert.ok(html.includes('role="alert"') && html.includes(escape(t(amount === "" ? "enterAmount" : "invalidAmount"))));
      assert.ok(!html.includes("<script>") && !html.includes("RangeError"));
    }
  }
});

test("create/file/delete callbacks retain org-scoped methods/payloads, resets and localized failures", async () => {
  for (const locale of locales) for (const operation of ["create", "file", "delete"]) for (const mode of ["success", "status", "network", "no-org", "empty-optional"]) {
    const t = translator(locale), events: unknown[] = []; let calls = 0;
    const optional = mode === "empty-optional" ? "" : caller;
    const owner = operation === "create" ? "CreatePeriodSheet" : operation === "file" ? "FileSheet" : "TaxPeriodsPage";
    const name = operation === "create" ? "handleCreate" : operation === "file" ? "handleFile" : "handleDelete";
    await callback(list, owner, name, {
      t, orgId: mode === "no-org" ? null : "org-a", period, name: caller, startDate: "2026-01-01", endDate: "2026-03-31", type: "quarterly", notes: optional, reference: optional,
      setSaving: (v: boolean) => events.push(["saving", v]), setOpen: (v: boolean) => events.push(["open", v]), setName: (v: string) => events.push(["name", v]), setStartDate: (v: string) => events.push(["start", v]), setEndDate: (v: string) => events.push(["end", v]), setNotes: (v: string) => events.push(["notes", v]), setReference: (v: string) => events.push(["reference", v]), onClose: () => events.push("close"), onCreated: () => events.push("refresh"), onFiled: () => events.push("refresh"), fetchPeriods: () => events.push("refresh"),
      toast: { success: (s: string) => events.push(s), error: (s: string) => events.push(s) },
      fetch: async (url: string, init: RequestInit) => {
        calls++;
        assert.equal(url, operation === "create" ? "/api/v1/tax-periods" : `/api/v1/tax-periods/${period.id}${operation === "file" ? "/file" : ""}`);
        assert.equal(init.method, operation === "delete" ? "DELETE" : "POST");
        assert.deepEqual(init.headers, operation === "delete" ? { "x-organization-id": "org-a" } : { "Content-Type": "application/json", "x-organization-id": "org-a" });
        if (operation !== "delete") assert.deepEqual(JSON.parse(init.body as string), operation === "create" ? { name: caller, startDate: "2026-01-01", endDate: "2026-03-31", type: "quarterly", ...(optional ? { notes: optional } : {}) } : optional ? { filedReference: optional } : {});
        if (mode === "network") throw new Error(caller);
        return new Response(caller, { status: mode === "status" ? 403 : 200 });
      },
    })(operation === "delete" ? period.id : event);
    assert.equal(calls, mode === "no-org" ? 0 : 1);
    const success = ["success", "empty-optional"].includes(mode);
    const key = operation === "create" ? success ? "created" : "createFailed" : operation === "file" ? success ? "filedSuccess" : "fileFailed" : success ? "deleted" : "deleteFailed";
    if (mode === "no-org") assert.deepEqual(events, []);
    else {
      assert.ok(events.includes(t(key)) && !events.includes(caller));
      assert.equal(events.includes("refresh"), success);
      if (operation !== "delete") assert.deepEqual(events.at(-1), ["saving", false]);
      if (!success) assert.equal(events.length, operation === "delete" ? 1 : 3);
      if (success && operation === "create") assert.ok(events.some(v => JSON.stringify(v) === '["name",""]'));
      if (success && operation === "file") assert.ok(events.includes("close") && events.some(v => JSON.stringify(v) === '["reference",""]'));
    }
  }
});

test("settlement callback preserves pay/refund exact aliases and blocks invalid/stale requests", async () => {
  for (const locale of locales) for (const direction of ["pay", "refund"]) for (const mode of ["success", "zero", "status", "network", "json", "mismatch", "alias", "currency", "no-org", "stale-org", "account", "amount", "empty", "optional"]) {
    const t = translator(locale), events: unknown[] = []; let calls = 0;
    const amount = mode === "zero" ? "0" : mode === "amount" ? "0.001" : mode === "empty" ? "" : "12.50";
    await callback(detail, "SettleSheet", "handleSettle", {
      t, orgId: mode === "no-org" ? null : "org-a", localStorage: { getItem: () => mode === "stale-org" ? "org-b" : "org-a" }, bankGlAccountId: mode === "account" ? "" : "bank-a", amount, currency: "USD", direction, date: "2026-04-02", reference: mode === "optional" ? "" : caller, period, taxUiSettlement, taxUiCurrency, taxUiMinor,
      setSaving: (v: boolean) => events.push(["saving", v]), onClose: () => events.push("close"), onSettled: () => events.push("refresh"), toast: { success: (v: string) => events.push(v), error: (v: string) => events.push(v) },
      fetch: async (url: string, init: RequestInit) => {
        calls++; assert.equal(url, `/api/v1/tax-periods/${period.id}/file`); assert.equal(init.method, "POST"); assert.deepEqual(init.headers, { "Content-Type": "application/json", "x-organization-id": "org-a" });
        assert.deepEqual(JSON.parse(init.body as string), { mode: "settle", bankGlAccountId: "bank-a", amountMinor: mode === "zero" ? "0" : "1250", isRefund: direction === "refund", date: "2026-04-02", ...(mode === "optional" ? {} : { reference: caller }) });
        if (mode === "network") throw new Error(caller);
        if (mode === "json") return new Response(caller);
        return Response.json(mode === "status" ? { error: caller } : { currencyCode: mode === "currency" ? "BAD" : "USD", amount: mode === "zero" ? 0 : mode === "mismatch" ? 1251 : 1250, amountMinor: mode === "zero" ? "0" : mode === "alias" ? "1251" : mode === "mismatch" ? "1251" : "1250" }, { status: mode === "status" ? 400 : 200 });
      },
    })(event);
    const guard = ["no-org", "stale-org", "account", "amount", "empty"].includes(mode);
    assert.equal(calls, guard ? 0 : 1);
    if (["no-org", "stale-org"].includes(mode)) assert.deepEqual(events, []);
    else if (guard) assert.deepEqual(events, [t(mode === "account" ? "chooseAccount" : mode === "empty" ? "enterAmount" : "invalidAmount")]);
    else if (["success", "zero", "optional"].includes(mode)) assert.deepEqual(events, [["saving", true], t(direction === "refund" ? "refundRecorded" : "paymentRecorded"), "close", "refresh", ["saving", false]]);
    else assert.deepEqual(events, [["saving", true], t(mode === "mismatch" ? "settlementMismatch" : "settlementFailed"), ["saving", false]]);
  }
});

test("list reads reject failed/malformed responses and release loading without leaking errors", async () => {
  for (const locale of locales) for (const mode of ["success", "status", "shape", "json", "network", "no-org"]) {
    const t = translator(locale), events: unknown[] = []; let calls = 0;
    await callback(list, "TaxPeriodsPage", "fetchPeriods", {
      t, orgId: mode === "no-org" ? null : "org-a", setPeriods: (v: unknown) => events.push(v), setLoading: (v: boolean) => events.push(v), toast: { error: (v: string) => events.push(v) },
      fetch: async (url: string, init: RequestInit) => {
        calls++; assert.equal(url, "/api/v1/tax-periods"); assert.deepEqual(init.headers, { "x-organization-id": "org-a" });
        if (mode === "network") throw new Error(caller);
        if (mode === "json") return new Response(caller);
        return Response.json({ taxPeriods: mode === "shape" ? {} : [period] }, { status: mode === "status" ? 403 : 200 });
      },
    })();
    assert.equal(calls, mode === "no-org" ? 0 : 1);
    assert.deepEqual(events, mode === "success" ? [[period], false] : mode === "no-org" ? [false] : [t("loadListFailed"), false]);
  }
});

test("detail reads validate exact money/currency, retain request scope and ignore aborted results", async () => {
  for (const locale of locales) for (const mode of ["success", "status", "json", "shape", "alias", "currency", "network", "aborted", "no-org"]) {
    const t = translator(locale), events: unknown[] = []; let calls = 0;
    const wire = { ...period, lines: [{ id: "line-5", boxNumber: "5", amount: 1250, amountMinor: mode === "alias" ? "1251" : "1250" }] };
    const signal = new AbortController().signal;
    const controller = new AbortController(); if (mode === "aborted") controller.abort();
    const activeSignal = mode === "aborted" ? controller.signal : signal;
    await callback(detail, "TaxPeriodWorkspace", "fetchPeriod", {
      t, id: period.id, orgId: mode === "no-org" ? null : "org-a", taxUiCurrency, taxUiRows,
      setPeriod: (v: unknown) => events.push(v), setCurrency: (v: string) => events.push(v), setError: (v: string | null) => events.push(v), setLoading: (v: boolean) => events.push(v),
      fetch: async (url: string, init: RequestInit) => {
        calls++; assert.deepEqual(init, { headers: { "x-organization-id": "org-a" }, signal: activeSignal });
        assert.ok([`/api/v1/tax-periods/${period.id}`, "/api/v1/organization"].includes(url));
        if (mode === "network") throw new Error(caller);
        if (mode === "json") return new Response(caller);
        return Response.json(mode === "shape" ? {} : url === "/api/v1/organization" ? { organization: { defaultCurrency: mode === "currency" ? "BAD" : "USD" } } : { taxPeriod: wire }, { status: mode === "status" ? 403 : 200 });
      },
    })(activeSignal);
    assert.equal(calls, mode === "no-org" ? 0 : 2);
    assert.deepEqual(events, mode === "success" ? [{ ...wire, lines: [{ ...wire.lines[0], amount: 1250n }] }, "USD", null, false] : mode === "aborted" ? [] : mode === "no-org" ? [false] : [null, t("loadDetailFailed"), false]);
  }
});

test("owned authored copy is fully extracted and paired Persian messages retain Persian script", () => {
  for (const path of [list, detail, "components/dashboard/tax-settlement-preview.tsx"]) {
    const source = readFileSync(path, "utf8");
    const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(node: ts.Node) {
      if (ts.isJsxText(node)) assert.match(node.text.trim(), /^(%|)$/, node.text.trim());
      if (ts.isJsxAttribute(node) && ["title", "description", "placeholder", "aria-label", "alt"].includes(node.name.getText(ast)) && node.initializer && ts.isStringLiteral(node.initializer)) assert.equal(node.initializer.text, "0.00");
      if (ts.isCallExpression(node) && /^(toast\.(success|error)|useDocumentTitle)$/.test(node.expression.getText(ast))) assert.ok(!node.arguments.some(ts.isStringLiteral), node.getText(ast));
      ts.forEachChild(node, visit);
    }
    visit(ast);
    assert.ok(!source.includes("err.message") && !source.includes("toast.error(parsed.error)"));
  }
  assert.equal(Object.keys(en.TaxPeriods).length, 93);
  assert.deepEqual(Object.keys(en.TaxPeriods), Object.keys(fa.TaxPeriods));
  for (const value of Object.values(fa.TaxPeriods)) assert.match(value, /[\u0600-\u06ff]/);
});
