import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import * as nextIntl from "next-intl";
import { compile } from "tailwindcss";
import ts from "typescript";
import * as Presentation from "../i18n/provider";
import * as CurrencySelect from "../components/ui/currency-select";
import * as DatePicker from "../components/ui/date-picker";
const { PresentationProvider } = Presentation;
import { resolvePresentation } from "../i18n/locale";
import { bankUiMoney } from "../lib/money/bank-ui";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const h = React.createElement, noop = () => {};
const root = "app/(dashboard)/accounting/banking/";
const presentations = (["en-US", "fa-IR"] as const).flatMap(language =>
  (["latn", "arabext"] as const).map(numerals => resolvePresentation({ user: { language, numerals } })));
const mixed = "  نام Caller <ACME/001> & " + "long-reference-".repeat(30);
const escaped = (s: string) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
const amount = 4000000000000001n;
const account = { id: "bank/001", accountName: mixed, bankName: mixed, accountNumber: "  IR-001/ABC  ",
  accountType: "checking", countryCode: "IR", currencyCode: "KWD", balance: amount, isActive: true, color: "#10b981", chartAccountId: "ledger/001" };
const tx = { id: "tx/001", date: "2026-10-25", description: mixed, reference: "  REF/001-ABC  ", payee: mixed,
  amount: -amount, balance: null, status: "unreconciled", accountName: mixed };
type Props = Record<string, unknown>;
// Control state/navigation/unowned widgets; execute production JSX and callbacks,
// actual next-intl, native Input, Button and SelectTrigger through the provider.
function loaded(file: string, name: string, states: unknown[] = [], context: Props = {}) {
  const require = createRequire(resolve(root + file));
  let index = 0;
  const controls: { type: unknown; props: Props }[] = [], updates: [number, unknown][] = [];
  const inline = ({ children }: { children: React.ReactNode }) => h("div", null, children);
  const capture = (create: typeof jsxRuntime.jsx) => (type: React.ElementType, props: Props, key?: string) => {
    controls.push({ type, props }); return create(type, props, key);
  };
  let source = readFileSync(root + file, "utf8");
  if (name !== "default") source += `\nexport { ${name} };`;
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const compiled = { exports: {} as Record<string, React.ComponentType<Props>> };
  new Function("require", "module", "exports", code)((id: string) => {
    if (id === "react") return { ...React, useState: (initial: unknown) => {
      const n = index++; return [n < states.length ? states[n] : typeof initial === "function" ? initial() : initial,
        (value: unknown) => updates.push([n, value])];
    }, useEffect: noop };
    if (id === "next-intl") return nextIntl;
    if (id.endsWith("/i18n/provider")) return Presentation;
    if (id.endsWith("/ui/currency-select")) return CurrencySelect;
    if (id.endsWith("/ui/date-picker")) return DatePicker;
    if (id === "react/jsx-runtime") return { ...jsxRuntime, jsx: capture(jsxRuntime.jsx), jsxs: capture(jsxRuntime.jsxs) };
    if (id === "next/navigation") return { useParams: () => ({ id: account.id }), useRouter: () => ({ push: noop }) };
    if (id.endsWith("/layout")) return { useBankAccountContext: () => ({ account, setAccount: noop, refetch: noop, ...context }) };
    if (id.endsWith("/use-document-title")) return { useDocumentTitle: noop };
    if (id.endsWith("/use-confirm")) return { useConfirm: () => ({ confirm: noop, dialog: null }) };
    if (id.endsWith("/account-picker")) return { AccountPicker: () => null };
    if (id.endsWith("/create-drawer")) return { useCreateDrawer: () => ({ open: noop }) };
    if (["/ui/dialog", "/ui/sheet"].some(s => id.endsWith(s))) return new Proxy({}, { get: (_o, key) =>
      key === "Dialog" || key === "Sheet" ? ({ open, children }: { open: boolean; children: React.ReactNode }) => open ? inline({ children }) : null : inline });
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  }, compiled, compiled.exports);
  return { controls, updates, render(p: typeof presentations[number], props: Props = {}) {
    index = 0; controls.length = 0;
    return renderToStaticMarkup(h(PresentationProvider, { presentation: p, messages: p.locale === "fa-IR" ? fa : en,
      now: new Date("2026-10-25T00:00:00Z") }, h(compiled.exports[name], props)));
  } };
}

test("actual banking transaction/import rows isolate exact caller values and preserve selection/action identities", () => {
  for (const p of presentations) {
    const row = loaded("[id]/_components.tsx", "TransactionRow"), selected: unknown[] = [], categorized: unknown[] = [];
    const html = row.render(p, { tx, cur: "KWD", isLast: true, selectable: true, selected: false,
      onSelectChange: (...args: unknown[]) => selected.push(args), onCategorize: (value: unknown) => categorized.push(value),
      onReconcile: noop, onExclude: noop });
    assert.ok(html.includes(`>${escaped(mixed)}</bdi>`));
    assert.match(html, /<bdi[^>]*dir="ltr"[^>]*>  REF\/001-ABC  <\/bdi>/);
    assert.ok(html.includes(escaped(bankUiMoney(-amount, "KWD", p))));
    assert.ok(html.includes("text-end")); assert.ok(html.includes("flex-wrap"));
    const choice = row.controls.find(c => typeof c.props.onCheckedChange === "function"); assert.ok(choice);
    (choice.props.onCheckedChange as (v: boolean) => void)(true);
    assert.deepEqual(selected, [[tx.id, true]]);
    const action = row.controls.find(c => c.props.title === (p.locale === "fa-IR" ? fa : en).BankWorkspace.categorizeHint);
    assert.ok(action); (action.props.onClick as () => void)(); assert.equal(categorized[0], tx);
    const imp = loaded("[id]/_components.tsx", "ImportRow");
    const impHtml = imp.render(p, { imp: { id: "import/001", fileName: mixed, format: "csv", importedCount: 1,
      duplicateCount: 0, createdAt: "2026-10-25T00:00:00Z", warnings: [] }, isLast: true });
    assert.match(impHtml, /<bdi[^>]*dir="ltr"/); assert.ok(impHtml.includes(`>${escaped(mixed)}</bdi>`));
    assert.equal(tx.reference, "  REF/001-ABC  "); // Intl may supply its own direction marks in money.
  }
});

test("actual bank settings retain native exact fields and accessible growing account-type trigger", () => {
  for (const p of presentations) {
    const page = loaded("[id]/(detail)/settings/page.tsx", "default"), html = page.render(p);
    for (const [name, value, dir] of [["accountName", mixed, "auto"], ["bankName", mixed, "auto"],
      ["accountNumber", account.accountNumber, "ltr"], ["countryCode", "IR", "ltr"]]) {
      const input = page.controls.find(c => c.props.name === name)?.props;
      assert.ok(input); assert.equal(input.defaultValue, value); assert.equal(input.dir, dir); assert.ok(input["aria-label"]);
    }
    assert.ok(html.includes("sm:grid-cols-[200px_minmax(0,1fr)]"));
    assert.match(html, /role="combobox"/);
    assert.ok(html.includes("data-[size=default]:h-auto"));
    assert.ok(html.includes("[&amp;_[data-slot=select-value]]:line-clamp-none"));
    assert.ok(html.includes('name="accountType"'));
  }
});

test("actual payment batch and scheduled list preserve isolated supplier identifiers and exact amounts", () => {
  const bill = { id: "bill/001", billNumber: "  BILL-001/ABC  ", contact: { id: "supplier/001", name: mixed }, currencyCode: "KWD", amountDue: amount, total: amount };
  const item = { id: "item/001", bill, contact: bill.contact, amount, currencyCode: "KWD", scheduledDate: "2026-10-25", status: "pending", notes: mixed };
  const batch = { id: "batch/001", name: mixed, status: "draft", totalAmount: amount, currencyCode: "KWD", paymentCount: 1, items: [item], createdAt: "2026-10-25T00:00:00Z" };
  for (const p of presentations) {
    for (const page of [loaded("batches/[id]/page.tsx", "BatchDetails", [batch, "", false]),
      loaded("scheduled/page.tsx", "ScheduledPaymentsList", [[item], "", false])]) {
      const html = page.render(p, { id: batch.id, orgId: "org/001" });
      assert.ok(html.includes(`>${escaped(mixed)}</bdi>`));
      assert.match(html, /<bdi[^>]*dir="ltr"[^>]*>  BILL-001\/ABC  <\/bdi>/);
      assert.ok(html.includes(escaped(bankUiMoney(amount, "KWD", p))));
    }
  }
});

test("installed banking CSS supplies logical alignment, growing values and intrinsic layout tracks", async () => {
  const compiler = await compile("@theme { --spacing: 0.25rem; } @tailwind utilities;");
  const css = compiler.build(["start-3", "end-3", "ps-9", "me-2", "text-start", "text-end", "h-auto", "min-w-0",
    "grid-cols-[200px_minmax(0,1fr)]", "grid-cols-[90px_minmax(0,1fr)_100px]", "flex-wrap",
    "[&_[data-slot=select-value]]:line-clamp-none", "[&_[data-slot=select-value]]:whitespace-normal", "[&:dir(rtl)]:rotate-180"]);
  for (const declaration of ["inset-inline-start:", "inset-inline-end:", "padding-inline-start:", "margin-inline-end:",
    "text-align: start", "text-align: end", "height: auto", "min-width:", "grid-template-columns: 200px minmax(0,1fr)",
    "grid-template-columns: 90px minmax(0,1fr) 100px", "flex-wrap: wrap", "-webkit-line-clamp: unset", "white-space: normal", "rotate: 180deg"])
    assert.ok(css.includes(declaration), declaration);
});
