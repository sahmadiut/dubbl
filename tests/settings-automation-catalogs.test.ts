import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { createTranslator } from "next-intl";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { renderWithPresentation } from "./helpers/presentation";
import BankRulesPage from "../app/(dashboard)/settings/bank-rules/page";
import ApprovalWorkflowsPage from "../app/(dashboard)/settings/approval-workflows/page";
import WebhooksPage from "../app/(dashboard)/settings/webhooks/page";
import { NotificationPreferencesForm, buildDefaultState, mergePrefs, preferencePayload } from "../components/settings/notification-preferences-form";
import { ReminderTemplateFields, REMINDER_VARIABLES } from "../components/settings/reminder-template-fields";
import { ApprovalConditionHelp } from "../components/settings/approval-condition-help";
import { summarizeRule, bankFieldLabels, opsForField, type BankRule } from "../i18n/bank-rule-presentation";
import { createPipelineStages, pipelineAnnouncements } from "../i18n/pipeline-stages";
import { settingsErrorMessage, SettingsRequestError } from "../i18n/settings-errors";
import { webhookStatusLabel } from "../i18n/webhook-status";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const locales = ["en-US", "fa-IR"] as const;
const noop = () => {};

test("actual automation pages render translated headings and actions through the production provider", () => {
  for (const locale of locales) {
    const messages = locale === "en-US" ? en : fa;
    const bank = renderWithPresentation(createElement(BankRulesPage), locale);
    assert.ok(bank.includes(messages.SettingsBankRules.bankRules));
    assert.ok(bank.includes(messages.SettingsBankRules.getSuggestions));
    assert.ok(bank.includes(messages.SettingsBankRules.addRule));
    const approvals = renderWithPresentation(createElement(ApprovalWorkflowsPage), locale);
    assert.ok(approvals.includes(messages.SettingsApprovals.approvalWorkflows));
    assert.ok(approvals.includes(messages.SettingsApprovals.createWorkflow));
    const webhooks = renderWithPresentation(createElement(WebhooksPage), locale);
    assert.ok(webhooks.includes(messages.SettingsWebhooks.webhooks));
    assert.ok(webhooks.includes(messages.SettingsWebhooks.addWebhook));
  }
});

test("loaded notification controls preserve type IDs, both channel defaults, save guards and digest branches", () => {
  const types = ["invoice_overdue", "payment_received", "inventory_low", "payroll_due", "approval_needed", "system_alert", "task_assigned"];
  for (const locale of locales) for (const saving of [false, true]) for (const email of [false, true]) {
    const messages = locale === "en-US" ? en : fa;
    const prefs = buildDefaultState();
    prefs.invoice_overdue.email = email;
    const html = renderWithPresentation(createElement(NotificationPreferencesForm, {
      prefs, saving, onSave: noop, onToggleInApp: noop, onToggleEmail: noop,
    }), locale);
    for (const type of types) for (const suffix of ["inapp", "email"]) {
      assert.ok(html.includes(`id="${type}-${suffix}"`));
    }
    assert.equal(html.split('role="switch"').length - 1, 14);
    assert.equal(html.split('aria-checked="true"').length - 1, email ? 8 : 7);
    assert.equal(html.includes(messages.SettingsNotifications.emailDebounce), email);
    assert.equal(/<button[^>]*disabled=""/.test(html), saving);
    assert.ok(html.includes(messages.SettingsNotifications[saving ? "saving" : "saveChanges"]));
    assert.ok(html.includes(messages.SettingsNotifications.whenAnInvoicePassesItsDueDate));
    assert.ok(html.includes('aria-label="' + messages.SettingsNotifications.emailFor.replace("{type}", messages.SettingsNotifications.invoiceOverdue) + '"'));
  }
});

test("notification payload stays ASCII and keeps independent in_app/email settings and 120-minute email digest", () => {
  const prefs = mergePrefs([
    { type: "invoice_overdue", channel: "email", enabled: true, digestIntervalMinutes: 120 },
    { type: "inventory_low", channel: "in_app", enabled: false, digestIntervalMinutes: 0 },
    { type: "unknown_future_type", channel: "email", enabled: true, digestIntervalMinutes: 120 },
  ]);
  const payload = preferencePayload(prefs);
  assert.equal(payload.length, 14);
  assert.deepEqual(payload.find(p => p.type === "invoice_overdue" && p.channel === "email"), { type: "invoice_overdue", channel: "email", enabled: true, digestIntervalMinutes: 120 });
  assert.deepEqual(payload.find(p => p.type === "inventory_low" && p.channel === "in_app"), { type: "inventory_low", channel: "in_app", enabled: false, digestIntervalMinutes: 0 });
  assert.ok(payload.filter(p => p.channel === "email").every(p => p.digestIntervalMinutes === 120));
  assert.ok(payload.filter(p => p.channel === "in_app").every(p => p.digestIntervalMinutes === 0));
  assert.ok(!JSON.stringify(payload).includes("unknown_future_type"));
  assert.deepEqual(mergePrefs([]), buildDefaultState());
});

test("real reminder template fields localize labels while retaining literal double-brace examples and escaped user templates", () => {
  assert.deepEqual(REMINDER_VARIABLES.map(v => v.value), ["{{contactName}}", "{{documentNumber}}", "{{amountDue}}", "{{dueDate}}", "{{organizationName}}", "{{daysOverdue}}"]);
  for (const locale of locales) {
    const messages = locale === "en-US" ? en : fa;
    const html = renderWithPresentation(createElement(ReminderTemplateFields, {
      subjectTemplate: '<script>{{documentNumber}}</script>', bodyTemplate: '<img src=x> {{contactName}}', onChange: noop, onInsert: noop,
    }), locale);
    assert.ok(html.includes(messages.SettingsReminders.subjectTemplate));
    assert.ok(html.includes(messages.SettingsReminders.bodyTemplate));
    assert.ok(html.includes("{{documentNumber}}"));
    assert.ok(html.includes("{{contactName}}"));
    assert.ok(html.includes('&lt;script&gt;{{documentNumber}}&lt;/script&gt;'));
    assert.ok(html.includes('&lt;img src=x&gt; {{contactName}}'));
    assert.ok(!html.includes('<script>'));
    assert.ok(!html.includes('<img src=x>'));
    assert.equal(html.split('type="button"').length - 1, 12);
    for (const variable of REMINDER_VARIABLES) assert.ok(html.includes(messages.SettingsReminders[variable.label]));
    if (locale === "en-US") {
      assert.ok(html.includes('placeholder="Payment reminder for {{documentNumber}}"'));
      assert.ok(html.includes('placeholder="Dear {{contactName}}, this is a reminder..."'));
    } else {
      assert.ok(html.includes("یادآور پرداخت برای {{documentNumber}}"));
    }
  }
});

test("workflow condition guidance uses complete entity-specific plurals and preserves machine field names and minor-unit guidance", () => {
  const entities = { bill: "bills", expense: "expenses", invoice: "invoices", journal_entry: "journal entries", purchase_order: "purchase orders", unknown: "documents" };
  for (const locale of locales) {
    for (const [entityType, plural] of Object.entries(entities)) {
      const html = renderWithPresentation(createElement(ApprovalConditionHelp, { entityType, hasConditions: false }), locale);
      if (locale === "en-US") assert.ok(html.includes(`workflow will apply to all ${plural}.`));
      else assert.ok(html.includes("گردش کار"));
      assert.ok(!html.includes("{entity}"));
    }
    const help = renderWithPresentation(createElement(ApprovalConditionHelp, { entityType: "bill", hasConditions: true }), locale);
    for (const field of ["total", "totalAmount", "status"]) assert.ok(help.includes(field));
    assert.ok(help.includes(locale === "en-US" ? "integer minor units" : "واحد خرد"));
  }
});

test("bank rule summaries preserve legacy matching, signed minor-unit ranges, joins, user labels and escaping", () => {
  const rule: BankRule = {
    id: "rule", name: "Caller rule", priority: 2, matchField: "description", matchType: "contains", matchValue: '<script>payee</script>',
    matchAll: true, accountId: "account", contactId: "contact", taxRateId: "tax", autoReconcile: false, isActive: true, createdAt: "2026-10-17",
  };
  const snapshot = JSON.stringify(rule);
  for (const locale of locales) {
    const messages = locale === "en-US" ? en : fa;
    const t = createTranslator({ locale, messages, namespace: "SettingsBankRules" });
    assert.deepEqual(Object.keys(bankFieldLabels(t)), ["description", "reference", "amount", "payee", "counterparty"]);
    assert.deepEqual(opsForField("description", t).map(op => op.value), ["contains", "equals", "starts_with", "ends_with"]);
    assert.deepEqual(opsForField("amount", t).map(op => op.value), ["equals", "gt", "lt", "between"]);
    const legacy = summarizeRule(t, rule, [{ id: "account", name: "Caller account" }], [], []);
    assert.deepEqual(legacy.actions, ["Caller account", messages.SettingsBankRules.tax, messages.SettingsBankRules.contact]);
    assert.ok(legacy.match.includes(messages.SettingsBankRules.description));
    const html = renderWithPresentation(createElement("p", null, legacy.match), locale);
    assert.ok(html.includes('&lt;script&gt;payee&lt;/script&gt;'));
    assert.ok(!html.includes('<script>'));
    for (const matchAll of [true, false]) {
      const summary = summarizeRule(t, { ...rule, matchAll, conditions: [{ field: "amount", op: "between", value: "-1250,9007199254740991" }, { field: "reference", op: "equals", value: "REF" }], splitAllocations: [{ accountId: "a" }, { accountId: "b" }] }, [], [], []);
      assert.ok(summary.match.includes("-1250"));
      assert.ok(summary.match.includes("9007199254740991"));
      assert.ok(summary.match.includes(messages.SettingsBankRules[matchAll ? "and" : "or"]));
      assert.equal(summary.actions[0], t("splitAccounts", { count: 2 }));
    }
    if (locale === "en-US") assert.equal(legacy.match, 'Description contains "<script>payee</script>"');
  }
  assert.equal(JSON.stringify(rule), snapshot);
});

test("new pipeline seed names localize without changing IDs/colors or sharing mutable stage objects", () => {
  const expected = [
    ["lead", "Lead", "#94a3b8"], ["qualified", "Qualified", "#3b82f6"], ["proposal", "Proposal", "#8b5cf6"],
    ["negotiation", "Negotiation", "#f59e0b"], ["closed_won", "Won", "#10b981"], ["closed_lost", "Lost", "#ef4444"],
  ];
  for (const locale of locales) {
    const t = createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace: "SettingsPipelines" });
    const stages = createPipelineStages(t);
    assert.deepEqual(stages.map(s => [s.id, s.color]), expected.map(([id, , color]) => [id, color]));
    if (locale === "en-US") assert.deepEqual(stages.map(s => [s.id, s.name, s.color]), expected);
    else assert.equal(stages[0].name, "سرنخ");
    stages[0].name = "Caller-edited name";
    assert.notEqual(createPipelineStages(t)[0].name, stages[0].name);
  }
});

test("automation count messages cover zero/one/many and pagination as whole messages in both locales", () => {
  for (const locale of locales) {
    const messages = locale === "en-US" ? en : fa;
    const bank = createTranslator({ locale, messages, namespace: "SettingsBankRules" });
    const approvals = createTranslator({ locale, messages, namespace: "SettingsApprovals" });
    const hooks = createTranslator({ locale, messages, namespace: "SettingsWebhooks" });
    const reminders = createTranslator({ locale, messages, namespace: "SettingsReminders" });
    const pipelines = createTranslator({ locale, messages, namespace: "SettingsPipelines" });
    for (const count of [0, 1, 2, 15]) {
      for (const text of [bank("suggestionCount", { count }), bank("ruleCount", { count }), approvals("stepCount", { count }), approvals("conditionCount", { count }), hooks("eventCount", { count }), hooks("attemptCount", { count }), reminders("dayCount", { count }), pipelines("stageCount", { count }), reminders("pagination", { page: 2, pages: 3, count })]) {
        assert.ok(!text.includes("{"));
        assert.ok(text.includes(new Intl.NumberFormat(locale).format(count)));
        if (locale === "fa-IR") assert.match(text, /[\u0600-\u06ff]/);
      }
    }
    if (locale === "en-US") {
      assert.equal(bank("ruleCount", { count: 1 }), "1 rule");
      assert.equal(hooks("attemptCount", { count: 2 }), "2 attempts");
      assert.equal(reminders("pagination", { page: 1, pages: 1, count: 1 }), "Page 1 of 1 · 1 entry");
    }
    const named = pipelines("deleteNamed", { name: '<script>Caller</script>' });
    const html = renderWithPresentation(createElement("p", null, named), locale);
    assert.ok(html.includes('&lt;script&gt;Caller&lt;/script&gt;'));
  }
});

test("pipeline drag announcements localize start, target, outside, end and cancel while escaping stage names", () => {
  const active = { id: "lead", data: { current: {} }, rect: { current: { initial: null, translated: null } } };
  const over = { id: "won", disabled: false, data: { current: {} }, rect: { width: 1, height: 1, top: 0, left: 0, right: 1, bottom: 1 } };
  for (const locale of locales) {
    const t = createTranslator({ locale, messages: locale === "en-US" ? en : fa, namespace: "SettingsPipelines" });
    const announcements = pipelineAnnouncements(t, [{ id: "lead", name: '<script>Lead</script>' }, { id: "won", name: "Caller target" }]);
    for (const message of [announcements.onDragStart({ active }), announcements.onDragOver({ active, over }), announcements.onDragOver({ active, over: null }), announcements.onDragEnd({ active, over }), announcements.onDragCancel({ active, over: null })]) {
      assert.ok(message?.includes('<script>Lead</script>'));
      const html = renderWithPresentation(createElement("p", null, message), locale);
      assert.ok(html.includes('&lt;script&gt;Lead&lt;/script&gt;'));
      assert.ok(!html.includes('<script>'));
      if (locale === "fa-IR") assert.match(message ?? "", /[\u0600-\u06ff]/);
    }
    assert.ok(announcements.onDragEnd({ active, over })?.includes("Caller target"));
  }
});

test("automation errors map only known REST contracts and do not echo unknown server or network prose", () => {
  const cases = [["Bank rule not found", "bankRuleMissing"], ["Approval workflow not found", "workflowMissing"], ["Webhook not found", "webhookMissing"], ["Pipeline not found", "pipelineMissing"], ["Reminder rule not found", "reminderMissing"]] as const;
  for (const locale of locales) {
    const messages = locale === "en-US" ? en : fa;
    const t = createTranslator({ locale, messages, namespace: "SettingsErrors" });
    for (const [message, key] of cases) assert.equal(settingsErrorMessage(t, message, "fallback", 404), messages.SettingsErrors[key]);
    for (const unknown of [undefined, {}, "constructor", "__proto__", '<script>server</script>', "Network Error"]) {
      assert.equal(settingsErrorMessage(t, unknown, "fallback", 500), "fallback");
      assert.equal(settingsErrorMessage(t, unknown, "fallback", 422), messages.SettingsErrors.invalidInput);
      assert.equal(settingsErrorMessage(t, unknown, "fallback", 401), messages.SettingsErrors.unauthenticated);
      assert.equal(settingsErrorMessage(t, unknown, "fallback", 403), messages.SettingsErrors.forbidden);
    }
  }
  assert.ok(new SettingsRequestError("translated") instanceof Error);
  assert.ok(!(new Error("network") instanceof SettingsRequestError));
});

test("every saved webhook delivery status has a localized label and unknown status prose is never used as a key", () => {
  for (const locale of locales) {
    const messages = locale === "en-US" ? en : fa;
    const t = createTranslator({ locale, messages, namespace: "SettingsWebhooks" });
    for (const status of ["pending", "success", "failed", "retrying"] as const) assert.equal(webhookStatusLabel(t, status), messages.SettingsWebhooks[status]);
    for (const status of ["constructor", "__proto__", '<script>status</script>', "unknown_future_status"]) assert.equal(webhookStatusLabel(t, status), messages.SettingsWebhooks.unknownStatus);
  }
});

test("bounded automation source audit rejects hardcoded JSX/display attributes and translated machine values", () => {
  const pages = ["bank-rules", "approval-workflows", "pipelines", "webhooks", "reminders", "notifications"].map(name => `app/(dashboard)/settings/${name}/page.tsx`);
  const components = ["notification-preferences-form", "reminder-template-fields", "approval-condition-help"].map(name => `components/settings/${name}.tsx`);
  for (const path of [...pages, ...components]) {
    const source = readFileSync(path, "utf8");
    const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(node: ts.Node) {
      if (ts.isJsxText(node)) assert.ok(!/[A-Za-z]/.test(node.text), `${path}: ${node.text.trim()}`);
      if (ts.isJsxAttribute(node) && ["placeholder", "aria-label", "title", "description", "alt"].includes(node.name.getText(ast))) assert.ok(!node.initializer || !ts.isStringLiteral(node.initializer) || /^\d+$/.test(node.initializer.text), `${path}: ${node.getText(ast)}`);
      if (ts.isPropertyAssignment(node) && ["value", "id", "type", "channel", "triggerType", "documentType", "recipientType", "operator", "op"].includes(node.name.getText(ast))) {
        const call = node.parent.parent;
        const isMessageArgument = ts.isCallExpression(call) && call.expression.getText(ast) === "t";
        if (!isMessageArgument) assert.ok(!/^t\(/.test(node.initializer.getText(ast)), `${path}: translated machine identity ${node.getText(ast)}`);
      }
      if (ts.isPropertyAssignment(node) && ["matchType", "matchField"].includes(node.name.getText(ast))) assert.ok(!/\bt\(/.test(node.initializer.getText(ast)), `${path}: translated matching contract`);
      ts.forEachChild(node, visit);
    }
    visit(ast);
  }
  for (const ns of ["SettingsBankRules", "SettingsApprovals", "SettingsPipelines", "SettingsWebhooks", "SettingsReminders", "SettingsNotifications"] as const) {
    for (const value of Object.values(fa[ns])) assert.ok(!/\?{2,}|\ufffd/.test(value), `${ns}: corrupt Persian`);
  }
});
