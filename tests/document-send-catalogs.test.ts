import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import * as React from "react";
import * as intl from "next-intl";
import ts from "typescript";
import { renderWithPresentation } from "./helpers/presentation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const file = "components/dashboard/send-document-dialog.tsx";
const kinds = ["invoice", "quote", "credit_note", "purchase_order", "debit_note"] as const;
type Kind = typeof kinds[number];
type Props = { children?: React.ReactNode; onClick?: () => Promise<void>; disabled?: boolean; loading?: boolean; value?: string; onChange?: (event: { target: { value: string } }) => void; onCheckedChange?: (value: boolean) => void };
function harness(locale: "en-US" | "fa-IR", kind: Kind = "quote", overrides: Record<number, unknown> = {}, amount: number | bigint = 9007199254740993n) {
  let index = 0;
  const states: unknown[] = ["person@example.test", "caller message", kind === "invoice", false, false, false, "<p>template</p>", false, false, "blob:document", false, false, false, null];
  for (const [key, value] of Object.entries(overrides)) states[Number(key)] = value;
  const buttons: Props[] = [];
  const inputs: Props[] = [];
  const events: string[] = [];
  let closed = 0, sent = 0;
  const require = createRequire(resolve(file));
  const compiled = { exports: {} as { SendDocumentDialog: React.ComponentType<Record<string, unknown>> } };
  const code = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const wrapper = (props: Props) => React.createElement("div", null, props.children);
  const load = (id: string) => {
    if (id === "react") return { ...React, useState: () => { const slot = index++; return [states[slot], (value: unknown) => { states[slot] = value; }]; }, useEffect: () => {}, useCallback: (fn: unknown) => fn };
    if (id === "next-intl") return intl;
    if (id === "sonner") return { toast: { success: (s: string) => events.push(s), error: (s: string) => events.push(s) } };
    if (id.endsWith("/ui/button")) return { Button: (props: Props) => { buttons.push(props); return React.createElement("button", { disabled: props.disabled }, props.children); } };
    if (id.endsWith("/ui/input")) return { Input: (props: Props) => { inputs.push(props); return React.createElement("input", { value: props.value, readOnly: true }); } };
    if (id.endsWith("/ui/textarea")) return { Textarea: (props: Props & { placeholder: string }) => { inputs.push(props); return React.createElement("textarea", { placeholder: props.placeholder, value: props.value, readOnly: true }); } };
    if (id.endsWith("/ui/checkbox")) return { Checkbox: (props: Props) => { inputs.push(props); return null; } };
    if (id.endsWith("/ui/label")) return { Label: wrapper };
    if (id.endsWith("/ui/sheet")) return Object.fromEntries(["Sheet", "SheetContent", "SheetHeader", "SheetTitle", "SheetDescription"].map(name => [name, wrapper]));
    if (id.endsWith("/ui/select")) return Object.fromEntries(["Select", "SelectContent", "SelectItem", "SelectTrigger", "SelectValue"].map(name => [name, wrapper]));
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  };
  new Function("require", "module", "exports", code)(load, compiled, compiled.exports);
  const html = renderWithPresentation(React.createElement(compiled.exports.SendDocumentDialog, {
    open: true, onOpenChange: () => { closed++; }, onSent: () => { sent++; }, documentType: kind,
    documentId: "document-id", documentNumber: "DOC-42", contactName: "<script>caller & name</script>", organizationName: "Organization", amountDue: amount,
    currencyCode: "USD", dueDate: "2026-10-30", issueDate: "2026-10-23", sendApiUrl: "/api/v1/caller/document-id/send",
  }), locale);
  const button = (name: string) => { const found = buttons.find(props => React.Children.toArray(props.children).includes(name)); assert.ok(found, name); return found; };
  return { html, states, buttons, inputs, events, button, result: () => ({ closed, sent }) };
}

test("send controls render both catalogs for every kind, escaping caller data and preserving exact money", () => {
  for (const locale of ["en-US", "fa-IR"] as const) {
    const m = (locale === "en-US" ? en : fa).DocumentSend;
    for (const kind of kinds) {
      const h = harness(locale, kind);
      for (const key of ["sendEmail", "markAsSent", "previewEmail", "personalMessage", "messageHelp", "emailIncludes"] as const) assert.ok(h.html.includes(m[key]));
      assert.ok(h.html.includes(m[`type_${kind}`]));
      assert.ok(h.html.includes("&lt;script&gt;caller &amp; name&lt;/script&gt;"));
      assert.ok(h.html.includes("90,071,992,547,409.93"));
      assert.ok(h.html.includes(kind === "quote" ? m.validUntil : m.dueDate));
      assert.equal(h.html.includes(m.attachPdf), kind === "invoice");
      if (kind === "invoice") assert.ok(h.html.includes("Online payment (Stripe)"));
    }
  }
  const check = (value: unknown) => { if (typeof value === "string") { assert.match(value, /[\u0600-\u06ff]/); assert.ok(!value.includes("???")); } else for (const child of Object.values(value as object)) check(child); };
  check(fa.DocumentSend);
});

test("preview panels expose translated titles, recovery actions and loading states", async () => {
  for (const locale of ["en-US", "fa-IR"] as const) {
    const m = (locale === "en-US" ? en : fa).DocumentSend;
    const email = harness(locale, "quote", { 5: true });
    assert.ok(email.html.includes(`title="${m.emailPreviewTitle}"`));
    await email.button(m.edit).onClick?.();
    assert.equal(email.states[5], false);
    const doc = harness(locale, "quote", { 8: true });
    assert.ok(doc.html.includes(`title="${m.documentPreviewTitle.replace("{type}", m.type_quote)}"`));
    await doc.button(m.back).onClick?.();
    assert.equal(doc.states[8], false);
    const failed = harness(locale, "quote", { 8: true, 11: true });
    assert.ok(failed.html.includes(m.documentPreviewFailed.replace("{type}", m.lowerType_quote).replaceAll("'", "&#x27;")));
    failed.button(m.retry);
    assert.ok(!harness(locale, "quote", { 5: true, 7: true }).html.includes("<iframe"));
    assert.ok(!harness(locale, "quote", { 8: true, 10: true }).html.includes("<iframe"));
  }
});

test("send, mark, email/PDF preview callbacks preserve contracts and contain HTTP/network errors", async () => {
  const previousFetch = globalThis.fetch;
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const oldStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "window", { value: {}, configurable: true });
  Object.defineProperty(globalThis, "localStorage", { value: { getItem: (key: string) => { assert.equal(key, "activeOrgId"); return "org-id"; } }, configurable: true });
  try {
    for (const locale of ["en-US", "fa-IR"] as const) for (const outcome of ["success", "http", "network"] as const) {
      const m = (locale === "en-US" ? en : fa).DocumentSend;
      for (const kind of kinds) for (const operation of ["send", "mark", "email", "pdf"] as const) {
        const requests: { url: string; init?: RequestInit }[] = [];
        globalThis.fetch = async (url, init) => {
          requests.push({ url: String(url), init });
          if (outcome === "network") throw new Error("private diagnostic");
          return operation === "pdf" ? new Response("%PDF-1.4\npreview", { status: outcome === "http" ? 403 : 200, headers: { "content-type": "application/pdf" } }) : new Response(JSON.stringify({ html: "<p>preview</p>", error: "private diagnostic" }), { status: outcome === "http" ? 403 : 200 });
        };
        const h = harness(locale, kind);
        const label = operation === "send" ? m.sendEmail : operation === "mark" ? m.markAsSent : operation === "email" ? m.previewEmail : m.previewDocument.replace("{type}", m[`type_${kind}`]);
        await h.button(label).onClick?.();
        assert.equal(requests.length, 1);
        assert.equal((requests[0].init?.headers as Record<string, string>)["x-organization-id"], "org-id");
        assert.equal(requests[0].init?.method, operation === "pdf" ? undefined : "POST");
        if (operation === "send" || operation === "mark") {
          assert.equal(requests[0].url, "/api/v1/caller/document-id/send");
          assert.deepEqual(h.result(), outcome === "success" ? { closed: 1, sent: 1 } : { closed: 0, sent: 0 });
          const key = operation === "send" ? (outcome === "success" ? "sent" : "sendFailed") : (outcome === "success" ? "marked" : "markFailed");
          assert.deepEqual(h.events, [m[key].replace("{type}", outcome === "success" ? m[`type_${kind}`] : m[`lowerType_${kind}`])]);
          assert.equal(h.states[operation === "send" ? 3 : 4], false);
        }
        if (operation === "send" || operation === "email") {
          const body = JSON.parse(String(requests[0].init?.body));
          const template = operation === "send" ? body.templateProps : body;
          assert.equal(template.documentType, kind);
          assert.equal(template.documentNumber, "DOC-42");
          assert.equal(template.personalMessage, "caller message");
          assert.equal(template.amountFormatted, "$90,071,992,547,409.93");
          assert.equal(template.dueDateFormatted, "Oct 30, 2026");
          if (operation === "send") {
            assert.equal(body.subject, `${en.DocumentSend[`type_${kind}`]} DOC-42 from Organization`);
            assert.equal(body.sendEmail, true);
            assert.equal(body.recipientEmail, "person@example.test");
            assert.equal(body.attachPdf, kind === "invoice");
            assert.equal("includePaymentLink" in body, kind === "invoice");
          } else {
            assert.equal(requests[0].url, "/api/v1/document-emails/preview");
            assert.equal(h.states[7], false);
            if (outcome === "success") assert.equal(h.states[6], "<p>preview</p>");
            else assert.deepEqual(h.events, [m.previewFailed]);
            if (kind === "quote") assert.equal(body.buttonLabel, "View quote");
          }
        }
        if (operation === "mark") assert.equal(requests[0].init?.body, undefined);
        if (operation === "pdf") {
          const routes = { invoice: "invoices", quote: "quotes", credit_note: "credit-notes", purchase_order: "purchase-orders", debit_note: "debit-notes" };
          assert.equal(requests[0].url, `/api/v1/${routes[kind]}/document-id/pdf?format=pdf`);
          assert.equal(h.states[10], false);
          assert.equal(h.states[11], outcome !== "success");
          if (outcome === "success") { assert.match(String(h.states[9]), /^blob:/); URL.revokeObjectURL(String(h.states[9])); }
        }
      }
    }
    for (const locale of ["en-US", "fa-IR"] as const) {
      const m = (locale === "en-US" ? en : fa).DocumentSend;
      globalThis.fetch = async () => { throw new Error("must not request"); };
      const bad = harness(locale, "quote", {}, Number.MAX_SAFE_INTEGER + 1);
      assert.ok(bad.html.includes(m.moneyError));
      assert.equal(bad.button(m.sendEmail).disabled, true);
      await bad.button(m.previewEmail).onClick?.();
      await bad.button(m.sendEmail).onClick?.();
      assert.deepEqual(bad.events, [m.moneyError, m.moneyError]);
      const empty = harness(locale, "quote", { 0: "" });
      assert.equal(empty.button(m.sendEmail).disabled, true);
      await empty.button(m.sendEmail).onClick?.();
      assert.deepEqual(empty.events, [m.recipientRequired]);
      const editing = harness(locale, "invoice");
      editing.inputs[0].onChange?.({ target: { value: "edited@example.test" } });
      editing.inputs[1].onChange?.({ target: { value: "edited note" } });
      editing.inputs[2].onCheckedChange?.(false);
      assert.equal(editing.states[0], "edited@example.test");
      assert.equal(editing.states[1], "edited note");
      assert.equal(editing.states[2], false);
    }
  } finally {
    globalThis.fetch = previousFetch;
    if (oldWindow) Object.defineProperty(globalThis, "window", oldWindow); else Reflect.deleteProperty(globalThis, "window");
    if (oldStorage) Object.defineProperty(globalThis, "localStorage", oldStorage); else Reflect.deleteProperty(globalThis, "localStorage");
  }
});
