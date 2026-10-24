import { resolvePresentation } from "../i18n/locale";
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { createElement, type ComponentType, type ReactNode } from "react";
import * as React from "react";
import * as nextIntl from "next-intl";
import { createTranslator } from "next-intl";
import ts from "typescript";
import { renderWithPresentation } from "./helpers/presentation";
import { bankImportFormatLabels, bankImportWarning } from "../i18n/bank-import-presentation";
import { requireBankAccountResponse } from "../i18n/bank-account-presentation";
import { bankWorkspaceFailure } from "../i18n/bank-workspace-presentation";
import { bankUiPreview, bankUiMoney } from "../lib/money/bank-ui";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const base = "app/(dashboard)/accounting/banking/[id]/";
const shared = base + "_components.tsx", page = base + "(detail)/imports/page.tsx", layout = base + "(detail)/layout.tsx";
const locales = ["en-US", "fa-IR"] as const, noop = () => {};
const content = "date,description,amountMinor\n2026-10-18,Caller,4000000000000001";
const imp = { id: "import-a", fileName: "<script>Caller صورتحساب.csv</script>", format: "csv", createdAt: "2026-10-18T00:00:00Z", statementStartDate: "2026-10-01", statementEndDate: "2026-10-18", importedCount: 2, duplicateCount: 1, warnings: [] };
const wirePreview = { format: "csv", currencyCode: "USD", accountIdentifier: "CALLER-ASCII", statementStartDate: imp.statementStartDate, statementEndDate: imp.statementEndDate, rowCount: 123, openingBalance: null, closingBalance: 4000000000000001, closingBalanceMinor: "4000000000000001", warnings: ["No transactions were found in the QIF file.", "<script>secret warning</script>"], duplicates: [{ dedupeHash: "ASCII-HASH", date: "2026-10-18", description: "Caller duplicate", amount: 1250, amountMinor: "1250" }], transactions: [{ date: "2026-10-18", description: "<b>Caller تراکنش</b>", reference: "REF-ASCII", amount: 4000000000000001, amountMinor: "4000000000000001", balance: null }] };
const preview = bankUiPreview(wirePreview, "USD");

function translators(locale: typeof locales[number]) {
  const messages = locale === "en-US" ? en : fa;
  return { imports: createTranslator({ locale, messages, namespace: "BankImports" }), t: createTranslator({ locale, messages, namespace: "BankWorkspace" }), errors: createTranslator({ locale, messages, namespace: "BankAccountErrors" }) };
}

// Actual production templates/React/next-intl. Control state/context; inline the
// portal/select boundaries so their children can be inspected without a browser.
function loaded(path: string, context = { imports: [imp], openImport: noop }) {
  const require = createRequire(resolve(path)), compiled = { exports: {} as Record<string, ComponentType<Record<string, unknown>>> };
  const code = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  const inline = ({ children }: { children: ReactNode }) => createElement("div", null, children);
  const load = (id: string) => {
    if (id === "react") return { ...React, useEffect: noop };
    if (id === "next-intl") return nextIntl;
    if (id === "../layout") return { useBankAccountContext: () => context };
    if (id === "../../_components") return loaded(shared);
    if (id.endsWith("/use-document-title")) return { useDocumentTitle: noop };
    if (id.endsWith("/ui/sheet") || id.endsWith("/ui/select")) return new Proxy({}, { get: (_obj, name) => name === "Sheet" ? ({ open, children }: { open: boolean; children: ReactNode }) => open ? inline({ children }) : null : inline });
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  };
  new Function("require", "module", "exports", code)(load, compiled, compiled.exports);
  return compiled.exports;
}

// Execute the real callback syntax with explicit network/state boundaries.
function callback(name: string, scope: Record<string, unknown>) {
  const ast = ts.createSourceFile(layout, readFileSync(layout, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let expression = "";
  function visit(n: ts.Node) { if (ts.isFunctionDeclaration(n) && n.name?.text === name) expression = `(${n.getText(ast)})`; ts.forEachChild(n, visit); }
  visit(ast); assert.ok(expression, name);
  const js = ts.transpileModule(`const run = ${expression};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(scope), `${js}; return run;`)(...Object.values(scope));
}

const escaped = (s: string) => s.replaceAll("&", "&amp;").replaceAll("'", "&#x27;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
function includes(html: string, strings: string[]) { for (const s of strings) assert.ok(html.includes(escaped(s)), s); }
const sheetProps = { open: true, onOpenChange: noop, selectedFile: null, setSelectedFile: noop, manualContent: content, setManualContent: noop, format: "auto", setFormat: noop, preview, previewing: false, importing: false, onPreview: noop, onImport: noop, currencyCode: "USD" };

test("real import page/history render empty/populated states, ICU counts, periods and safe filenames in both locales", () => {
  for (const locale of locales) {
    const { imports: t } = translators(locale);
    const Page = loaded(page).default;
    includes(renderWithPresentation(createElement(Page), locale), [t("title"), t("rowCount", { count: 2 }), t("duplicatesSkipped", { count: 1 }), t("period", { start: imp.statementStartDate, end: imp.statementEndDate }), imp.fileName, "CSV"]);
    const Empty = loaded(page, { imports: [], openImport: noop }).default;
    includes(renderWithPresentation(createElement(Empty), locale), [t("noImports"), t("emptyHint")]);
    const Row = loaded(shared).ImportRow;
    for (const count of [0, 1, 2]) {
      const html = renderWithPresentation(createElement(Row, { imp: { ...imp, importedCount: count, duplicateCount: count }, isLast: true }), locale);
      includes(html, [t("rowCount", { count }), imp.fileName]);
      assert.ok(!html.includes("<script>"));
      assert.equal(html.includes(escaped(t("duplicatesSkipped", { count }))), count > 0);
    }
    if (locale === "en-US") { assert.equal(t("rowCount", { count: 1 }), "1 row"); assert.equal(t("duplicatesSkipped", { count: 2 }), "2 duplicates skipped"); }
  }
});

test("real import sheet translates preview/warnings/format options and preserves exact low digits, caller data and file contracts", () => {
  for (const locale of locales) {
    const { imports: t } = translators(locale), Sheet = loaded(shared).ImportSheet;
    const html = renderWithPresentation(createElement(Sheet, sheetProps), locale);
    includes(html, [t("hint"), t("uploadFile"), t("dropHint"), t("browseHint"), t("pasteContent"), t("contentPlaceholder"), t("format"), t("autoDetect"), t("rows"), t("duplicates"), t("periodLabel"), t("period", { start: imp.statementStartDate, end: imp.statementEndDate }), t("noQifTransactions"), t("unknownWarning"), t("date"), t("description"), t("amount"), t("cancel"), t("preview"), t("import"), "123", "CAMT.053", "BAI2", "<b>Caller تراکنش</b>", bankUiMoney(4000000000000001n, "USD", resolvePresentation({ user: { language: locale } })), content]);
    assert.ok(!html.includes("secret warning") && !html.includes("<script>") && !html.includes("<b>Caller"));
    assert.ok(html.includes('accept=".csv,.tsv,.qif,.ofx,.qfx,.qbo,.xml,.txt,.bai,.bai2"'));
    assert.equal(preview.transactions[0].amount, 4000000000000001n);
    assert.equal(preview.closingBalance, 4000000000000001n);
    const file = { name: imp.fileName, size: 1536 };
    includes(renderWithPresentation(createElement(Sheet, { ...sheetProps, selectedFile: file, previewing: true, importing: true }), locale), [file.name, t("fileSize", { size: "1.5" }), t("removeFile"), t("previewing"), t("importing")]);
    const blank = renderWithPresentation(createElement(Sheet, { ...sheetProps, preview: null, manualContent: "  " }), locale);
    assert.equal((blank.match(/disabled=""/g) ?? []).length, 2);
    assert.ok(!blank.includes(escaped(t("periodLabel"))));
    const noPeriod = renderWithPresentation(createElement(Sheet, { ...sheetProps, preview: { ...preview, statementStartDate: null, warnings: [] } }), locale);
    assert.ok(!noPeriod.includes(escaped(t("warnings"))));
    assert.ok(!noPeriod.includes(escaped(t("period", { start: imp.statementStartDate, end: imp.statementEndDate }))));
  }
});

test("all emitted parser warnings have finite translated mappings; format IDs and unknown-warning fallback are safe", () => {
  for (const [key, value] of Object.entries(fa.BankImports)) assert.match(value, /[\u0600-\u06ff]/, `Persian text missing: ${key}`);
  const source = readFileSync("lib/banking/importer.ts", "utf8");
  const warnings = [...source.matchAll(/warnings\.push\("([^"]+)"\)/g)].map(m => m[1]);
  assert.equal(warnings.length, 6);
  for (const locale of locales) {
    const { imports: t } = translators(locale);
    for (const warning of warnings) assert.notEqual(bankImportWarning(t, warning), t("unknownWarning"));
    for (const warning of ["__proto__", "constructor", "secret <script>" ]) assert.equal(bankImportWarning(t, warning), t("unknownWarning"));
    const formats = bankImportFormatLabels(t);
    assert.deepEqual(Object.keys(formats), ["auto", "csv", "tsv", "qif", "ofx", "qfx", "qbo", "camt052", "camt053", "camt054", "mt940", "mt942", "bai2"]);
    assert.equal(formats.auto, t("autoDetect")); assert.equal(formats.camt052, "CAMT.052");
    for (const count of [0, 1, 2, 1.5]) for (const key of ["rowCount", "duplicatesSkipped"] as const) assert.ok(!/MISSING|INVALID/.test(t(key, { count })));
  }
});

test("actual preview/commit callbacks retain org scope, ASCII formats, content and bigint preview adaptation", async () => {
  for (const locale of locales) for (const commit of [false, true]) for (const format of ["auto", "csv", "camt053"]) {
    const { t, errors } = translators(locale), successes: string[] = [], busy: boolean[] = [];
    let result: unknown, closed = false, refreshed = 0;
    const resets: unknown[] = [];
    const read = callback("readStatementContent", { selectedFile: null, manualContent: content });
    const scope = { t, errors, requireBankAccountResponse, bankWorkspaceFailure, bankUiPreview, orgId: "org-a", id: "bank-a", account: { currencyCode: "USD" }, format, readStatementContent: read, setPreviewing: (v: boolean) => busy.push(v), setImporting: (v: boolean) => busy.push(v), setPreview: (v: unknown) => { result = v; }, setImportOpen: (v: boolean) => { closed = !v; }, setSelectedFile: (v: unknown) => resets.push(v), setManualContent: (v: unknown) => resets.push(v), setFormat: (v: unknown) => resets.push(v), fetchData: () => { refreshed++; }, toast: { success: (v: string) => successes.push(v), error: (v: string) => assert.fail(v) }, fetch: async (url: string, init: RequestInit) => {
      assert.equal(url, "/api/v1/bank-accounts/bank-a/transactions/import"); assert.equal(init.method, "POST"); assert.deepEqual(init.headers, { "Content-Type": "application/json", "x-organization-id": "org-a" });
      assert.deepEqual(JSON.parse(String(init.body)), { mode: commit ? "commit" : "preview", content, fileName: null, format: format === "auto" ? null : format });
      return Response.json(commit ? { import: { imported: 2 } } : { preview: wirePreview });
    } };
    await callback(commit ? "handleImport" : "handlePreview", scope)();
    assert.deepEqual(busy, [true, false]);
    if (commit) { assert.equal(closed, true); assert.equal(refreshed, 1); assert.deepEqual(resets, [null, "", "auto"]); assert.equal(result, null); assert.deepEqual(successes, [t("importedCount", { count: 2 })]); }
    else { assert.deepEqual(result, preview); assert.equal(closed, false); assert.equal(refreshed, 0); assert.deepEqual(resets, []); assert.deepEqual(successes, []); }
    const fromFile = await callback("readStatementContent", { selectedFile: { name: "Caller.csv", text: async () => content }, manualContent: "ignored" })();
    assert.deepEqual(fromFile, { content, fileName: "Caller.csv" });
  }
});

test("actual import callbacks reject validation/auth/network/HTML/malformed responses without success, closing or resetting inputs", async () => {
  for (const locale of locales) for (const commit of [false, true]) for (const mode of ["validation", "unauthenticated", "forbidden", "network", "html", "malformed", "currency"]) {
    const { t, errors } = translators(locale), failures: string[] = [], busy: boolean[] = [];
    const forbid = () => assert.fail("failed operation must preserve inputs and stay open");
    const scope = { t, errors, requireBankAccountResponse, bankWorkspaceFailure, bankUiPreview, orgId: "org-a", id: "bank-a", account: { currencyCode: "USD" }, format: "auto", readStatementContent: async () => ({ content, fileName: null }), setPreviewing: (v: boolean) => busy.push(v), setImporting: (v: boolean) => busy.push(v), setPreview: forbid, setImportOpen: forbid, setSelectedFile: forbid, setManualContent: forbid, setFormat: forbid, fetchData: forbid, toast: { success: forbid, error: (v: string) => failures.push(v) }, fetch: async () => {
      if (mode === "network") throw new Error("network secret");
      if (mode === "html") return new Response("<html>secret</html>", { status: 500 });
      if (mode === "malformed") return new Response("invalid JSON", { status: 200 });
      if (mode === "currency") return Response.json({ preview: { ...wirePreview, currencyCode: "EUR" } });
      return Response.json({ error: "Mapped column not found: secret" }, { status: mode === "validation" ? 400 : mode === "unauthenticated" ? 401 : 403 });
    } };
    await callback(commit ? "handleImport" : "handlePreview", scope)();
    const expected = mode === "validation" ? errors("invalidInput") : mode === "unauthenticated" ? errors("unauthenticated") : mode === "forbidden" ? errors("forbidden") : mode === "html" ? t("requestFailed") : t(commit ? "importFailed" : "previewFailed");
    assert.deepEqual(failures, [expected]); assert.deepEqual(busy, [true, false]);
  }
});

test("owned import JSX has no remaining authored English text or visible string attributes", () => {
  for (const path of [shared, page]) {
    const ast = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(n: ts.Node) {
      if (path === shared && ts.isFunctionDeclaration(n) && !["ImportRow", "ImportSheet"].includes(n.name?.text ?? "")) return;
      if (ts.isJsxText(n)) assert.ok(!/[A-Za-z]/.test(n.text), `${path}: ${n.text}`);
      if (ts.isJsxAttribute(n) && ["title", "placeholder", "aria-label"].includes(n.name.getText(ast)) && n.initializer && ts.isStringLiteral(n.initializer)) assert.ok(!/[A-Za-z]/.test(n.initializer.text), n.getText(ast));
      ts.forEachChild(n, visit);
    }
    visit(ast);
  }
});
