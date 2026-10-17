import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { createTranslator } from "next-intl";
import { requestSettingsExport } from "../components/settings/export-request";
import { TrashEmptyDescription } from "../components/settings/data-management-content";
import { renderWithPresentation } from "./helpers/presentation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

test("selected exports request exactly selected CSVs with dates only on transactional files and package exact bytes", async () => {
  const calls: { url: string; headers: Headers }[] = [];
  const bodies: Record<string, string> = { contacts: 'name\r\n"Caller, <&>"\r\n', invoices: 'totalMinor\r\n9007199254740991\r\n' };
  const send: typeof fetch = async (url, init) => {
    calls.push({ url: String(url), headers: new Headers(init?.headers) });
    return new Response(bodies[new URL(String(url), "http://fixture").pathname.split("/").at(-1)!]);
  };
  const input = { selected: ["contacts", "invoices", "contacts"], startDate: "2024-01-01", endDate: "2024-01-31", organizationId: "org" };
  const result = await requestSettingsExport(input, send);
  assert.equal(result.filename, "dubbl-export.zip");
  assert.equal(result.blob.type, "application/zip");
  assert.deepEqual(calls.map(c => c.url), ["/api/v1/export/contacts?", "/api/v1/export/invoices?startDate=2024-01-01&endDate=2024-01-31"]);
  assert.ok(calls.every(c => c.headers.get("x-organization-id") === "org"));
  // Independently decode ZIP local headers (store method) and payloads.
  const bytes = Buffer.from(await result.blob.arrayBuffer()), files: Record<string, string> = {};
  let offset = 0;
  while (bytes.readUInt32LE(offset) === 0x04034b50) {
    assert.equal(bytes.readUInt16LE(offset + 8), 0);
    const size = bytes.readUInt32LE(offset + 18), nameSize = bytes.readUInt16LE(offset + 26), extraSize = bytes.readUInt16LE(offset + 28);
    const start = offset + 30 + nameSize + extraSize;
    files[bytes.subarray(offset + 30, offset + 30 + nameSize).toString()] = bytes.subarray(start, start + size).toString();
    offset = start + size;
  }
  assert.deepEqual(files, { "contacts.csv": bodies.contacts, "invoices.csv": bodies.invoices });
  calls.length = 0;
  const single = await requestSettingsExport({ ...input, selected: ["contacts"] }, send);
  assert.equal(single.filename, "contacts.csv"); assert.equal(await single.blob.text(), bodies.contacts);
  assert.deepEqual(calls.map(c => c.url), ["/api/v1/export/contacts?"]);
});

test("all export uses the snapshot ZIP with dates and rejects invalid selections or failed files before a download", async () => {
  const input = { selected: [], all: true, startDate: "2024-01-01", endDate: "2024-01-31", organizationId: "org" };
  const result = await requestSettingsExport(input, async (url, init) => {
    assert.equal(String(url), "/api/v1/export/all?startDate=2024-01-01&endDate=2024-01-31");
    assert.equal(new Headers(init?.headers).get("x-organization-id"), "org");
    return new Response("ZIP fixture", { headers: { "content-type": "application/zip" } });
  });
  assert.equal(result.filename, "dubbl-export.zip"); assert.equal(await result.blob.text(), "ZIP fixture");
  for (const selected of [[], ["__proto__"], ["all"], ["contacts", "future"]]) {
    await assert.rejects(requestSettingsExport({ ...input, all: false, selected }, async () => { assert.fail("Invalid selection sent a request"); }));
  }
  for (const selected of [["contacts"], ["contacts", "invoices"]]) await assert.rejects(requestSettingsExport({ ...input, all: false, selected }, async () => new Response("denied", { status: 403 })));
});

test("combined settings catalogs validate and destructive copy identifies the full organization scope in both locales", () => {
  const namespaces = ["SettingsBilling", "SettingsStripe", "SettingsDocumentTemplates", "SettingsImportExport", "SettingsBackups", "SettingsTrash", "BulkImport", "SettingsDataEntities"] as const;
  for (const namespace of namespaces) {
    assert.deepEqual(Object.keys(en[namespace]).sort(), Object.keys(fa[namespace]).sort());
    const technical = new Set(["Pro", "https://example.com/logo.png"]);
    assert.ok(Object.values(fa[namespace]).every(v => technical.has(v) || /[\u0600-\u06ff]/.test(v)));
  }
  for (const locale of ["en-US", "fa-IR"] as const) {
    const t = createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace: "SettingsTrash" });
    const text = renderWithPresentation(createElement(TrashEmptyDescription), locale);
    assert.equal(text, renderWithPresentation(createElement("span", null, t("emptyDescription")), locale).slice(6, -7));
    assert.ok(!text.includes("{count}"));
    if (locale === "en-US") assert.match(text, /outside the current filters and page/);
  }
  const page = readFileSync("app/(dashboard)/settings/import-export/page.tsx", "utf8");
  assert.match(page, /await requestSettingsExport\(\{ selected: entities, all: entityKey === "all"/);
  assert.match(page, /downloadBlob\(result.blob, result.filename\)/);
  assert.match(readFileSync("app/(dashboard)/settings/trash/page.tsx", "utf8"), /<TrashEmptyDescription \/>/);
});
