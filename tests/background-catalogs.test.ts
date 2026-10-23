import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { render } from "@react-email/render";
import { backgroundTranslator, digestTime, scheduledReportEmail } from "../i18n/background";
import { NotificationDigestEmail } from "../lib/email/templates/notification-digest";
import { budgetAlertAmounts, budgetAlertBody } from "../lib/api/budget-alert-wire";
import { toXlsx, toPdf, type Statement } from "../lib/reports/statement-export";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

test("background catalogs have paired keys and intact Persian prose", () => {
  assert.deepEqual(Object.keys(en.Background), Object.keys(fa.Background));
  for (const [key, text] of Object.entries(fa.Background)) {
    if (key !== "immediateSubject") assert.match(text, /[\u0600-\u06ff]/, key);
    assert.doesNotMatch(text, /\uFFFD|\?\?/, key);
  }
});

test("existing English alert and delivery copy preserves exact data", () => {
  const t = backgroundTranslator();
  assert.equal(t("budgetTitle", { name: "Q4 {budget}" }), 'Budget "Q4 {budget}" exceeded threshold');
  assert.equal(t("bankBody", { currency: "KWD", balance: "9007199254740.991", threshold: "9007199254740.992" }),
    "Balance KWD 9007199254740.991 is below threshold KWD 9007199254740.992");
  assert.equal(budgetAlertBody("Period-A", budgetAlertAmounts(1250, 1500n, 125, "JPY")),
    "Period Period-A: actual JPY 1500 vs budget JPY 1250 (125% threshold)");
  assert.equal(t("invoiceSubject", { number: "INV-1250" }), "Invoice INV-1250");
  assert.equal(t("statementSubject", { name: "Caller", start: "2026-10-01", end: "2026-10-24" }),
    "Statement from Caller - 2026-10-01 to 2026-10-24");
});

for (const locale of ["en-US", "fa-IR"] as const) {
  test(`${locale}: background output composes real digest and escaped report HTML`, async () => {
    const t = backgroundTranslator(locale);
    const now = new Date("2026-10-24T12:00:00Z");
    for (const [minutes, key, count] of [[0, "minutesAgo", 0], [59, "minutesAgo", 59], [60, "hoursAgo", 1], [1439, "hoursAgo", 23]] as const) {
      assert.equal(digestTime(new Date(+now - minutes * 60000), now, locale), t(key, { count }));
    }
    const day = new Date(+now - 1440 * 60000);
    assert.equal(digestTime(day, now, locale), day.toLocaleDateString(locale, { month: "short", day: "numeric" }));
    for (const count of [0, 1, 2, 10]) {
      const title = t("budgetTitle", { name: "Caller <script>" });
      const html = await render(createElement(NotificationDigestEmail, { locale, userName: t("there"), orgName: "Caller Org",
        notifications: Array.from({ length: count }, () => ({ type: "budget_exceeded", title, body: "IRR 9007199254740991", createdAt: t("justNow") })) }));
      assert.ok(t("digestSubject", { count }).length > 0);
      assert.ok(html.includes(`lang="${locale}"`));
      if (count) {
        assert.ok(html.includes("Caller &lt;script&gt;"));
        assert.ok(html.includes("IRR 9007199254740991"));
        assert.ok(html.includes(t("justNow")));
      }
    }
    for (const frequency of ["daily", "weekly", "monthly", "caller_owned"]) {
      const report = scheduledReportEmail("Caller <script>&", frequency, "pdf", locale);
      assert.equal(report.subject, t("reportSubject", { name: "Caller <script>&" }));
      assert.ok(report.html.includes("Caller &lt;script&gt;&amp;"));
      assert.ok(!report.html.includes("<script>"));
      assert.ok(report.html.includes("pdf"));
    }
  });
}

test("English digest pluralization and scheduled report text retain delivery defaults", () => {
  const t = backgroundTranslator();
  assert.equal(t("digestSubject", { count: 1 }), "You have 1 new notification on dubbl");
  assert.equal(t("digestSubject", { count: 2 }), "You have 2 new notifications on dubbl");
  assert.deepEqual(scheduledReportEmail("Sales", "weekly", "pdf"), {
    subject: "Scheduled Report: Sales", html: "<h2>Scheduled Report: Sales</h2><p>Your weekly report is attached (pdf).</p>",
  });
});

test("statement exports retain English headers, exact cells and real PDF output", async () => {
  const statement: Statement = { title: "Assets", periodLabel: "2026-10-01 to 2026-10-24", currency: "KWD",
    sections: [{ label: "Cash", rows: [{ code: "1100", name: "=caller", amount: 1250, depth: 0 }], subtotal: 1250 }], grandTotal: 1250 };
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  const buffer = await toXlsx(statement);
  await workbook.xlsx.load(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer);
  const sheet = workbook.worksheets[0];
  assert.deepEqual([sheet.getCell("A3").value, sheet.getCell("B3").value, sheet.getCell("C3").value], ["Code", "Account", "Amount (KWD)"]);
  const rows: unknown[][] = [];
  sheet.eachRow(row => rows.push(Array.isArray(row.values) ? row.values : []));
  assert.ok(rows.some(values => values.includes("'=caller") && values.includes(1.25)));
  assert.ok(rows.some(values => values.includes("Total Cash") && values.includes(1.25)));
  assert.ok(rows.some(values => values.includes("Total") && values.includes(1.25)));
  const pdf = await toPdf(statement);
  assert.equal(pdf.subarray(0, 4).toString(), "%PDF");
});
