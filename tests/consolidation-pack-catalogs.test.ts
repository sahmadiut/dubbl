import { resolvePresentation } from "../i18n/locale";
import assert from "node:assert/strict";
import { test } from "node:test";
import { createTranslator } from "next-intl";
import { renderReportPage as render, withIO, flush, has } from "./helpers/report-page";
import { reportResultMoney } from "../lib/money/report-result-ui";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const ready = { initialLoad: false, startDate: "2026-01-01", endDate: "2026-10-23" };
const member = { id: "member-a", orgId: "org-b", label: "Branch <b>", organization: { id: "org-b", name: "Business <b>" } };
const group = { id: "group-a", name: "Group <script>", parentOrgId: "org-a", members: [member], createdAt: "2026-01-01" };
const amount = 9007199254740993n;
const account = (type: string) => ({ code: "101", name: "Account <b>", type, total: amount, byEntity: { "org-b": amount } });
const report = {
  presentationCurrency: "USD", members: [{ orgId: "org-b", label: member.label, orgName: member.organization.name }],
  consolidatedPnL: { totalRevenue: amount, totalExpenses: 0n, netIncome: amount, accounts: [account("revenue")], byEntity: [{ orgId: "org-b", label: member.label, revenue: amount, expenses: 0n, netIncome: amount }] },
  consolidatedBalanceSheet: { totalAssets: amount, totalLiabilities: 0n, totalEquity: amount, accounts: [account("asset")], byEntity: [{ orgId: "org-b", label: member.label, assets: amount, liabilities: 0n, equity: amount }] },
};
const selected = { ...ready, groups: [group], selectedGroupId: group.id };

test("both consolidation tabs render translated production JSX and preserve exact raw-unit export", async () => {
  await withIO(async () => { throw new Error("render must not fetch"); }, async () => {
  for (const locale of ["en-US", "fa-IR"] as const) {
    const t = createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace: "ConsolidationReports" });
    assert.ok(render("consolidation", ready, locale).html.includes(t("emptyGroups")));
    for (const tab of ["pnl", "balance-sheet"] as const) {
      const h = render("consolidation", { ...selected, report, tab }, locale);
      for (const text of [t("title"), t("accountBreakdown"), t("totalLabel", { label: t(tab === "pnl" ? "revenue" : "assets") }), "Account &lt;b&gt;", "Group &lt;script&gt;", reportResultMoney(amount, "USD", resolvePresentation({ user: { language: locale } }))]) assert.ok(h.html.includes(text), text);
      assert.ok(!h.html.includes("Group <script>"));
      const output = h.captured.find(c => c.props.filename === `consolidation-${tab}`)!;
      assert.ok(output);
      const data = output.props.data as Record<string, string>[];
      assert.equal(data[0].total, "9007199254740993");
      assert.equal(data[0]["Branch <b> (org-b)"], "9007199254740993");
      assert.equal(data[0].currencyCode, "USD");
      assert.deepEqual(output.props.columns, ["type", "code", "name", "Branch <b> (org-b)", "total", "currencyCode"]);
      const toggle = h.captured.find(c => c.kind === "button" && c.props.children === t("balanceSheet"))!;
      (toggle.props.onClick as () => void)(); assert.ok(has(h, "tab", "balance-sheet"));
      assert.ok(h.captured.some(c => c.props["aria-label"] === t("removeMember", { name: member.organization.name })));
    }
    for (const [members, orgs, key] of [[[], [], "oneOrg"], [[member], [{ id: "org-a" }, { id: "org-b" }], "allAdded"]] as const) {
      assert.ok(render("consolidation", { ...selected, groups: [{ ...group, members }], userOrgs: orgs }, locale).html.includes(t(key)));
    }
  }
  for (const ns of [fa.ConsolidationReports, fa.ReportPack]) for (const value of Object.values(ns)) assert.match(value, /[\u0600-\u06ff]/);
  });
});

test("report failures localize HTTP, malformed money and network errors; stale results stay ignored", async () => {
  for (const locale of ["en-US", "fa-IR"] as const) {
    const message = (locale === "en-US" ? en : fa).ConsolidationReports.reportError;
    for (const failure of ["http", "invalid", "network"]) await withIO(async (url, init) => {
      assert.equal(url, "/api/v1/consolidation/groups/group-a/report?startDate=2026-01-01&endDate=2026-10-23");
      assert.equal((init!.headers as Record<string,string>)["x-organization-id"], "org-a");
      if (failure === "network") throw new Error("private diagnostics");
      return Response.json(failure === "http" ? { error: "private diagnostics" } : { presentationCurrency: "USD", consolidatedPnL: { totalRevenueMinor: "1.5" } }, { status: failure === "http" ? 403 : 200 });
    }, async () => {
      const h = render("consolidation", selected, locale);
      h.effects[2](); await flush();
      assert.ok(has(h, "reportError", message)); assert.ok(has(h, "report", null)); assert.ok(has(h, "reportLoading", false));
      assert.ok(!has(h, "reportError", "private diagnostics"));
    });
    let reject!: (error: Error) => void;
    await withIO(() => new Promise((_resolve, no) => { reject = no; }), async () => {
      const h = render("consolidation", selected, locale);
      const cleanup = h.effects[2]()!; cleanup(); reject(new Error("stale")); await flush();
      assert.ok(!has(h, "reportError", message)); assert.ok(!has(h, "reportLoading", false));
    });
  }
});

test("group creation preserves caller text and organization-scoped machine payload", async () => {
  for (const locale of ["en-US", "fa-IR"] as const) await withIO(async (url, init) => {
    assert.equal(url, "/api/v1/consolidation/groups"); assert.equal(init!.method, "POST");
    assert.equal((init!.headers as Record<string,string>)["x-organization-id"], "org-a");
    assert.deepEqual(JSON.parse(init!.body as string), { name: group.name });
    return Response.json({ group });
  }, async () => {
    const h = render("consolidation", { ...ready, newGroupName: `  ${group.name}  ` }, locale);
    const create = h.captured.find(c => c.props.disabled === false && c.props.onClick)!;
    await (create.props.onClick as () => Promise<void>)();
    assert.ok(has(h, "selectedGroupId", group.id)); assert.ok(has(h, "newGroupName", ""));
  });
});

test("pack content, date/basis callbacks and workbook URLs remain canonical in both locales", () => {
  for (const locale of ["en-US", "fa-IR"] as const) for (const basis of ["accrual", "cash"]) {
    const t = createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace: "ReportPack" });
    const h = render("pack", { ...ready, basis }, locale);
    for (const key of ["title", "contents", "download", "incomeName", "balanceName", "trialName", "cashName"] as const) assert.ok(h.html.replaceAll("&#x27;", "'").includes(t(key)), key);
    assert.ok(h.html.includes(t("period", { startDate: ready.startDate, endDate: ready.endDate })));
    assert.equal(h.captured.find(c => c.kind === "a")!.props.href, `/api/v1/reports/pack?startDate=2026-01-01&endDate=2026-10-23&basis=${basis}&format=xlsx`);
    (h.captured.find(c => c.kind === "BasisToggle")!.props.onChange as (v: string) => void)("cash");
    assert.ok(has(h, "basis", "cash"));
    (h.captured.find(c => c.kind === "DateRangeFilter")!.props.onDateChange as (s: string, e: string) => void)("2026-02-01", "2026-02-28");
    assert.ok(has(h, "startDate", "2026-02-01")); assert.ok(has(h, "endDate", "2026-02-28"));
  }
});
