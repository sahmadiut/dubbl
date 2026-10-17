import type { useTranslations } from "next-intl";

type StripeTranslate = ReturnType<typeof useTranslations<"SettingsStripe">>;

// OAuth query parameters and status IDs remain provider contracts, never keys
// supplied by the server or URL. Unknown values use reviewed product copy.
export function stripeOAuthError(t: StripeTranslate, code: string): string {
  switch (code) {
    case "account_already_connected": return t("thisStripeAccountIsAlreadyConnected");
    case "missing_params": return t("missingOAuthParameters");
    case "invalid_state": return t("invalidOAuthState");
    case "oauth_failed": return t("oAuthAuthorizationFailed");
    case "server_error": return t("anUnexpectedErrorOccurred");
    default: return t("connectionFailed");
  }
}

export function stripeStatusLabel(t: StripeTranslate, status: string | undefined): string {
  switch (status) {
    case "active": return t("active");
    case "error": return t("error");
    case "disconnected": return t("disconnected");
    default: return t("unknownStatus");
  }
}
