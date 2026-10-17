import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement, type ComponentType, type ReactNode } from "react";
import * as React from "react";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { createTranslator } from "next-intl";
import * as nextIntl from "next-intl";
import * as DatePicker from "../components/ui/date-picker";
import * as DataTable from "../components/dashboard/data-table";
import * as BrandLoader from "../components/dashboard/brand-loader";
import * as ActivityFeed from "../components/dashboard/activity-feed";
import * as AccountPicker from "../components/dashboard/account-picker";
import * as Presentation from "../i18n/provider";
import { EntryForm } from "../components/dashboard/entry-form";
import { OpeningBalanceForm } from "../components/dashboard/opening-balance-form";
import { OpeningBalanceMoneyDetails } from "../components/dashboard/opening-balance-money-details";
import { journalPreviewMessage, requireJournalResponse, journalFailureMessage } from "../i18n/journal-presentation";
import { journalEditorPreview, journalDecimal, journalRestMinor } from "../lib/money/journal-display";
import { openingBalancePreview } from "../lib/money/opening-balance-ui";
import { coreJournalSummary } from "../lib/money/core-presentation";
import { renderWithPresentation } from "./helpers/presentation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const locales = ["en-US", "fa-IR"] as const;
const base = "app/(dashboard)/accounting";
const entryPath = `${base}/[id]/page.tsx`;
const recurringPath = `${base}/recurring-journals/[id]/page.tsx`;
const drawer = "components/dashboard/create-drawer.tsx";
const noop = () => {};
const account = { id: "account-a", code: "1000", name: "<script>حساب</script>" };
const rows = [{ accountId: account.id, description: "", debit: "40000000000000.01", credit: "" }, { accountId: account.id, description: "", debit: "", credit: "40000000000000.01" }];
const entry = { id: "entry-a", entryNumber: 42, date: "2026-10-18", description: "<script>شرح</script>", reference: "REF-CALLER", status: "draft", sourceType: "manual", sourceId: null, createdAt: "2026-10-18T00:00:00Z", fiscalYearId: "fy-a", lines: rows.map((row, i) => ({ id: `line-${i}`, accountId: account.id, accountCode: account.code, accountName: account.name, description: "caller memo", debitAmount: row.debit || "0.00", creditAmount: row.credit || "0.00", debitAmountMinor: i === 0 ? "4000000000000001" : "0", creditAmountMinor: i === 1 ? "4000000000000001" : "0", currencyCode: "USD", amountCurrencyCode: "USD", exchangeRate: 1000000, costCenterId: "cc-a", projectId: "project-a" })) };
const recurring = { id: "recurring-a", name: "<script>نام</script>", frequency: "semi_annual", status: "active", startDate: "2026-10-18", endDate: null, nextRunDate: "2026-11-18", lastRunDate: null, occurrencesGenerated: 2, maxOccurrences: null, reference: "REF-CALLER", notes: "caller notes", currencyCode: "USD", lines: entry.lines };

// Real production templates and next-intl render with controlled state/navigation.
// Sheets/dialogs render inline to inspect their actual content without a browser.
function loaded(path: string, states: unknown[]) {
  let index = 0;
  const require = createRequire(resolve(path));
  const compiledModule = { exports: {} as Record<string, ComponentType<Record<string, unknown>>> };
  let source = readFileSync(path, "utf8");
  if (path === drawer) {
    const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const names = new Set(["EntryDrawer", "OpeningBalanceDrawer", "RecurringJournalDrawer", "DrawerIcon", "SectionLabel"]);
    const functions = ast.statements.filter(node => ts.isFunctionDeclaration(node) && node.name && names.has(node.name.text));
    const bindings = new Set<string>();
    const visit = (node: ts.Node) => { if (ts.isIdentifier(node)) bindings.add(node.text); ts.forEachChild(node, visit); };
    functions.forEach(visit);
    source = ast.statements.flatMap(node => {
      if (functions.includes(node)) return [node.getText(ast)];
      if (ts.isImportDeclaration(node) && node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings)) {
        const imports = node.importClause.namedBindings.elements.filter(n => bindings.has(n.name.text));
        if (imports.length) return [`import { ${imports.map(n => n.getText(ast)).join(", ")} } from ${node.moduleSpecifier.getText(ast)};`];
      }
      return [];
    }).join("\n") + "\nexport { EntryDrawer, OpeningBalanceDrawer, RecurringJournalDrawer };";
  } else if (path === entryPath) source += "\nexport { EditEntrySheet };";
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  const load = (id: string) => {
    if (id === "next-intl") return nextIntl;
    if (id.endsWith("/date-picker")) return DatePicker;
    if (id.endsWith("/data-table")) return DataTable;
    if (id.endsWith("/brand-loader")) return BrandLoader;
    if (id.endsWith("/activity-feed")) return ActivityFeed;
    if (id.endsWith("/account-picker")) return AccountPicker;
    if (id.endsWith("/i18n/provider")) return Presentation;
    if (id.endsWith("/entry-form")) return { EntryForm };
    if (id.endsWith("/opening-balance-form")) return { OpeningBalanceForm };
    if (id.endsWith("/opening-balance-money-details")) return { OpeningBalanceMoneyDetails };
    if (id === "react") return { ...React, useState: (initial: unknown) => [index < states.length ? states[index++] : initial, noop], useEffect: noop, useCallback: (fn: unknown) => fn, useMemo: (fn: () => unknown) => fn(), useRef: () => ({ current: null }) };
    if (id === "next/navigation") return { useRouter: () => ({ push: noop }), useParams: () => ({ id: "entry-a" }) };
    if (id.endsWith("/create-drawer")) return { useCreateDrawer: () => ({ open: noop }) };
    if (id.endsWith("/use-confirm")) return { useConfirm: () => ({ confirm: noop, dialog: null }) };
    if (id.endsWith("/use-document-title")) return { useDocumentTitle: noop };
    if (id.endsWith("/use-entity-title")) return { useEntityTitle: noop };
    if (id.endsWith("/ui/sheet") || id.endsWith("/ui/dialog")) return Object.fromEntries(["Sheet", "SheetContent", "SheetHeader", "SheetTitle", "SheetDescription", "Dialog", "DialogContent", "DialogDescription", "DialogFooter", "DialogHeader", "DialogTitle", "DialogTrigger"].map(key => [key, ({ children }: { children: ReactNode }) => createElement("div", null, children)]));
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  };
  new Function("require", "module", "exports", code)(load, compiledModule, compiledModule.exports);
  return compiledModule.exports;
}

function callback(path: string, name: string, scope: Record<string, unknown>, owner?: string) {
  const ast = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let expression = "";
  function visit(node: ts.Node) {
    if (owner && ts.isFunctionDeclaration(node) && node.parent === ast && node.name?.text !== owner) return;
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) expression = `(${node.getText(ast)})`;
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name && node.initializer && ts.isCallExpression(node.initializer)) expression = node.initializer.arguments[0].getText(ast);
    if (name === "initialEffect" && ts.isCallExpression(node) && node.expression.getText(ast) === "useEffect") expression ||= node.arguments[0].getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(expression, name);
  const js = ts.transpileModule(`const run = ${expression};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(scope), `${js}; return run;`)(...Object.values(scope));
}

function translators(locale: typeof locales[number]) {
  const messages = locale === "en-US" ? en : fa;
  return { messages, t: createTranslator({ locale, messages, namespace: "Journals" }), errors: createTranslator({ locale, messages, namespace: "JournalErrors" }) };
}

test("journal/opening forms render paired copy and accessible rows while keeping exact text and validation", () => {
  for (const locale of locales) {
    const { messages } = translators(locale);
    const form = renderWithPresentation(createElement(EntryForm, { accounts: [account], onSubmit: noop, initial: { date: "2026-10-18", description: "<script>شرح</script>", reference: "REF-CALLER", lines: rows } }), locale);
    for (const key of ["entryLines", "description", "debit", "credit", "saveEntry"] as const) assert.ok(form.includes(messages.Journals[key]), key);
    assert.ok(form.includes("40000000000000.01"));
    assert.ok(form.includes('value="2026-10-18"'));
    assert.ok(form.includes("&lt;script&gt;شرح&lt;/script&gt;"));
    assert.ok(!form.includes("<script>"));
    assert.ok(!/<button(?=[^>]*type="submit")(?=[^>]*disabled="")/.test(form));
    for (const [debit, expected] of [["1x", "amountError"], ["0.001", "precisionError"], ["90071992547409.92", "rangeError"]] as const) {
      const html = renderWithPresentation(createElement(OpeningBalanceForm, { accounts: [account], saving: false, onSubmit: noop, onCancel: noop, initialRows: [{ accountId: account.id, debit, credit: "" }, { accountId: account.id, debit: "", credit: "1" }] }), locale);
      assert.ok(html.includes(messages.Journals[expected]));
      assert.ok(html.includes('role="alert"'));
      assert.ok(/<button(?=[^>]*type="submit")(?=[^>]*disabled="")/.test(html));
      assert.ok(html.includes(translators(locale).t("debitLine", { number: 1 })), `${locale}: ${html.match(/aria-label="[^"]*"/g)?.join(", ")}`);
    }
  }
});

test("production list, detail, edit, recurring and opening templates render bilingual copy and saved values", () => {
  for (const locale of locales) {
    const { messages, t } = translators(locale);
    for (const list of [[], [coreJournalSummary({ ...entry, totalDebit: "40000000000000.01", totalDebitMinor: "4000000000000001", debitTotals: [{ currencyCode: "USD", totalDebit: 4000000000000001, totalDebitMinor: "4000000000000001" }] })]]) {
      const Page = loaded(`${base}/page.tsx`, [list, false, null, "all", "", "", "", "date:desc"]).default;
      const html = renderWithPresentation(createElement(Page), locale);
      assert.ok(html.includes(messages.Journals.newEntry));
      assert.ok(html.includes(list.length ? messages.Journals.drafts : messages.Journals.manualDescription));
      if (list.length) { assert.ok(html.includes("40,000,000,000,000.01")); assert.ok(html.includes("&lt;script&gt;شرح&lt;/script&gt;")); }
    }
    const Detail = loaded(entryPath, [entry, false, null, "", false, false]).default;
    const html = renderWithPresentation(createElement(Detail), locale);
    for (const key of ["entryDetails", "auditTrail", "finalize", "edit", "manualSource"] as const) assert.ok(html.includes(messages.Journals[key]), key);
    assert.ok(html.includes(t("entryTitle", { number: 42 })));
    assert.ok(html.includes("40,000,000,000,000.01"));
    const Edit = loaded(entryPath, [entry.date, entry.description, entry.reference, rows, false]).EditEntrySheet;
    const edit = renderWithPresentation(createElement(Edit, { open: true, onClose: noop, entry, orgId: "org-a", onSaved: noop }), locale);
    assert.ok(edit.includes(t("editTitle", { number: 42 })));
    assert.ok(edit.includes(messages.Journals.saveChanges));
    const Recurring = loaded(recurringPath, [recurring, null, false, false, false]).default;
    const recurringHtml = renderWithPresentation(createElement(Recurring), locale);
    for (const key of ["semiAnnual", "postingStatus", "postNow", "pause", "never", "notes"] as const) assert.ok(recurringHtml.includes(messages.Journals[key]), key);
    assert.ok(recurringHtml.includes("2026-11-18"));
    assert.ok(recurringHtml.includes("40,000,000,000,000.01"));
    const Opening = loaded(`${base}/opening-balances/page.tsx`, [{ ...entry, lines: [{ id: "a", debitAmount: 4000000000000001, creditAmount: 0, account }] }, false, null]).default;
    const opening = renderWithPresentation(createElement(Opening), locale);
    assert.ok(opening.includes(messages.Journals.replaceOpening));
    assert.ok(opening.includes("40,000,000,000,000.01"));
    assert.ok(opening.includes(t("startingFrom", { date: entry.date })));
    const List = loaded(`${base}/recurring-journals/page.tsx`, [[recurring], null, false, false, false, 1, 1, 0, "all", "all", "created", "desc", ""]).default;
    const list = renderWithPresentation(createElement(List), locale);
    assert.ok(list.includes(messages.Journals.newRecurring));
    assert.ok(list.includes(messages.Journals.semiAnnual));
  }
});

test("owned drawers render their real translated forms and keep canonical frequency and currency choices", () => {
  for (const locale of locales) for (const owner of ["EntryDrawer", "OpeningBalanceDrawer", "RecurringJournalDrawer"]) {
    const { messages } = translators(locale);
    const states = owner === "EntryDrawer" ? [[account], false] : owner === "OpeningBalanceDrawer" ? [false, [account]] : [false, [account], "Caller name", "monthly", "2026-10-18", "", "REF-CALLER", "caller notes", rows];
    const Drawer = loaded(drawer, states)[owner];
    const html = renderWithPresentation(createElement(Drawer, { open: true, onClose: noop }), locale);
    assert.ok(html.includes(messages.Journals[owner === "EntryDrawer" ? "createEntry" : owner === "OpeningBalanceDrawer" ? "setOpening" : "createRecurring"]));
    assert.ok(html.includes(messages.Journals.cancel));
    if (owner === "RecurringJournalDrawer") { assert.ok(html.includes(messages.Journals.linesHint)); assert.ok(html.includes("40") || html.includes("40000000000000.01")); }
  }
});

test("approved HTTP/preview messages translate and unknown server, network and prototype prose stays hidden", async () => {
  for (const locale of locales) {
    const { messages, t, errors } = translators(locale);
    const fallback = t("createFailed");
    for (const [status, error, key] of [[409, "Entry changed before posting", "changed"], [400, "Cannot toggle a completed template", "completed"], [404, "Entry not found", "missing"], [401, "secret", "unauthenticated"], [403, "secret", "forbidden"], [422, "secret", "invalidInput"]] as const) await assert.rejects(requireJournalResponse(Response.json({ error }, { status }), errors, fallback), { message: messages.JournalErrors[key] });
    for (const value of ["<script>secret</script>", "constructor", "__proto__"]) await assert.rejects(requireJournalResponse(Response.json({ error: value }, { status: 500 }), errors, fallback), { message: fallback });
    await assert.rejects(requireJournalResponse(new Response("HTML secret", { status: 500 }), errors, fallback), { message: fallback });
    assert.equal(journalFailureMessage(new Error("network secret"), fallback), fallback);
    assert.equal(journalPreviewMessage(t, "Select an account for every amount"), t("selectAccountError"));
    assert.equal(journalPreviewMessage(t, "Use either debit or credit on each line"), t("oneSidedError"));
    assert.equal(journalPreviewMessage(t, "secret"), t("amountError"));
    assert.ok(/\p{Script=Arabic}/u.test(fa.Journals.amountError));
  }
});

test("production create callbacks keep exact payloads and never close or navigate after failed requests", async () => {
  for (const locale of locales) for (const owner of ["EntryDrawer", "OpeningBalanceDrawer", "RecurringJournalDrawer"]) for (const failure of ["success", "forbidden", "network", "html"]) {
    const { t, errors } = translators(locale);
    const successes: string[] = [], failures: string[] = [], bodies: Record<string, unknown>[] = [];
    let changes = 0;
    const preview = journalEditorPreview(rows, { oneSided: true });
    const payload = { date: "2026-10-18", balances: openingBalancePreview(rows).balances };
    const run = callback(drawer, "handleSubmit", {
      t, errors, requireJournalResponse, journalFailureMessage, journalPreviewMessage,
      localStorage: { getItem: () => "org-a" }, setLoading: noop, setSaving: noop,
      name: "Caller name", frequency: "semi_annual", startDate: "2026-10-18", endDate: "", reference: "REF-CALLER", notes: "caller notes", preview, isBalanced: true,
      onClose: () => { changes++; }, router: { push: () => { changes++; } }, window: { dispatchEvent: () => { changes++; } }, Event: class {},
      toast: { success: (v: string) => successes.push(v), error: (v: string) => failures.push(v) },
      fetch: async (url: string, init: RequestInit) => {
        assert.equal(url, owner === "EntryDrawer" ? "/api/v1/entries" : owner === "OpeningBalanceDrawer" ? "/api/v1/opening-balances" : "/api/v1/recurring-journals");
        assert.equal(init.method, "POST");
        assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a");
        bodies.push(JSON.parse(String(init.body)));
        if (failure === "network") throw new Error("network secret");
        if (failure === "html") return new Response("HTML secret", { status: 500 });
        return Response.json({ entry: { id: "entry-a" }, error: "secret" }, { status: failure === "forbidden" ? 403 : 200 });
      },
    }, owner);
    await run(owner === "EntryDrawer" ? { date: "2026-10-18", description: "Caller text", reference: "", lines: preview.lines } : owner === "OpeningBalanceDrawer" ? payload : { preventDefault: noop });
    assert.equal(successes.length, failure === "success" ? 1 : 0);
    assert.equal(failures.length, failure === "success" ? 0 : 1);
    assert.equal(changes > 0, failure === "success");
    if (owner === "OpeningBalanceDrawer") assert.deepEqual(bodies[0], payload);
    else {
      const lines = bodies[0].lines as { debitAmountMinor: string; creditAmountMinor: string }[];
      assert.equal(lines[0].debitAmountMinor, "4000000000000001");
      assert.equal(lines[1].creditAmountMinor, "4000000000000001");
      if (owner === "RecurringJournalDrawer") { assert.equal(bodies[0].frequency, "semi_annual"); assert.equal(bodies[0].currencyCode, "USD"); assert.equal(bodies[0].endDate, null); }
    }
    assert.ok(!failures.some(value => /secret|<script>/.test(value)));
  }
});

test("production journal editing and entry-form submission preserve metadata and exact amount aliases", async () => {
  for (const locale of locales) {
    const { t, errors } = translators(locale);
    let body: Record<string, unknown> | undefined, saved = 0;
    const preview = journalEditorPreview(rows.map(row => ({ ...row, currencyCode: "USD", exchangeRate: 1000000, costCenterId: "cc-a", projectId: "project-a" })));
    const save = callback(entryPath, "save", { t, errors, requireJournalResponse, journalFailureMessage, journalPreviewMessage, orgId: "org-a", entry, date: entry.date, description: " Caller text ", reference: " REF ", preview, balanced: true, setSaving: noop, toast: { success: noop, error: noop }, onSaved: () => { saved++; }, fetch: async (url: string, init: RequestInit) => { assert.equal(url, "/api/v1/entries/entry-a"); assert.equal(init.method, "PUT"); body = JSON.parse(String(init.body)); return Response.json({ entry }); } }, "EditEntrySheet");
    await save();
    assert.equal(saved, 1);
    assert.equal(body?.fiscalYearId, "fy-a");
    assert.equal(body?.description, "Caller text");
    assert.deepEqual(body?.lines, preview.lines);
    let submitted: unknown;
    const submit = callback("components/dashboard/entry-form.tsx", "handleSubmit", { isBalanced: true, date: entry.date, description: "caller text", reference: "REF", preview, onSubmit: (v: unknown) => { submitted = v; } });
    submit({ preventDefault: noop });
    assert.deepEqual(submitted, { date: entry.date, description: "caller text", reference: "REF", lines: preview.lines });
    assert.equal(journalDecimal(journalRestMinor("40000000000000.01", "4000000000000001")), "40000000000000.01");
  }
});

test("delete confirmations translate, preserve endpoints and reject on request failure", async () => {
  for (const locale of locales) for (const path of [entryPath, recurringPath]) for (const failure of [false, true]) {
    const { t, errors } = translators(locale);
    const successes: string[] = [], failures: string[] = [];
    let navigated = 0;
    const run = callback(path, path === entryPath ? "deleteEntry" : "handleDelete", {
      t, errors, requireJournalResponse, journalFailureMessage, orgId: "org-a", id: "entry-a",
      confirm: async (options: { title: string; cancelLabel: string; destructive: boolean; onConfirm: () => Promise<void> }) => {
        assert.equal(options.cancelLabel, t("cancel")); assert.equal(options.destructive, true);
        if (failure) await assert.rejects(options.onConfirm()); else await options.onConfirm();
      },
      router: { push: () => { navigated++; } }, toast: { success: (v: string) => successes.push(v), error: (v: string) => failures.push(v) },
      fetch: async (url: string, init: RequestInit) => { assert.equal(init.method, "DELETE"); assert.equal(url, path === entryPath ? "/api/v1/entries/entry-a" : "/api/v1/recurring-journals/entry-a"); return Response.json({ error: "secret" }, { status: failure ? 403 : 200 }); },
    });
    await run();
    assert.equal(navigated, failure ? 0 : 1); assert.equal(successes.length, failure ? 0 : 1); assert.equal(failures.length, failure ? 1 : 0);
  }
});

test("ICU counts and escaping work for zero, one and multiple journals in both locales", () => {
  for (const locale of locales) {
    const { t } = translators(locale);
    for (const count of [0, 1, 2]) {
      for (const key of ["showing", "showingRecurring"] as const) assert.ok(!/MISSING|INVALID/.test(t(key, { count, shown: count })));
      assert.ok(!/MISSING|INVALID/.test(t("postedDue", { count })));
    }
    const html = renderWithPresentation(createElement(OpeningBalanceMoneyDetails, { lines: [{ id: "a", debitAmount: 1, creditAmount: 0, account }] }), locale);
    assert.ok(html.includes("&lt;script&gt;حساب&lt;/script&gt;")); assert.ok(!html.includes("<script>"));
  }
});

test("journal finalize/cancel callbacks preserve operations and reasons and hide failed response prose", async () => {
  for (const locale of locales) for (const operation of ["postEntry", "voidEntry"]) for (const failure of ["success", "forbidden", "network", "html"]) {
    const { t, errors } = translators(locale);
    let refreshed = 0;
    const successes: string[] = [], failures: string[] = [], loading: boolean[] = [];
    const run = callback(entryPath, operation, {
      t, errors, requireJournalResponse, journalFailureMessage, orgId: "org-a", id: "entry-a", voidReason: "Caller reason دلیل",
      setActionLoading: (v: boolean) => loading.push(v), setVoidReason: noop, loadEntry: () => { refreshed++; },
      toast: { success: (v: string) => successes.push(v), error: (v: string) => failures.push(v) },
      fetch: async (url: string, init: RequestInit) => {
        assert.equal(url, `/api/v1/entries/entry-a/${operation === "postEntry" ? "post" : "void"}`);
        assert.equal(init.method, "POST"); assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a");
        if (operation === "voidEntry") assert.deepEqual(JSON.parse(String(init.body)), { reason: "Caller reason دلیل" });
        if (failure === "network") throw new Error("network secret");
        if (failure === "html") return new Response("HTML secret", { status: 500 });
        return Response.json({ error: "secret" }, { status: failure === "forbidden" ? 403 : 200 });
      },
    });
    await run();
    assert.deepEqual(loading, [true, false]);
    assert.equal(refreshed, failure === "success" ? 1 : 0);
    assert.equal(successes.length, failure === "success" ? 1 : 0);
    assert.equal(failures.length, failure === "success" ? 0 : 1);
    assert.ok(!failures.some(value => value.includes("secret")));
  }
});

test("recurring pause/resume and run callbacks preserve status codes, org scope, ICU results and failure recovery", async () => {
  for (const locale of locales) for (const operation of ["handleToggle", "handlePostNow"]) for (const failure of ["success", "forbidden", "network", "json"]) {
    const { t, errors } = translators(locale);
    const successes: string[] = [], failures: string[] = [], loading: boolean[] = [];
    let changes = 0;
    const run = callback(recurringPath, operation, {
      t, errors, requireJournalResponse, journalFailureMessage, orgId: "org-a", id: "recurring-a",
      setToggling: (v: boolean) => loading.push(v), setPosting: (v: boolean) => loading.push(v), setRj: () => { changes++; },
      toast: { success: (v: string) => successes.push(v), error: (v: string) => failures.push(v) },
      fetch: async (url: string, init: RequestInit) => {
        assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a");
        if (!init.method) { assert.equal(url, "/api/v1/recurring-journals/recurring-a"); return Response.json({ template: recurring }); }
        assert.equal(init.method, "POST");
        assert.equal(url, operation === "handleToggle" ? "/api/v1/recurring-journals/recurring-a/pause" : "/api/v1/recurring-journals/run");
        if (failure === "network") throw new Error("network secret");
        if (failure === "json") return new Response("not JSON secret");
        return Response.json({ posted: 2, template: { ...recurring, status: "paused" }, error: "secret" }, { status: failure === "forbidden" ? 403 : 200 });
      },
    });
    await run();
    assert.deepEqual(loading, [true, false]);
    assert.equal(successes.length, failure === "success" ? 1 : 0);
    assert.equal(changes, failure === "success" ? 1 : 0);
    assert.equal(failures.length, failure === "success" ? 0 : 1);
    if (failure === "success") assert.equal(successes[0], operation === "handleToggle" ? t("pauseSuccess") : t("postedDue", { count: 2 }));
    assert.ok(!failures.some(value => value.includes("secret")));
  }
});

test("recurring list keeps canonical filters/pagination and shows read failures rather than a successful empty state", async () => {
  for (const locale of locales) {
    const { t, errors } = translators(locale);
    const params = callback(`${base}/recurring-journals/page.tsx`, "buildParams", { statusFilter: "paused", frequencyFilter: "semi_annual", sortBy: "nextRun", sortOrder: "asc", PAGE_SIZE: 50, URLSearchParams });
    assert.equal(params(2).toString(), "status=paused&frequency=semi_annual&sortBy=nextRun&sortOrder=asc&page=2&limit=50");
    for (const failure of ["forbidden", "network", "json"]) {
      const messages: string[] = [];
      const effect = callback(`${base}/recurring-journals/page.tsx`, "initialEffect", {
        t, errors, requireJournalResponse, journalFailureMessage, orgId: "org-a", buildParams: params,
        setRefetching: noop, setPage: noop, setTemplates: () => assert.fail("failed data must not become empty success"), setTotalCount: noop, setError: (v: string) => messages.push(v), setInitialLoad: noop, setFetchKey: noop, devDelay: async () => {},
        fetch: async (url: string, init: RequestInit) => {
          assert.ok(url.startsWith("/api/v1/recurring-journals?status=paused&frequency=semi_annual"));
          assert.equal((init.headers as Record<string, string>)["x-organization-id"], "org-a");
          if (failure === "network") throw new Error("network secret");
          return failure === "json" ? new Response("HTML secret") : Response.json({ error: "secret" }, { status: 403 });
        },
      });
      effect(); await new Promise(resolve => setImmediate(resolve));
      assert.deepEqual(messages, [failure === "forbidden" ? errors("forbidden") : t("loadRecurringFailed")]);
      const Page = loaded(`${base}/recurring-journals/page.tsx`, [[], messages[0], false]).default;
      const html = renderWithPresentation(createElement(Page), locale);
      assert.ok(html.includes('role="alert"')); assert.ok(!html.includes(t("exampleSchedule")));
    }
    const Empty = loaded(`${base}/recurring-journals/page.tsx`, [[], null, false, false, false, 1, 0, 0, "all", "all", "created", "desc", ""]).default;
    const empty = renderWithPresentation(createElement(Empty), locale);
    assert.ok(empty.includes(t("exampleSchedule"))); assert.ok(empty.includes(t("calendarHint")));
    const Invalid = loaded(recurringPath, [{ ...recurring, lines: [{ ...recurring.lines[0], debitAmountMinor: "01250" }] }, null, false]).default;
    const invalid = renderWithPresentation(createElement(Invalid), locale);
    assert.ok(invalid.includes('role="alert"')); assert.ok(invalid.includes(t("loadFailed")));
  }
});

test("activity sidebar reuses audit labels and dates while escaping caller text and preserving its route", () => {
  for (const locale of locales) {
    const messages = locale === "en-US" ? en : fa;
    const Page = loaded("components/dashboard/activity-feed.tsx", [[{ id: "audit-a", action: "create", entityType: "journal_entry", entityId: "entry-a", userName: "<script>نام</script>", createdAt: "2026-10-17T00:00:00Z" }], false]).ActivityFeed;
    const html = renderWithPresentation(createElement(Page), locale);
    assert.ok(html.includes(messages.JournalActivity.title)); assert.ok(html.includes(messages.JournalActivity.viewAll));
    assert.ok(html.includes(messages.SettingsAudit.action_create)); assert.ok(html.includes(messages.SettingsAudit.entity_journal_entry));
    assert.ok(html.includes('href="/settings/audit-log"')); assert.ok(html.includes("&lt;script&gt;نام&lt;/script&gt;"));
  }
});
