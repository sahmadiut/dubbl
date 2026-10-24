import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as intl from "next-intl";
import { render } from "@react-email/render";
import ts from "typescript";
import { renderWithPresentation } from "./helpers/presentation";
import { portalInvoicesSchema } from "../lib/money/public-ui";
import { documentMoneyText } from "../lib/documents/render-wire";
import { generateInvoiceHtml } from "../lib/documents/pdf-generator";
import { renderDocumentEmailHtml } from "../lib/email/render-document-email";
import { NotificationDigestEmail } from "../lib/email/templates/notification-digest";
import { backgroundTranslator } from "../i18n/background";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

type Locale = "en-US" | "fa-IR";
type Page = (props: { children?: React.ReactNode; params: Promise<{token: string}> }) => React.ReactNode;
const token = "opaque-public-token";
const caller = "Caller <script>&";
const escape = (text: string) => renderToStaticMarkup(React.createElement(React.Fragment, null, text));

// Execute production JSX, next-intl, wire readers and UI primitives. Control only
// request/navigation I/O, React client lifecycle, and signing service data.
function page(file: string, locale: Locale, states: unknown[], signature?: unknown, fetcher?: typeof fetch) {
  const require = createRequire(resolve(file));
  const pageModule = {exports: {} as {default: Page}};
  const effects: Array<() => unknown> = [], updates = new Map<number, unknown>();
  let slot = 0;
  const catalog = locale === "fa-IR" ? fa : en;
  const code = ts.transpileModule(readFileSync(file, "utf8"), {compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022,
  }}).outputText;
  new Function("require", "module", "exports", "fetch", code)((id: string) => {
    if (id === "next-intl") return intl;
    if (id === "@/i18n/server") return { getPresentation: async () => ({locale, numerals: locale === "fa-IR" ? "arabext" : "latn"}) };
    if (id === "next-intl/server") return {getTranslations: async () => intl.createTranslator({locale, messages: catalog, namespace: "PublicSigning"})};
    if (id === "react") return {...React,
      useState: (initial: unknown) => {const index = slot++; return [index < states.length ? states[index] : initial, (value: unknown) => updates.set(index, value)];},
      useEffect: (effect: () => unknown) => effects.push(effect),
    };
    if (id === "next/navigation") return {useParams: () => ({token}), usePathname: () => `/portal/${token}/invoices`};
    if (id === "@/lib/api/invoice-signatures") return {getPublicInvoiceSignature: async (value: string) => {assert.equal(value, token); return signature;}};
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  }, pageModule, pageModule.exports, fetcher ?? (() => {throw new Error("Unexpected fetch");}));
  return {Component: pageModule.exports.default, effects, updates};
}

test("public invoice, signed snapshot, document HTML, email and digest preserve one financial fixture across locales", async () => {
  const diagnostics: unknown[][] = [], previous = console.error;
  console.error = (...args: unknown[]) => {diagnostics.push(args);};
  try {
    // Interleave languages to detect accidental shared translator/request state.
    for (const locale of ["fa-IR", "en-US", "fa-IR"] as const) for (const currencyCode of ["USD", "JPY", "KWD", "IRR"]) {
      const catalog = locale === "fa-IR" ? fa : en;
      const invoice = {id: "invoice-id", invoiceNumber: "INV-FROZEN-01", issueDate: "2026-10-24", dueDate: "2026-11-24",
        status: "sent", currencyCode, total: Number.MAX_SAFE_INTEGER, totalMinor: "9007199254740991",
        amountDue: Number.MAX_SAFE_INTEGER, amountDueMinor: "9007199254740991", paymentLinkToken: null};
      const wire = portalInvoicesSchema.parse({data: [invoice]});
      const frozen = JSON.stringify(wire);
      const formatted = documentMoneyText(wire.data[0].total, currencyCode);
      const websiteFormatted = documentMoneyText(wire.data[0].total, currencyCode, { locale, numerals: locale === "fa-IR" ? "arabext" : "latn" });
      const list = page("app/portal/[token]/invoices/page.tsx", locale, [wire.data, false, null]);
      const layout = page("app/portal/[token]/layout.tsx", locale, [{organization: {name: caller}, contact: {name: caller}}]);
      const signing = page("app/sign/[token]/page.tsx", locale, [], {
        signature: {status: "signed", signerName: caller, signerEmail: "caller@example.test", signedAt: null},
        invoice: {...invoice, contact: {name: caller}, totalFormatted: formatted}, isExpired: false,
      });
      const portal = renderWithPresentation(React.createElement(layout.Component, {params: Promise.resolve({token})},
        React.createElement(list.Component, {params: Promise.resolve({token})})), locale);
      const signed = renderWithPresentation(await signing.Component({params: Promise.resolve({token})}), locale);
      const html = generateInvoiceHtml({...invoice, subtotal: invoice.total, taxTotal: 0, amountPaid: 0, contactName: caller,
        lines: [{description: caller, quantity: 100, unitPrice: invoice.total, taxAmount: 0, amount: invoice.total}]},
      {name: caller}, {locale});
      const email = await renderDocumentEmailHtml({locale, documentType: "invoice", documentNumber: invoice.invoiceNumber,
        organizationName: caller, contactName: caller, amountFormatted: formatted, issueDateFormatted: invoice.issueDate,
        dueDateFormatted: invoice.dueDate, viewUrl: `/sign/${token}`});
      const background = backgroundTranslator(locale);
      const digest = await render(React.createElement(NotificationDigestEmail, {locale, userName: caller, orgName: caller,
        notifications: [{type: "system_alert", title: background("invoiceSubject", {number: invoice.invoiceNumber}),
          body: formatted, createdAt: invoice.issueDate}], dashboardUrl: `/portal/${token}`}));
      for (const [surface, text] of Object.entries({portal, signed, html, email, digest})) {
        assert.ok(text.includes(escape(surface === "portal" || surface === "signed" ? websiteFormatted : formatted)), `${surface} ${locale} ${currencyCode}: exact money`);
        assert.ok(text.includes(invoice.invoiceNumber), `${surface}: document number`);
        assert.ok(text.includes(invoice.issueDate), `${surface}: Gregorian date`);
        assert.ok(text.includes(escape(caller)), `${surface}: escaped caller`);
        assert.doesNotMatch(text, /<script>|(?:PublicPortal|PublicSigning|Output|Background)\.[A-Za-z]/);
      }
      for (const message of [catalog.PublicPortal.invoices, catalog.PublicPortal.statusSent]) assert.ok(portal.includes(escape(message)));
      assert.ok(signed.includes(escape(catalog.PublicSigning.alreadySigned)));
      assert.ok(html.includes(escape(catalog.Output.dateIssue)));
      assert.ok(email.includes(escape(catalog.Output.invoiceButton)));
      assert.ok(digest.includes(escape(background("invoiceSubject", {number: invoice.invoiceNumber}))));
      assert.ok(email.includes(`/sign/${token}`));
      assert.ok(digest.includes(`/portal/${token}`));
      assert.ok(portal.includes(`/portal/${token}/quotes`));
      assert.ok(!portal.includes("/pay/"), "absent payment token stays absent");
      assert.equal(JSON.stringify(wire), frozen, "presentation must not mutate the validated invoice");
      // A Persian render must not change default worker/email language.
      assert.equal(backgroundTranslator()("invoiceSubject", {number: invoice.invoiceNumber}), `Invoice ${invoice.invoiceNumber}`);
      const defaultEmail = await renderDocumentEmailHtml({documentType: "invoice", documentNumber: invoice.invoiceNumber,
        organizationName: caller, contactName: caller, viewUrl: `/sign/${token}`});
      assert.ok(defaultEmail.includes('lang="en-US"'));
      assert.ok(defaultEmail.includes(en.Output.invoiceButton));
    }
    assert.deepEqual(diagnostics, [], "combined render must have no missing-message/context/markup diagnostics");
  } finally {console.error = previous;}
});

test("public production read rejects disagreeing financial aliases with the locale's reviewed fallback", async () => {
  for (const locale of ["en-US", "fa-IR"] as const) {
    const catalog = locale === "fa-IR" ? fa : en;
    const client = page("app/portal/[token]/invoices/page.tsx", locale, [], undefined, (async (url: string) => {
      assert.equal(url, `/api/portal/${token}/invoices`);
      return Response.json({data: [{id: "invoice-id", invoiceNumber: "INV-INVALID", issueDate: "2026-10-24", dueDate: "2026-11-24",
        status: "sent", currencyCode: "USD", total: 1250, totalMinor: "1251", amountDue: 1250, amountDueMinor: "1250"}]});
    }) as typeof fetch);
    renderWithPresentation(React.createElement(client.Component, {params: Promise.resolve({token})}), locale);
    for (const effect of client.effects) effect();
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.deepEqual(client.updates.get(0), []);
    assert.equal(client.updates.get(1), false);
    assert.equal(client.updates.get(2), catalog.PublicPortal.invoiceLoadFailed);
  }
});
