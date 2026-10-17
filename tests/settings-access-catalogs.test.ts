import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement, type ReactNode } from "react";
import { createTranslator } from "next-intl";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { AppRouterContext, type AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { renderWithPresentation } from "./helpers/presentation";
import MembersPage from "../app/(dashboard)/settings/members/page";
import RolesPage from "../app/(dashboard)/settings/roles/page";
import AdvisorsPage from "../app/(dashboard)/settings/advisors/page";
import ApiKeysPage from "../app/(dashboard)/settings/api-keys/page";
import AuditLogPage from "../app/(dashboard)/settings/audit-log/page";
import { RolePermissionFields, rolePermissions } from "../components/settings/role-permission-fields";
import { ApiKeyFields } from "../components/settings/api-key-fields";
import { AuditActivityText } from "../components/settings/audit-activity-text";
import { memberCapacityReason, memberPlanLabel } from "../i18n/access-presentation";
import { AUDIT_ENTITY_TYPES, auditActionLabel, auditEntityLabel, auditRelativeTime, auditDayLabel } from "../i18n/audit-presentation";
import { invitationRole } from "../i18n/invitation-role";
import { settingsErrorMessage } from "../i18n/settings-errors";
import { resolvePresentation } from "../i18n/locale";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const locales = ["en-US", "fa-IR"] as const;
const noop = () => {};
const router: AppRouterInstance = { back: noop, forward: noop, refresh: noop, push: noop, replace: noop, prefetch: noop };
function render(locale: typeof locales[number], node: ReactNode) {
  return renderWithPresentation(createElement(AppRouterContext.Provider, { value: router }, node), locale);
}

test("actual access pages render localized headings, actions and key guidance with the production provider", () => {
  for (const locale of locales) {
    const messages = locale === "en-US" ? en : fa;
    const members = render(locale, createElement(MembersPage));
    for (const key of ["team", "inviteMember", "readyMadeAccessLevels", "readOnly", "createLink"] as const) {
      assert.ok(members.includes(messages.SettingsMembers[key]), key);
    }
    const roles = render(locale, createElement(RolesPage));
    assert.ok(roles.includes(messages.SettingsRoles.customRoles));
    assert.ok(roles.includes(messages.SettingsRoles.createRole));
    const advisors = render(locale, createElement(AdvisorsPage));
    assert.ok(advisors.includes(messages.SettingsAdvisors.advisors));
    assert.ok(advisors.includes(messages.SettingsAdvisors.inviteAdvisor));
    const keys = render(locale, createElement(ApiKeysPage));
    assert.ok(keys.includes(messages.SettingsApiKeys.apiKeys));
    if (locale === "fa-IR") assert.ok(keys.includes("کلیدهای API"));
    assert.ok(keys.includes(messages.SettingsApiKeys.newKey));
    assert.match(keys, /<code[^>]*>Authorization<\/code>/);
    assert.ok(keys.includes('Bearer dk_live_...'));
    assert.ok(keys.includes('aria-label="' + messages.SettingsApiKeys.copyExample + '"'));
    assert.ok(render(locale, createElement(AuditLogPage)).length > 0); // Existing initial loading branch.
  }
});

test("loaded permission controls retain all 45 existing permission IDs and selected/category states", () => {
  let englishIds: string[] = [];
  for (const locale of locales) {
    const messages = locale === "en-US" ? en : fa;
    const t = createTranslator({ locale, messages, namespace: "SettingsRoles" });
    const { categories, labels } = rolePermissions(t);
    const ids = Object.values(categories).flat();
    assert.equal(Object.keys(categories).length, 17);
    assert.equal(new Set(ids).size, 45);
    assert.deepEqual(Object.keys(labels).sort(), [...ids].sort());
    if (locale === "fa-IR") assert.equal(labels["manage:payroll"], "مدیریت حقوق و دستمزد");
    assert.ok(!ids.includes("bypass:period-lock")); // Existing UI does not expose this elevated permission.
    assert.ok(ids.every(id => /^[a-z-]+:[a-z-]+$/.test(id)));
    if (locale === "en-US") englishIds = ids;
    else assert.deepEqual(ids, englishIds);
    for (const selectedPermissions of [[], ["view:data", "create:entries"], ids]) {
      const html = render(locale, createElement(RolePermissionFields, { selectedPermissions, onToggleCategory: noop, onTogglePermission: noop }));
      assert.equal(html.split('role="checkbox"').length - 1, 62);
      const expectedCategories = Object.values(categories).filter(perms => perms.every(p => selectedPermissions.includes(p))).length;
      assert.equal(html.split('aria-checked="true"').length - 1, selectedPermissions.length + expectedCategories);
      for (const label of Object.values(labels)) {
        const escaped = label.replaceAll('&', '&amp;').replaceAll("'", '&#x27;');
        assert.ok(html.includes(escaped), label);
      }
    }
  }
});

test("API key creation/reveal fields translate controls and escape caller text without changing key bytes", () => {
  for (const locale of locales) {
    const messages = locale === "en-US" ? en : fa;
    const secret = 'dk_live_<script>"&';
    const revealed = render(locale, createElement(ApiKeyFields, { newKey: secret, name: "Caller name", onNameChange: noop, onCopy: noop }));
    assert.ok(revealed.includes('dk_live_&lt;script&gt;&quot;&amp;'));
    assert.ok(!revealed.includes('<script>'));
    assert.ok(!revealed.includes('<input'));
    assert.ok(revealed.includes('aria-label="' + messages.SettingsApiKeys.copyKey + '"'));
    const create = render(locale, createElement(ApiKeyFields, { newKey: null, name: '<img src=x>', onNameChange: noop, onCopy: noop }));
    assert.ok(create.includes('value="&lt;img src=x&gt;"'));
    assert.ok(create.includes('placeholder="' + messages.SettingsApiKeys.eGProductionAPI + '"'));
    assert.ok(!create.includes(secret));
  }
});

test("member summaries use complete count messages and translate capacity from structured fields", () => {
  for (const locale of locales) {
    const messages = locale === "en-US" ? en : fa;
    const t = createTranslator({ locale, messages, namespace: "SettingsMembers" });
    const tr = createTranslator({ locale, messages, namespace: "Invitation" });
    for (const count of [0, 1, 2, 20]) {
      for (const key of ["ownerCount", "adminCount", "memberCount", "uses"] as const) {
        assert.ok(!t(key, { count }).includes('{'));
      }
      const roles = createTranslator({ locale, messages, namespace: "SettingsRoles" });
      assert.ok(!roles("permissionCount", { count }).includes('{'));
      assert.ok(!roles("members", { count }).includes('{'));
    }
    if (locale === "en-US") {
      assert.equal(t("ownerCount", { count: 1 }), "Owner");
      assert.equal(t("ownerCount", { count: 0 }), "Owners");
      assert.equal(t("uses", { count: 1 }), " · 1 use");
      assert.equal(t("uses", { count: 2 }), " · 2 uses");
    }
    for (const role of ["owner", "admin", "member"] as const) assert.equal(invitationRole(tr, role), messages.Invitation[role]);
    assert.equal(invitationRole(tr, "Caller custom role"), "Caller custom role");
    const capacity = { plan: "pro", status: "active", seatCount: 3, max: 3, reason: "Untrusted <script>server prose</script>" };
    const snapshot = JSON.stringify(capacity);
    assert.equal(memberCapacityReason(t, capacity), t("seatLimit", { count: 3 }));
    assert.equal(memberCapacityReason(t, { ...capacity, plan: "free" }), t("freeLimit"));
    assert.equal(memberCapacityReason(t, { ...capacity, plan: "business" }), t("memberLimit", { count: 3 }));
    assert.equal(memberCapacityReason(t, { ...capacity, status: "past_due" }), t("updateYourPaymentMethodToContinueInvitingMembers"));
    assert.equal(memberCapacityReason(t, null), t("upgradeYourPlanToAddMoreMembers"));
    assert.equal(memberCapacityReason(t, { ...capacity, reason: null }), t("upgradeYourPlanToAddMoreMembers"));
    assert.equal(JSON.stringify(capacity), snapshot);
    assert.equal(memberPlanLabel(t, "free"), t("free"));
    assert.equal(memberPlanLabel(t, "Caller plan"), "Caller plan");
  }
});

test("audit activity uses complete messages, exact known codes, unknown-code fallback and escaped user data", () => {
  assert.deepEqual(AUDIT_ENTITY_TYPES, ["invoice", "bill", "contact", "journal_entry", "account", "quote", "purchase_order", "bank_account", "expense", "payment", "credit_note"]);
  for (const locale of locales) {
    const messages = locale === "en-US" ? en : fa;
    const t = createTranslator({ locale, messages, namespace: "SettingsAudit" });
    for (const code of ["create", "update", "delete", "post", "void", "approve", "send", "restore", "purge", "restore_backup", "close", "reopen", "import", "export", "reject", "comment"]) {
      assert.notEqual(auditActionLabel(t, code), code);
    }
    assert.equal(auditActionLabel(t, "unrecognized_create_event"), "unrecognized_create_event");
    assert.equal(auditEntityLabel(t, "future_entity"), "future entity");
    for (const type of AUDIT_ENTITY_TYPES) assert.notEqual(auditEntityLabel(t, type), type);
    const html = render(locale, createElement(AuditActivityText, { userName: '<img src=x>', action: 'restore_backup', entityType: 'invoice' }));
    assert.ok(html.includes('&lt;img src=x&gt;'));
    assert.ok(!html.includes('<img'));
    assert.ok(html.includes(messages.SettingsAudit.action_restore_backup));
    assert.ok(html.includes(messages.SettingsAudit.entity_invoice));
    assert.ok(!t("pagination", { page: 2, total: 5 }).includes('{'));
    assert.ok(!t("resultCount", { count: 30, total: 45 }).includes('{'));
  }
});

test("audit relative/day labels handle thresholds, invalid dates and local-day boundaries", () => {
  const now = new Date("2026-10-17T12:00:00Z");
  for (const locale of locales) {
    const messages = locale === "en-US" ? en : fa;
    const t = createTranslator({ locale, messages, namespace: "SettingsAudit" });
    const presentation = resolvePresentation({ user: { language: locale, timeZone: "Asia/Tehran" } });
    for (const [minutes, key, count] of [[0, "justNow", 0], [1, "minutesAgo", 1], [59, "minutesAgo", 59], [60, "hoursAgo", 1], [1439, "hoursAgo", 23], [1440, "daysAgo", 1], [6 * 1440, "daysAgo", 6]] as const) {
      assert.equal(auditRelativeTime(t, presentation, new Date(now.getTime() - minutes * 60000).toISOString(), now), t(key, { count }));
    }
    assert.equal(auditRelativeTime(t, presentation, "invalid", now), t("unknownDate"));
    assert.equal(auditDayLabel(t, presentation, "invalid", now), t("unknownDate"));
    assert.equal(auditDayLabel(t, presentation, "2026-10-16T21:00:00Z", now), t("today"));
    assert.equal(auditDayLabel(t, presentation, "2026-10-16T20:00:00Z", now), t("yesterday"));
    assert.ok(!auditRelativeTime(t, presentation, "2026-10-01T00:00:00Z", now).includes("Invalid"));
  }
});

test("access error allowlist preserves useful authorization/conflict context and rejects arbitrary response prose", () => {
  for (const locale of locales) {
    const messages = locale === "en-US" ? en : fa;
    const t = createTranslator({ locale, messages, namespace: "SettingsErrors" });
    for (const [message, key] of [["Cannot change the owner's role", "ownerRoleProtected"], ["User is already a member", "alreadyMember"], ["Cannot delete system roles", "systemRoleProtected"], ["An invitation is already pending for this email", "invitationPending"], ["No account found with this email. The advisor must create an account first.", "advisorAccountRequired"]] as const) {
      assert.equal(settingsErrorMessage(t, message, "fallback", 400), t(key));
    }
    for (const message of ["<script>API error</script>", "SettingsMembers.owner", {}, null]) {
      assert.equal(settingsErrorMessage(t, message, "fallback", 500), "fallback");
      assert.equal(settingsErrorMessage(t, message, "fallback", 403), t("forbidden"));
      assert.equal(settingsErrorMessage(t, message, "fallback", 422), t("invalidInput"));
    }
  }
});

test("bounded JSX prose and display attributes are extracted; request identities stay canonical", () => {
  const files = ["members", "roles", "advisors", "api-keys", "audit-log"].map(name => `app/(dashboard)/settings/${name}/page.tsx`);
  files.push(...["role-permission-fields", "api-key-fields", "audit-activity-text"].map(name => `components/settings/${name}.tsx`));
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(node: ts.Node) {
      if (ts.isJsxText(node) && /[a-z]/i.test(node.text.trim())) {
        assert.equal(node.text.trim(), "/invite/", `${file}: unextracted JSX ${node.text}`);
      }
      if (ts.isJsxAttribute(node) && ["placeholder", "title", "description", "aria-label"].includes(node.name.getText(ast)) && node.initializer && ts.isStringLiteral(node.initializer)) {
        assert.ok(!/[a-z]/i.test(node.initializer.text), `${file}: unextracted ${node.getText(ast)}`);
      }
      if (ts.isCallExpression(node) && node.expression.getText(ast) === "JSON.stringify") {
        assert.ok(!/\bt(?:r|e)?\(/.test(node.arguments.map(arg => arg.getText(ast)).join("")), `${file}: translated request`);
      }
      if (ts.isJsxAttribute(node) && node.name.getText(ast) === "value" && node.initializer && ts.isJsxExpression(node.initializer)) {
        assert.ok(!/\bt\(/.test(node.initializer.getText(ast)), `${file}: translated machine value`);
      }
      if (ts.isJsxExpression(node) && ts.isJsxElement(node.parent)) {
        assert.notEqual(node.expression?.getText(ast), "entry.action", `${file}: raw audit action label`);
      }
      ts.forEachChild(node, visit);
    }
    visit(ast);
    assert.ok(!source.includes('toast.error(data.error'));
    assert.ok(!source.includes('err instanceof Error ? err.message'));
  }
});
