import assert from "node:assert/strict";
import { test } from "node:test";
import { createTranslator } from "next-intl";
import { renderReportPage as render, withIO, flush, has, type Harness } from "./helpers/report-page";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const ready = { initialLoad: false, loading: false };
const savedReport = { id: "report-a", name: "<script>My report</script>", description: null };
const base = { ...ready, savedReports: [savedReport], savedReportId: savedReport.id, recipients: "a@example.com, b@example.com\nc@example.com", timeOfDay: "09:45", dayOfWeek: "6", dayOfMonth: "28" };
const submit = (h: Harness) => h.captured.find(c => typeof c.props.onClick === "function" && Array.isArray(c.props.children) && c.props.children.includes(en.ScheduledReports.schedule))
  ?? h.captured.find(c => typeof c.props.onClick === "function" && Array.isArray(c.props.children) && c.props.children.includes(fa.ScheduledReports.schedule));

test("production schedule JSX localizes empty/list/timing states and keeps caller values escaped", () => {
  for (const locale of ["en-US", "fa-IR"] as const) {
    const t = createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace: "ScheduledReports" });
    assert.ok(render("schedules", ready, locale).html.includes(t("noReports")));
    assert.ok(render("schedules", base, locale).html.includes(t("empty")));
    for (const frequency of ["daily", "weekly", "monthly", "quarterly"] as const) {
      const schedule = { id: frequency, frequency, format: "csv", recipients: ["a@example.com"], dayOfWeek: 6, dayOfMonth: 28, timeOfDay: "09:45", isActive: frequency === "daily", nextRunAt: null, savedReport };
      const h = render("schedules", { ...base, schedules: [schedule], frequency }, locale);
      for (const label of [t(frequency), t("csv"), t("status"), t(schedule.isActive ? "on" : "paused")]) assert.ok(h.html.includes(label), label);
      const timing = frequency === "weekly" ? t("weeklyTiming", { day: t("saturday"), time: "09:45" }) : frequency === "daily" ? t("at", { time: "09:45" }) : t("monthlyTiming", { day: "28", time: "09:45" });
      assert.ok(h.html.includes(timing));
      assert.ok(h.html.includes("&lt;script&gt;My report&lt;/script&gt;"));
      assert.ok(h.html.includes("a@example.com"));
      const values = h.captured.filter(c => c.kind === "SelectItem").map(c => c.props.value);
      const items = h.captured.filter(c => c.kind === "SelectItem");
      for (const value of ["daily", "weekly", "monthly", "quarterly", "pdf", "csv", "xlsx"] as const) {
        assert.equal(items.find(c => c.props.value === value)?.props.children, t(value));
      }
      assert.ok(h.captured.some(c => c.props.children === t("dialogTitle")));
      for (const value of ["daily", "weekly", "monthly", "quarterly", "pdf", "csv", "xlsx", savedReport.id]) assert.ok(values.includes(value));
      if (frequency === "weekly") for (let day = 0; day < 7; day++) assert.ok(values.includes(String(day)));
      if (["monthly", "quarterly"].includes(frequency)) for (let day = 1; day <= 28; day++) {
        assert.equal(items.find(c => c.props.value === String(day))?.props.children, t("day", { day: String(day) }));
      }
    }
  }
  for (const value of Object.values(fa.ScheduledReports)) assert.match(value, /[\u0600-\u06ff]/);
});

test("create callback preserves org, recipient parsing, schedule enums and conditional day payloads", async () => {
  for (const locale of ["en-US", "fa-IR"] as const) for (const frequency of ["daily", "weekly", "monthly", "quarterly"]) {
    await withIO(async (url, init) => {
      assert.equal(url, "/api/v1/report-schedules"); assert.equal(init?.method, "POST");
      assert.equal((init!.headers as Record<string, string>)["x-organization-id"], "org-a");
      assert.deepEqual(JSON.parse(init!.body as string), { savedReportId: savedReport.id, frequency, format: "xlsx", recipients: ["a@example.com", "b@example.com", "c@example.com"], timeOfDay: "09:45", ...(frequency === "weekly" ? { dayOfWeek: 6 } : {}), ...(["monthly", "quarterly"].includes(frequency) ? { dayOfMonth: 28 } : {}) });
      return Response.json({ data: { id: "created" } });
    }, async () => {
      const h = render("schedules", { ...base, frequency, format: "xlsx" }, locale);
      await (submit(h)!.props.onClick as () => Promise<void>)();
      assert.ok(has(h, "dialogOpen", false)); assert.ok(has(h, "submitting", false)); assert.ok(has(h, "recipients", ""));
      assert.ok(h.events.some(([key]) => key === "refreshKey"));
    });
  }
});

test("validation and server/network failures use localized errors and leave the form open", async () => {
  for (const locale of ["en-US", "fa-IR"] as const) {
    const t = createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace: "ScheduledReports" });
    for (const [override, key] of [[{ savedReportId: "" }, "pickReport"], [{ recipients: " , " }, "addRecipient"]] as const) {
      await withIO(async () => { throw new Error("must not fetch"); }, async () => {
        const h = render("schedules", { ...base, ...override }, locale);
        await (submit(h)!.props.onClick as () => Promise<void>)(); assert.ok(has(h, "formError", t(key)));
      });
    }
    for (const failure of ["http", "network"]) await withIO(async () => {
      if (failure === "network") throw new Error("private diagnostics");
      return Response.json({ error: "private diagnostics" }, { status: 403 });
    }, async () => {
      const h = render("schedules", base, locale);
      await (submit(h)!.props.onClick as () => Promise<void>)();
      assert.ok(has(h, "formError", t("createError"))); assert.ok(has(h, "submitting", false));
      assert.ok(!has(h, "dialogOpen", false)); assert.ok(!has(h, "formError", "private diagnostics"));
    });
  }
});

test("list effect requests supported pagination and adopts schedule/saved-report envelopes", async () => {
  const urls: string[] = [];
  await withIO(async (url, init) => {
    urls.push(String(url)); assert.equal((init!.headers as Record<string,string>)["x-organization-id"], "org-a");
    return Response.json(String(url).includes("report-schedules") ? { data: [{ id: "schedule-a" }] } : { reports: [savedReport] });
  }, async () => {
    const h = render("schedules", ready); h.effects[0](); await flush();
    assert.deepEqual(urls, ["/api/v1/report-schedules?limit=100", "/api/v1/reports/saved"]);
    assert.ok(h.events.some(([key, value]) => key === "schedules" && (value as { id: string }[])[0].id === "schedule-a"));
    assert.ok(has(h, "initialLoad", false)); assert.ok(has(h, "loading", false));
  });
});
