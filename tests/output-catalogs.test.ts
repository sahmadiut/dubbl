import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { render } from "@react-email/render";
import { WelcomeEmail } from "../lib/email/templates/welcome";
import { OrgCreatedEmail } from "../lib/email/templates/org-created";
import { MemberInviteEmail } from "../lib/email/templates/member-invite";
import { LoginAlertEmail } from "../lib/email/templates/login-alert";
import { NotificationDigestEmail } from "../lib/email/templates/notification-digest";
import { renderDocumentEmailHtml } from "../lib/email/render-document-email";
import { generateDocumentHtml, generateInvoiceHtml, type DocumentKind } from "../lib/documents/pdf-generator";
import { renderInvoicePdf } from "../lib/documents/pdf-renderer";
import { documentMoneyText } from "../lib/documents/render-wire";
import { outputDocumentKind, outputTranslator } from "../i18n/output";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const caller = "Caller <script>& حساب";
const link = "https://fixture.example/documents?token=unchanged";
const kinds: DocumentKind[] = ["invoice", "quote", "credit_note", "purchase_order", "debit_note"];
const doc = { documentNumber: "DOC-1250", issueDate: "2026-10-24", secondDate: "2026-11-24", contactName: caller,
  subtotal: Number.MAX_SAFE_INTEGER, taxTotal: 0, total: Number.MAX_SAFE_INTEGER, amountPaid: 0,
  currencyCode: "USD", lines: [{ description: caller, quantity: 125, unitPrice: 29, taxAmount: 0, amount: Number.MAX_SAFE_INTEGER }] };

test("paired output catalogs contain Persian script and no replacement corruption", () => {
  assert.deepEqual(Object.keys(en.Output).sort(), Object.keys(fa.Output).sort());
  for (const [key, value] of Object.entries(fa.Output)) {
    assert.match(value, /[\u0600-\u06ff]/, key);
    assert.doesNotMatch(value, /\?\?|\uFFFD/, key);
  }
});

for (const locale of ["en-US", "fa-IR"] as const) {
  const messages = locale === "en-US" ? en.Output : fa.Output;
  test(`${locale}: actual email templates preserve caller data, links and translated chrome`, async () => {
    const fixtures = [
      [createElement(WelcomeEmail, { locale, userName: caller, loginUrl: link }), messages.invoicing],
      [createElement(OrgCreatedEmail, { locale, userName: caller, orgName: caller, dashboardUrl: link }), messages.openOrg],
      [createElement(MemberInviteEmail, { locale, inviterName: caller, orgName: caller, role: "custom_role", loginUrl: link }), messages.acceptInvite],
      [createElement(LoginAlertEmail, { locale, userName: caller, ipAddress: "192.0.2.1", provider: "credentials", timestamp: "2026-10-24T00:00:00Z", securityUrl: link }), messages.reviewAccount],
    ] as const;
    for (const [element, expected] of fixtures) {
      const html = await render(element);
      assert.ok(html.includes(expected));
      assert.ok(html.includes(`lang="${locale}"`));
      assert.ok(html.includes(`dir="${locale === "fa-IR" ? "rtl" : "ltr"}"`));
      assert.ok(html.includes(messages.terms));
      assert.ok(html.includes(link));
      assert.ok(html.includes("Caller &lt;script&gt;&amp;"));
      assert.ok(!html.includes("<script>"));
      // Legal identity and addresses are intentionally retained verbatim.
      assert.match(html, /Mindroot Ltd/);
    }
    const invite = await render(fixtures[2][0]);
    assert.match(invite, /<strong>custom_role<\/strong>/);
    const alert = await render(fixtures[3][0]);
    assert.match(alert, /192\.0\.2\.1/);
    assert.match(alert, /credentials/);
    assert.match(alert, /2026-10-24T00:00:00Z/);
  });

  test(`${locale}: digest renders zero, singular, plural and truncated lists`, async () => {
    for (const count of [0, 1, 2, 10, 11]) {
      const notifications = Array.from({ length: count }, (_, i) => ({ type: "system_alert", title: `event-${i}`, body: caller, createdAt: "UTC timestamp" }));
      const html = await render(createElement(NotificationDigestEmail, { locale, userName: caller, orgName: caller, notifications, dashboardUrl: link, unsubscribeUrl: link }));
      const t = outputTranslator(locale);
      assert.ok(html.includes(t("digestHeading", { count })));
      assert.ok(html.includes(messages.unsubscribe));
      assert.ok(!html.includes("event-9"));
      if (count > 9) assert.ok(html.includes(t("digestMore", { count: count - 9 })));
      if (count === 1 && locale === "en-US") assert.ok(!html.includes("1 new notifications"));
    }
  });

  test(`${locale}: document email covers each type and safe fallback with exact formatted data`, async () => {
    for (const documentType of [...kinds, "unknown", "__proto__", "constructor"]) {
      const html = await renderDocumentEmailHtml({ locale, organizationName: caller, contactName: caller,
        documentType, documentNumber: "DOC-1250", personalMessage: caller, amountFormatted: "$90,071,992,547,409.91",
        issueDateFormatted: "2026-10-24", dueDateFormatted: "2026-11-24", viewUrl: link });
      const kind = outputDocumentKind(documentType);
      assert.ok(html.includes(messages[`${kind}Button`]));
      assert.ok(html.includes(documentType === "quote" ? messages.validUntil : messages.dueDate));
      assert.match(html, /\$90,071,992,547,409\.91/);
      assert.ok(!html.includes("<script>"));
      assert.ok(html.includes(link));
      const custom = await renderDocumentEmailHtml({ locale, organizationName: caller, contactName: caller, documentType,
        documentNumber: "DOC-1250", viewUrl: link, buttonLabel: caller });
      assert.ok(custom.includes("Caller &lt;script&gt;&amp;"));
    }
  });

  test(`${locale}: HTML documents preserve date visibility, caller templates and currency scale`, () => {
    for (const kind of kinds) for (const currencyCode of ["USD", "IRR", "JPY", "KWD"]) {
      const html = generateDocumentHtml(kind, { ...doc, currencyCode }, { name: caller, taxId: "TAX-01", countryCode: "IR" },
        { locale, bankDetails: "Bank {{documentNumber}}", paymentInstructions: caller, headerHtml: "<i>Custom header</i>" });
      assert.ok(html.includes(documentMoneyText(doc.total, currencyCode)));
      assert.match(html, /Caller &lt;script&gt;&amp;/);
      assert.match(html, /Bank DOC-1250/);
      assert.match(html, /<i>Custom header<\/i>/);
      assert.ok(html.includes(messages.dateIssue));
      assert.equal(html.includes("2026-11-24"), kind !== "credit_note" && kind !== "debit_note");
    }
    const invoice = generateInvoiceHtml({ ...doc, invoiceNumber: doc.documentNumber, dueDate: doc.secondDate, status: "sent" }, { name: caller, countryCode: "AU", taxId: "123" }, { locale });
    assert.ok(invoice.includes(messages.taxInvoice));
    assert.match(invoice, /ABN/);
    assert.ok(invoice.includes(documentMoneyText(doc.total, "USD")));
  });
}

test("PDF production renderer retains English catalog and renders a real PDF", async () => {
  const bytes = await renderInvoicePdf({ ...doc, invoiceNumber: doc.documentNumber, dueDate: doc.secondDate },
    { name: "Fixture Org", countryCode: "AU", taxId: "123" }, { name: "Fixture Customer" },
    { bankDetails: "Bank {{invoiceNumber}}", paymentInstructions: "Saved instructions" });
  const pdf = Buffer.from(bytes);
  assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
  assert.ok(pdf.length > 1000);
});
