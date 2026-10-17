import type { useTranslations } from "next-intl";

type Translate = ReturnType<typeof useTranslations<"SettingsErrors">>;
type ErrorKey = Parameters<Translate>[0];

// Exact existing server contracts. Never translate REST/MCP output or treat
// arbitrary server/network prose as approved product copy.
const keys: Partial<Record<string, ErrorKey>> = {
  "Organization not found": "organizationMissing",
  "Tag not found": "tagMissing",
  "Template not found": "templateMissing",
  "Bank rule not found": "bankRuleMissing",
  "Approval workflow not found": "workflowMissing",
  "Webhook not found": "webhookMissing",
  "Pipeline not found": "pipelineMissing",
  "Reminder rule not found": "reminderMissing",
  "Member not found": "memberMissing",
  "Role not found": "roleMissing",
  "Invitation not found": "invitationMissing",
  "Link not found": "inviteLinkMissing",
  "Cannot change the owner's role": "ownerRoleProtected",
  "Cannot remove the organization owner": "ownerRemovalProtected",
  "Cannot modify system roles": "systemRoleProtected",
  "Cannot delete system roles": "systemRoleProtected",
  "Cannot delete role while members are assigned to it. Reassign members first.": "roleAssigned",
  "Can only revoke pending invitations": "invitationNotPending",
  "User is already a member": "alreadyMember",
  "An invitation is already pending for this email": "invitationPending",
  "API keys require a Pro plan": "apiPlanRequired",
  "Your billing is past due. Update your payment method to invite members.": "billingPastDue",
  "Free plan is limited to 1 member. Upgrade to Pro to invite your team.": "freeMemberLimit",
  "No account found with this email. The advisor must create an account first.": "advisorAccountRequired",
  "Insufficient permissions": "forbidden",
  "Not authenticated": "unauthenticated",
  "Base currency can't be changed once transactions exist": "currencyTransactions",
  "Base currency can't be changed with payroll-run history": "currencyPayroll",
  "Base currency can't be changed with asset, category or loan history": "currencyAssets",
  "Base currency can't be changed with accrual schedule history": "currencyAccruals",
};

// Only errors created after the allowlist/status mapping may carry display copy.
// Fetch, JSON and saved-data validators otherwise use the operation fallback.
export class SettingsRequestError extends Error {}

export function settingsErrorMessage(t: Translate, message: unknown, fallback: string, status?: number): string {
  if (typeof message === "string" && Object.hasOwn(keys, message)) {
    const key = keys[message];
    if (key) return t(key);
  }
  if (status === 401) return t("unauthenticated");
  if (status === 403) return t("forbidden");
  return status === 400 || status === 422 ? t("invalidInput") : fallback;
}
