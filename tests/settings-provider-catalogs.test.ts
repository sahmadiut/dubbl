import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement, type ComponentProps } from "react";
import { createTranslator } from "next-intl";
import { readFileSync } from "node:fs";
import ts from "typescript";
import BillingPage from "../app/(dashboard)/settings/billing/page";
import StripePage from "../app/(dashboard)/settings/integrations/stripe/page";
import { BillingContent } from "../components/settings/billing-content";
import { IntegrationCard } from "../components/settings/stripe-integration-card";
import { stripeOAuthError, stripeStatusLabel } from "../i18n/provider-presentation";
import { renderWithPresentation } from "./helpers/presentation";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const locales = ["en-US", "fa-IR"] as const;
const noop = () => {};
const defaults: ComponentProps<typeof BillingContent> = {
  billing: null, selfHosted: false, loading: false, error: null,
  checkoutLoading: null, portalLoading: false, interval: "monthly",
  setInterval: noop, checkout: noop, openPortal: noop,
};

test("billing renders free, Pro, annual, self-hosted, failure and loading branches in both catalogs", () => {
  for (const locale of locales) {
    const messages = locale === "en-US" ? en : fa;
    if (locale === "fa-IR") {
      assert.equal(messages.SettingsBilling.teamSeats, "ظرفیت اعضای تیم");
      assert.equal(messages.SettingsBilling.renewsOn, "تمدید در {date}");
      assert.ok(!Object.values(messages.SettingsBilling).some(value => /\?{2,}|�/.test(value)));
      assert.ok(!Object.values(messages.SettingsStripe).some(value => /\?{2,}|�/.test(value)));
    }
    const render = (props: Partial<typeof defaults>) => renderWithPresentation(createElement(BillingContent, { ...defaults, ...props }), locale);
    const free = render({});
    assert.ok(free.includes(messages.SettingsBilling.teamSeats));
    assert.ok(free.includes(messages.SettingsBilling.organizationStorage));
    assert.ok(free.includes(messages.SettingsBilling.upgradeToPro));
    for (const size of ["5 GB", "25 GB", "75 GB", "300 GB"]) assert.ok(free.includes(size));
    for (const price of ["$0", "$15", "$45", "$120"]) assert.ok(free.includes(price));
    const billing = { plan: "pro", status: "active", seatCount: 2, currentPeriodEnd: "2026-10-17T00:00:00Z", cancelAtPeriodEnd: false, billingInterval: "annual", storagePlan: "growth", storageUsedBytes: 76800 * 1024 * 1024, emailsPerMonth: 100, emailsSentThisMonth: 99 } as const;
    const annual = render({ billing, interval: "annual" });
    assert.ok(annual.includes("$120")); // Annual seat charge remains 10 * 12 USD.
    assert.ok(annual.includes("$13"));
    assert.ok(annual.includes("$38"));
    assert.ok(annual.includes(messages.SettingsBilling.storageAlmostFullConsiderUpgradingYourPlan));
    assert.ok(annual.includes(messages.SettingsBilling.emailLimitAlmostReachedUpgradeYourStoragePlanFor));
    assert.ok(annual.includes(messages.SettingsBilling.manageBilling));
    const t = createTranslator({ locale, messages, namespace: "SettingsBilling" });
    assert.ok(annual.includes(t("currentSeats", { count: 2 })));
    for (const count of [0, 1, 2, 10000]) {
      assert.ok(!t("monthlyEmails", { count }).includes("{"));
      assert.ok(!t("currentSeats", { count }).includes("{"));
    }
    const date = new Date(billing.currentPeriodEnd).toLocaleDateString();
    assert.ok(annual.includes(t("renewsOn", { date })));
    assert.ok(render({ billing: { ...billing, cancelAtPeriodEnd: true } }).includes(t("cancelsOn", { date })));
    assert.ok(render({ selfHosted: true }).includes(messages.SettingsBilling.allFeaturesUnlocked));
    assert.ok(!render({ selfHosted: true }).includes(messages.SettingsBilling.teamSeats));
    assert.ok(render({ error: '<script>"&' }).includes('&lt;script&gt;&quot;&amp;'));
    assert.ok(renderWithPresentation(createElement(BillingPage), locale).length > 0);
    assert.ok(renderWithPresentation(createElement(StripePage), locale).length > 0);
    assert.ok(render({ checkoutLoading: "pro" }).includes("disabled=\"\""));
  }
});

test("Stripe cards translate status/mapping copy, preserve data and disable sync until configured", () => {
  for (const locale of locales) {
    const messages = locale === "en-US" ? en : fa;
    const t = createTranslator({ locale, messages, namespace: "SettingsStripe" });
    const integration = { id: "integration-id", connected: true, label: '<script>Caller & Stripe', status: "active", stripeAccountId: "acct_123456789012345", livemode: true, errorMessage: "untrusted provider prose" };
    const props: ComponentProps<typeof IntegrationCard> = { integration, accounts: [], bankAccounts: [], syncing: false, disconnecting: false, onSync: noop, onDisconnect: noop, onUpdateMapping: noop };
    const render = (changes: Partial<typeof props> = {}) => renderWithPresentation(createElement(IntegrationCard, { ...props, ...changes }), locale);
    const missing = render();
    assert.ok(missing.includes('&lt;script&gt;Caller &amp; Stripe'));
    assert.ok(missing.includes("acct_123...2345"));
    assert.ok(missing.includes(messages.SettingsStripe.accountMappingsRequired));
    assert.ok(missing.includes(messages.SettingsStripe.providerError));
    assert.ok(!missing.includes(integration.errorMessage));
    assert.match(missing, /disabled=""[^>]*>[\s\S]*?<\/button>/);
    for (const field of ["clearingAccountAsset", "revenueAccount", "feesAccountExpense", "payoutBankAccount"] as const) assert.ok(missing.includes(messages.SettingsStripe[field]));
    const configured = render({ integration: { ...integration, clearingAccountId: "a", revenueAccountId: "b", feesAccountId: "c", status: "disconnected", livemode: false, lastSyncAt: "2026-10-17T00:00:00Z" } });
    assert.ok(!configured.includes(messages.SettingsStripe.accountMappingsRequired));
    assert.ok(!configured.includes('disabled=""'));
    assert.ok(configured.includes(t("disconnected")));
    assert.ok(configured.includes(t("test")));
    assert.ok(configured.includes(t("initialSyncInProgress")));
    assert.ok(render({ syncing: true, disconnecting: true }).split('disabled=""').length >= 3);
    for (const code of ["account_already_connected", "missing_params", "invalid_state", "oauth_failed", "server_error"]) assert.notEqual(stripeOAuthError(t, code), t("connectionFailed"));
    for (const unknown of ["<script>", "__proto__", "constructor", ""]){
      assert.equal(stripeOAuthError(t, unknown), t("connectionFailed"));
      assert.equal(stripeStatusLabel(t, unknown), t("unknownStatus"));
    }
  }
});

// Captured from the pre-extraction provider pages; independent of future Git HEAD.
const requestContracts: Record<string, string[]> = {
  "app/(dashboard)/settings/billing/page.tsx": [
    "fetch(\"/api/v1/billing\", { headers: { \"x-organization-id\": orgId }, })",
    "fetch(\"/api/v1/billing/checkout\", { method: \"POST\", headers: { \"Content-Type\": \"application/json\", \"x-organization-id\": orgId, }, body: JSON.stringify({ type, plan, interval }), })",
    "JSON.stringify({ type, plan, interval })",
    "fetch(\"/api/v1/billing/portal\", { method: \"POST\", headers: { \"x-organization-id\": orgId }, })"
  ],
  "app/(dashboard)/settings/integrations/stripe/page.tsx": [
    "fetch(\"/api/v1/integrations/stripe/status\", { headers: orgHeaders(), })",
    "fetch(\"/api/v1/accounts\", { headers: orgHeaders() })",
    "fetch(\"/api/v1/bank-accounts\", { headers: orgHeaders() })",
    "fetch(\"/api/v1/integrations/stripe/connect\", { headers: orgHeaders(), })",
    "fetch(\"/api/v1/integrations/stripe/sync\", { method: \"POST\", headers: orgHeaders({ \"Content-Type\": \"application/json\" }), body: JSON.stringify({ integrationId }), })",
    "JSON.stringify({ integrationId })",
    "fetch(\"/api/v1/integrations/stripe/disconnect\", { method: \"POST\", headers: orgHeaders({ \"Content-Type\": \"application/json\" }), body: JSON.stringify({ integrationId }), })",
    "JSON.stringify({ integrationId })",
    "fetch(\"/api/v1/integrations/stripe/settings\", { method: \"PATCH\", headers: orgHeaders({ \"Content-Type\": \"application/json\" }), body: JSON.stringify({ integrationId, [field]: value }), })",
    "JSON.stringify({ integrationId, [field]: value })"
  ]
};

test("provider HTTP requests retain their exact existing endpoints, methods, organization headers and payloads", () => {
  function requests(source: string) {
    const sf = ts.createSourceFile("source.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const result: string[] = [];
    function visit(node: ts.Node) {
      if (ts.isCallExpression(node) && (node.expression.getText(sf) === "fetch" || node.expression.getText(sf) === "JSON.stringify")) result.push(node.getText(sf).replace(/\s+/g, " "));
      ts.forEachChild(node, visit);
    }
    visit(sf); return result;
  }
  for (const path of ["app/(dashboard)/settings/billing/page.tsx", "app/(dashboard)/settings/integrations/stripe/page.tsx"]) {
    assert.deepEqual(requests(readFileSync(path, "utf8")), requestContracts[path]);
  }
});

test("bounded provider JSX has no remaining authored English text or untranslated label attributes", () => {
  for (const path of ["app/(dashboard)/settings/billing/page.tsx", "app/(dashboard)/settings/integrations/stripe/page.tsx", "components/settings/billing-content.tsx", "components/settings/stripe-integration-card.tsx"]) {
    const sf = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(node: ts.Node) {
      if (ts.isJsxText(node)) assert.ok(!/[a-z]/i.test(node.text), node.text);
      if (ts.isJsxAttribute(node) && ["title", "placeholder", "aria-label"].includes(node.name.getText(sf))) assert.ok(!node.initializer || !ts.isStringLiteral(node.initializer), node.getText(sf));
      ts.forEachChild(node, visit);
    }
    visit(sf);
  }
});
