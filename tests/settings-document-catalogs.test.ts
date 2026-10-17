import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement, type ComponentProps } from "react";
import { createTranslator } from "next-intl";
import { readFileSync } from "node:fs";
import ts from "typescript";
import DocumentTemplatesPage from "../app/(dashboard)/settings/document-templates/page";
import { DocumentTemplateForm, DocumentTemplateList, DocumentTemplatePreview, documentTemplateTypes, documentTemplateTypeLabel, type Template } from "../components/settings/document-template-content";
import { requireTemplateResponse, templateFailureMessage } from "../components/settings/document-template-request";
import { clientPdf } from "../lib/api/client-response";
import { renderWithPresentation } from "./helpers/presentation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const locales = ["en-US", "fa-IR"] as const;
const noop = () => {};
const sample: Template = {
  id: "template-id", name: '<script>Caller " & قالب', type: "invoice",
  logoUrl: "https://example.org/logo.png", accentColor: "#123456",
  headerHtml: '<b>{{orgName}} & <script>untrusted</script></b>',
  footerHtml: '<p>{{total}}</p>', notes: "Saved notes {{invoiceNumber}}",
  bankDetails: "Saved IBAN {{orgName}}", paymentInstructions: "Saved {{dueDate}}",
  showTaxBreakdown: false, showPaymentTerms: true, isDefault: true, createdAt: "2026-10-17",
};
const defaults: ComponentProps<typeof DocumentTemplateForm> = {
  editing: null, saving: false, setSheetOpen: noop, handleSave: noop,
  name: "", setName: noop, type: "invoice", setType: noop,
  logoUrl: "", setLogoUrl: noop, accentColor: "#10b981", setAccentColor: noop,
  headerHtml: "", setHeaderHtml: noop, footerHtml: "", setFooterHtml: noop,
  showTaxBreakdown: true, setShowTaxBreakdown: noop, showPaymentTerms: true, setShowPaymentTerms: noop,
  notes: "", setNotes: noop, bankDetails: "", setBankDetails: noop,
  paymentInstructions: "", setPaymentInstructions: noop, isDefault: false, setIsDefault: noop,
};
const escaped = (text: string) => renderWithPresentation(createElement("span", null, text)).slice(6, -7);

test("document settings list renders empty/default/type branches and escapes caller content in both locales", () => {
  for (const locale of locales) {
    const messages = locale === "en-US" ? en : fa;
    const st = createTranslator({ locale, messages, namespace: "SettingsDocumentTemplates" });
    const props = { openCreate: noop, openEdit: noop, handlePreview: noop, handleDelete: noop };
    const empty = renderWithPresentation(createElement(DocumentTemplateList, { ...props, templates: [] }), locale);
    for (const key of ["documentTemplates", "description", "newTemplate", "noTemplates", "emptyDescription", "createTemplate"] as const) assert.ok(empty.includes(escaped(st(key))), key);
    const cards = renderWithPresentation(createElement(DocumentTemplateList, { ...props, templates: [sample] }), locale);
    assert.ok(cards.includes(escaped(sample.name)));
    assert.ok(cards.includes(escaped(st("default"))));
    assert.ok(cards.includes(escaped(st("invoice"))));
    assert.ok(cards.includes(`aria-label="${st("actions")}"`));
    assert.ok(cards.includes("#123456"));
    assert.ok(!cards.includes("<script>"));
    assert.deepEqual(Object.keys(documentTemplateTypes(st)), ["invoice", "quote", "receipt", "payslip", "purchase_order"]);
    for (const type of Object.keys(documentTemplateTypes(st))) assert.ok(documentTemplateTypeLabel(st, type));
    for (const type of ["future_type", "__proto__", "constructor"]) assert.equal(documentTemplateTypeLabel(st, type), type);
    assert.equal(st("deleteTitle", { name: sample.name }).includes(sample.name), true);
    assert.ok(renderWithPresentation(createElement(DocumentTemplatesPage), locale).length > 0);
  }
  assert.equal(fa.SettingsDocumentTemplates.documentTemplates, "قالب‌های اسناد");
  assert.ok(!Object.values(fa.SettingsDocumentTemplates).some(value => /\?{2,}|�/.test(value)));
});

test("real document form preserves variables, raw saved fields, controls and save disabling in both locales", () => {
  for (const locale of locales) {
    const messages = locale === "en-US" ? en : fa;
    const st = createTranslator({ locale, messages, namespace: "SettingsDocumentTemplates" });
    const render = (changes: Partial<typeof defaults> = {}) => renderWithPresentation(createElement(DocumentTemplateForm, { ...defaults, ...changes }), locale);
    const empty = render();
    for (const key of ["general", "name", "type", "defaultTemplate", "branding", "accentColor", "logoUrl", "displayOptions", "showTax", "showPaymentTerms", "paymentInformation", "bankDetails", "paymentInstructions", "content", "notes", "headerHtml", "footerHtml", "variables", "variablesHelp", "cancel", "create"] as const) assert.ok(empty.includes(escaped(st(key))), key);
    assert.match(empty, /disabled=""[^>]*>[^<]*<\/button>/);
    assert.ok(!render({ name: "Standard" }).includes('disabled=""'));
    assert.ok(render({ name: "  " }).includes('disabled=""'));
    assert.ok(render({ name: "Standard", saving: true }).includes('disabled=""'));
    assert.ok(render({ saving: true }).includes(escaped(st("saving"))));
    for (const variable of ["orgName", "orgAddress", "orgTaxId", "orgPhone", "orgEmail", "orgRegistrationNumber", "invoiceNumber", "issueDate", "dueDate", "reference", "contactName", "contactEmail", "contactAddress", "contactTaxNumber", "subtotal", "taxTotal", "total", "currency"]) assert.ok(empty.includes(`{{${variable}}}`));
    assert.ok(empty.includes(escaped(st("instructionsPlaceholder", { invoiceNumber: "{{invoiceNumber}}" }))));
    assert.ok(empty.includes("DE89 3704 0044 0532 0130 00"));
    assert.ok(empty.includes("COBADEFFXXX"));
    assert.ok(empty.includes("https://example.com/logo.png"));
    assert.ok(empty.includes(escaped(`<p style="color: #6b7280;">${st("headerSample")}</p>`)));
    const edit = render({ ...sample, editing: sample, name: sample.name, logoUrl: sample.logoUrl!, accentColor: sample.accentColor!, headerHtml: sample.headerHtml!, footerHtml: sample.footerHtml!, notes: sample.notes!, bankDetails: sample.bankDetails!, paymentInstructions: sample.paymentInstructions! });
    assert.ok(!edit.includes('role="combobox"')); // Type remains immutable on edit.
    assert.ok(edit.includes(escaped(st("update"))));
    for (const text of [sample.name, sample.headerHtml!, sample.footerHtml!, sample.notes!, sample.bankDetails!, sample.paymentInstructions!]) assert.ok(edit.includes(escaped(text)), text);
    assert.ok(edit.includes('aria-checked="false"'));
    assert.ok(edit.includes('aria-checked="true"'));
    assert.ok(!edit.includes("<script>"));
  }
});

test("preview keeps the server HTML and original iframe contract while translating its accessible title", () => {
  const html = '<!doctype html><html><body><h1>Caller {{invoiceNumber}} & قالب</h1></body></html>';
  for (const locale of locales) {
    const messages = locale === "en-US" ? en : fa;
    const output = renderWithPresentation(createElement(DocumentTemplatePreview, { html }), locale);
    assert.ok(output.includes(`title="${messages.SettingsDocumentTemplates.previewTitle}"`));
    assert.ok(output.includes(`srcDoc="${escaped(html)}"`));
    assert.ok(!output.includes("<h1>"));
    assert.equal(renderWithPresentation(createElement(DocumentTemplatePreview, { html: null }), locale), "");
  }
});

test("template request errors use only approved messages and keep successful JSON/HTML/PDF bodies intact", async () => {
  for (const locale of locales) {
    const messages = locale === "en-US" ? en : fa;
    const errors = createTranslator({ locale, messages, namespace: "SettingsErrors" });
    const fallback = messages.SettingsDocumentTemplates.saveFailed;
    for (const [status, message, expected] of [
      [404, "Template not found", errors("templateMissing")],
      [401, "unknown", errors("unauthenticated")],
      [403, "unknown", errors("forbidden")],
      [422, "unknown", errors("invalidInput")],
      [400, "unknown", errors("invalidInput")],
      [500, "<script>server prose", fallback],
      [404, "constructor", fallback],
      [404, "__proto__", fallback],
    ] as const) {
      try {
        await requireTemplateResponse(Response.json({ error: message }, { status }), errors, fallback);
        assert.fail("Failure response must reject before a success action");
      } catch (error) { assert.equal(templateFailureMessage(error, fallback), expected); }
    }
    await assert.rejects(requireTemplateResponse(new Response("<html>failure</html>", { status: 500 }), errors, fallback), { message: fallback });
    for (const error of [new Error("network secret"), new SyntaxError("bad JSON"), "<script>", null]) assert.equal(templateFailureMessage(error, fallback), fallback);
    const json = Response.json({ templates: [sample] });
    assert.deepEqual(await (await requireTemplateResponse(json, errors, fallback)).json(), { templates: [sample] });
    const html = new Response("<h1>Saved preview</h1>", { headers: { "content-type": "text/html" } });
    assert.equal(await (await requireTemplateResponse(html, errors, fallback)).text(), "<h1>Saved preview</h1>");
    const pdf = new Response("%PDF-sample", { headers: { "content-type": "application/pdf" } });
    assert.equal(await (await clientPdf(await requireTemplateResponse(pdf, errors, fallback))).text(), "%PDF-sample");
    await assert.rejects(clientPdf(await requireTemplateResponse(Response.json({ error: "wrong format" }), errors, fallback)));
  }
});

// Captured from the page before extraction, including null normalization and file naming.
const requestContracts = [
  'fetch("/api/v1/document-templates", { headers: getHeaders() })',
  'getHeaders()',
  'payload = { name, type, logoUrl: logoUrl || null, accentColor, headerHtml: headerHtml || null, footerHtml: footerHtml || null, showTaxBreakdown, showPaymentTerms, notes: notes || null, bankDetails: bankDetails || null, paymentInstructions: paymentInstructions || null, isDefault, }',
  'fetch(`/api/v1/document-templates/${editing.id}`, { method: "PATCH", headers: getHeaders(), body: JSON.stringify(payload), })',
  'getHeaders()', 'JSON.stringify(payload)',
  'fetch("/api/v1/document-templates", { method: "POST", headers: getHeaders(), body: JSON.stringify(payload), })',
  'getHeaders()', 'JSON.stringify(payload)',
  'fetch(`/api/v1/document-templates/${t.id}`, { method: "DELETE", headers: getHeaders(), })',
  'getHeaders()',
  'fetch(`/api/v1/document-templates/${t.id}/preview`, { method: "POST", headers: getHeaders(), })',
  'getHeaders()',
  'fetch(`/api/v1/document-templates/${previewTemplateId}/preview?format=pdf`, { method: "POST", headers: getHeaders(), })',
  'getHeaders()', 'downloadBlob(blob, "sample-invoice.pdf")',
];

test("template HTTP methods, organization headers, payload and preview/PDF requests retain existing contracts", () => {
  const path = "app/(dashboard)/settings/document-templates/page.tsx";
  const source = readFileSync(path, "utf8");
  const sf = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const actual: string[] = [];
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) && ["fetch", "JSON.stringify", "downloadBlob", "getHeaders"].includes(node.expression.getText(sf))) actual.push(node.getText(sf).replace(/\s+/g, " "));
    if (ts.isVariableDeclaration(node) && node.name.getText(sf) === "payload") actual.push(node.getText(sf).replace(/\s+/g, " "));
    ts.forEachChild(node, visit);
  }
  visit(sf);
  assert.deepEqual(actual, requestContracts);
  assert.ok(source.includes('return { "x-organization-id": orgId, "Content-Type": "application/json" }'));
});

test("bounded document settings JSX contains no authored English copy or untranslated attributes", () => {
  for (const path of ["app/(dashboard)/settings/document-templates/page.tsx", "components/settings/document-template-content.tsx"]) {
    const sf = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(node: ts.Node) {
      if (ts.isJsxText(node)) assert.ok(!/[a-z]/i.test(node.text), node.text);
      if (ts.isJsxAttribute(node) && ["title", "placeholder", "aria-label"].includes(node.name.getText(sf))) assert.ok(!node.initializer || !ts.isStringLiteral(node.initializer), node.getText(sf));
      ts.forEachChild(node, visit);
    }
    visit(sf);
  }
});
