import assert from "node:assert/strict";
import { test } from "node:test";
import { createTranslator } from "next-intl";
import { renderReportPage as render, withIO, flush, has } from "./helpers/report-page";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";
const ready = { initialLoad: false, loading: false };
const report = { id: "saved-a", name: "<script>Personal</script>", description: "My description", updatedAt: "invalid", config: { dataSource: "invoices", columns: ["total", "currencyCode"], filters: [], groupBy: [] } };
test("saved/custom production JSX renders localized empty/list states and stable identifiers", () => {
  for (const locale of ["en-US", "fa-IR"] as const) {
    const t = createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace: "CustomReports" });
    for (const route of ["saved", "custom"]) {
      const empty = render(route, ready, locale);
      assert.ok(empty.html.includes(t(route === "saved" ? "savedEmpty" : "customEmpty")));
      const h = render(route, { ...ready, reports: [report], savedReports: [report], builderOpen: true, dataSource: "invoices", selectedColumns: ["total"], reportName: report.name }, locale);
      assert.ok(h.html.includes("&lt;script&gt;Personal&lt;/script&gt;"));
      assert.ok(!h.html.includes("<script>Personal"));
      assert.ok(h.html.includes(t("invoices")));
      assert.ok(h.html.includes(t("actions")));
      if (route === "saved") assert.ok(h.html.includes(t("never")));
      else {
        const items = h.captured.filter(c => c.kind === "SelectItem");
        assert.deepEqual(items.map(c => c.props.value), ["invoices", "contacts", "inventory", "transactions"]);
        const save = h.captured.find(c => c.props.onClick && Array.isArray(c.props.children) && c.props.children.includes(t("save")));
        assert.ok(save);
      }
    }
  }
  for (const value of Object.values(fa.CustomReports)) assert.match(value, /[\u0600-\u06ff]/);
});
test("builder run preserves org/config and uses localized errors without adopting invalid money", async () => {
  for (const locale of ["en-US", "fa-IR"] as const) {
    const t = createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace: "CustomReports" });
    await withIO(async (_url, init) => {
      assert.equal((init!.headers as Record<string,string>)["x-organization-id"], "org-a");
      assert.deepEqual(JSON.parse(init!.body as string), { dataSource: "invoices", columns: ["total"], filters: [], groupBy: [] });
      return Response.json({ error: "private diagnostics" }, { status: 403 });
    }, async () => {
      const h = render("custom", { ...ready, builderOpen: true, selectedColumns: ["total"] }, locale);
      const run = h.captured.find(c => typeof c.props.onClick === "function" && c.props.disabled === false)!;
      assert.ok(run); await (run.props.onClick as () => Promise<void>)(); await flush();
      assert.ok(has(h, "runError", t("runError"))); assert.ok(has(h, "results", null)); assert.ok(has(h, "running", false));
    });
  }
});

test("saving preserves caller name and machine config, deletion confirmation translates caller interpolation", async () => {
  for (const locale of ["en-US", "fa-IR"] as const) {
    let saved = false;
    await withIO(async (url, init) => {
      if (init?.method === "POST") {
        assert.equal(url, "/api/v1/reports/saved");
        assert.deepEqual(JSON.parse(init.body as string), { name: report.name, config: { dataSource: "invoices", columns: ["total"], filters: [], groupBy: [] } });
        saved = true;
      }
      return Response.json({ reports: [] });
    }, async () => {
      const h = render("custom", { ...ready, builderOpen: true, reportName: report.name, selectedColumns: ["total"] }, locale);
      const save = h.captured.find(c => typeof c.props.onClick === "function" && Array.isArray(c.props.children) && c.props.children.includes(locale === "en-US" ? en.CustomReports.save : fa.CustomReports.save))!;
      await (save.props.onClick as () => Promise<void>)(); await flush();
      assert.ok(saved); assert.ok(has(h, "builderOpen", false));
      const list = render("custom", { ...ready, savedReports: [report] }, locale);
      const remove = list.captured.find(c => c.kind === "DropdownMenuItem" && c.props.variant === "destructive")!;
      await (remove.props.onClick as () => Promise<void>)();
      const options = list.events.find(([key]) => key === "confirm")![1] as { title: string; confirmLabel: string };
      assert.ok(options.title.includes(report.name));
      assert.equal(options.confirmLabel, locale === "en-US" ? en.CustomReports.delete : fa.CustomReports.delete);
    });
  }
});
