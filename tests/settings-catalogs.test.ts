import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { createTranslator } from "next-intl";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { renderWithPresentation } from "./helpers/presentation";
import SettingsLayout from "../app/(dashboard)/settings/layout";
import SettingsPage from "../app/(dashboard)/settings/page";
import TagsPage from "../app/(dashboard)/settings/tags/page";
import CostCentersPage from "../app/(dashboard)/settings/cost-centers/page";
import { ProcurementSettingsForm, bpsToPercent, percentToBps } from "../components/settings/procurement-settings-form";
import { CostCenterDeleteDescription } from "../components/settings/cost-center-delete-description";
import { TagFields } from "../components/settings/tag-fields";
import { addressCountryName, paymentTermLabel } from "../i18n/settings-options";
import { countryName } from "../i18n/onboarding-options";
import { settingsErrorMessage } from "../i18n/settings-errors";
import { COUNTRIES as BUSINESS_COUNTRIES } from "../lib/data/business-types";
import { COUNTRIES } from "../lib/countries";
import { PAYMENT_TERMS } from "../lib/payment-terms";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const noop = () => {};
const locales = ["en-US", "fa-IR"] as const;

test("settings navigation translates desktop/mobile labels and preserves all destinations and detail branching", () => {
  const destinations = ["", "members", "roles", "billing", "advisors", "document-templates", "import-export", "trash", "backups", "pipelines", "bank-rules", "approval-workflows", "procurement", "webhooks", "integrations/stripe", "notifications", "reminders", "cost-centers", "tags", "api-keys", "audit-log"];
  for (const locale of locales) {
    const messages = locale === "en-US" ? en : fa;
    const render = (path: string) => renderWithPresentation(createElement(PathnameContext.Provider, { value: path }, createElement(SettingsLayout, null, createElement("p", null, "Caller content"))), locale);
    const html = render("/settings");
    for (const suffix of destinations) assert.equal(html.split(`href="/settings${suffix ? "/" + suffix : ""}"`).length - 1, 2, suffix);
    assert.ok(html.includes(messages.SettingsNavigation.organization));
    assert.ok(html.includes(messages.SettingsNavigation.billMatching));
    assert.ok(html.includes("Caller content"));
    assert.ok(!render("/settings/tags/example").includes("<nav"));
    assert.ok(render("/settings/tags").includes("<nav"));
  }
});

test("actual general settings form translates sections, labels and samples without changing defaults or native date fields", () => {
  for (const locale of locales) {
    const messages = locale === "en-US" ? en : fa;
    const html = renderWithPresentation(createElement(SettingsPage), locale);
    for (const key of ["organization", "legal", "address", "contact", "financials", "lockPastDates", "dangerZone", "saveChanges", "taxIDVAT", "registrationNumber", "businessStructure", "peppolParticipantId"] as const) assert.ok(html.includes(messages.SettingsGeneral[key]), key);
    assert.ok(html.includes(messages.LocalePreferences.title));
    assert.ok(html.includes(messages.SettingsErrors.irrUnavailable));
    assert.ok(html.includes('value="en-US"'));
    assert.ok(html.includes('value="fa-IR"'));
    assert.ok(html.includes('type="date"'));
    assert.ok(html.includes('type="email"'));
    assert.ok(html.includes('placeholder="billing@company.com"'));
    assert.ok(html.includes('aria-controls="settings-country-options"'));
    assert.ok(html.includes(messages.SettingsGeneral.acmeInc));
  }
});

test("procurement form keeps percentage inputs, basis-point conversion, switches and saving guard in both locales", () => {
  for (const locale of locales) {
    const messages = locale === "en-US" ? en : fa;
    for (const saving of [false, true]) {
      const html = renderWithPresentation(createElement(ProcurementSettingsForm, {
        saving, priceInput: "5.25", qtyInput: "1.5",
        settings: { priceTolerancePercent: 525, qtyTolerancePercent: 150, requireGrnBeforeBill: true, blockOverBill: false },
        onSave: noop, onSettingsChange: noop, onPriceChange: noop, onQtyChange: noop,
      }), locale);
      assert.ok(html.includes(messages.SettingsProcurement.allowedPriceDifference));
      assert.ok(html.includes(messages.SettingsProcurement.allowedQuantityDifference));
      assert.ok(html.includes(messages.SettingsProcurement.requireGoodsToBeReceivedFirst));
      assert.ok(html.includes(messages.SettingsProcurement.blockBillsThatChargeMoreThanOrdered));
      assert.ok(html.includes('value="5.25"'));
      assert.ok(html.includes('value="1.5"'));
      assert.equal(html.split('type="number"').length - 1, 2);
      assert.equal(html.split('step="0.01"').length - 1, 2);
      assert.ok(html.includes('aria-checked="true"'));
      assert.ok(html.includes('aria-checked="false"'));
      assert.equal(/<button[^>]*disabled=""/.test(html), saving);
      assert.ok(html.includes(saving ? messages.SettingsProcurement.saving : messages.SettingsProcurement.saveChanges));
    }
  }
  assert.equal(bpsToPercent(525), "5.25");
  assert.equal(percentToBps("5.25"), 525);
  assert.equal(percentToBps("0.01"), 1);
  for (const invalid of ["NaN", "-1", "Infinity"]) assert.equal(percentToBps(invalid), 0);
});

test("cost-center delete message preserves escaped identity, emphasis and conditional child warning", () => {
  for (const locale of locales) {
    const messages = locale === "en-US" ? en : fa;
    for (const hasChildren of [false, true]) {
      const html = renderWithPresentation(createElement(CostCenterDeleteDescription, { code: "ENG", name: '<script>org</script>', hasChildren }), locale);
      assert.ok(html.includes('ENG · &lt;script&gt;org&lt;/script&gt;'));
      assert.ok(!html.includes('<script>'));
      assert.ok(html.includes('class="font-medium text-foreground"'));
      assert.equal(html.includes(messages.SettingsCostCenters.warningThisCostCenterHasChildrenDeletingItWillOrphanItsChild), hasChildren);
    }
    const t = createTranslator({ locale, messages, namespace: "SettingsGeneral" });
    const html = renderWithPresentation(createElement("p", null, t("lockNotice", { date: "2026-10-17" })), locale);
    assert.ok(html.includes("2026-10-17"));
    assert.ok(!html.includes("{date}"));
  }
});

test("tag fields translate colors and help while retaining user text and hexadecimal identities", () => {
  const colors = ["#6b7280", "#ef4444", "#f97316", "#f59e0b", "#22c55e", "#14b8a6", "#3b82f6", "#6366f1", "#a855f7", "#ec4899"];
  for (const locale of locales) {
    const messages = locale === "en-US" ? en : fa;
    const html = renderWithPresentation(createElement(TagFields, {
      name: '<img src=x>', color: "#ef4444", description: "Caller description",
      onNameChange: noop, onColorChange: noop, onDescriptionChange: noop,
    }), locale);
    for (const color of colors) assert.ok(html.includes(`background-color:${color}`));
    for (const key of ["gray", "red", "orange", "amber", "green", "teal", "blue", "indigo", "purple", "pink"] as const) assert.ok(html.includes(`title="${messages.SettingsTags[key]}"`));
    assert.ok(html.includes('value="&lt;img src=x&gt;"'));
    assert.ok(html.includes('value="Caller description"'));
    assert.ok(html.includes(messages.SettingsTags.optionalDescription));
    assert.equal(html.split("ring-2 ring-offset-2 ring-primary").length - 1, 1);
    assert.ok(renderWithPresentation(createElement(TagsPage), locale).includes(messages.SettingsTags.addTag));
    assert.ok(renderWithPresentation(createElement(CostCentersPage), locale).includes(messages.SettingsCostCenters.newCostCenter));
  }
});

test("country and payment labels remain presentation-only and Gregorian fiscal month labels retain month numbers", () => {
  const before = JSON.stringify({ COUNTRIES, BUSINESS_COUNTRIES, PAYMENT_TERMS });
  for (const locale of locales) {
    const messages = locale === "en-US" ? en : fa;
    const t = createTranslator({ locale, messages, namespace: "SettingsGeneral" });
    const options = createTranslator({ locale, messages, namespace: "OnboardingOptions" });
    for (const country of COUNTRIES) {
      const label = addressCountryName(locale, country);
      assert.ok(label);
      if (locale === "en-US") assert.equal(label, country.name);
    }
    for (const country of BUSINESS_COUNTRIES) assert.ok(countryName(options, country));
    for (const term of PAYMENT_TERMS) {
      assert.ok(paymentTermLabel(t, term.value));
      if (locale === "en-US") assert.equal(paymentTermLabel(t, term.value), term.label);
    }
    assert.equal(t("january"), locale === "en-US" ? "January" : "ژانویه");
    assert.equal(t("december"), locale === "en-US" ? "December" : "دسامبر");
  }
  assert.equal(addressCountryName("fa-IR", { code: "IR", name: "Iran" }), "ایران");
  assert.equal(addressCountryName("fa-IR", { code: "constructor", name: "Caller country" }), "Caller country");
  const displayNames = Intl.DisplayNames;
  try {
    Object.defineProperty(Intl, "DisplayNames", { value: undefined, configurable: true });
    assert.equal(addressCountryName("fa-IR", { code: "IR", name: "Iran" }), "Iran");
  } finally {
    Object.defineProperty(Intl, "DisplayNames", { value: displayNames, configurable: true });
  }
  assert.equal(JSON.stringify({ COUNTRIES, BUSINESS_COUNTRIES, PAYMENT_TERMS }), before);
});

test("settings errors localize currency-history restrictions and reject unknown server/network prose", () => {
  const cases = [
    ["Organization not found", "organizationMissing"], ["Tag not found", "tagMissing"],
    ["Insufficient permissions", "forbidden"], ["Not authenticated", "unauthenticated"],
    ["Base currency can't be changed once transactions exist", "currencyTransactions"],
    ["Base currency can't be changed with payroll-run history", "currencyPayroll"],
    ["Base currency can't be changed with asset, category or loan history", "currencyAssets"],
    ["Base currency can't be changed with accrual schedule history", "currencyAccruals"],
    ["IRR functional currency is disabled pending financial qualification", "irrUnavailable"],
  ] as const;
  for (const locale of locales) {
    const messages = locale === "en-US" ? en : fa;
    const t = createTranslator({ locale, messages, namespace: "SettingsErrors" });
    for (const [error, key] of cases) assert.equal(settingsErrorMessage(t, error, "fallback"), messages.SettingsErrors[key]);
    for (const value of [undefined, {}, "constructor", "__proto__", '<script>server</script>', "Network error"]) {
      assert.equal(settingsErrorMessage(t, value, "fallback"), "fallback");
      for (const status of [400, 422]) assert.equal(settingsErrorMessage(t, value, "fallback", status), messages.SettingsErrors.invalidInput);
      assert.equal(settingsErrorMessage(t, value, "fallback", 403), messages.SettingsErrors.forbidden);
      assert.equal(settingsErrorMessage(t, value, "fallback", 401), messages.SettingsErrors.unauthenticated);
    }
  }
});

test("core settings source audit leaves no hardcoded JSX prose or display attributes", () => {
  const paths = [
    ...["layout.tsx", "loading.tsx", "page.tsx", "procurement/page.tsx", "cost-centers/page.tsx", "tags/page.tsx"].map(path => "app/(dashboard)/settings/" + path),
    ...["procurement-settings-form", "cost-center-delete-description", "tag-fields"].map(path => "components/settings/" + path + ".tsx"),
  ];
  for (const path of paths) {
    const source = readFileSync(path, "utf8");
    const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(node: ts.Node) {
      if (ts.isJsxText(node)) assert.ok(!/[A-Za-z]/.test(node.text), `${path}: ${node.text.trim()}`);
      if (ts.isJsxAttribute(node) && ["placeholder", "aria-label", "title", "description", "alt"].includes(node.name.getText(ast))) assert.ok(!node.initializer || !ts.isStringLiteral(node.initializer), `${path}: ${node.getText(ast)}`);
      ts.forEachChild(node, visit);
    }
    visit(ast);
  }
  for (const [namespace, messages] of Object.entries(fa).filter(([name]) => name.startsWith("Settings"))) {
    for (const [key, value] of Object.entries(messages)) assert.ok(!/\?{2,}/.test(value), `${namespace}.${key}: encoding corruption`);
  }
});
