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

const file = "components/dashboard/email-history.tsx";
const rows = ["sent", "failed", "unexpected-server-prose"].map((status, i) => ({ id: `log-${i}`, status, recipientEmail: "person@example.test", subject: "<script>subject & caller</script>", sentAt: "2026-10-16T23:58:00Z" }));
function harness(locale: "en-US" | "fa-IR", loading = false) {
  let index = 0;
  const states = [rows, loading, null];
  const buttons: { onClick: () => Promise<void> }[] = [];
  const events: string[] = [];
  const require = createRequire(resolve(file));
  const compiled = { exports: {} as { EmailHistory: React.ComponentType<{documentType: string; documentId: string}> } };
  const code = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const load = (id: string) => {
    if (id === "react") return { ...React, useState: () => [states[index++], () => {}], useEffect: () => {}, useCallback: (fn: unknown) => fn };
    if (id === "next-intl") return intl;
    if (id === "sonner") return { toast: { success: (s: string) => events.push(s), error: (s: string) => events.push(s) } };
    if (id.endsWith("/ui/button")) return { Button: (props: { children: React.ReactNode; onClick: () => Promise<void> }) => { buttons.push(props); return React.createElement("button", null, props.children); } };
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  };
  new Function("require", "module", "exports", code)(load, compiled, compiled.exports);
  const html = renderWithPresentation(React.createElement(compiled.exports.EmailHistory, { documentType: "invoice", documentId: "document-id" }), locale);
  return { html, buttons, events };
}

test("history renders both catalogs, safe caller text and known/unknown statuses", () => {
  for (const locale of ["en-US", "fa-IR"] as const) {
    const messages = locale === "en-US" ? en : fa;
    const { html } = harness(locale);
    for (const key of ["title", "sent", "failed", "unknownStatus", "resend"] as const) assert.ok(html.includes(messages.DocumentEmailHistory[key]));
    assert.ok(html.includes("&lt;script&gt;subject &amp; caller&lt;/script&gt;"));
    assert.ok(html.includes("person@example.test"));
    assert.ok(!html.includes("unexpected-server-prose"));
    assert.ok(html.includes(new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(-2, "minute")));
    assert.equal(harness(locale, true).html, "");
  }
  for (const value of Object.values(fa.DocumentEmailHistory)) assert.match(value, /[\u0600-\u06ff]/);
});

test("resend preserves URL/header and localizes HTTP and network failures", async () => {
  const previousFetch = globalThis.fetch;
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "window", { value: {}, configurable: true });
  Object.defineProperty(globalThis, "localStorage", { value: { getItem: () => "org-id" }, configurable: true });
  try {
    for (const outcome of ["success", "http", "network"]) {
      const requests: { url: string; init?: RequestInit }[] = [];
      globalThis.fetch = async (url, init) => {
        requests.push({ url: String(url), init });
        if (outcome === "network") throw new Error("private server detail");
        return new Response(JSON.stringify({ emails: [] }), { status: outcome === "http" ? 403 : 200 });
      };
      const h = harness("fa-IR");
      await h.buttons[0].onClick();
      assert.equal(requests[0].url, "/api/v1/document-emails/log-0/resend");
      assert.equal(requests[0].init?.method, "POST");
      assert.deepEqual(requests[0].init?.headers, { "x-organization-id": "org-id" });
      assert.deepEqual(h.events, [outcome === "success" ? fa.DocumentEmailHistory.resent : fa.DocumentEmailHistory.resendFailed]);
      if (outcome === "success") assert.equal(requests[1].url, "/api/v1/document-emails?documentType=invoice&documentId=document-id");
    }
  } finally {
    globalThis.fetch = previousFetch;
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow); else Reflect.deleteProperty(globalThis, "window");
    if (previousStorage) Object.defineProperty(globalThis, "localStorage", previousStorage); else Reflect.deleteProperty(globalThis, "localStorage");
  }
});
