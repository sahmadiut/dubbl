import type { useTranslations } from "next-intl";
import { settingsErrorMessage, SettingsRequestError } from "@/i18n/settings-errors";

/** Inspect failures without consuming successful JSON, HTML or PDF bodies. */
export async function requireTemplateResponse(
  response: Response,
  errors: ReturnType<typeof useTranslations<"SettingsErrors">>,
  fallback: string,
) {
  if (!response.ok) {
    let message: unknown;
    try { message = (await response.json()).error; } catch { /* Use the operation fallback. */ }
    throw new SettingsRequestError(settingsErrorMessage(errors, message, fallback, response.status));
  }
  return response;
}

export function templateFailureMessage(error: unknown, fallback: string) {
  return error instanceof SettingsRequestError ? error.message : fallback;
}
