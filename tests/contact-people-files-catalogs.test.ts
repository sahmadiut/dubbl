import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { createElement, type ComponentType } from "react";
import * as React from "react";
import * as nextIntl from "next-intl";
import { createTranslator } from "next-intl";
import ts from "typescript";
import { renderWithPresentation } from "./helpers/presentation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const peoplePath = "app/(dashboard)/contacts/[id]/people/page.tsx";
const filesPath = "app/(dashboard)/contacts/[id]/files/page.tsx";
const locales = ["en-US", "fa-IR"] as const;
const noop = () => {};
const caller = '<script>مخاطب & person</script>';
const emptyPerson = { name: "", email: "", phone: "", jobTitle: "", isPrimary: false };
function translator(locale: typeof locales[number], namespace: "ContactPeople" | "ContactFiles") {
  return createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace });
}
function escape(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
}

// Real production templates and UI/provider; only hooks, navigation and the
// enclosing contact context are controlled. This is not a mounted browser test.
function page(path: string, state: unknown[], people: unknown[] = []) {
  const require = createRequire(resolve(path));
  const compiled = { exports: {} as Record<string, ComponentType> };
  const code = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  let index = 0;
  const load = (id: string) => {
    if (id === "react") return { ...React, useState: (initial: unknown) => [index < state.length ? state[index++] : initial, noop], useRef: (current: unknown) => ({ current }), useEffect: noop, useCallback: (fn: unknown) => fn };
    if (id === "next-intl") return nextIntl;
    if (id === "next/navigation") return { useParams: () => ({ id: "contact-a" }) };
    if (id === "../layout") return { getOrgId: () => "org-a", useContactContext: () => ({ contact: { people }, fetchContact: noop, confirm: noop }) };
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  };
  new Function("require", "module", "exports", code)(load, compiled, compiled.exports);
  return compiled.exports.default;
}

// Execute the actual authored callback bodies with controlled IO, not copies.
function callback(path: string, name: string, scope: Record<string, unknown>) {
  const source = readFileSync(path, "utf8");
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let expression = "";
  function visit(node: ts.Node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) expression = node.getText(ast);
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name && node.initializer && ts.isCallExpression(node.initializer)) expression = node.initializer.arguments[0].getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast); assert.ok(expression, name);
  const code = ts.transpileModule(`const run = ${expression};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(scope), `${code}; return run;`)(...Object.values(scope));
}

test("people production template translates empty, populated, primary, form and busy states in both locales", () => {
  for (const locale of locales) {
    const t = translator(locale, "ContactPeople");
    const Empty = page(peoplePath, [false, false, emptyPerson]);
    const empty = renderWithPresentation(createElement(Empty), locale);
    for (const key of ["title", "description", "addPerson", "empty", "emptyHint"] as const) assert.ok(empty.includes(escape(t(key))), key);
    for (const count of [1, 2]) {
      const people = Array.from({ length: count }, (_, i) => ({ id: `p-${i}`, name: caller, email: "person@example.test", phone: "+98-123", jobTitle: caller, isPrimary: i === 0 }));
      const List = page(peoplePath, [false, false, emptyPerson], people);
      const html = renderWithPresentation(createElement(List), locale);
      assert.ok(html.includes(escape(t("count", { count }))));
      assert.ok(html.includes(escape(t("primary"))));
      assert.ok(html.includes(escape(caller)) && !html.includes("<script>"));
      assert.ok(html.includes("person@example.test") && html.includes("+98-123"));
    }
    for (const busy of [false, true]) {
      const Form = page(peoplePath, [true, busy, { ...emptyPerson, name: caller, isPrimary: true }]);
      const form = renderWithPresentation(createElement(Form), locale);
      for (const key of ["cancel", "nameRequired", "fullName", "email", "emailAddress", "phone", "phoneNumber", "jobTitle", "primaryContact", "add"] as const) assert.ok(form.includes(escape(t(key))), key);
      assert.ok(form.includes('id="personPrimary"') && form.includes('type="email"') && form.includes('required=""'));
      assert.ok(form.includes(escape(caller)) && !form.includes("<script>"));
      if (busy) assert.ok(form.includes('disabled=""'));
      assert.ok(!form.includes(escape(t("empty"))));
    }
    assert.ok(t("count", { count: 0 }).length > 0);
  }
});

test("files production template translates empty, busy, loading, counts, visibility and accessible actions", () => {
  for (const locale of locales) {
    const t = translator(locale, "ContactFiles");
    const Empty = page(filesPath, [[], false, false, "organization"]);
    const empty = renderWithPresentation(createElement(Empty), locale);
    for (const key of ["title", "description", "upload", "empty", "emptyHint"] as const) assert.ok(empty.includes(escape(t(key))), key);
    const Busy = page(filesPath, [[], false, true, "private"]);
    const busy = renderWithPresentation(createElement(Busy), locale);
    assert.ok(busy.includes(escape(t("uploading"))) && busy.includes('disabled=""'));
    const Loading = page(filesPath, [[], true, false, "organization"]);
    assert.ok(!renderWithPresentation(createElement(Loading), locale).includes(escape(t("empty"))));
    for (const count of [1, 2, 3]) {
      const sizes = [12, 2048, 2097152];
      const files = Array.from({ length: count }, (_, i) => ({ id: `f-${i}`, fileName: caller, fileSize: sizes[i], visibility: i === 0 ? "private" : "organization", createdAt: "2026-10-18T00:00:00Z" }));
      const List = page(filesPath, [files, false, false, "organization"]);
      const html = renderWithPresentation(createElement(List), locale);
      for (const key of ["name", "size", "visibility", "uploaded", "private"] as const) assert.ok(html.includes(escape(t(key))), key);
      if (count > 1) assert.ok(html.includes(escape(t("shared"))));
      assert.ok(html.includes(escape(t("count", { count }))));
      assert.ok(html.includes(`aria-label="${escape(t("download"))}"`) && html.includes(`aria-label="${escape(t("deleteTitle"))}"`));
      for (const size of ["12 B", "2.0 KB", "2.0 MB"].slice(0, count)) assert.ok(html.includes(size));
      assert.ok(html.includes(escape(caller)) && !html.includes("<script>"));
    }
  }
});

test("add-person production handler preserves org scope, payload, retry data and translated outcomes", async () => {
  for (const locale of locales) for (const mode of ["success", "status", "network", "no-org", "blank", "optional"]) {
    const t = translator(locale, "ContactPeople"), events: unknown[] = [];
    const newPerson = { name: mode === "blank" ? "  " : caller, email: mode === "optional" ? "" : "p@example.test", phone: "+98-123", jobTitle: caller, isPrimary: true };
    const original = { ...newPerson };
    await callback(peoplePath, "handleAddPerson", { t, id: "contact-a", newPerson, getOrgId: () => mode === "no-org" ? null : "org-a",
      setAddingPerson: (value: boolean) => events.push(value), setNewPerson: (value: unknown) => events.push(value), setShowAddPerson: (value: boolean) => events.push(value), fetchContact: () => events.push("refresh"),
      toast: { success: (value: string) => events.push(value), error: (value: string) => events.push(value) },
      fetch: async (url: string, init: RequestInit) => {
        assert.equal(url, "/api/v1/contacts/contact-a/people");
        assert.equal(init.method, "POST");
        assert.deepEqual(init.headers, { "Content-Type": "application/json", "x-organization-id": "org-a" });
        assert.deepEqual(JSON.parse(init.body as string), { ...newPerson, email: newPerson.email || null });
        if (mode === "network") throw new Error("private server prose");
        return Response.json({ error: "private server prose" }, { status: mode === "status" ? 403 : 201 });
      } })({ preventDefault: noop });
    assert.deepEqual(newPerson, original);
    assert.deepEqual(events, ["blank", "no-org"].includes(mode) ? [] : ["success", "optional"].includes(mode) ? [true, t("added"), emptyPerson, false, "refresh", false] : [true, t("addFailed"), false]);
  }
});

test("file list callback validates response envelopes and localizes HTTP, JSON and network failures", async () => {
  for (const locale of locales) for (const mode of ["success", "status", "html", "shape", "network", "no-org"]) {
    const t = translator(locale, "ContactFiles"), events: unknown[] = [];
    const rows = [{ id: "file-a", fileName: caller }];
    await callback(filesPath, "fetchFiles", { t, id: "contact-a", getOrgId: () => mode === "no-org" ? null : "org-a",
      setFilesLoading: (value: boolean) => events.push(value), setFiles: (value: unknown) => events.push(value), toast: { error: (value: string) => events.push(value) },
      fetch: async (url: string, init: RequestInit) => {
        assert.equal(url, "/api/v1/contacts/contact-a/files");
        assert.deepEqual(init, { headers: { "x-organization-id": "org-a" } });
        if (mode === "network") throw new Error("private server prose");
        if (mode === "html") return new Response("<html>private server prose</html>");
        return Response.json(mode === "shape" ? { data: {} } : { data: rows }, { status: mode === "status" ? 403 : 200 });
      } })();
    assert.deepEqual(events, mode === "no-org" ? [] : mode === "success" ? [true, rows, false] : [true, t("readFailed"), false]);
  }
});

test("file upload callback preserves metadata, MIME fallback, visibility, signed PUT and translated failures", async () => {
  for (const locale of locales) for (const visibility of ["organization", "private"]) for (const mode of ["success", "mime-fallback", "status", "html", "shape", "network", "put-status", "put-network", "no-org"]) {
    const t = translator(locale, "ContactFiles"), events: unknown[] = [];
    const file = { name: caller, size: 1250, type: mode === "mime-fallback" ? "" : "application/pdf" };
    const mime = file.type || "application/octet-stream";
    const fileInputRef = { current: { value: "selected" } };
    let requests = 0;
    await callback(filesPath, "handleFileUpload", { t, id: "contact-a", fileVisibility: visibility, fileInputRef,
      getOrgId: () => mode === "no-org" ? null : "org-a", setUploading: (value: boolean) => events.push(value), fetchFiles: () => events.push("refresh"),
      toast: { success: (value: string) => events.push(value), error: (value: string) => events.push(value) },
      fetch: async (url: string, init: RequestInit) => {
        requests++;
        if (requests === 1) {
          assert.equal(url, "/api/v1/contacts/contact-a/files");
          assert.equal(init.method, "POST");
          assert.deepEqual(init.headers, { "Content-Type": "application/json", "x-organization-id": "org-a" });
          assert.deepEqual(JSON.parse(init.body as string), { fileName: caller, fileSize: 1250, mimeType: mime, visibility });
          if (mode === "network") throw new Error("private server prose");
          if (mode === "html") return new Response("private server prose");
          return Response.json(mode === "shape" ? {} : { uploadUrl: "https://storage.example.test/signed-upload" }, { status: mode === "status" ? 403 : 200 });
        }
        assert.equal(url, "https://storage.example.test/signed-upload");
        assert.deepEqual(init, { method: "PUT", headers: { "Content-Type": mime }, body: file });
        if (mode === "put-network") throw new Error("private storage prose");
        return new Response(null, { status: mode === "put-status" ? 500 : 200 });
      } })(file);
    const success = ["success", "mime-fallback"].includes(mode);
    assert.deepEqual(events, mode === "no-org" ? [] : success ? [true, t("uploadSuccess"), "refresh", false] : [true, t("uploadFailed"), false]);
    assert.equal(fileInputRef.current.value, mode === "no-org" ? "selected" : "");
    assert.equal(requests, mode === "no-org" ? 0 : success || mode.startsWith("put-") ? 2 : 1);
  }
});

test("file delete callback translates confirmation and preserves cancellation and scoped DELETE", async () => {
  for (const locale of locales) for (const mode of ["success", "cancel", "status", "network", "no-org"]) {
    const t = translator(locale, "ContactFiles"), events: unknown[] = [];
    await callback(filesPath, "handleDeleteFile", { t, getOrgId: () => mode === "no-org" ? null : "org-a", fetchFiles: () => events.push("refresh"),
      confirm: async (options: unknown) => { events.push(options); return mode !== "cancel"; },
      toast: { success: (value: string) => events.push(value), error: (value: string) => events.push(value) },
      fetch: async (url: string, init: RequestInit) => {
        events.push("delete"); assert.equal(url, "/api/v1/documents/file-a");
        assert.deepEqual(init, { method: "DELETE", headers: { "x-organization-id": "org-a" } });
        if (mode === "network") throw new Error("private server prose");
        return new Response(null, { status: mode === "status" ? 403 : 204 });
      } })("file-a");
    const confirmation = { title: t("deleteTitle"), description: t("deleteDescription") };
    assert.deepEqual(events, mode === "no-org" ? [] : mode === "cancel" ? [confirmation] : mode === "success" ? [confirmation, "delete", t("deleteSuccess"), "refresh"] : [confirmation, "delete", t("deleteFailed")]);
  }
});

test("file download callback preserves signed URL and localizes failures without opening a window", async () => {
  for (const locale of locales) for (const mode of ["success", "status", "html", "shape", "network", "no-org"]) {
    const t = translator(locale, "ContactFiles"), events: unknown[] = [];
    await callback(filesPath, "handleDownloadFile", { t, getOrgId: () => mode === "no-org" ? null : "org-a",
      toast: { error: (value: string) => events.push(value) }, window: { open: (...args: unknown[]) => events.push(args) },
      fetch: async (url: string, init: RequestInit) => {
        assert.equal(url, "/api/v1/documents/file-a/download");
        assert.deepEqual(init, { headers: { "x-organization-id": "org-a" } });
        if (mode === "network") throw new Error("private server prose");
        if (mode === "html") return new Response("private server prose");
        return Response.json(mode === "shape" ? { downloadUrl: 42 } : { downloadUrl: "https://storage.example.test/signed-download" }, { status: mode === "status" ? 403 : 200 });
      } })("file-a");
    assert.deepEqual(events, mode === "no-org" ? [] : mode === "success" ? [["https://storage.example.test/signed-download", "_blank"]] : [t("downloadFailed")]);
  }
});

test("owned sources have no remaining authored JSX or display attribute literals; Persian messages contain Persian script", () => {
  for (const path of [peoplePath, filesPath]) {
    const ast = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(node: ts.Node) {
      if (ts.isJsxText(node)) assert.equal(node.text.trim(), "", `${path}: ${node.text.trim()}`);
      if (ts.isJsxAttribute(node) && ["title", "description", "placeholder", "aria-label", "alt"].includes(node.name.getText(ast))) assert.ok(!node.initializer || !ts.isStringLiteral(node.initializer), node.getText(ast));
      ts.forEachChild(node, visit);
    }
    visit(ast);
  }
  for (const namespace of [fa.ContactPeople, fa.ContactFiles]) for (const value of Object.values(namespace)) assert.match(value, /[\u0600-\u06ff]/);
  for (const count of [0, 1, 2]) {
    assert.equal(translator("en-US", "ContactPeople")("count", { count }), `${count} ${count === 1 ? "person" : "people"}`);
    assert.equal(translator("en-US", "ContactFiles")("count", { count }), `${count} ${count === 1 ? "file" : "files"}`);
    const number = new Intl.NumberFormat("fa-IR").format(count);
    assert.equal(translator("fa-IR", "ContactPeople")("count", { count }), `${number} نفر`);
    assert.equal(translator("fa-IR", "ContactFiles")("count", { count }), `${number} فایل`);
  }
});
