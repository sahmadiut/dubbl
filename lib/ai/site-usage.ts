import { assertSiteSession, type SiteSessionContext } from "@/lib/api/require-site-admin";
import { readUsageGroups, siteUsageFilterSchema, siteUsagePageSchema, USAGE_EXPORT_GROUP_LIMIT } from "./usage-reports";

async function report(ctx: SiteSessionContext, input: unknown, exporting: boolean) {
  await assertSiteSession(ctx);
  const value = exporting ? { ...siteUsageFilterSchema.parse(input), page: 1, pageSize: USAGE_EXPORT_GROUP_LIMIT } : siteUsagePageSchema.parse(input);
  const result = await readUsageGroups(value, exporting, true);
  await assertSiteSession(ctx);
  const { page, pageSize, ...filters } = value;
  return {
    scope: "site" as const, filters, costsAreEstimates: true, costUnit: "major-billing-currency-decimal", tokensAreObservedPartialSums: true,
    ...result,
    ...(exporting ? { format: "json", exportGroupLimit: USAGE_EXPORT_GROUP_LIMIT, complete: true } : {
      page, pageSize, hasNextPage: BigInt(page) * BigInt(pageSize) < BigInt(result.totalGroups),
    }),
  };
}

export const siteUsageReportPage = (ctx: SiteSessionContext, input: unknown) => report(ctx, input, false);
export const exportSiteUsageReport = (ctx: SiteSessionContext, input: unknown) => report(ctx, input, true);
