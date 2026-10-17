import type { useTranslations } from "next-intl";

type Translate = ReturnType<typeof useTranslations<"AuthErrors">>;
type ErrorKey = Parameters<Translate>[0];

// These are existing server contracts, not translated response values. Keep the
// allowlist exact: arbitrary server/network prose must not become product copy.
const errorKeys: Partial<Record<string, ErrorKey>> = {
  "Email already registered": "emailRegistered",
  "Registration is currently disabled": "registrationDisabled",
  "Registration is by invitation only": "inviteOnly",
  "Registration is not allowed for this email domain": "domainDenied",
  "Not authenticated": "notAuthenticated",
  "Invalid client_id": "invalidClient",
  "Invalid redirect_uri": "invalidRedirect",
  "Not a member of this organization": "notMember",
  "Invitation not found": "invitationMissing",
  "Invite link not found": "linkMissing",
  "This invite link has been disabled": "linkDisabled",
  "This invite link has expired": "linkExpired",
  "This invite link has reached its maximum uses": "linkLimit",
  "This organization has reached its member limit. Ask the admin to add more seats.": "memberLimit",
  "This invitation has expired": "invitationExpired",
  "Invalid token": "invalidToken",
  "Token required": "tokenRequired",
  "Only administrators can create organizations": "orgAdminOnly",
  "Slug already taken": "slugTaken",
  "Organization not found": "orgMissing",
  "Cannot unlink your last authentication method": "lastAuthenticationMethod",
  "This invitation has been accepted": "accepted",
  "This invitation has been rejected": "rejected",
  "This invitation has been cancelled": "cancelled",
  "This invitation has been revoked": "revoked",
  "This invitation has been expired": "expired",
};

export class AuthPresentationError extends Error {}

export function authErrorMessage(t: Translate, message: unknown, fallback: string, status?: number): string {
  if (typeof message === "string") {
    const key = Object.hasOwn(errorKeys, message) ? errorKeys[message] : undefined;
    if (key) return t(key);
    const sentTo = /^This invitation was sent to (.+)\. Please sign in with that email\.$/.exec(message);
    if (sentTo) return t("sentTo", { email: sentTo[1] });
    const limit = /^You've reached the limit of ([1-9]\d*) organizations?\. Upgrade your plan to create more\.$/.exec(message);
    if (limit && Number.isSafeInteger(Number(limit[1]))) return t("organizationLimit", { count: Number(limit[1]) });
  }
  return status === 400 || status === 422 ? t("invalidInput") : fallback;
}
