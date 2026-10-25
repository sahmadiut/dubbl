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
import { documentMoneyText } from "../lib/documents/render-wire";

const caller = "  شرکت ACME <&> /123  ";
const escaped = "  شرکت ACME &lt;&amp;&gt; /123  ";
const token = "INV-123/<&>";
const url = "https://fixture.example/view?token=unchanged-123";
const doc = { documentNumber: token, issueDate: "2026-10-25", secondDate: "2026-11-25", contactName: caller,
  contactEmail: "buyer@example.test", contactAddress: caller, contactTaxNumber: "TX-123",
  reference: caller, subtotal: Number.MAX_SAFE_INTEGER, taxTotal: 0, total: Number.MAX_SAFE_INTEGER,
  amountPaid: 0, currencyCode: "USD", lines: [{ description: caller, quantity: -125, unitPrice: 29, taxAmount: 0, amount: Number.MAX_SAFE_INTEGER }] };

for (const locale of ["en-US", "fa-IR"] as const) {
  test(`${locale}: email caller scopes, physical fallback spacing and exact technical text survive real rendering`, async () => {
    const fixtures = [
      createElement(WelcomeEmail, { locale, userName: caller, loginUrl: url }),
      createElement(OrgCreatedEmail, { locale, userName: caller, orgName: caller, dashboardUrl: url }),
      createElement(MemberInviteEmail, { locale, inviterName: caller, orgName: caller, role: "custom_role", loginUrl: url }),
      createElement(LoginAlertEmail, { locale, userName: caller, ipAddress: "2001:db8::123", userAgent: caller, provider: "credentials", timestamp: "2026-10-25T00:00:00Z", securityUrl: url }),
      createElement(NotificationDigestEmail, { locale, userName: caller, orgName: caller, notifications: [{ type: "system_alert", title: caller, body: caller, createdAt: "2026-10-25T00:00:00Z" }], dashboardUrl: url }),
    ];
    for (const element of fixtures) {
      const html = await render(element);
      assert.ok(html.includes(`<span dir="auto" style="unicode-bidi:isolate;overflow-wrap:anywhere">${escaped}</span>`));
      assert.ok(html.includes(`padding-${locale === "fa-IR" ? "left" : "right"}:10px`));
      assert.ok(html.includes(`text-align:${locale === "fa-IR" ? "right" : "left"}`));
      assert.ok(html.includes(url));
      assert.match(html, /dir="ltr"[^>]*>Mindroot Ltd/);
      assert.doesNotMatch(html, /[\u202a-\u202e\u2066-\u2069]/);
    }
    const alert = await render(fixtures[3]);
    assert.match(alert, /<span dir="ltr"[^>]*>2001:db8::123<\/span>/);
    assert.ok(alert.includes(`padding-${locale === "fa-IR" ? "left" : "right"}:16px`));
    const document = await renderDocumentEmailHtml({ locale, organizationName: caller, contactName: caller,
      documentType: "invoice", documentNumber: token, amountFormatted: "IRR 90,071,992,547,409.91",
      personalMessage: caller, issueDateFormatted: "۱۴۰۵/۰۸/۰۳", dueDateFormatted: "2026-11-25", viewUrl: url, buttonLabel: caller });
    assert.match(document, /<span dir="ltr"[^>]*>INV-123\/&lt;&amp;&gt;<\/span>/);
    assert.match(document, /<span dir="ltr"[^>]*>IRR 90,071,992,547,409\.91<\/span>/);
    assert.match(document, /<span dir="auto"[^>]*>۱۴۰۵\/۰۸\/۰۳<\/span>/);
    assert.ok(document.includes(`padding-${locale === "fa-IR" ? "left" : "right"}:24px`));
    assert.ok(document.includes(url));
  });

  test(`${locale}: actual HTML builders isolate exact data and retain document-kind/date/template contracts`, () => {
    const before = structuredClone(doc);
    const kinds: DocumentKind[] = ["invoice", "quote", "credit_note", "purchase_order", "debit_note"];
    for (const kind of kinds) for (const currencyCode of ["USD", "IRR", "JPY", "KWD"]) {
      const html = generateDocumentHtml(kind, { ...doc, currencyCode }, { name: caller, email: "org@example.test", taxId: "TX-123" },
        { locale, headerHtml: "<i>Caller HTML</i>", notes: caller, bankDetails: "Bank {{documentNumber}}" });
      assert.ok(html.includes('<bdi dir="ltr" style="unicode-bidi:isolate;overflow-wrap:anywhere;">INV-123/&lt;&amp;&gt;</bdi>'));
      assert.ok(html.includes(`<bdi dir="auto" style="unicode-bidi:isolate;overflow-wrap:anywhere;">${escaped}</bdi>`));
      assert.ok(html.includes(`<bdi dir="ltr" style="unicode-bidi:isolate;overflow-wrap:anywhere;">${documentMoneyText(doc.total, currencyCode)}</bdi>`));
      assert.ok(html.includes('<bdi dir="ltr" style="unicode-bidi:isolate;overflow-wrap:anywhere;">-1.25</bdi>'));
      assert.equal(html.includes("2026-11-25"), kind !== "credit_note" && kind !== "debit_note");
      assert.match(html, /padding-inline-end:12px/);
      assert.match(html, /text-align:start/);
      assert.match(html, /display:flex;flex-wrap:wrap/);
      assert.ok(html.includes("<i>Caller HTML</i>"));
      assert.doesNotMatch(html, /[\u202a-\u202e\u2066-\u2069]/);
      assert.doesNotMatch(html, /INV-123\/<&>/);
    }
    const invoice = generateInvoiceHtml({ ...doc, invoiceNumber: token, dueDate: doc.secondDate, status: "sent" }, { name: caller }, { locale });
    assert.match(invoice, /<title>[^<]*INV-123\/&lt;&amp;&gt;<\/title>/);
    assert.ok(invoice.includes(documentMoneyText(doc.total, "USD")));
    assert.deepEqual(doc, before);
  });
}
