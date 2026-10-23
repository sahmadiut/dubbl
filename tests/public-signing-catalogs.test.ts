import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import React from "react";
import * as intl from "next-intl";
import ts from "typescript";
import { renderWithPresentation } from "./helpers/presentation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const base = "app/sign/[token]/";
function load(file: string, locale: "en-US" | "fa-IR", result: unknown, states: unknown[] = []) {
  const path = base + file, require = createRequire(resolve(path));
  const mod = { exports: {} as Record<string, React.ComponentType<{token: string}>> };
  let index = 0;
  const code = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  const t = intl.createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace: "PublicSigning" });
  new Function("require", "module", "exports", code)((id: string) => {
    if (id === "next-intl") return intl;
    if (id === "next-intl/server") return { getTranslations: async () => t };
    if (id === "react") return { ...React, useState: (v: unknown) => [index < states.length ? states[index++] : v, () => {}], useEffect: () => {}, useRef: () => ({ current: null }), useCallback: (fn: unknown) => fn };
    if (id === "./signature-canvas") return { SignatureCanvas: () => React.createElement("span", null, "canvas-boundary") };
    if (id === "@/lib/api/invoice-signatures") return { getPublicInvoiceSignature: async () => result };
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  }, mod, mod.exports);
  return mod.exports;
}

test("public signing renders localized statuses and escaped frozen data without changing money or date strings", async () => {
  for (const locale of ["en-US", "fa-IR"] as const) {
    const t = intl.createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace: "PublicSigning" });
    for (const [status, expired, key] of [["signed", false, "alreadySigned"], ["pending", true, "expiredHeading"], ["declined", false, "declinedHeading"], ["pending", false, null]] as const) {
      const result = { signature: { status, signerName: "<script>Signer</script>", signerEmail: "a@example.test", signedAt: null }, invoice: { invoiceNumber: "INV-ASCII", contact: { name: "<b>Contact</b>" }, issueDate: "2026-10-23", dueDate: "2026-11-23", totalFormatted: "USD 40000000000000.01" }, isExpired: expired };
      const page = load("page.tsx", locale, result).default as unknown as (p: { params: Promise<{token: string}> }) => Promise<React.ReactNode>;
      const html = renderWithPresentation(await page({ params: Promise.resolve({token: "opaque-token"}) }), locale);
      for (const value of ["INV-ASCII", "2026-10-23", "USD 40000000000000.01", "&lt;script&gt;Signer&lt;/script&gt;"]) assert.ok(html.includes(value), value);
      assert.ok(html.includes(key ? t(key) : "canvas-boundary"));
      if (status === "signed") assert.ok(html.includes(t("previousDate")));
    }
  }
});

test("submission preserves POST payload and localizes HTTP and network failures", async () => {
  const source = readFileSync(base + "signature-canvas.tsx", "utf8");
  const start = source.indexOf("  async function handleSubmit()");
  const end = source.indexOf("\n  if (success)", start);
  const code = ts.transpileModule(source.slice(start, end), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  for (const locale of ["en-US", "fa-IR"] as const) {
    const t = intl.createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace: "PublicSigning" });
    for (const mode of ["success", "http", "network", "json"] as const) {
      let error: unknown, success = false, submitting = false;
      const fetch = async (url: string, init: RequestInit) => {
        assert.equal(url, "/api/sign/opaque-token");
        assert.equal(init.method, "POST");
        assert.deepEqual(JSON.parse(init.body as string), { signatureDataUrl: "data:image/png;base64,unchanged" });
        if (mode === "network") throw new Error("network detail");
        return { ok: mode === "success", json: async () => {
          if (mode === "json") throw new Error("invalid JSON");
          return { error: "<script>unreviewed server prose</script>" };
        } };
      };
      const run = new Function("canvasRef", "hasStrokes", "token", "fetch", "t", "setError", "setSubmitting", "setSuccess", code + "; return handleSubmit;")(
        {current: {toDataURL: () => "data:image/png;base64,unchanged"}}, true, "opaque-token", fetch, t,
        (v: unknown) => {error = v;}, (v: boolean) => {submitting = v;}, (v: boolean) => {success = v;});
      await run();
      assert.equal(success, mode === "success");
      if (mode !== "success") {
        assert.equal(submitting, false);
        assert.equal(error, t(mode === "http" ? "submitFailed" : "submitRetry"));
      }
    }
  }
});

test("canvas renders initial, submitting, error and success states through the real bilingual provider", () => {
  for (const locale of ["en-US", "fa-IR"] as const) {
    const messages = locale === "en-US" ? en : fa;
    for (const [states, key] of [[[false, false, false, false, null], "drawHint"], [[false, true, true, false, null], "submitting"], [[false, true, false, true, null], "submittedHeading"], [[false, true, false, false, messages.PublicSigning.submitFailed], "submitFailed"]] as const) {
      const Canvas = load("signature-canvas.tsx", locale, null, [...states]).SignatureCanvas;
      const html = renderWithPresentation(React.createElement(Canvas, {token: "opaque"}), locale);
      assert.ok(html.includes(messages.PublicSigning[key]));
    }
  }
  for (const value of Object.values(fa.PublicSigning)) assert.match(value, /[\u0600-\u06ff]/);
});
