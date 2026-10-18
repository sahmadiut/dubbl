import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AuthContext } from "@/lib/api/auth-context";
import { wrapTool } from "@/lib/mcp/errors";
import { getLocalePreferences, updateLocalePreferences } from "@/lib/api/locale-preferences";
import { localePreferencesSchema } from "@/i18n/preferences-schema";

export function registerLocalePreferencesTools(server: McpServer, ctx: AuthContext) {
  server.registerTool("get_locale_preferences", {
    description: "Get the authenticated user's global presentation preferences in the current organization membership context. Returns {preferences: {language, timeZone, numerals, calendar, fontFamily}}; null values inherit defaults. Contains no money or currency settings.",
    inputSchema: z.object({}).strict(),
  }, () => wrapTool(ctx, () => getLocalePreferences(ctx)));
  server.registerTool("update_locale_preferences", {
    description: "Update only the authenticated user's global presentation preferences, requiring current organization membership. Supply at least one field; null clears an override. Returns {preferences}. Does not change URLs, stored dates, currency or amounts. Organization defaultLanguage is set separately with update_organization.",
    inputSchema: localePreferencesSchema,
  }, input => wrapTool(ctx, () => updateLocalePreferences(ctx, input)));
}
