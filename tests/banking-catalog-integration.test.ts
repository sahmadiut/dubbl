import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import * as React from "react";
import { createElement, type ComponentType, type ReactNode } from "react";
import * as nextIntl from "next-intl";
import ts from "typescript";
import { DatePicker } from "../components/ui/date-picker";
import * as CurrencySelect from "../components/ui/currency-select";
import * as Presentation from "../i18n/provider";
import { bankUiMoney } from "../lib/money/bank-ui";
import { renderWithPresentation } from "./helpers/presentation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const root = "app/(dashboard)/accounting/banking";
const layoutPath = `${root}/[id]/(detail)/layout.tsx`;
const noop = () => {};
const amount = 4000000000000001n;
const account = { id: "bank-a", accountName: "<b>Caller حساب</b>", bankName: "Caller Bank", accountType: "checking", accountNumber: "CALLER-1234", currencyCode: "KWD", countryCode: "KW", balance: amount, isActive: true, color: "#10b981", chartAccountId: "ledger-a" };
const transaction = { id: "tx-a", date: "2026-10-18", description: "<script>Caller تراکنش</script>", reference: "REF-ASCII", payee: "Caller Payee", amount: -amount, balance: null, status: "unreconciled" };
const statement = { id: "import-a", format: "csv", fileName: "<b>Caller statement.csv</b>", importedCount: 1, duplicateCount: 2, warnings: [], statementStartDate: "2026-10-01", statementEndDate: "2026-10-18", createdAt: "2026-10-18T00:00:00Z" };

// Keep actual context identity across layout/page/shared modules. Control only
// initial layout state, navigation/effects and portal/unowned widget boundaries.
// Unlike individual child tests, no bank context or banking component is mocked.
function workspace(page: string, populated: boolean, importOpen = false) {
  const cache = new Map<string, { exports: Record<string, ComponentType<Record<string, unknown>>> }>();
  const layoutState = [account, populated ? [transaction] : [], populated ? [statement] : [], false, importOpen];
  const inline = ({ children }: { children: ReactNode }) => createElement("div", null, children);
  function loadModule(file: string): Record<string, ComponentType<Record<string, unknown>>> {
    const path = resolve(file);
    if (cache.has(path)) return cache.get(path)!.exports;
    const compiled = { exports: {} as Record<string, ComponentType<Record<string, unknown>>> };
    cache.set(path, compiled);
    const require = createRequire(path);
    let stateIndex = 0;
    const load = (id: string): unknown => {
      if (id === "react") return { ...React, useState: (initial: unknown) => {
        const index = stateIndex++;
        return [path === resolve(layoutPath) && index < layoutState.length ? layoutState[index] : typeof initial === "function" ? initial() : initial, noop];
      }, useEffect: noop };
      if (id === "next-intl") return nextIntl;
      if (id.endsWith("/i18n/provider")) return Presentation;
      if (id.endsWith("/ui/date-picker")) return { DatePicker };
      if (id.endsWith("/ui/currency-select")) return CurrencySelect;
      if (id === "next/navigation") return { useParams: () => ({ id: account.id }), useRouter: () => ({ push: noop }), usePathname: () => `/accounting/banking/${account.id}/${page}` };
      if (id.endsWith("/use-document-title")) return { useDocumentTitle: noop };
      if (id.endsWith("/use-entity-title")) return { useEntityTitle: noop };
      if (id.endsWith("/use-debounce")) return { useDebounce: (value: unknown) => value };
      if (id.endsWith("/use-confirm")) return { useConfirm: () => ({ confirm: noop, dialog: null }) };
      if (id.endsWith("/account-picker")) return { AccountPicker: () => null };
      if (id.endsWith("/contact-picker")) return { ContactPicker: () => null };
      if (id.endsWith("/tracking-picker")) return { TrackingPicker: () => null };
      if (id.endsWith("/receipt-attachments")) return { ReceiptAttachments: () => null };
      if (["/ui/sheet", "/ui/dialog", "/ui/select"].some(suffix => id.endsWith(suffix))) return new Proxy({}, { get: (_obj, name) => name === "Sheet" || name === "Dialog" ? ({ open, children }: { open: boolean; children: ReactNode }) => open ? inline({ children }) : null : inline });
      if (id.startsWith(".")) return loadModule(resolve(dirname(path), `${id}.tsx`));
      return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
    };
    const code = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
    new Function("require", "module", "exports", code)(load, compiled, compiled.exports);
    return compiled.exports;
  }
  const Layout = loadModule(layoutPath).default;
  const Page = loadModule(`${root}/[id]/(detail)/${page ? page + "/" : ""}page.tsx`).default;
  return createElement(Layout, null, createElement(Page));
}

function contains(html: string, value: string) {
  const escaped = value.replaceAll("&", "&amp;").replaceAll("'", "&#x27;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  assert.ok(html.includes(escaped), value);
}

test("combined banking layout/pages share real context, catalogs, canonical fields and exact KWD amounts", () => {
  for (const locale of ["en-US", "fa-IR"] as const) {
    const messages = locale === "en-US" ? en : fa;
    for (const page of ["", "transactions", "imports", "settings"]) {
      const html = renderWithPresentation(workspace(page, true), locale);
      for (const label of [messages.BankWorkspace.overview, messages.BankWorkspace.transactions, messages.BankWorkspace.imports, messages.BankWorkspace.settings]) contains(html, label);
      contains(html, account.accountName);
      contains(html, messages.BankAccounts.checking);
      contains(html, bankUiMoney(amount, "KWD"));
      assert.ok(!html.includes("<script>") && !html.includes("<b>Caller"));
      if (page === "" || page === "transactions") {
        contains(html, transaction.description);
        contains(html, bankUiMoney(-amount, "KWD"));
      }
      if (page === "" || page === "imports") contains(html, statement.fileName);
      if (page === "settings") {
        contains(html, messages.BankAccounts.saveChanges);
        assert.ok(html.includes('name="accountName"'));
      }
    }
  }
});

test("combined empty workspace and open import sheet resolve cross-child namespaces without fabricated context", () => {
  for (const locale of ["en-US", "fa-IR"] as const) {
    const messages = locale === "en-US" ? en : fa;
    const html = renderWithPresentation(workspace("imports", false, true), locale);
    for (const text of [messages.BankImports.noImports, messages.BankImports.emptyHint, messages.BankImports.title]) contains(html, text);
    assert.ok(html.includes('type="file"'));
    assert.ok(!html.includes(statement.fileName) && !html.includes("MISSING_MESSAGE"));
  }
});

test("complete banking route inventory has no authored English JSX or visible literal attributes", () => {
  function files(path: string): string[] {
    return readdirSync(path, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(`${path}/${entry.name}`) : entry.name.endsWith(".tsx") ? [`${path}/${entry.name}`] : []);
  }
  const paths = files(root);
  assert.equal(paths.length, 11, "Review any new route/shared component against the banking scope inventory");
  for (const path of paths) {
    const ast = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(node: ts.Node) {
      if (ts.isJsxText(node)) assert.ok(!/[A-Za-z]/.test(node.text.replaceAll("&rarr;", "")), `${path}: ${node.text}`);
      if (ts.isJsxAttribute(node) && ["title", "placeholder", "aria-label", "label", "alt"].includes(node.name.getText(ast)) && node.initializer && ts.isStringLiteral(node.initializer)) {
        // Documented ISO country-code sample, not authored prose.
        if (path.endsWith("/(detail)/settings/page.tsx") && node.name.getText(ast) === "placeholder" && node.initializer.text === "US") return;
        assert.ok(!/[A-Za-z]/.test(node.initializer.text), `${path}: ${node.getText(ast)}`);
      }
      ts.forEachChild(node, visit);
    }
    visit(ast);
  }
});
