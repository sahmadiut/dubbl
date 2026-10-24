import { displayNumberFixture } from "./helpers/localized-fixtures";
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import React from "react";
import * as intl from "next-intl";
import ts from "typescript";
import { renderWithPresentation } from "./helpers/presentation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

type Locale = "en-US" | "fa-IR";
type Element = React.ReactElement<Record<string, unknown>>;
function harness(file: string, locale: Locale, states: unknown[], fetcher?: typeof fetch) {
  const path = `app/portal/[token]/${file}`, require = createRequire(resolve(path));
  const mod = { exports: {} as { default: (props: { children?: React.ReactNode }) => React.ReactNode } };
  let index = 0, tree: React.ReactNode;
  const effects: Array<() => unknown> = [], updates = new Map<number, unknown>(), pushes: string[] = [];
  const code = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function("require", "module", "exports", "fetch", code)((id: string) => {
    if (id === "next-intl") return intl;
    if (id === "react") return { ...React,
      useState: (initial: unknown) => { const i = index++; return [i < states.length ? states[i] : initial, (v: unknown) => updates.set(i, v)]; },
      useEffect: (fn: () => unknown) => effects.push(fn), useCallback: (fn: unknown) => fn };
    if (id === "next/navigation") return { useParams: () => ({token: "opaque-token"}), usePathname: () => "/portal/opaque-token/quotes", useRouter: () => ({push: (url: string) => pushes.push(url)}) };
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  }, mod, mod.exports, fetcher ?? (() => { throw new Error("Unexpected fetch"); }));
  function Capture() { tree = React.createElement(mod.exports.default, null, "child"); return tree; }
  // Capture the production element tree before React renders the real UI primitives.
  const Component = mod.exports.default;
  mod.exports.default = (props) => { const value = Component(props); tree = value; return value; };
  const html = renderWithPresentation(React.createElement(Capture), locale);
  function elements(node: React.ReactNode = tree): Element[] {
    if (Array.isArray(node)) return node.flatMap(child => elements(child));
    if (!React.isValidElement(node)) return [];
    const el = node as Element;
    return [el, ...(el.props.children === undefined ? [] : elements(el.props.children as React.ReactNode))];
  }
  return { html, elements, effects, updates, pushes };
}
const invoice = { id: "inv-id", invoiceNumber: "INV-ASCII", issueDate: "2026-10-24", dueDate: "2026-11-24", status: "sent", total: 12345, amountDue: 12345, currencyCode: "USD", paymentLinkToken: "pay-opaque" };
const quote = { id: "quote-id", quoteNumber: "Q-ASCII", issueDate: "2026-10-24", expiryDate: "2026-11-24", status: "sent", total: 12345, currencyCode: "USD" };
function wireData(file: string) {
  if (file.startsWith("invoices")) return {data: [{...invoice, totalMinor: "12345", amountDueMinor: "12345"}]};
  if (file.startsWith("quotes")) return {data: [{...quote, subtotal: 12345, subtotalMinor: "12345", taxTotal: 0, taxTotalMinor: "0", totalMinor: "12345", billedTotal: 0, billedTotalMinor: "0", lines: []}]};
  if (file.startsWith("payments")) return {data: [{...invoice, invoiceId: invoice.id, amountPaid: 12345, amountPaidMinor: "12345", totalMinor: "12345", paidAt: null}]};
  return {currencyCode: "USD", totalOutstanding: 12345, totalOutstandingMinor: "12345", lines: [{date: invoice.issueDate, description: "Invoice", status: "sent", currencyCode: "USD", amount: 12345, amountMinor: "12345", paid: 0, paidMinor: "0", balance: 12345, balanceMinor: "12345", runningBalance: 12345, runningBalanceMinor: "12345"}]};
}

test("all portal pages render bilingual loading, empty, populated, error and unknown-status states", () => {
  for (const locale of ["en-US", "fa-IR"] as const) {
    const m = (locale === "en-US" ? en : fa).PublicPortal;
    const info = { organization: {name: "<b>Org</b>"}, contact: {name: "<script>Customer</script>"} };
    const layout = harness("layout.tsx", locale, [info]).html;
    for (const label of [m.overview, m.invoices, m.statements, m.quotes, m.payments]) assert.ok(layout.includes(label));
    assert.ok(layout.includes('/portal/opaque-token/quotes'));
    const overview = harness("page.tsx", locale, [info, null]);
    assert.ok(overview.html.includes("&lt;script&gt;Customer&lt;/script&gt;"));
    const navigate = overview.elements().find(el => typeof el.props.onClick === "function")!;
    (navigate.props.onClick as () => void)();
    assert.deepEqual(overview.pushes, ["/portal/opaque-token/invoices"]);
    assert.ok(harness("page.tsx", locale, [null, null]).html.includes(m.loading));
    assert.ok(harness("page.tsx", locale, [null, m.invalidLink]).html.includes(m.unavailable));
    const rows = [
      ["invoices/page.tsx", [invoice], m.invoices, m.noInvoices, m.loadingInvoices],
      ["quotes/page.tsx", [quote], m.quotes, m.noQuotes, m.loading],
      ["payments/page.tsx", [{...invoice, invoiceId: "inv-id", amountPaid: 12345, paidAt: null}], m.paymentHistory, m.noPayments, m.loading],
      ["statements/page.tsx", [{date: "2026-10-24", description: "<b>Invoice</b>", amount: 12345, paid: 0, balance: 12345, status: "sent"}], m.statement, m.noTransactions, m.loading],
    ] as const;
    for (const [file, data, heading, empty, loading] of rows) {
      const state = (items: unknown, busy: boolean, error: string | null) => file.startsWith("statements") ? [items, 12345, "USD", busy, error] : [items, busy, error, null];
      const html = harness(file, locale, state(data, false, null)).html;
      for (const text of [heading, m.statusSent, displayNumberFixture("123.45", locale)]) assert.ok(html.includes(text), `${file}: ${text}`);
      assert.ok(harness(file, locale, state([], false, null)).html.includes(empty));
      assert.ok(harness(file, locale, state([], true, null)).html.includes(loading));
      assert.ok(harness(file, locale, state([], false, m.invoiceLoadFailed)).html.includes(m.invoiceLoadFailed));
      assert.ok(harness(file, locale, state(data.map(row => ({...row, status: "unreviewed-server-value"})), false, null)).html.includes(m.statusUnknown));
    }
    const invoices = harness("invoices/page.tsx", locale, [[invoice], false, null]).html;
    for (const value of ["INV-ASCII", "2026-10-24", "2026-11-24", "/pay/pay-opaque"]) assert.ok(invoices.includes(value));
    assert.ok(!harness("invoices/page.tsx", locale, [[{...invoice, status: "paid"}], false, null]).html.includes("/pay/pay-opaque"));
  }
  function check(values: object) { for (const value of Object.values(values)) { if (typeof value === "object") check(value); else assert.match(value, /[\u0600-\u06ff]/); } }
  check(fa.PublicPortal);
});

test("portal reads localize HTTP, malformed JSON and invalid money failures before adopting data", async () => {
  for (const locale of ["en-US", "fa-IR"] as const) {
    const m = (locale === "en-US" ? en : fa).PublicPortal;
    for (const [file, error, slot, route] of [
      ["invoices/page.tsx", m.invoiceLoadFailed, 2, "/api/portal/opaque-token/invoices"],
      ["quotes/page.tsx", m.quoteLoadFailed, 2, "/api/v1/portal/opaque-token/quotes"],
      ["payments/page.tsx", m.paymentLoadFailed, 2, "/api/v1/portal/opaque-token/payments"],
      ["statements/page.tsx", m.statementLoadFailed, 4, "/api/v1/portal/opaque-token/statements"],
    ] as const) {
      for (const mode of ["success", "http", "json", "money"] as const) {
        const h = harness(file, locale, [], (async (url: string) => {
          assert.equal(url, route);
          if (mode === "json") return new Response("{broken");
          const data = wireData(file);
          if (mode === "money") {
            if ("data" in data) data.data![0].totalMinor = "999";
            else data.totalOutstandingMinor = "999";
          }
          return Response.json(mode === "http" ? {error: "unreviewed server prose"} : data, {status: mode === "http" ? 403 : 200});
        }) as typeof fetch);
        for (const effect of h.effects) effect();
        await new Promise(resolve => setTimeout(resolve, 0));
        assert.equal(h.updates.get(slot), mode === "success" ? null : error);
        if (mode === "success") assert.equal((h.updates.get(0) as unknown[]).length, 1);
        else assert.deepEqual(h.updates.get(0), []);
      }
    }
  }
});

test("quote acceptance and PDF callbacks preserve routes and use reviewed failures", async () => {
  for (const locale of ["en-US", "fa-IR"] as const) {
    const m = (locale === "en-US" ? en : fa).PublicPortal;
    const calls: Array<[string, RequestInit | undefined]> = [];
    const fail = (async (url: string, init?: RequestInit) => {calls.push([url, init]); return Response.json({error: "server detail"}, {status: 500});}) as typeof fetch;
    const q = harness("quotes/page.tsx", locale, [[quote], false, null, null], fail);
    await (q.elements().find(el => typeof el.props.onClick === "function")!.props.onClick as () => Promise<void>)();
    assert.deepEqual(calls.pop(), ["/api/v1/portal/opaque-token/quotes/quote-id/accept", {method: "POST"}]);
    assert.equal(q.updates.get(2), m.quoteAcceptFailed);
    assert.equal(q.updates.get(3), null);
    for (const [file, states, url, slot, error] of [
      ["invoices/page.tsx", [[invoice], false, null], "/api/portal/opaque-token/invoices/inv-id/pdf", 2, m.invoiceDownloadFailed],
      ["statements/page.tsx", [[], 0, "USD", false, null], "/api/portal/opaque-token/statements/pdf?format=pdf", 4, m.statementDownloadFailed],
    ] as const) {
      const h = harness(file, locale, [...states], fail);
      await (h.elements().find(el => typeof el.props.onClick === "function")!.props.onClick as () => Promise<void>)();
      assert.equal(calls.pop()![0], url);
      assert.equal(h.updates.get(slot), error);
    }
  }
});


test("actual public invoice renders literal Persian rial without changing token URLs or caller data", () => {
  const row = {...invoice, currencyCode: "IRR", total: 1250, amountDue: 1250};
  const html = harness("invoices/page.tsx", "fa-IR", [[row], false, null]).html;
  assert.ok(html.includes("ریال"));
  assert.ok(html.includes("۱٬۲۵۰"));
  assert.ok(html.includes("INV-ASCII"));
  assert.ok(html.includes("/pay/pay-opaque"));
  assert.equal(row.currencyCode, "IRR");
  assert.equal(row.total, 1250);
});
