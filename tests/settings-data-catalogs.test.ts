import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement, type ComponentProps } from "react";
import { createTranslator } from "next-intl";
import { readFileSync } from "node:fs";
import ts from "typescript";
import ImportExportPage from "../app/(dashboard)/settings/import-export/page";
import BackupsPage from "../app/(dashboard)/settings/backups/page";
import TrashPage from "../app/(dashboard)/settings/trash/page";
import { BulkImportWizardContent } from "../components/bulk-import-wizard";
import { Sheet } from "../components/ui/sheet";
import { BackupList, TrashList, ImportJobHistory, BackupRestoreDescription, BackupDeleteDescription, TrashDeleteDescription, TrashEmptyDescription, type Backup, type TrashItem } from "../components/settings/data-management-content";
import { importOptions } from "../components/settings/import-options";
import { backupTypeLabel, formatBackupSize, formatEntitySummary, importEntityLabel, importStatusLabel, trashEntityLabel, trashEntityOptions, trashRelativeTime } from "../i18n/data-presentation";
import { autoMapColumns, mapImportRows, csvFailureMessage, importRowError } from "../i18n/import-presentation";
import { parseCSV } from "../lib/import-export/csv-utils";
import { getMapping, aliasesToRecord } from "../lib/import-export/mappings";
import { renderWithPresentation } from "./helpers/presentation";
import contracts from "./fixtures/settings-data-contracts.json";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const locales = ["en-US", "fa-IR"] as const;
const noop = () => {};
const escaped = (text: string) => renderWithPresentation(createElement("span", null, text)).slice(6, -7);
const sampleName = '<script>نام " & {{caller}}';
const backup: Backup = { id: "backup-id", type: "manual", status: "completed", sizeBytes: 2048, entityCounts: { accounts: 2, contacts: 0, invoices: 3, futureEntity: 1, bills: 4 }, createdAt: "2026-10-17T00:00:00Z", expiresAt: null };
const item: TrashItem = { id: "item-id", name: sampleName, entityType: "invoice", label: "Server English label", deletedAt: "2026-10-17T00:00:00Z" };

test("import display catalogs preserve all original source/entity/field identities and English labels", () => {
  for (const locale of locales) {
    const messages = locale === "en-US" ? en : fa;
    const t = createTranslator({ locale, messages, namespace: "SettingsImportExport" });
    const options = importOptions(t);
    assert.deepEqual(options.SOURCES.map(s => s.key), contracts.options.SOURCES.map(s => s.key));
    for (const [i, entity] of options.ENTITIES.entries()) {
      const original = contracts.options.ENTITIES[i];
      assert.equal(entity.key, original.key);
      assert.equal(entity.previewEndpoint, original.previewEndpoint);
      assert.equal(entity.importEndpoint, original.importEndpoint);
      assert.deepEqual(entity.targetFields.map(f => ({ ...f, label: f.matchLabel })), original.targetFields.map(f => ({ ...f, matchLabel: f.label })));
      if (locale === "en-US") {
        assert.equal(entity.label, original.label);
        assert.equal(entity.note, original.note);
        assert.deepEqual(entity.targetFields.map(f => Object.fromEntries(Object.entries(f).filter(([key]) => key !== "matchLabel"))), original.targetFields);
      } else {
        assert.notEqual(entity.label, original.label);
        assert.ok(entity.targetFields.every(f => /[\u0600-\u06ff]/.test(f.label)));
      }
    }
    assert.deepEqual(options.EXPORT_ENTITIES.map(({ key, transactional }) => ({ key, transactional })), contracts.options.EXPORT_ENTITIES.map(({ key, transactional }) => ({ key, transactional })));
    if (locale === "en-US") assert.deepEqual(options.SOURCES, contracts.options.SOURCES);
    for (const value of ["future_type", "__proto__", "constructor"]) {
      assert.equal(importEntityLabel(t, value), value);
      assert.equal(importStatusLabel(t, value), value);
    }
  }
});

test("actual CSV parsing and auto-mapping retain canonical headers, aliases and exact cell text in both locales", () => {
  for (const locale of locales) {
    const messages = locale === "en-US" ? en : fa;
    const t = createTranslator({ locale, messages, namespace: "SettingsImportExport" });
    const { SOURCES, ENTITIES } = importOptions(t);
    for (const entity of ENTITIES) {
      for (const field of entity.targetFields) {
        assert.deepEqual(autoMapColumns([field.key.toUpperCase(), field.matchLabel!], entity.targetFields).map(m => m.targetField), [field.key, field.key]);
      }
      for (const source of SOURCES) {
        const aliases = aliasesToRecord(getMapping(source.key, entity.key));
        for (const [target, headers] of Object.entries(aliases)) {
          if (!entity.targetFields.some(f => f.key === target)) continue;
          for (const header of headers) {
            const mapped = autoMapColumns([header], entity.targetFields, aliases)[0];
            const exact = entity.targetFields.find(f => f.key.toLowerCase() === header.toLowerCase() || f.matchLabel?.toLowerCase() === header.toLowerCase());
            assert.equal(mapped.targetField, exact?.key ?? entity.targetFields.find(f => aliases[f.key]?.some(alias => alias.toLowerCase() === header.toLowerCase()))?.key);
          }
        }
      }
    }
    const fields = ENTITIES.find(e => e.key === "products")!.targetFields;
    const parsed = parseCSV('\uFEFFName,Unit Price (minor units),unused\r\n"کالای, دقیق",9007199254740991,"<script>"\r\n"Second",0001250,keep');
    const mappings = autoMapColumns(parsed.headers, fields);
    assert.deepEqual(mappings.map(m => m.targetField), ["name", "unitPriceMinor", ""]);
    assert.deepEqual(mapImportRows(parsed.rows, mappings), [
      { name: "کالای, دقیق", unitPriceMinor: "9007199254740991" },
      { name: "Second", unitPriceMinor: "0001250" },
    ]);
    assert.equal(autoMapColumns(["نام"], fields)[0].targetField, ""); // Display translations never become machine aliases.
    assert.equal(autoMapColumns(["x"], [{ key: "x", label: "X" }, { key: "other", label: "Other" }], { other: ["x"] })[0].targetField, "x");
  }
});

test("real page shells and loaded history, backup and trash views render paired catalogs and escaped data", () => {
  for (const locale of locales) {
    const messages = locale === "en-US" ? en : fa;
    const t = createTranslator({ locale, messages, namespace: "SettingsImportExport" });
    const bt = createTranslator({ locale, messages, namespace: "SettingsBackups" });
    const tt = createTranslator({ locale, messages, namespace: "SettingsTrash" });
    const output = renderWithPresentation(createElement(ImportExportPage), locale);
    for (const key of ["importExport", "importData", "exportData", "selectYourSourceSystem", "exportAllAsZIP", "customCSV"] as const) assert.ok(output.includes(escaped(t(key))), key);
    assert.ok(output.includes("<strong>"));
    assert.ok(output.includes("OFX/QFX/QBO"));
    assert.ok(renderWithPresentation(createElement(TrashPage), locale).includes(escaped(tt("trash"))));
    assert.ok(renderWithPresentation(createElement(BackupsPage), locale).length > 0);

    const jobs = ["completed", "failed", "processing", "pending"].map((status, i) => ({ id: String(i), type: "accounts", fileName: sampleName + ".csv", status, totalRows: 10, processedRows: 3, errorRows: i, createdAt: backup.createdAt }));
    const history = renderWithPresentation(createElement(ImportJobHistory, { jobs }), locale);
    for (const job of jobs) assert.ok(history.includes(escaped(importStatusLabel(t, job.status))));
    assert.ok(history.includes(escaped(t("chartOfAccounts"))));
    assert.ok(history.includes(escaped(sampleName + ".csv")));
    assert.ok(history.includes("3/10"));
    assert.ok(!history.includes("<script>"));
    assert.equal(renderWithPresentation(createElement(ImportJobHistory, { jobs: [] }), locale), "");

    const props = { page: 1, totalPages: 2, restoringId: backup.id, deletingId: null, handleDownload: noop, setRestoreBackup: noop, setDeleteBackup: noop, setPage: noop };
    const backups = renderWithPresentation(createElement(BackupList, { ...props, backups: [backup, { ...backup, id: "uploaded", type: "uploaded", expiresAt: "2026-11-17" }, { ...backup, id: "scheduled", type: "scheduled" }] }), locale);
    for (const type of ["manual", "uploaded", "scheduled"]) assert.ok(backups.includes(escaped(backupTypeLabel(bt, type))));
    assert.ok(backups.includes('disabled=""'));
    assert.ok(backups.includes('title="' + bt("restore") + '"'));
    assert.ok(backups.includes("2.0 KB"));
    assert.ok(backups.includes(escaped(bt("pageOf", { page: 1, total: 2 }))));
    assert.ok(renderWithPresentation(createElement(BackupList, { ...props, backups: [] }), locale).includes(escaped(bt("noBackupsYet"))));

    const trash = renderWithPresentation(createElement(TrashList, { items: [item, { ...item, id: "backup", name: null, entityType: "data_backup" }], handleRestore: noop, setDeleteItem: noop }), locale);
    assert.ok(trash.includes(escaped(sampleName)));
    assert.ok(trash.includes(escaped(tt("invoice"))));
    assert.ok(trash.includes(escaped(tt("backup"))));
    assert.ok(!trash.includes("Server English label"));
    assert.ok(!trash.includes("<script>"));
    assert.ok(renderWithPresentation(createElement(TrashList, { items: [], handleRestore: noop, setDeleteItem: noop }), locale).includes(escaped(tt("trashIsEmpty"))));
  }
});

const wizardDefaults: ComponentProps<typeof BulkImportWizardContent> = {
  title: sampleName, step: "upload", csvData: [{ name: "x" }], csvHeaders: [sampleName], mappings: [{ csvColumn: sampleName, targetField: "" }],
  preview: [{ row: 1, valid: false, data: { name: sampleName }, errors: ["<script>server-secret"] }], validCount: 0, fileName: sampleName + ".csv",
  result: { processedRows: 1, errorRows: 1, errorDetails: [{ row: 2, error: "server-secret" }] }, loading: false, error: null, dragActive: false,
  fileInputRef: { current: null }, targetFields: [{ key: "name", label: "Caller field", required: true }],
  setDragActive: noop, setMappings: noop, reset: noop, handleDrop: noop, handleFileUpload: noop, handlePreview: noop, handleImport: noop, setStep: noop, onOpenChange: noop,
};

test("all five real wizard states translate their descriptions, counts, actions and row errors", () => {
  for (const locale of locales) {
    const messages = locale === "en-US" ? en : fa;
    const t = createTranslator({ locale, messages, namespace: "BulkImport" });
    const render = (changes: Partial<typeof wizardDefaults>) => renderWithPresentation(createElement(Sheet, { open: true }, createElement(BulkImportWizardContent, { ...wizardDefaults, ...changes })), locale);
    const upload = render({});
    assert.ok(upload.includes(escaped(t("dropYourCSVFileHere"))));
    assert.ok(upload.includes('accept=".csv"'));
    assert.ok(!upload.includes("<script>"));
    const mapping = render({ step: "mapping" });
    assert.ok(mapping.includes(escaped(t("mapFile", { fileName: wizardDefaults.fileName }))));
    assert.ok(mapping.includes(escaped(t("requiredFieldsMissing"))));
    assert.ok(mapping.includes('disabled=""'));
    assert.ok(!render({ step: "mapping", mappings: [{ csvColumn: sampleName, targetField: "name" }] }).includes('disabled=""'));
    assert.ok(render({ step: "mapping", mappings: [{ csvColumn: sampleName, targetField: "name" }], loading: true }).includes('disabled=""'));
    const preview = render({ step: "preview" });
    assert.ok(preview.includes(escaped(t("validCount", { count: 0 }))));
    assert.ok(preview.includes(escaped(t("invalidCount", { count: 1 }))));
    assert.ok(preview.includes(escaped(t("invalidRowCheckTheMappedValues"))));
    assert.ok(!preview.includes("server-secret"));
    assert.ok(preview.includes('disabled=""'));
    assert.ok(!render({ step: "preview", validCount: 1 }).includes('disabled=""'));
    const importing = render({ step: "importing" });
    assert.ok(importing.includes(escaped(t("importingRows", { count: 1 }))));
    assert.ok(!importing.includes("<button"));
    const result = render({ step: "results" });
    assert.ok(result.includes(escaped(t("imported"))));
    assert.ok(result.includes(escaped(t("rowError", { row: 2, error: t("invalidRowCheckTheMappedValues") }))));
    assert.ok(result.includes(escaped(t("close"))));
    assert.ok(!result.includes("server-secret"));
    assert.ok(render({ error: t("previewFailed") }).includes('role="alert"'));
  }
});

test("destructive descriptions escape names and describe organization-wide emptying regardless of filters", () => {
  for (const locale of locales) {
    const messages = locale === "en-US" ? en : fa;
    const tt = createTranslator({ locale, messages, namespace: "SettingsTrash" });
    const bt = createTranslator({ locale, messages, namespace: "SettingsBackups" });
    assert.equal(renderWithPresentation(createElement(TrashDeleteDescription, { item }), locale), escaped(tt("deleteDescription", { name: sampleName })));
    assert.equal(renderWithPresentation(createElement(TrashDeleteDescription, { item: { ...item, name: null } }), locale), escaped(tt("deleteDescription", { name: tt("invoice") })));
    assert.equal(renderWithPresentation(createElement(TrashEmptyDescription), locale), escaped(tt("emptyDescription")));
    const date = "2026-10-17 10:00 <script>";
    assert.equal(renderWithPresentation(createElement(BackupRestoreDescription, { date }), locale), escaped(bt("restoreDescription", { date })));
    assert.equal(renderWithPresentation(createElement(BackupDeleteDescription, { date }), locale), escaped(bt("deleteDescription", { date })));
  }
});

test("CSV errors are localized from actual parser issues; unknown/server/prototype prose uses reviewed fallback", () => {
  const bad = [
    ["x".repeat(5000001), "maximumCSVSizeIs5MB"],
    ["name\n" + "x\n".repeat(1001), "maximum1000CSVDataRows"],
    ['name\na"b', "malformedCSVQuote"],
    ['name\n"a"b', "unexpectedTextAfterQuotedField"],
    ['name\n"a', "unterminatedCSVQuote"],
    ["name", "cSVRequiresAHeaderAndDataRow"],
    ["name,NAME\nx,y", "emptyOrDuplicateCSVHeaders"],
    ["name,type\nx", "cSVColumnCountDoesNotMatchHeader"],
  ] as const;
  for (const locale of locales) {
    const messages = locale === "en-US" ? en : fa;
    const t = createTranslator({ locale, messages, namespace: "BulkImport" });
    for (const [input, key] of bad) {
      assert.throws(() => { try { parseCSV(input); } catch (error) { assert.equal(csvFailureMessage(t, error), t(key)); throw error; } });
    }
    for (const error of [new Error("Maximum CSV size is 5 MB"), new Error("secret"), null, "__proto__", "constructor"]) assert.equal(csvFailureMessage(t, error), t("invalidCSV"));
    for (const message of ["__proto__", "constructor", "<script>server text", { error: "secret" }]) assert.equal(importRowError(t, message), t("invalidRowCheckTheMappedValues"));
    assert.equal(importRowError(t, "Malformed CSV quote"), t("malformedCSVQuote"));
  }
});

test("entity, size and relative-time helpers preserve filtering, thresholds, summary limits and unknown identities", () => {
  const now = Date.parse("2026-10-17T12:00:00Z");
  for (const locale of locales) {
    const messages = locale === "en-US" ? en : fa;
    const t = createTranslator({ locale, messages, namespace: "SettingsTrash" });
    const e = createTranslator({ locale, messages, namespace: "SettingsDataEntities" });
    assert.deepEqual(trashEntityOptions(t).map(e => e.value), contracts.types.map(e => e.value));
    if (locale === "en-US") assert.deepEqual(trashEntityOptions(t), contracts.types);
    for (const value of ["future", "__proto__", "constructor"]) assert.equal(trashEntityLabel(t, value), value);
    for (const [minutes, expected] of [[0, t("justNow")], [59, t("minutesAgo", { count: 59 })], [60, t("hoursAgo", { count: 1 })], [1439, t("hoursAgo", { count: 23 })], [1440, t("daysAgo", { count: 1 })], [10079, t("daysAgo", { count: 6 })]] as const) assert.equal(trashRelativeTime(t, new Date(now - minutes * 60000).toISOString(), now), expected);
    assert.equal(trashRelativeTime(t, new Date(now - 7 * 86400000).toISOString(), now), new Date(now - 7 * 86400000).toLocaleDateString());
    assert.equal(formatEntitySummary(e, backup.entityCounts), `2 ${e("accounts")}, 3 ${e("invoices")}, 1 futureEntity`);
    assert.equal(formatEntitySummary(e, { accounts: 0 }), "-");
    assert.equal(formatEntitySummary(e, null), "-");
  }
  assert.deepEqual([null, 0, 1023, 1024, 1048576].map(formatBackupSize), ["-", "-", "1023 B", "1.0 KB", "1.0 MB"]);
});

test("HTTP methods, org headers, confirmation bodies, dates, columns and file names retain pre-extraction contracts", () => {
  for (const [path, expected] of Object.entries(contracts.requests)) {
    const sf = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const actual: string[] = [];
    function visit(node: ts.Node) {
      if (ts.isCallExpression(node) && ["fetch", "JSON.stringify", "downloadBlob", "params.set", "form.append"].includes(node.expression.getText(sf))) actual.push(node.getText(sf).replace(/\s+/g, " "));
      if (ts.isBinaryExpression(node) && node.left.getText(sf) === "a.download") actual.push(node.getText(sf).replace(/\s+/g, " "));
      ts.forEachChild(node, visit);
    }
    visit(sf);
    assert.deepEqual(actual, expected, path);
  }
});

test("bounded data-settings JSX has no remaining authored English text or literal translated attributes", () => {
  for (const path of [...Object.keys(contracts.requests), "components/settings/data-management-content.tsx"]) {
    const sf = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(node: ts.Node) {
      if (ts.isJsxText(node)) assert.ok(!/[a-z]/i.test(node.text), path + ": " + node.text);
      if (ts.isJsxAttribute(node) && ["title", "placeholder", "aria-label"].includes(node.name.getText(sf))) assert.ok(!node.initializer || !ts.isStringLiteral(node.initializer), node.getText(sf));
      ts.forEachChild(node, visit);
    }
    visit(sf);
  }
  for (const namespace of [fa.SettingsImportExport, fa.SettingsBackups, fa.SettingsTrash, fa.BulkImport, fa.SettingsDataEntities]) assert.ok(Object.values(namespace).every(value => /[\u0600-\u06ff]/.test(value) && !/[\ufffd]|\?{2,}/.test(value)));
});
