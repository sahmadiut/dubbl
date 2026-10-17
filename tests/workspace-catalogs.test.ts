import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement, type ReactNode } from "react";
import { createTranslator } from "next-intl";
import { readFileSync, readdirSync } from "node:fs";
import ts from "typescript";
import { AppRouterContext, type AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { renderWithPresentation } from "./helpers/presentation";
import { AdminNavigation } from "../components/admin/navigation";
import { SiteSettingsForm } from "../components/admin/site-settings-form";
import { SubscriptionDescription } from "../components/admin/subscription-description";
import { TeamFields, TEAM_COLORS } from "../components/dashboard/team-fields";
import { ApprovalNotificationTitle, ApprovalNotificationSender, approvalEntityHref, type ApprovalEntity } from "../components/dashboard/approval-notification-text";
import TeamsLayout from "../app/(dashboard)/teams/layout";
import AdminUsersPage from "../app/(admin)/admin/users/page";
import AdminOrgsPage from "../app/(admin)/admin/organizations/page";
import AdminEmailPreviewPage from "../app/(admin)/admin/email-preview/page";
import { resolvePresentation } from "../i18n/locale";
import { adminPlanLabel, adminRoleLabel, adminStatusLabel, adminTemplateLabel } from "../i18n/admin-labels";
import { notificationRelativeTime, groupNotifications } from "../i18n/notification-presentation";
import { workspaceErrorMessage } from "../i18n/workspace-errors";
import en from "../messages/en-US.json";
import fa from "../messages/fa-IR.json";

const locales = ["en-US", "fa-IR"] as const;
const noop = () => {};
const router: AppRouterInstance = { back: noop, forward: noop, refresh: noop, push: noop, replace: noop, prefetch: noop };
function render(locale: typeof locales[number], node: ReactNode, pathname = "/admin") {
  return renderWithPresentation(createElement(AppRouterContext.Provider, { value: router },
    createElement(PathnameContext.Provider, { value: pathname }, node)), locale);
}

test("admin navigation renders both responsive menus, preserves detail branching, and hides children when access is denied", () => {
  for (const locale of locales) {
    const messages = locale === "en-US" ? en : fa;
    const node = (allowed: boolean) => createElement(AdminNavigation, { allowed }, "Sensitive child");
    const html = render(locale, node(true));
    for (const path of ["/admin", "/admin/users", "/admin/organizations", "/admin/settings", "/admin/email-preview"]) {
      assert.equal(html.split(`href="${path}"`).length - 1, 2, path);
    }
    assert.ok(html.includes(messages.Admin.management));
    assert.ok(html.includes("Sensitive child"));
    const detail = render(locale, node(true), "/admin/organizations/fixture");
    assert.ok(!detail.includes('<nav'));
    assert.ok(detail.includes("Sensitive child"));
    const denied = render(locale, node(false));
    assert.ok(denied.includes(messages.Admin.pageNotFound));
    assert.ok(!denied.includes("Sensitive child"));
    assert.ok(!denied.includes('href="/admin/users"'));
    const teams = render(locale, createElement(TeamsLayout, null, "Teams child"), "/teams");
    assert.ok(teams.includes(messages.Teams.teams));
    assert.ok(teams.includes('href="/teams/members"'));
  }
});

test("real admin list and email-preview screens render localized headings and search controls", () => {
  for (const locale of locales) {
    const messages = locale === "en-US" ? en : fa;
    const users = render(locale, createElement(AdminUsersPage));
    const orgs = render(locale, createElement(AdminOrgsPage));
    const email = render(locale, createElement(AdminEmailPreviewPage));
    assert.ok(users.includes(messages.Admin.allRegisteredUsersAcrossThePlatform));
    assert.ok(users.includes(`placeholder="${messages.Admin.searchNameOrEmail}"`));
    assert.ok(orgs.includes(messages.Admin.allOrganizationsOnThePlatform));
    assert.ok(orgs.includes(`placeholder="${messages.Admin.searchNameOrSlug}"`));
    assert.ok(email.includes(messages.Admin.previewEmailTemplatesWithSampleData));
  }
});

test("loaded site settings form preserves domain input, switch state, billing branches and saving notice", () => {
  for (const locale of locales) for (const stripeConfigured of [true, false]) for (const saving of [true, false]) {
    const messages = locale === "en-US" ? en : fa;
    const html = render(locale, createElement(SiteSettingsForm, {
      settings: { registration_mode: "invite_only", allowed_email_domains: '<script>example.com</script>', allow_user_org_creation: "true", self_hosted_unlimited: "auto" },
      stripeConfigured, saving, save: async () => {}, onSettingsChange: noop,
    }));
    for (const key of ["siteSettings", "registrationMode", "allowedEmailDomains", "allowUsersToCreateOrganizations", "selfHostedUnlimitedMode"] as const) assert.ok(html.includes(messages.Admin[key]), key);
    assert.ok(html.includes('&lt;script&gt;example.com&lt;/script&gt;'));
    assert.ok(!html.includes('<script>'));
    assert.ok(html.includes('aria-checked="true"'));
    assert.equal(html.includes(messages.Admin.saving), saving);
    assert.ok(html.includes(stripeConfigured ? messages.Admin.stripeIsConfiguredBillingFeaturesAreActive : messages.Admin.stripeIsNotConfiguredAllOrganizationsGetUnlimitedFeatures));
  }
});

test("team create/edit fields translate labels while preserving caller data, color identity and selected state", () => {
  for (const locale of locales) for (const editing of [true, false]) {
    const messages = locale === "en-US" ? en : fa;
    const html = render(locale, createElement(TeamFields, {
      name: '<img src=x>', description: 'Customer team', color: "#3b82f6", editing,
      onNameChange: noop, onDescriptionChange: noop, onColorChange: noop,
    }));
    assert.ok(html.includes(`placeholder="${editing ? messages.Teams.teamName : messages.Teams.eGEngineeringMarketing}"`));
    assert.ok(html.includes('value="&lt;img src=x&gt;"'));
    assert.ok(html.includes('Customer team'));
    assert.ok(html.includes(messages.Teams.description));
    for (const color of TEAM_COLORS) assert.ok(html.includes(`background-color:${color}`));
    assert.equal(html.split('aria-pressed="true"').length - 1, 1);
    assert.equal(html.split('aria-pressed="false"').length - 1, 7);
    assert.equal(html.split('type="button"').length - 1, 8);
    assert.ok(!html.includes('<img'));
  }
});

test("whole subscription sentences escape names and only show Stripe cancellation warnings when applicable", () => {
  for (const locale of locales) for (const switching of [true, false]) for (const hasStripe of [true, false]) {
    const messages = locale === "en-US" ? en : fa;
    const html = render(locale, createElement(SubscriptionDescription, { name: '<script>org</script>', switching, hasStripe }));
    assert.ok(html.includes('&lt;script&gt;org&lt;/script&gt;'));
    assert.ok(!html.includes('<script>'));
    assert.equal(html.includes(messages.Admin.switchStripeWarning.trim()), switching && hasStripe);
  }
});

test("approval summaries localize all entity labels and retain review routes and escaped requester data", () => {
  const destinations: Record<ApprovalEntity, string> = { bill: "/purchases/id", expense: "/purchases/expenses/id", invoice: "/sales/id", journal_entry: "/accounting/id", purchase_order: "/purchases/orders/id" };
  for (const locale of locales) {
    const messages = locale === "en-US" ? en : fa;
    const entityLabels = { bill: messages.Notifications.bill, expense: messages.Notifications.expense, invoice: messages.Notifications.invoice, journal_entry: messages.Notifications.journalEntry, purchase_order: messages.Notifications.purchaseOrder };
    for (const entityType of Object.keys(destinations) as ApprovalEntity[]) {
      assert.equal(approvalEntityHref({ entityType, entityId: "id" }), destinations[entityType]);
      const html = render(locale, createElement(ApprovalNotificationTitle, { entityType }));
      assert.ok(!html.includes('{entity}'));
      assert.ok(html.includes(entityLabels[entityType]));
    }
    const html = render(locale, createElement(ApprovalNotificationSender, { name: '<img src=x>' }));
    assert.ok(html.includes('&lt;img src=x&gt;'));
    assert.ok(!html.includes('<img'));
    assert.ok(!html.includes('{name}'));
    const t = createTranslator({ locale, messages, namespace: "Notifications" });
    for (const count of [0, 1, 2]) {
      const value = t("unreadCount", { count });
      assert.ok(!value.includes('{'));
      if (locale === "en-US") assert.equal(value, `${count} unread notification${count === 1 ? "" : "s"}`);
      else assert.ok(/[۰۱۲]/.test(value));
    }
    const teams = createTranslator({ locale, messages, namespace: "Teams" });
    assert.equal(teams("memberCount", { count: 1 }), locale === "en-US" ? "1 member" : "۱ عضو");
    assert.equal(teams("memberCount", { count: 2 }), locale === "en-US" ? "2 members" : "۲ عضو");
  }
});

test("relative time keeps English thresholds and translates Persian values; grouping uses preference timezone across DST and years", () => {
  const now = new Date("2026-10-17T01:00:00Z");
  for (const locale of locales) {
    const messages = locale === "en-US" ? en : fa;
    const t = createTranslator({ locale, messages, namespace: "Notifications" });
    const p = resolvePresentation({ user: { language: locale, timeZone: "Asia/Tehran" } });
    const cases = [[0, "Just now"], [59, "Just now"], [60, "1m ago"], [3599, "59m ago"], [3600, "1h ago"], [86399, "23h ago"], [86400, "1d ago"], [518400, "6d ago"]] as const;
    for (const [seconds, english] of cases) {
      const value = notificationRelativeTime(t, p, new Date(+now - seconds * 1000).toISOString(), now);
      if (locale === "en-US") assert.equal(value, english);
      else assert.ok(!/ago|Just now/.test(value));
    }
    assert.equal(notificationRelativeTime(t, p, "invalid", now), messages.Notifications.unknownDate);
    assert.equal(notificationRelativeTime(t, p, new Date(+now + 60000).toISOString(), now), messages.Notifications.justNow);
    const old = new Date("2026-10-01T00:00:00Z");
    assert.equal(notificationRelativeTime(t, p, old.toISOString(), now), new Intl.DateTimeFormat(locale, { timeZone: p.timeZone, calendar: p.calendar, numberingSystem: p.numerals, month: "short", day: "numeric" }).format(old));
    const rows = [{ id: "today", createdAt: "2026-10-16T21:00:00Z" }, { id: "yesterday", createdAt: "2026-10-16T20:00:00Z" }, { id: "old1", createdAt: "2025-01-01T00:00:00Z" }, { id: "old2", createdAt: "2024-01-01T00:00:00Z" }];
    const before = JSON.stringify(rows);
    const groups = groupNotifications(t, p, rows, now);
    assert.equal(groups[0].label, messages.Notifications.today);
    assert.equal(groups[1].label, messages.Notifications.yesterday);
    assert.equal(groups.length, 4); // Identical month/day display must not merge years.
    assert.equal(JSON.stringify(rows), before);
    const dst = groupNotifications(t, { ...p, timeZone: "America/New_York" }, [{ createdAt: "2026-03-08T05:30:00Z" }], new Date("2026-03-09T04:15:00Z"));
    assert.equal(dst[0].label, messages.Notifications.yesterday);
  }
});

test("built-in admin labels localize without modifying machine values or custom names; unknown server prose fails closed", () => {
  for (const locale of locales) {
    const messages = locale === "en-US" ? en : fa;
    const t = createTranslator({ locale, messages, namespace: "Admin" });
    assert.equal(adminPlanLabel(t, "pro"), messages.Admin.pro);
    assert.equal(adminRoleLabel(t, "owner"), messages.Admin.owner);
    assert.equal(adminStatusLabel(t, "past_due"), messages.Admin.pastDue);
    assert.equal(adminTemplateLabel(t, "login-alert", "Login Alert"), messages.Admin.loginAlert);
    for (const value of ["Custom role", "constructor", "__proto__"]) {
      assert.equal(adminRoleLabel(t, value), value);
      assert.equal(adminPlanLabel(t, value), value);
      assert.equal(adminStatusLabel(t, value), value);
      assert.equal(adminTemplateLabel(t, value, "Custom template"), "Custom template");
    }
    const errors = createTranslator({ locale, messages, namespace: "WorkspaceErrors" });
    assert.equal(workspaceErrorMessage(errors, "Member is already in this team", "fallback"), messages.WorkspaceErrors.duplicateMember);
    assert.equal(workspaceErrorMessage(errors, "Site admin access required", "fallback"), messages.WorkspaceErrors.siteAdminRequired);
    for (const value of [undefined, {}, "constructor", "__proto__", '<script>server</script>', "Network error"]) {
      assert.equal(workspaceErrorMessage(errors, value, "fallback"), "fallback");
      assert.equal(workspaceErrorMessage(errors, value, "fallback", 401), messages.WorkspaceErrors.unauthenticated);
      assert.equal(workspaceErrorMessage(errors, value, "fallback", 403), messages.WorkspaceErrors.forbidden);
      assert.equal(workspaceErrorMessage(errors, value, "fallback", 400), messages.WorkspaceErrors.invalidInput);
    }
  }
});

test("teams/admin/notification source audit has no untracked JSX copy or display attributes", () => {
  const walk = (path: string): string[] => readdirSync(path, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(`${path}/${entry.name}`) : entry.name.endsWith('.tsx') ? [`${path}/${entry.name}`] : []);
  const paths = [...walk("app/(admin)"), ...walk("app/(dashboard)/teams"), ...walk("components/admin"), "app/(dashboard)/notifications/page.tsx", "components/dashboard/notification-dropdown.tsx", "components/dashboard/team-fields.tsx", "components/dashboard/approval-notification-text.tsx"];
  const exceptions = new Set(["dubbl", "Stripe", "acme.com, example.com"]);
  for (const path of paths) {
    const source = readFileSync(path, "utf8");
    const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(node: ts.Node) {
      if (ts.isJsxText(node) && /[A-Za-z]/.test(node.text)) assert.ok(exceptions.has(node.text.trim()), `${path}: ${node.text.trim()}`);
      if (ts.isJsxAttribute(node) && ["placeholder", "aria-label", "title", "description", "label", "sub", "alt"].includes(node.name.getText(ast)) && node.initializer && ts.isStringLiteral(node.initializer)) {
        assert.ok(!node.initializer.text || exceptions.has(node.initializer.text), `${path}: ${node.getText(ast)}`);
      }
      ts.forEachChild(node, visit);
    }
    visit(ast);
    assert.ok(!/toast\.error\((?:err|e) instanceof Error \? (?:err|e)\.message/.test(source), path);
  }
  for (const ns of ["Teams", "Admin", "Notifications", "WorkspaceErrors"] as const) for (const [key, value] of Object.entries(fa[ns])) {
    assert.ok(!/\?{2,}|\uFFFD/.test(value), `${ns}.${key}`);
    assert.match(value, /[\u0600-\u06ff]/, `${ns}.${key}: provisional Persian copy required`);
  }
});
