import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement, type ReactNode } from "react";
import { createTranslator } from "next-intl";
import { readFileSync, readdirSync } from "node:fs";
import ts from "typescript";
import { AppRouterContext, type AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { TestSession } from "./helpers/session";
import { FileText } from "lucide-react";
import { renderWithPresentation } from "./helpers/presentation";
import { SidebarProvider } from "../components/ui/sidebar";
import { CreateDrawerProvider } from "../components/dashboard/create-drawer";
import { AppSidebar } from "../components/dashboard/sidebar";
import { Topbar } from "../components/dashboard/topbar";
import { ThemeOptions } from "../components/shared/theme-toggle";
import { DataTable } from "../components/dashboard/data-table";
import { DataTableAdvanced } from "../components/dashboard/data-table-advanced";
import { ErrorState } from "../components/dashboard/error-state";
import { EmptyState } from "../components/dashboard/empty-state";
import { PageSkeleton } from "../components/dashboard/page-skeleton";
import { BrandLoader } from "../components/dashboard/brand-loader";
import { SearchInput } from "../components/ui/search-input";
import { DatePicker } from "../components/ui/date-picker";
import { DateRangeFilter } from "../components/dashboard/date-range-filter";
import { ExportButton } from "../components/dashboard/export-button";
import { FileUploader } from "../components/dashboard/file-uploader";
import { InlineEdit } from "../components/dashboard/inline-edit";
import { RateNote } from "../components/ui/rate-note";
import { Command } from "../components/ui/command";
import { GlobalSearchResults } from "../components/dashboard/command-palette";
import { ProfileTab, AccountsTab, SecurityTab, formatProvider, timeAgo } from "../components/dashboard/edit-profile-dialog";
import { authErrorMessage } from "../i18n/auth-errors";
import { resolvePresentation } from "../i18n/locale";
import NotFound from "../app/not-found";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const noop = () => {};
const router: AppRouterInstance = { back: noop, forward: noop, refresh: noop, push: noop, replace: noop, prefetch: noop };
function renderShell(locale: "en-US" | "fa-IR", pathname: string, node: ReactNode) {
  return renderWithPresentation(createElement(AppRouterContext.Provider, { value: router },
    createElement(PathnameContext.Provider, { value: pathname },
      createElement(TestSession, null,
        createElement(SidebarProvider, null, createElement(CreateDrawerProvider, null, node))))), locale);
}

test("real sidebar/topbar translate navigation while retaining routes, CTA selection and escaped user data", () => {
  for (const locale of ["en-US", "fa-IR"] as const) {
    const messages = locale === "en-US" ? en : fa;
    const sidebar = renderShell(locale, "/dashboard", createElement(AppSidebar));
    for (const path of ["/dashboard", "/contacts", "/sales", "/purchases", "/accounting", "/tax", "/teams", "/inventory", "/payroll", "/crm", "/documents", "/reports", "/settings", "/docs"]) assert.ok(sidebar.includes(`href="${path}"`));
    assert.ok(sidebar.includes(messages.Shell.financials));
    assert.ok(sidebar.includes(messages.Shell.operations));
    assert.ok(sidebar.includes("&lt;script&gt;user&lt;/script&gt;"));
    for (const [path, title, action] of [
      ["/sales/quotes", messages.Shell.quotes, messages.Shell.newQuote],
      ["/accounting/banking", messages.Shell.banking, messages.Shell.newAccount],
      ["/settings", messages.Shell.general, null],
      ["/inventory/valuation", messages.Shell.valuation, null],
    ] as const) {
      const html = renderShell(locale, path, createElement(Topbar));
      assert.ok(html.includes(title), path);
      if (action) assert.ok(html.includes(action), path);
      else assert.ok(!html.includes(messages.Shell.newItem), path);
      assert.ok(html.includes('href="/"'));
    }
  }
});

test("real generic tables use catalog defaults and ICU counts without changing caller columns or exact text", () => {
  for (const locale of ["en-US", "fa-IR"] as const) {
    const messages = locale === "en-US" ? en : fa;
    const columns = [{ key: "value", header: "Caller heading", render: (row: { value: string }) => row.value }];
    const empty = renderWithPresentation(createElement(DataTable<{ value: string }>, { columns, data: [] }), locale);
    assert.ok(empty.includes(messages.SharedUI.noDataFound));
    const custom = renderWithPresentation(createElement(DataTable<{ value: string }>, { columns, data: [], emptyMessage: "Caller empty message" }), locale);
    assert.ok(custom.includes("Caller empty message"));
    const html = renderWithPresentation(createElement(DataTableAdvanced<{ value: string }>, { columns,
      data: [{ value: "9007199254740991" }, { value: '<img src=x>' }], pageSize: 1, selectable: true }), locale);
    assert.ok(html.includes(messages.SharedUI.columns));
    assert.ok(html.includes("9007199254740991"));
    assert.ok(html.includes(messages.SharedUI.previousPage));
    assert.ok(html.includes(messages.SharedUI.nextPage));
    assert.ok(html.includes(messages.SharedUI.selectAll));
    const t = createTranslator({ locale, messages, namespace: "SharedUI" });
    for (const count of [0, 1, 2]) {
      assert.ok(t("results", { count }));
      const result = t("resultsFor", { count, search: '<script>query</script>' });
      const rendered = renderWithPresentation(createElement("p", null, result), locale);
      assert.ok(rendered.includes("&lt;script&gt;query&lt;/script&gt;"));
      assert.ok(!rendered.includes("<script>"));
    }
    assert.equal(t("results", { count: 1 }), locale === "en-US" ? "1 result" : "۱ نتیجه");
    assert.equal(t("results", { count: 2 }), locale === "en-US" ? "2 results" : "۲ نتیجه");
  }
});

test("shared fallback, loading, upload, date, inline and theme controls render in both locales", () => {
  for (const locale of ["en-US", "fa-IR"] as const) {
    const messages = locale === "en-US" ? en : fa;
    const render = (node: ReactNode) => renderWithPresentation(node, locale);
    assert.ok(render(createElement(ErrorState, { onRetry: noop })).includes(messages.SharedUI.tryAgain));
    assert.ok(render(createElement(ErrorState, { message: '<script>caller</script>' })).includes("&lt;script&gt;caller&lt;/script&gt;"));
    assert.ok(render(createElement(EmptyState, { icon: FileText, title: "Caller title", description: "Caller description" })).includes("Caller title"));
    assert.ok(render(createElement(PageSkeleton)).includes(messages.SharedUI.overview));
    assert.ok(render(createElement(BrandLoader)).includes(messages.SharedUI.loading2));
    const missing = render(createElement(NotFound));
    assert.ok(missing.includes(messages.SharedUI.pageMissing.replaceAll("'", "&#x27;")));
    assert.ok(missing.includes('href="/"'));
    assert.ok(render(createElement(InlineEdit, { value: "", onSave: noop })).includes(messages.SharedUI.clickToEdit));
    assert.ok(render(createElement(FileUploader, { onUpload: noop })).includes(messages.Upload.dropAFileOrClickToUpload));
    assert.ok(render(createElement(ExportButton, { data: [], columns: [] })).includes(messages.SharedUI.exportCSV));
    assert.ok(render(createElement(DatePicker)).includes(messages.SharedUI.pickADate));
    assert.ok(render(createElement(DateRangeFilter, { startDate: "2026-10-01", endDate: "2026-10-31", onDateChange: noop })).includes(messages.DateRange.thisMonth));
    const input = render(createElement(SearchInput, { value: "test", onChange: noop }));
    assert.ok(input.includes(messages.SharedUI.clearSearch));
    assert.ok(input.includes('value="test"'));
    const theme = render(createElement(ThemeOptions, { theme: "dark", onSelect: noop }));
    const t = createTranslator({ locale, messages, namespace: "SharedUI" });
    for (const value of ["light", "dark", "system"]) assert.ok(theme.includes(t("theme", { theme: value })));
  }
});

test("account tabs preserve linked-method guards, provider identities, roles and security copy", () => {
  for (const locale of ["en-US", "fa-IR"] as const) {
    const messages = locale === "en-US" ? en : fa;
    const render = (node: ReactNode) => renderWithPresentation(node, locale);
    const profile = render(createElement(ProfileTab, { name: "Caller name", setName: noop, email: "a@example.com", saving: false, onSave: noop }));
    assert.ok(profile.includes(messages.Account.displayName));
    assert.ok(profile.includes('value="Caller name"'));
    const accounts = render(createElement(AccountsTab, { accounts: [{ id: "a", provider: "google", type: "oauth" }], hasPassword: false, canUnlink: false, unlinking: null, email: "a@example.com", onUnlink: noop }));
    assert.ok(accounts.includes("Google"));
    assert.ok(accounts.includes(messages.Account.unlinkAccount));
    assert.match(accounts, /disabled=""/);
    const security = render(createElement(SecurityTab, { logins: [], loading: false, revoking: false, onRevokeAll: noop }));
    assert.ok(security.includes(messages.Account.signOutEverywhere));
    assert.ok(security.includes(messages.Account.noSignInHistoryYet));
    const t = createTranslator({ locale, messages, namespace: "Account" });
    assert.equal(formatProvider("credentials", t), messages.Account.emailPassword);
    for (const provider of ["custom-provider", "constructor"]) assert.equal(formatProvider(provider, t), provider);
    const now = Date.parse("2026-10-17T00:00:00Z");
    for (const [seconds, key] of [[0, "justNow"], [120, "minutesAgo"], [7200, "hoursAgo"], [172800, "daysAgo"]] as const) {
      assert.equal(timeAgo(new Date(now - seconds * 1000).toISOString(), t, now), key === "justNow" ? t(key) : t(key, { count: 2 }));
    }
    const errors = createTranslator({ locale, messages, namespace: "AuthErrors" });
    assert.equal(authErrorMessage(errors, "Cannot unlink your last authentication method", "fallback"), messages.AuthErrors.lastAuthenticationMethod);
  }
});

test("global search result states render translated groups and escaped server text", () => {
  for (const locale of ["en-US", "fa-IR"] as const) {
    const messages = locale === "en-US" ? en : fa;
    const render = (loading: boolean, query: string, results: Parameters<typeof GlobalSearchResults>[0]["results"]) => renderWithPresentation(createElement(Command, { shouldFilter: false },
      createElement(GlobalSearchResults, { loading, query, results, onSelect: noop })), locale);
    assert.ok(render(true, "query", []).includes(messages.GlobalSearch.searching));
    assert.ok(render(false, "", []).includes(messages.GlobalSearch.typeToSearchInvoicesBillsContactsAndDocuments));
    assert.ok(render(false, "query", []).includes(messages.GlobalSearch.noResultsFound));
    const html = render(false, "query", [{ id: "invoice-1", type: "invoice", title: '<script>server</script>', subtitle: "Exact 9007199254740991", href: "/sales/invoices/invoice-1" }]);
    assert.ok(html.includes(messages.GlobalSearch.invoices));
    assert.ok(html.includes("&lt;script&gt;server&lt;/script&gt;"));
    assert.ok(html.includes("Exact 9007199254740991"));
  }
});

test("rate-note wording is translated without changing rate units or currency links", () => {
  for (const locale of ["en-US", "fa-IR"] as const) {
    const messages = locale === "en-US" ? en : fa;
    const status = { rate: 1234567, origin: "manual" as const, effectiveDate: "2026-10-17", ageDays: 2, stale: true, missing: false };
    const html = renderWithPresentation(createElement(RateNote, { currency: "EUR", baseCurrency: "USD", status }), locale);
    assert.ok(html.includes(messages.SharedUI.manualRate));
    const presentation = resolvePresentation({ user: { language: locale } });
    assert.ok(html.includes(new Intl.NumberFormat(locale, {
      numberingSystem: presentation.numerals, maximumFractionDigits: 6,
    }).format(1.234567)));
    const missing = renderWithPresentation(createElement(RateNote, { currency: "EUR", baseCurrency: "USD", status: { ...status, missing: true } }), locale);
    assert.ok(missing.includes('href="/tax/currencies"'));
    assert.ok(missing.includes(messages.SharedUI.setACustomRate));
  }
});

test("shell/shared source audit leaves only inventoried brands, shortcut glyphs and technical samples", () => {
  const dashboard = ["sidebar", "topbar", "command-palette", "org-switcher", "org-loader", "user-menu", "create-org-dialog", "edit-profile-dialog", "data-table", "data-table-advanced", "error-state", "empty-state", "page-header", "page-skeleton", "brand-loader", "section", "tab-layout", "status-dot", "date-range-filter", "export-button", "inline-edit", "file-uploader", "time-picker"];
  const paths = [...dashboard.map(name => `components/dashboard/${name}.tsx`), "app/not-found.tsx",
    ...readdirSync("components/shared").filter(name => name.endsWith(".tsx")).map(name => `components/shared/${name}`),
    ...readdirSync("components/ui").filter(name => name.endsWith(".tsx")).map(name => `components/ui/${name}`)];
  for (const path of paths) {
    const source = readFileSync(path, "utf8");
    const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(node: ts.Node) {
      if (ts.isJsxText(node) && /[A-Za-z]/.test(node.text)) assert.ok(["dubbl", "K", "HTTP"].includes(node.text.trim()), `${path}: ${node.text.trim()}`);
      if (ts.isJsxAttribute(node) && ["placeholder", "aria-label", "title", "alt"].includes(node.name.getText(ast)) && node.initializer && ts.isStringLiteral(node.initializer)) {
        assert.ok(["my-company", "0.00"].includes(node.initializer.text), `${path}: ${node.initializer.text}`);
      }
      ts.forEachChild(node, visit);
    }
    visit(ast);
  }
});
