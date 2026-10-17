import type { useTranslations } from "next-intl";

type Translate = ReturnType<typeof useTranslations<"Admin">>;

export function adminPlanLabel(t: Translate, value: string) {
  switch (value) {
    case "free": return t("free");
    case "pro": return t("pro");
    default: return value;
  }
}

export function adminRoleLabel(t: Translate, value: string) {
  switch (value) {
    case "owner": case "member": return t(value);
    case "admin": return t("admin");
    default: return value; // Custom organization role names remain data.
  }
}

export function adminStatusLabel(t: Translate, value: string) {
  switch (value) {
    case "active": case "trialing": case "canceled": case "incomplete": return t(value);
    case "past_due": return t("pastDue");
    default: return value;
  }
}

export function adminTemplateLabel(t: Translate, id: string, fallback: string) {
  switch (id) {
    case "notification-digest": return t("notificationDigest");
    case "welcome": return t("welcome");
    case "org-created": return t("organizationCreated");
    case "member-invite": return t("memberInvite");
    case "login-alert": return t("loginAlert");
    default: return fallback;
  }
}
