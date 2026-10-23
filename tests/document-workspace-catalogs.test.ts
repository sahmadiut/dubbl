import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import * as React from "react";
import * as jsx from "react/jsx-runtime";
import * as intl from "next-intl";
import ts from "typescript";
import { renderWithPresentation } from "./helpers/presentation";
import { flush, withIO } from "./helpers/report-page";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";
import * as SearchInput from "../components/ui/search-input";
import * as BrandLoader from "../components/dashboard/brand-loader";

type Props = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const locales = ["en-US", "fa-IR"] as const;
const caller = '<script>caller & file.pdf</script>';
const doc = { id: "doc-id", fileName: caller, fileSize: 2048, mimeType: "application/pdf", folderId: null, visibility: "private", uploadedBy: "user-id", createdAt: "2026-10-17T00:00:00Z" };
const folder = { id: "folder-id", name: caller, parentId: null };

// Execute production JSX and callbacks under the real PresentationProvider.
// Portal primitives expose their children so dialog/select contents are testable
// without a browser; transport, state transitions and callbacks are captured.
function render(kind: "page" | "upload" | "attachments" | "loading", states: Props, locale: typeof locales[number], props: Props = {}) {
  const file = kind === "page" || kind === "loading" ? `app/(dashboard)/documents/${kind === "page" ? "page" : "loading"}.tsx` : `components/dashboard/${kind === "upload" ? "file-uploader" : "receipt-attachments"}.tsx`;
  const source = readFileSync(file, "utf8"), ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const names: string[] = [];
  const walk = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isArrayBindingPattern(node.name) && node.initializer && ts.isCallExpression(node.initializer) && node.initializer.expression.getText(ast) === "useState") names.push(node.name.elements[0].getText(ast));
    ts.forEachChild(node, walk);
  };
  walk(ast);
  const captured: Props[] = [], effects: (() => unknown)[] = [], events: [string, unknown][] = [];
  let index = 0;
  const capture = (factory: typeof jsx.jsx) => (type: Parameters<typeof jsx.jsx>[0], props: Props, key: string) => { captured.push(props); return factory(type, props, key); };
  const box = ({ children }: { children?: React.ReactNode }) => React.createElement("div", null, children);
  const require = createRequire(resolve(file)), compiled = { exports: {} as Record<string, React.ComponentType<Props>> };
  const load = (id: string): unknown => {
    if (id === "react") return { ...React, useState: (initial: unknown) => {
      const name = names[index++];
      return [Object.hasOwn(states, name) ? states[name] : initial, (value: unknown) => events.push([name, value])];
    }, useEffect: (fn: () => unknown) => effects.push(fn) };
    if (id === "react/jsx-runtime") return { ...jsx, jsx: capture(jsx.jsx), jsxs: capture(jsx.jsxs) };
    if (id === "next-intl") return intl;
    if (id.endsWith("/search-input")) return SearchInput;
    if (id.endsWith("/brand-loader")) return BrandLoader;
    if (id === "sonner") return { toast: { success: (text: string) => events.push(["success", text]), error: (text: string) => events.push(["error", text]) } };
    if (id === "motion/react") return { AnimatePresence: box, motion: { div: box } };
    if (/\/ui\/(dialog|sheet|dropdown-menu|select|tabs)$/.test(id)) return new Proxy({}, { get: () => box });
    if (id.endsWith("/use-confirm")) return { useConfirm: () => ({ dialog: null, confirm: async (options: Props) => events.push(["confirm", options]) }) };
    if (id.endsWith("/use-debounce")) return { useDebounce: (value: unknown) => value };
    if (id.endsWith("/use-document-title")) return { useDocumentTitle: (title: string) => events.push(["title", title]) };
    if (id === "./file-uploader") return { FileUploader: box };
    return require(id.startsWith("@/") ? resolve(id.slice(2)) : id);
  };
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function("require", "module", "exports", code)(load, compiled, compiled.exports);
  const component = compiled.exports[kind === "upload" ? "FileUploader" : kind === "attachments" ? "ReceiptAttachments" : "default"];
  return { html: renderWithPresentation(React.createElement(component, props), locale), captured, effects, events };
}
const ready = { loading: false, folders: [folder], documents: [doc] };
const translator = (locale: typeof locales[number]) => intl.createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace: "DocumentWorkspace" });

test("document workspace renders bilingual empty, populated, filtered, dialog, preview and loading states", () => {
  for (const locale of locales) {
    const t = translator(locale), h = render("page", { ...ready, selectedDoc: doc, pendingFiles: [{ name: caller, size: 2048, type: "application/pdf" }] }, locale);
    for (const key of ["documents", "newFolder", "uploadFiles", "all", "images", "spreadsheets", "name", "size", "date", "private", "share", "delete", "details", "viewEdit", "fileName", "visibility", "sharedWithTeam", "privateOnlyYou", "type", "uploaded", "download", "open", "duplicateHelp"] as const) assert.ok(h.html.includes(t(key)), key);
    assert.ok(h.html.includes("&lt;script&gt;caller &amp; file.pdf&lt;/script&gt;")); assert.ok(!h.html.includes("<script>"));
    assert.ok(h.events.some(([key, value]) => key === "title" && value === t("documentTitle")));
    for (const value of ["organization", "private", "all", "documents", "images", "spreadsheets", "name", "date", "size"]) assert.ok(h.captured.some(p => p.value === value), value);
    const empty = render("page", { loading: false }, locale);
    for (const key of ["hub", "hubHelp", "exampleBrowser", "contracts", "invoices", "folder", "exampleSummary", "whyHub", "nestedTitle", "nestedHelp", "quickTitle", "quickHelp", "secureTitle", "secureHelp", "teamTitle", "teamHelp"] as const) assert.ok(empty.html.includes(t(key)), key);
    assert.ok(empty.html.includes("Q1-Report.pdf"));
    assert.ok(render("page", { loading: false, currentFolder: "empty" }, locale).html.includes(t("dropOrClick")));
    assert.ok(render("page", { loading: false, currentFolder: "empty", dragOver: true }, locale).html.includes(t("dropHere")));
    assert.ok(render("page", { ...ready, search: "missing" }, locale).html.includes(t("searchHelp")));
    assert.ok(render("page", { ...ready, typeFilter: "images", folders: [] }, locale).html.includes(t("filterHelp")));
    for (const [states, key] of [[{ previewLoading: true, selectedDoc: doc }, "loadingPreview"], [{ creating: true }, "creating"], [{ uploading: true }, "uploading"]] as const) assert.ok(render("page", { ...ready, ...states }, locale).html.includes(t(key)));
    const editing = render("page", { ...ready, selectedDoc: doc, editingName: true }, locale);
    assert.ok(editing.captured.some(p => p["aria-label"] === t("saveName")));
    for (const mimeType of ["image/png", "application/pdf"]) assert.ok(render("page", { ...ready, selectedDoc: { ...doc, mimeType }, previewUrl: "https://example.test/preview" }, locale).captured.some(p => p.src === "https://example.test/preview"));
    assert.ok(render("loading", {}, locale).html.includes((locale === "en-US" ? en : fa).SharedUI.loading2));
    for (const count of [0, 1, 2]) for (const key of ["uploadTitle", "uploadedFiles", "fileCount", "folderCount"] as const) assert.ok(t(key, { count }));
  }
  for (const value of Object.values(fa.DocumentWorkspace)) { assert.match(value, /[\u0600-\u06ff]/); assert.ok(!value.includes("???")); }
});

test("folder creation preserves body and org header and suppresses HTTP/network diagnostics", async () => {
  for (const locale of locales) for (const mode of ["ok", "http", "network"]) {
    const requests: Props[] = [];
    await withIO(async (url, init) => {
      requests.push({ url: String(url), ...init });
      if (mode === "network") throw new Error("private network detail");
      return new Response(JSON.stringify({ error: "private server detail", folders: [], data: [] }), { status: mode === "http" ? 403 : 200 });
    }, async () => {
      const t = translator(locale), h = render("page", { ...ready, newFolderName: "caller folder", currentFolder: "parent-id" }, locale);
      await h.captured.find(p => p.onClick?.name === "handleCreateFolder")!.onClick();
      assert.equal(requests[0].url, "/api/v1/documents/folders"); assert.equal(requests[0].method, "POST");
      assert.deepEqual(requests[0].headers, { "x-organization-id": "org-a", "Content-Type": "application/json" });
      assert.deepEqual(JSON.parse(requests[0].body), { name: "caller folder", parentId: "parent-id" });
      assert.ok(h.events.some(([key, value]) => key === (mode === "ok" ? "success" : "error") && value === t(mode === "ok" ? "folderCreated" : "createFolderFailed")));
      assert.ok(h.events.some(([key, value]) => key === "creating" && value === false));
    });
  }
});

test("upload retains metadata, visibility, custom name and binary PUT while translating failure and plural success", async () => {
  for (const locale of locales) for (const mode of ["ok", "http", "network"]) {
    const requests: Props[] = [], file = { name: "source.pdf", size: 4, type: "application/pdf" };
    await withIO(async (url, init) => {
      requests.push({ url: String(url), ...init });
      if (mode === "network") throw new Error("private detail");
      return new Response(JSON.stringify({ uploadUrl: "https://example.test/upload", error: "private detail", data: [], folders: [] }), { status: mode === "http" ? 400 : 200 });
    }, async () => {
      const t = translator(locale), h = render("page", { ...ready, currentFolder: "parent-id", pendingFiles: [file, file], uploadVisibility: "private", uploadNames: { 0: "renamed.pdf" } }, locale);
      await h.captured.find(p => p.onClick && String(p.onClick).includes("handleUpload(pendingFiles"))!.onClick();
      assert.equal(requests[0].url, "/api/v1/documents"); assert.equal(requests[0].method, "POST");
      assert.deepEqual(JSON.parse(requests[0].body), { fileName: "renamed.pdf", fileSize: 4, mimeType: "application/pdf", folderId: "parent-id", visibility: "private" });
      assert.equal(requests[0].headers["x-organization-id"], "org-a");
      if (mode === "ok") { assert.equal(requests[1].url, "https://example.test/upload"); assert.equal(requests[1].method, "PUT"); assert.equal(requests[1].body, file); }
      assert.ok(h.events.some(([key, value]) => key === (mode === "ok" ? "success" : "error") && value === (mode === "ok" ? t("uploadedFiles", { count: 2 }) : mode === "http" ? t("fileUploadFailed", { name: file.name }) : t("uploadFailed"))));
      assert.ok(h.events.some(([key, value]) => key === "uploading" && value === false));
    });
  }
});

test("rename and visibility callbacks retain PATCH machine values and show only reviewed errors", async () => {
  for (const locale of locales) for (const action of ["rename", "visibility"] as const) for (const ok of [true, false]) {
    const requests: Props[] = [];
    await withIO(async (url, init) => { requests.push({ url: String(url), ...init }); return new Response(JSON.stringify({ error: "private detail", folders: [], data: [] }), { status: ok ? 200 : 403 }); }, async () => {
      const t = translator(locale), h = render("page", { ...ready, selectedDoc: doc, editingName: true, editName: "renamed.pdf" }, locale);
      if (action === "rename") await h.captured.find(p => p["aria-label"] === t("saveName"))!.onClick();
      else await h.captured.find(p => p.onClick && String(p.onClick).includes("handleToggleVisibility(doc)"))!.onClick();
      assert.equal(requests[0].url, "/api/v1/documents/doc-id"); assert.equal(requests[0].method, "PATCH");
      assert.deepEqual(JSON.parse(requests[0].body), action === "rename" ? { fileName: "renamed.pdf" } : { visibility: "organization" });
      assert.equal(requests[0].headers["x-organization-id"], "org-a");
      assert.ok(h.events.some(([key, value]) => key === (ok ? "success" : "error") && value === t(action === "rename" ? ok ? "renamed" : "renameFailed" : ok ? "sharedSuccess" : "visibilityFailed")));
    });
  }
});

test("delete confirmations translate caller names without changing document/folder endpoints", async () => {
  const requests: Props[] = [];
  await withIO(async (url, init) => { requests.push({ url: String(url), ...init }); return new Response(JSON.stringify({ folders: [], data: [] })); }, async () => {
    for (const locale of locales) for (const action of ["Doc", "Folder"]) {
      const t = translator(locale), h = render("page", ready, locale);
      await h.captured.find(p => p.onClick && String(p.onClick).includes(`handleDelete${action}(${action === "Doc" ? "doc" : "folder"})`))!.onClick();
      const options = h.events.find(([key]) => key === "confirm")![1] as Props;
      assert.equal(options.title, t(action === "Doc" ? "deleteFile" : "deleteFolder", { name: caller }));
      assert.equal(options.confirmLabel, t("delete")); assert.equal(options.destructive, true);
      requests.length = 0;
      await options.onConfirm();
      assert.equal(requests[0].url, action === "Doc" ? "/api/v1/documents/doc-id" : "/api/v1/documents/folders/folder-id");
      assert.equal(requests[0].method, "DELETE"); assert.equal(requests[0].headers["x-organization-id"], "org-a");
      assert.ok(h.events.some(([key, value]) => key === "success" && value === t(action === "Doc" ? "fileDeleted" : "folderDeleted")));
    }
  });
});

test("attachment view/remove failures retain localized messages and optimistic removal rollback", async () => {
  for (const locale of locales) for (const action of ["view", "remove"] as const) {
    const messages = locale === "en-US" ? en : fa;
    const requests: Props[] = [];
    await withIO(async (url, init) => { requests.push({ url: String(url), ...init }); return new Response(JSON.stringify({ error: "private detail" }), { status: 403 }); }, async () => {
      const h = render("attachments", { docs: [doc] }, locale, { orgId: "org-a", entityType: "expense", entityId: "expense-id" });
      await h.captured.find(p => p.title === messages.ReceiptAttachments[action])!.onClick();
      assert.equal(requests[0].url, `/api/v1/documents/doc-id${action === "view" ? "/download" : ""}`);
      assert.equal(requests[0].headers["x-organization-id"], "org-a");
      if (action === "remove") { assert.equal(requests[0].method, "DELETE"); assert.ok(h.events.some(([key, value]) => key === "docs" && Array.isArray(value) && value[0] === doc)); }
      assert.ok(h.events.some(([key, value]) => key === "error" && value === messages.ReceiptAttachments[action === "view" ? "openFailed" : "removeFailed"]));
    });
  }
});

test("upload HTTP failure uses existing shared catalog and does not invoke success callbacks", async () => {
  for (const locale of locales) for (const stage of ["presign", "binary"]) {
    const messages = locale === "en-US" ? en : fa;
    await withIO(async (url) => new Response(JSON.stringify({ uploadUrl: "https://example.test/upload" }), { status: String(url).startsWith("/api/") === (stage === "presign") ? 403 : 200 }), async () => {
      const h = render("upload", {}, locale, { onUpload: () => assert.fail("failed upload must not complete") });
      h.captured.find(p => p.type === "file")!.onChange({ target: { files: [{ name: caller, size: 4, type: "application/pdf" }] } }); await flush();
      assert.ok(h.events.some(([key, value]) => key === "error" && value === messages.Upload[stage === "presign" ? "failedToGetUploadURL" : "failedToUploadFile"]));
      assert.ok(h.events.some(([key, value]) => key === "uploading" && value === false));
    });
  }
});

test("existing uploader and shared attachments render both catalogs and keep linked and legacy upload contracts", async () => {
  for (const locale of locales) {
    const messages = locale === "en-US" ? en : fa;
    assert.ok(render("upload", {}, locale, { onUpload: () => {} }).html.includes(messages.Upload.dropAFileOrClickToUpload));
    assert.ok(render("upload", { uploading: true }, locale, { onUpload: () => {} }).html.includes(messages.Upload.uploading));
    assert.ok(render("attachments", { docs: [doc] }, locale, { orgId: "org-a", entityType: "expense", entityId: "expense-id" }).html.includes(messages.ReceiptAttachments.label));
    assert.equal(render("attachments", {}, locale, { orgId: "org-a", entityType: "expense", entityId: null }).html, "");
    for (const linked of [true, false]) {
      const requests: Props[] = [], callbacks: unknown[][] = [], file = { name: "receipt.pdf", size: 4, type: "application/pdf" };
      await withIO(async (url, init) => { requests.push({ url: String(url), ...init }); return new Response(JSON.stringify({ uploadUrl: "https://example.test/upload", document: { id: "doc-id", fileKey: "linked-key" }, attachment: { fileKey: "legacy-key" } })); }, async () => {
        const h = render("upload", {}, locale, { onUpload: (...args: unknown[]) => callbacks.push(args), onAttached: (...args: unknown[]) => callbacks.push(args), ...(linked ? { entityType: "expense", entityId: "expense-id" } : {}) });
        h.captured.find(p => p.type === "file")!.onChange({ target: { files: [file] } }); await flush();
        assert.equal(requests[0].url, linked ? "/api/v1/documents" : "/api/v1/attachments/presign");
        assert.equal(requests[0].headers["x-organization-id"], "org-a");
        assert.deepEqual(JSON.parse(requests[0].body), linked ? { fileName: file.name, mimeType: file.type, fileSize: 4, entityType: "expense", entityId: "expense-id" } : { fileName: file.name, contentType: file.type, fileSize: 4 });
        assert.deepEqual(callbacks[0], [linked ? "linked-key" : "legacy-key", file.name]);
        if (linked) assert.deepEqual(callbacks[1], ["doc-id", file.name]);
        assert.ok(h.events.some(([key, value]) => key === "success" && value === messages.Upload.fileUploaded));
      });
    }
  }
});
