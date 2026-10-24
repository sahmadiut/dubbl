import { displayNumberFixture } from "./helpers/localized-fixtures";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { createElement as h } from "react";
import ts from "typescript";
import { Package } from "lucide-react";
import { PageHeader } from "../components/dashboard/page-header";
import { EmptyState } from "../components/dashboard/empty-state";
import { Section } from "../components/dashboard/section";
import { BudgetProgressBar } from "../components/dashboard/budget-progress-bar";
import { DateRangeFilter } from "../components/dashboard/date-range-filter";
import { ExportButton } from "../components/dashboard/export-button";
import { renderWithPresentation } from "./helpers/presentation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const domains = { inventory: 18, payroll: 27, projects: 11, crm: 7, reports: 34, dashboard: 2, documents: 2 };
const shared = ["activity-feed", "brand-loader", "budget-progress-bar", "cash-flow-widget", "category-picker", "contact-picker", "create-drawer", "data-table", "date-range-filter", "empty-state", "error-state", "export-button", "page-header", "section", "stat-card", "tab-layout", "topbar"];

function files(path: string): string[] {
  return readdirSync(path, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(`${path}/${e.name}`) : e.name.endsWith(".tsx") ? [`${path}/${e.name}`] : []);
}

test("LOC-008 reconciles all 101 routes and the cross-module shared dashboard controls", () => {
  const imports = new Set<string>();
  let count = 0;
  for (const [domain, expected] of Object.entries(domains)) {
    const routes = files(`app/(dashboard)/${domain}`);
    assert.equal(routes.length, expected, domain);
    count += routes.length;
    for (const file of routes) {
      const ast = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      for (const n of ast.statements) if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier) && n.moduleSpecifier.text.startsWith("@/components/dashboard/")) imports.add(n.moduleSpecifier.text.split("/").at(-1)!);
    }
  }
  assert.equal(count, 101);
  assert.deepEqual([...imports].sort(), [...shared].sort());
});

test("residual shared controls contain no authored literal copy and resolve paired catalog keys", () => {
  // Drawer functions, topbar and widgets have explicit child/shell ownership.
  // These remaining cross-module primitives were not independently accepted by
  // LOC-071's dashboard/document composition alone.
  const residual = ["date-range-filter", "export-button", "empty-state", "page-header", "section", "tab-layout", "budget-progress-bar"];
  for (const name of residual) {
    const file = `components/dashboard/${name}.tsx`;
    const ast = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let namespace: string | undefined;
    function visit(n: ts.Node) {
      if (ts.isJsxText(n)) assert.doesNotMatch(n.text, /[A-Za-z]/, file);
      if (ts.isJsxAttribute(n) && ["title", "description", "placeholder", "aria-label", "alt", "label", "emptyMessage"].includes(n.name.getText(ast)) && n.initializer && ts.isStringLiteral(n.initializer)) assert.doesNotMatch(n.initializer.text, /[A-Za-z]/, file);
      if (ts.isCallExpression(n) && n.arguments[0] && ts.isStringLiteral(n.arguments[0])) {
        if (n.expression.getText(ast) === "useTranslations") namespace = n.arguments[0].text;
        if (n.expression.getText(ast) === "t") {
          assert.ok(namespace, file);
          const key = n.arguments[0].text;
          for (const messages of [en, fa]) {
            const catalog = messages[namespace as keyof typeof en] as Record<string, string>;
            assert.equal(typeof catalog[key], "string", `${namespace}.${key}`);
          }
          assert.match((fa[namespace as keyof typeof fa] as Record<string, string>)[key], /[\u0600-\u06ff]/);
        }
      }
      ts.forEachChild(n, visit);
    }
    visit(ast);
  }
});

test("cross-module headers, empty states, filters, budget and exports share the active locale and escape data", () => {
  for (const locale of ["en-US", "fa-IR"] as const) {
    const m = locale === "en-US" ? en : fa;
    const caller = "<script>Caller & budget</script>";
    const html = renderWithPresentation(h("main", null,
      h(PageHeader, { title: m.DashboardOverview.revenue, description: caller }),
      h(Section, { title: m.SharedUI.exportCSV, description: caller,
        children: h(ExportButton, { data: [{ name: caller }], columns: ["name"] }) }),
      h(EmptyState, { icon: Package, title: m.SharedUI.exportCSV, description: caller }),
      h(DateRangeFilter, { startDate: "2026-01-01", endDate: "2026-12-31", onDateChange: () => {} }),
      h(BudgetProgressBar, { label: caller, budgeted: 9007199254740002n, actual: 9007199254740001n, currencyCode: "KWD" }),
    ), locale);
    for (const label of [m.DashboardOverview.revenue, m.SharedUI.exportCSV, m.DateRange.thisMonth, m.DateRange.lastYear, m.DateRange.custom]) assert.ok(html.includes(label), label);
    assert.ok(html.includes("&lt;script&gt;Caller &amp; budget&lt;/script&gt;"));
    assert.ok(html.includes(displayNumberFixture("90,071,992,547,400.01", locale)) && html.includes(displayNumberFixture("90,071,992,547,400.02", locale)));
    assert.ok(!html.includes("MISSING_MESSAGE") && !html.includes("<script>"));
  }
});
